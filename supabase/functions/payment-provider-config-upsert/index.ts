// Payment Provider Config Upsert Edge Function
// EPF-03R Remediation
//
// Admin-only endpoint to create or update tenant provider configurations.
// Credentials and webhook secrets are stored in Supabase Vault inside the
// atomic database RPC (resident.upsert_provider_config). The Edge Function
// never returns raw Vault secret UUIDs to the frontend.

import { buildCorsHeaders, jsonError, jsonOk, requestIdFromHeaders } from '../_shared/http.ts';
import { createAdminClient, createAuthClient } from '../_shared/payment/crypto.ts';
import type { PaymentMethodType, PaymentProviderEnvironment, PaymentProviderId } from '../_shared/payment/types.ts';

interface UpsertProviderConfigInput {
  id?: string;
  tenantId: string;
  providerId: PaymentProviderId;
  environment?: PaymentProviderEnvironment;
  methodType: PaymentMethodType;
  isActive?: boolean;
  isDefault?: boolean;
  agreementNumber?: string;
  wallet?: string;
  portfolio?: string;
  bankAccount?: Record<string, unknown>;
  pixKeys?: Record<string, unknown>;
  credentials?: string;
  webhookSecret?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(request.headers.get('origin')) });
  }

  if (request.method !== 'POST' && request.method !== 'PUT') {
    return jsonError('n/a', 'VALIDATION_ERROR', 'Method not allowed. Use POST or PUT.', 405, { headers: buildCorsHeaders(request.headers.get('origin')) });
  }

  const requestId = requestIdFromHeaders(request.headers);
  const headers = buildCorsHeaders(request.headers.get('origin'));
  const authClient = createAuthClient(request);
  const adminClient = createAdminClient();

  const { data: userData, error: authError } = await authClient.auth.getUser();
  if (authError || !userData.user) {
    return jsonError(requestId, 'UNAUTHENTICATED', 'Sessao invalida ou expirada.', 401, { headers });
  }

  let body: UpsertProviderConfigInput;
  try {
    body = await request.json() as UpsertProviderConfigInput;
  } catch {
    return jsonError(requestId, 'VALIDATION_ERROR', 'Invalid JSON body.', 422, { headers });
  }

  if (!body.tenantId || !body.providerId || !body.methodType) {
    return jsonError(requestId, 'VALIDATION_ERROR', 'tenantId, providerId and methodType are required.', 422, { headers });
  }

  // Require payment write permission for the target tenant
  const { data: hasPermission } = await authClient.rpc('has_tenant_permission', {
    target_tenant_id: body.tenantId,
    target_permission: 'payments:write',
  });

  if (!hasPermission) {
    return jsonError(requestId, 'FORBIDDEN', 'Permissao insuficiente.', 403, { headers });
  }

  try {
    const { data: result, error: rpcError } = await adminClient.rpc('upsert_provider_config', {
      p_tenant_id: body.tenantId,
      p_config_id: body.id ?? null,
      p_provider_id: body.providerId,
      p_environment: body.environment ?? 'sandbox',
      p_method_type: body.methodType,
      p_is_active: body.isActive ?? true,
      p_is_default: body.isDefault ?? false,
      p_agreement_number: body.agreementNumber ?? null,
      p_wallet: body.wallet ?? null,
      p_portfolio: body.portfolio ?? null,
      p_bank_account: body.bankAccount ?? {},
      p_pix_keys: body.pixKeys ?? {},
      p_credentials: body.credentials ?? null,
      p_webhook_secret: body.webhookSecret ?? null,
      p_metadata: body.metadata ?? {},
      p_actor_profile_id: null,
    });

    if (rpcError) {
      if (rpcError.message.includes('unique_violation') || rpcError.message.includes('unique constraint')) {
        return jsonError(requestId, 'CONFLICT', 'Ja existe uma configuracao padrao ativa para este metodo e ambiente.', 409, { headers });
      }
      return jsonError(requestId, 'INTERNAL_ERROR', rpcError.message, 500, { headers });
    }

    return jsonOk(requestId, { config: result }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal config error';
    return jsonError(requestId, 'INTERNAL_ERROR', message, 500, { headers });
  }
});
