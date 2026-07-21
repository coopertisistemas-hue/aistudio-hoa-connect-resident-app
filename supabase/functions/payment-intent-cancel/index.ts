// Payment Intent Cancel Edge Function
// EPF-03 Payment Processing Platform
//
// Cancels a pending payment intent through the provider and updates status.

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

  let body: { paymentIntentId: string };
  try {
    body = await request.json() as { paymentIntentId: string };
  } catch {
    return jsonError(requestId, 'VALIDATION_ERROR', 'Invalid JSON body.', 422, { headers });
  }

  if (!body.paymentIntentId) {
    return jsonError(requestId, 'VALIDATION_ERROR', 'paymentIntentId is required.', 422, { headers });
  }

  try {
    const { data: intent, error: intentError } = await adminClient
      .from('payment_intents')
      .select('*')
      .eq('id', body.paymentIntentId)
      .single();

    if (intentError || !intent) {
      return jsonError(requestId, 'NOT_FOUND', 'Payment intent nao encontrado.', 404, { headers });
    }

    // Verify caller has payment write permission for the tenant
    const { data: hasPermission } = await authClient.rpc('has_tenant_permission', {
      target_tenant_id: intent.tenant_id as string,
      target_permission: 'payments:write',
    });
    if (!hasPermission) {
      return jsonError(requestId, 'FORBIDDEN', 'Permissao insuficiente.', 403, { headers });
    }

    if (intent.status !== 'pending' && intent.status !== 'processing') {
      return jsonError(requestId, 'CONFLICT', `Payment intent nao pode ser cancelado em status ${intent.status}.`, 409, { headers });
    }

    const { data: configRow } = await adminClient
      .from('tenant_payment_provider_configs')
      .select('*')
      .eq('id', intent.provider_config_id)
      .single();

    if (configRow) {
      const config = mapConfig(configRow);
      const provider = createConfiguredProvider(config);
      await provider.cancel(intent.provider_payment_intent_id as string);
    }

    const { error: updateError } = await adminClient
      .from('payment_intents')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', body.paymentIntentId);

    if (updateError) {
      return jsonError(requestId, 'INTERNAL_ERROR', updateError.message, 500, { headers });
    }

    const { data: updated } = await adminClient
      .from('payment_intents')
      .select('*')
      .eq('id', body.paymentIntentId)
      .single();

    return jsonOk(requestId, { paymentIntent: updated }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal cancel error';
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
