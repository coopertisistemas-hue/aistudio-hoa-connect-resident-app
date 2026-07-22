// Payment Refund Edge Function
// EPF-03R Remediation
//
// Processes a full or partial refund for a confirmed payment transaction.
//
// The database portion is an atomic finalization RPC (process_payment_refund).
// The external provider call is an idempotent distributed operation. If the
// provider succeeds and local finalization fails, the operation remains
// recoverable by retrying finalization with the same provider refund id.

import { buildCorsHeaders, jsonError, jsonOk, requestIdFromHeaders } from '../_shared/http.ts';
import { createAdminClient, createAuthClient } from '../_shared/payment/crypto.ts';
import { createConfiguredProvider } from '../_shared/payment/registry.ts';
import type { PaymentProviderId, TenantProviderConfig } from '../_shared/payment/types.ts';

interface RefundInput {
  transactionId: string;
  amount?: number;
  idempotencyKey?: string;
  reason?: string;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(request.headers.get('origin')) });
  }

  if (request.method !== 'POST') {
    return jsonError('n/a', 'VALIDATION_ERROR', 'Method not allowed. Use POST.', 405, { headers: buildCorsHeaders(request.headers.get('origin')) });
  }

  const requestId = requestIdFromHeaders(request.headers);
  const headers = buildCorsHeaders(request.headers.get('origin'));
  const authClient = createAuthClient(request);
  const adminClient = createAdminClient();

  const { data: userData, error: authError } = await authClient.auth.getUser();
  if (authError || !userData.user) {
    return jsonError(requestId, 'UNAUTHENTICATED', 'Sessao invalida ou expirada.', 401, { headers });
  }

  let body: RefundInput;
  try {
    body = await request.json() as RefundInput;
  } catch {
    return jsonError(requestId, 'VALIDATION_ERROR', 'Invalid JSON body.', 422, { headers });
  }

  if (!body.transactionId) {
    return jsonError(requestId, 'VALIDATION_ERROR', 'transactionId is required.', 422, { headers });
  }

  const idempotencyKey = body.idempotencyKey?.trim() || `refund-${body.transactionId}-${crypto.randomUUID()}`;
  if (idempotencyKey.length < 8) {
    return jsonError(requestId, 'VALIDATION_ERROR', 'idempotencyKey must be at least 8 characters.', 422, { headers });
  }

  try {
    // Load transaction (service-role to bypass RLS and ensure integrity).
    const { data: transaction, error: txError } = await adminClient
      .from('payment_transactions')
      .select('*')
      .eq('id', body.transactionId)
      .single();

    if (txError || !transaction) {
      return jsonError(requestId, 'NOT_FOUND', 'Transacao nao encontrada.', 404, { headers });
    }

    if (transaction.status !== 'confirmed' && transaction.status !== 'partially_confirmed') {
      return jsonError(requestId, 'CONFLICT', 'Apenas transacoes confirmadas podem ser estornadas.', 409, { headers });
    }

    // Permission check.
    const { data: hasPermission } = await authClient.rpc('has_tenant_permission', {
      target_tenant_id: transaction.tenant_id as string,
      target_permission: 'payments:write',
    });

    if (!hasPermission) {
      return jsonError(requestId, 'FORBIDDEN', 'Permissao insuficiente.', 403, { headers });
    }

    const refundAmount = body.amount ?? Number(transaction.amount);
    if (refundAmount <= 0) {
      return jsonError(requestId, 'VALIDATION_ERROR', 'Valor de estorno invalido.', 422, { headers });
    }

    // Step 1: create pending refund operation and validate remaining amount.
    const { data: prepareResult, error: prepareError } = await adminClient.rpc('process_payment_refund', {
      p_tenant_id: transaction.tenant_id as string,
      p_payment_transaction_id: body.transactionId,
      p_amount: refundAmount,
      p_idempotency_key: idempotencyKey,
      p_provider_refund_id: null,
      p_raw_provider_response: null,
      p_actor_profile_id: null,
    });

    if (prepareError) {
      if (prepareError.message.includes('exceeds remaining refundable amount')) {
        return jsonError(requestId, 'VALIDATION_ERROR', 'Valor de estorno excede o valor remanescente.', 422, { headers });
      }
      return jsonError(requestId, 'INTERNAL_ERROR', prepareError.message, 500, { headers });
    }

    const prepare = (prepareResult as Record<string, unknown> | null) ?? {};
    if (prepare.status === 'confirmed') {
      return jsonOk(requestId, { refund: prepare }, { headers });
    }

    // Step 2: idempotent provider refund call.
    const { data: configRow } = await adminClient
      .from('tenant_payment_provider_configs')
      .select('*')
      .eq('id', transaction.provider_config_id as string)
      .eq('tenant_id', transaction.tenant_id as string)
      .single();

    let providerRefundId = 'unknown';
    let rawProviderResponse: Record<string, unknown> = {};

    if (configRow) {
      const config = mapConfig(configRow);
      const provider = createConfiguredProvider(config);
      const refundResult = await provider.refund({
        transactionId: body.transactionId,
        providerTransactionId: transaction.provider_transaction_id as string,
        amount: refundAmount,
        metadata: { idempotencyKey, reason: body.reason },
      });
      providerRefundId = refundResult.providerRefundId;
      rawProviderResponse = refundResult as unknown as Record<string, unknown>;
    } else {
      return jsonError(requestId, 'NOT_FOUND', 'Configuracao do provedor nao encontrada.', 404, { headers });
    }

    // Step 3: atomic database finalization.
    const { data: finalizeResult, error: finalizeError } = await adminClient.rpc('process_payment_refund', {
      p_tenant_id: transaction.tenant_id as string,
      p_payment_transaction_id: body.transactionId,
      p_amount: refundAmount,
      p_idempotency_key: idempotencyKey,
      p_provider_refund_id: providerRefundId,
      p_raw_provider_response: rawProviderResponse,
      p_actor_profile_id: null,
    });

    if (finalizeError) {
      return jsonError(requestId, 'INTERNAL_ERROR', finalizeError.message, 500, { headers });
    }

    return jsonOk(requestId, { refund: finalizeResult }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal refund error';
    return jsonError(requestId, 'INTERNAL_ERROR', message, 500, { headers });
  }
});

function mapConfig(row: Record<string, unknown>): TenantProviderConfig {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    providerId: row.provider_id as PaymentProviderId,
    environment: row.environment as 'sandbox' | 'production',
    methodType: row.method_type as never,
    isActive: row.is_active as boolean,
    isDefault: row.is_default as boolean,
    agreementNumber: row.agreement_number as string | undefined,
    wallet: row.wallet as string | undefined,
    portfolio: row.portfolio as string | undefined,
    bankAccount: row.bank_account as Record<string, unknown> | undefined,
    pixKeys: row.pix_keys as Record<string, unknown> | undefined,
    credentialsSecretId: row.credentials_secret_id as string | undefined,
    webhookSecretId: row.webhook_secret_id as string | undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}
