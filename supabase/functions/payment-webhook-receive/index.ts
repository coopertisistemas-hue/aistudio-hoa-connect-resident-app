// Payment Webhook Receive Edge Function
// EPF-03 Payment Processing Platform
//
// Receives webhooks from payment providers.
// Signature validation is performed by the provider adapter and the atomic
// database function. All financial side-effects occur inside a single
// transaction in process_payment_webhook.

import { buildCorsHeaders, jsonError, jsonOk, requestIdFromHeaders } from '../_shared/http.ts';
import { createAdminClient, getVaultSecret } from '../_shared/payment/crypto.ts';
import { createConfiguredProvider } from '../_shared/payment/registry.ts';
import type { PaymentProviderId, TenantProviderConfig, WebhookValidationResult } from '../_shared/payment/types.ts';

interface WebhookReceiveInput {
  provider: PaymentProviderId;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signatureHeader?: string;
  replayNonce?: string;
  replayTimestamp?: string;
  tenantId?: string;
  providerConfigId?: string;
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
  const adminClient = createAdminClient();

  let body: WebhookReceiveInput;
  try {
    body = await request.json() as WebhookReceiveInput;
  } catch {
    return jsonError(requestId, 'VALIDATION_ERROR', 'Invalid JSON body.', 422, { headers });
  }

  if (!body.provider || !body.eventId || !body.eventType || !body.payload) {
    return jsonError(requestId, 'VALIDATION_ERROR', 'provider, eventId, eventType and payload are required.', 422, { headers });
  }

  try {
    // Resolve provider configuration
    let config: TenantProviderConfig | null = null;
    if (body.providerConfigId) {
      const { data: row } = await adminClient
        .from('tenant_payment_provider_configs')
        .select('*')
        .eq('id', body.providerConfigId)
        .single();
      if (row) {
        config = mapConfig(row);
      }
    } else if (body.tenantId) {
      const { data: rows } = await adminClient
        .from('tenant_payment_provider_configs')
        .select('*')
        .eq('tenant_id', body.tenantId)
        .eq('provider_id', body.provider)
        .eq('is_active', true)
        .limit(1);
      if (rows && rows.length > 0) {
        config = mapConfig(rows[0]);
      }
    }

    if (!config) {
      return jsonError(requestId, 'NOT_FOUND', 'Provider configuration not found.', 404, { headers });
    }

    const provider = createConfiguredProvider(config);
    const rawPayload = JSON.stringify(body.payload);

    // Validate webhook signature if a secret is configured
    let validation: WebhookValidationResult | undefined;
    if (config.webhookSecretId) {
      const secret = await getVaultSecret(adminClient, config.webhookSecretId);
      if (secret) {
        validation = await provider.validateWebhook({
          payload: rawPayload,
          signatureHeader: body.signatureHeader,
          secret,
          nonce: body.replayNonce,
          timestamp: body.replayTimestamp,
        });
      }
    }

    // Atomic webhook processing in the database
    const { data: result, error: rpcError } = await adminClient.rpc('process_payment_webhook', {
      p_tenant_id: config.tenantId,
      p_provider: body.provider,
      p_event_id: body.eventId,
      p_event_type: body.eventType,
      p_payload: body.payload,
      p_signature_header: body.signatureHeader ?? null,
      p_replay_nonce: body.replayNonce ?? null,
      p_replay_timestamp: body.replayTimestamp ?? null,
      p_actor_profile_id: null,
    });

    if (rpcError) {
      return jsonError(requestId, 'INTERNAL_ERROR', rpcError.message, 500, { headers });
    }

    return jsonOk(requestId, {
      result,
      validation,
    }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal webhook error';
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
