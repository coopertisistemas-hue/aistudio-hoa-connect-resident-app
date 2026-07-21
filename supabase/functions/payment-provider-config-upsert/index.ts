// Payment Provider Config Upsert Edge Function
// EPF-03 Payment Processing Platform
//
// Admin-only endpoint to create or update tenant provider configurations.
// Credentials and webhook secrets are stored in Supabase Vault.
// Only non-sensitive configuration is persisted in application tables.

import { buildCorsHeaders, jsonError, jsonOk, requestIdFromHeaders } from '../_shared/http.ts';
import { createAdminClient, createAuthClient, createVaultSecret, updateVaultSecret } from '../_shared/payment/crypto.ts';
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
    // Resolve existing config to preserve secret ids
    let credentialsSecretId: string | undefined;
    let webhookSecretId: string | undefined;

    if (body.id) {
      const { data: existing } = await adminClient
        .from('tenant_payment_provider_configs')
        .select('credentials_secret_id, webhook_secret_id')
        .eq('id', body.id)
        .single();

      if (existing) {
        credentialsSecretId = existing.credentials_secret_id as string | undefined;
        webhookSecretId = existing.webhook_secret_id as string | undefined;
      }
    }

    // Store/update credentials in Vault
    if (body.credentials) {
      if (credentialsSecretId) {
        await updateVaultSecret(adminClient, credentialsSecretId, body.credentials);
      } else {
        const ref = await createVaultSecret(
          adminClient,
          body.credentials,
          `provider-config-${body.providerId}-${body.tenantId}-credentials`,
        );
        credentialsSecretId = ref.id;
      }
    }

    // Store/update webhook secret in Vault
    if (body.webhookSecret) {
      if (webhookSecretId) {
        await updateVaultSecret(adminClient, webhookSecretId, body.webhookSecret);
      } else {
        const ref = await createVaultSecret(
          adminClient,
          body.webhookSecret,
          `provider-config-${body.providerId}-${body.tenantId}-webhook`,
        );
        webhookSecretId = ref.id;
      }
    }

    // Upsert config row (without sensitive values)
    const configRow = {
      tenant_id: body.tenantId,
      provider_id: body.providerId,
      environment: body.environment ?? 'sandbox',
      method_type: body.methodType,
      is_active: body.isActive ?? true,
      is_default: body.isDefault ?? false,
      agreement_number: body.agreementNumber ?? null,
      wallet: body.wallet ?? null,
      portfolio: body.portfolio ?? null,
      bank_account: body.bankAccount ?? {},
      pix_keys: body.pixKeys ?? {},
      credentials_secret_id: credentialsSecretId ?? null,
      webhook_secret_id: webhookSecretId ?? null,
      metadata: body.metadata ?? {},
    };

    const { data: upserted, error: upsertError } = body.id
      ? await adminClient
        .from('tenant_payment_provider_configs')
        .update(configRow)
        .eq('id', body.id)
        .select()
        .single()
      : await adminClient
        .from('tenant_payment_provider_configs')
        .insert(configRow)
        .select()
        .single();

    if (upsertError || !upserted) {
      return jsonError(requestId, 'INTERNAL_ERROR', upsertError?.message ?? 'Erro ao salvar configuracao.', 500, { headers });
    }

    // Return sanitized config
    return jsonOk(requestId, {
      config: {
        id: upserted.id,
        tenantId: upserted.tenant_id,
        providerId: upserted.provider_id,
        environment: upserted.environment,
        methodType: upserted.method_type,
        isActive: upserted.is_active,
        isDefault: upserted.is_default,
        agreementNumber: upserted.agreement_number,
        wallet: upserted.wallet,
        portfolio: upserted.portfolio,
        bankAccount: upserted.bank_account,
        pixKeys: upserted.pix_keys,
        credentialsSecretId: upserted.credentials_secret_id,
        webhookSecretId: upserted.webhook_secret_id,
        metadata: upserted.metadata,
      },
    }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal config error';
    return jsonError(requestId, 'INTERNAL_ERROR', message, 500, { headers });
  }
});
