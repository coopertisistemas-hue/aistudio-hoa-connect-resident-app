// Payment Provider Config List Edge Function
// EPF-03 Payment Processing Platform
//
// Lists provider registry, capabilities, and tenant configurations.
// Does not expose decrypted secrets.

import { buildCorsHeaders, jsonError, jsonOk, requestIdFromHeaders } from '../_shared/http.ts';
import { createAdminClient, createAuthClient } from '../_shared/payment/crypto.ts';
import type { PaymentProviderCapability } from '../_shared/payment/types.ts';

interface ListRequest {
  tenantId?: string;
  providerId?: string;
  methodType?: string;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(request.headers.get('origin')) });
  }

  if (request.method !== 'POST' && request.method !== 'GET') {
    return jsonError('n/a', 'VALIDATION_ERROR', 'Method not allowed. Use GET or POST.', 405, { headers: buildCorsHeaders(request.headers.get('origin')) });
  }

  const requestId = requestIdFromHeaders(request.headers);
  const headers = buildCorsHeaders(request.headers.get('origin'));
  const authClient = createAuthClient(request);
  const adminClient = createAdminClient();

  const { data: userData, error: authError } = await authClient.auth.getUser();
  if (authError || !userData.user) {
    return jsonError(requestId, 'UNAUTHENTICATED', 'Sessao invalida ou expirada.', 401, { headers });
  }

  let body: ListRequest = {};
  if (request.method === 'POST') {
    try {
      body = await request.json() as ListRequest;
    } catch {
      return jsonError(requestId, 'VALIDATION_ERROR', 'Invalid JSON body.', 422, { headers });
    }
  }

  if (!body.tenantId) {
    return jsonError(requestId, 'VALIDATION_ERROR', 'tenantId is required.', 422, { headers });
  }

  const { data: hasPermission } = await authClient.rpc('has_tenant_permission', {
    target_tenant_id: body.tenantId,
    target_permission: 'payments:read',
  });

  if (!hasPermission) {
    return jsonError(requestId, 'FORBIDDEN', 'Permissao insuficiente.', 403, { headers });
  }

  try {
    // Fetch providers
    let providersQuery = adminClient
      .from('payment_providers')
      .select('*')
      .eq('is_active', true);
    if (body.providerId) {
      providersQuery = providersQuery.eq('id', body.providerId);
    }
    const { data: providers, error: providersError } = await providersQuery;
    if (providersError) {
      return jsonError(requestId, 'INTERNAL_ERROR', providersError.message, 500, { headers });
    }

    // Fetch capabilities
    const { data: capabilities, error: capabilitiesError } = await adminClient
      .from('payment_provider_capabilities')
      .select('*')
      .eq('is_active', true);
    if (capabilitiesError) {
      return jsonError(requestId, 'INTERNAL_ERROR', capabilitiesError.message, 500, { headers });
    }

    // Fetch tenant configs (sanitized). Vault secret UUIDs are mapped to booleans.
    let configsQuery = adminClient
      .from('tenant_payment_provider_configs')
      .select('id, tenant_id, provider_id, environment, method_type, is_active, is_default, agreement_number, wallet, portfolio, bank_account, pix_keys, metadata, created_at, updated_at, credentials_secret_id, webhook_secret_id');
    if (body.tenantId) {
      configsQuery = configsQuery.eq('tenant_id', body.tenantId);
    }
    if (body.providerId) {
      configsQuery = configsQuery.eq('provider_id', body.providerId);
    }
    if (body.methodType) {
      configsQuery = configsQuery.eq('method_type', body.methodType);
    }
    const { data: configs, error: configsError } = await configsQuery;
    if (configsError) {
      return jsonError(requestId, 'INTERNAL_ERROR', configsError.message, 500, { headers });
    }

    return jsonOk(requestId, {
      providers: providers ?? [],
      capabilities: (capabilities ?? []).map((c) => ({
        providerId: c.provider_id,
        capability: c.capability as PaymentProviderCapability,
      })),
      configs: (configs ?? []).map((c) => ({
        id: c.id,
        tenantId: c.tenant_id,
        providerId: c.provider_id,
        environment: c.environment,
        methodType: c.method_type,
        isActive: c.is_active,
        isDefault: c.is_default,
        agreementNumber: c.agreement_number,
        wallet: c.wallet,
        portfolio: c.portfolio,
        bankAccount: c.bank_account,
        pixKeys: c.pix_keys,
        metadata: c.metadata,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        hasCredentials: Boolean(c.credentials_secret_id),
        hasWebhookSecret: Boolean(c.webhook_secret_id),
      })),
    }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal list error';
    return jsonError(requestId, 'INTERNAL_ERROR', message, 500, { headers });
  }
});
