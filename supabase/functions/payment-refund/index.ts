// Payment Refund Edge Function
// EPF-03 Payment Processing Platform
//
// Processes a refund for a confirmed payment transaction.
// Supports full and partial refunds.

import { buildCorsHeaders, jsonError, jsonOk, requestIdFromHeaders } from '../_shared/http.ts';
import { createAdminClient, createAuthClient } from '../_shared/payment/crypto.ts';
import { createConfiguredProvider } from '../_shared/payment/registry.ts';
import type { PaymentProviderId, TenantProviderConfig } from '../_shared/payment/types.ts';

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

  let body: { transactionId: string; amount?: number };
  try {
    body = await request.json() as { transactionId: string; amount?: number };
  } catch {
    return jsonError(requestId, 'VALIDATION_ERROR', 'Invalid JSON body.', 422, { headers });
  }

  if (!body.transactionId) {
    return jsonError(requestId, 'VALIDATION_ERROR', 'transactionId is required.', 422, { headers });
  }

  try {
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

    // Refund is a staff operation
    const { data: hasPermission } = await authClient.rpc('has_tenant_permission', {
      target_tenant_id: transaction.tenant_id as string,
      target_permission: 'payments:write',
    });

    if (!hasPermission) {
      return jsonError(requestId, 'FORBIDDEN', 'Permissao insuficiente.', 403, { headers });
    }

    const refundAmount = body.amount ?? Number(transaction.amount);
    if (refundAmount <= 0 || refundAmount > Number(transaction.amount)) {
      return jsonError(requestId, 'VALIDATION_ERROR', 'Valor de estorno invalido.', 422, { headers });
    }

    const { data: configRow } = await adminClient
      .from('tenant_payment_provider_configs')
      .select('*')
      .eq('id', transaction.provider_config_id)
      .single();

    if (configRow) {
      const config = mapConfig(configRow);
      const provider = createConfiguredProvider(config);
      await provider.refund({
        transactionId: body.transactionId,
        providerTransactionId: transaction.provider_transaction_id as string,
        amount: refundAmount,
      });
    }

    const newStatus = refundAmount < Number(transaction.amount) ? 'partially_refunded' : 'refunded';
    const { error: updateError } = await adminClient
      .from('payment_transactions')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', body.transactionId);

    if (updateError) {
      return jsonError(requestId, 'INTERNAL_ERROR', updateError.message, 500, { headers });
    }

    const { data: updated } = await adminClient
      .from('payment_transactions')
      .select('*')
      .eq('id', body.transactionId)
      .single();

    return jsonOk(requestId, { transaction: updated, refundAmount }, { headers });
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
