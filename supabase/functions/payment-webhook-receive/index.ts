// Payment Webhook Receive Edge Function
// EPF-03R Remediation
//
// Receives webhooks from payment providers at a URL-scoped endpoint identifier.
// The endpoint identifier is public routing data only; the request must still
// present a valid cryptographic signature, a timestamp inside the accepted
// window, and a fresh replay nonce.
//
// Flow:
// 1. Parse the public endpoint identifier from the URL path.
// 2. Resolve the trusted server-side registration via resolve_webhook_endpoint.
// 3. Verify the registration and provider configuration are active.
// 4. Load the Vault-backed webhook secret via service role.
// 5. Validate signature, timestamp and nonce through the provider adapter.
// 6. Reject with 401 before any financial mutation if validation fails.
// 7. Invoke the atomic database RPC process_payment_webhook with the trusted
//    endpoint identifier and validation results.

import { buildCorsHeaders, jsonError, jsonOk, requestIdFromHeaders } from '../_shared/http.ts';
import { createAdminClient, getVaultSecret } from '../_shared/payment/crypto.ts';
import { createConfiguredProvider } from '../_shared/payment/registry.ts';
import type { PaymentProviderId, TenantProviderConfig } from '../_shared/payment/types.ts';

interface WebhookEndpoint {
  tenant_id: string;
  provider_id: string;
  provider_config_id: string;
  environment: 'sandbox' | 'production';
  is_active: boolean;
  config_is_active: boolean;
  webhook_secret_id: string | null;
  event_types: string[] | null;
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

  let rawBody: string;
  let body: Record<string, unknown>;
  try {
    rawBody = await request.text();
    body = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
  } catch {
    return jsonError(requestId, 'VALIDATION_ERROR', 'Invalid JSON body.', 422, { headers });
  }

  try {
    // 1. Public endpoint identifier from URL path.
    const endpointId = parseWebhookEndpointId(request.url);
    if (!endpointId) {
      return jsonError(requestId, 'VALIDATION_ERROR', 'Missing webhook endpoint identifier in URL path.', 422, { headers });
    }

    // 2. Resolve trusted registration.
    const { data: endpointRows, error: resolveError } = await adminClient.rpc('resolve_webhook_endpoint', {
      p_endpoint_id: endpointId,
    });

    if (resolveError) {
      return jsonError(requestId, 'INTERNAL_ERROR', 'Unable to resolve webhook endpoint.', 500, { headers });
    }

    const endpoint = Array.isArray(endpointRows) && endpointRows.length > 0
      ? endpointRows[0] as WebhookEndpoint
      : null;

    if (!endpoint) {
      return jsonError(requestId, 'NOT_FOUND', 'Webhook endpoint not found.', 404, { headers });
    }

    if (!endpoint.is_active || !endpoint.config_is_active) {
      return jsonError(requestId, 'FORBIDDEN', 'Webhook endpoint or provider configuration is inactive.', 403, { headers });
    }

    const providerId = endpoint.provider_id as PaymentProviderId;

    // 3. Extract provider payload fields.
    const eventId = extractString(body, ['event_id', 'eventId']);
    const eventType = extractString(body, ['event_type', 'eventType']);
    const signatureHeader = extractStringFromHeadersOrBody(request.headers, body, [
      'x-webhook-signature',
      'X-Webhook-Signature',
    ], ['signature', 'signatureHeader']);
    const replayNonce = extractStringFromHeadersOrBody(request.headers, body, [
      'x-replay-nonce',
      'X-Replay-Nonce',
    ], ['nonce', 'replayNonce']);
    const replayTimestamp = extractStringFromHeadersOrBody(request.headers, body, [
      'x-replay-timestamp',
      'X-Replay-Timestamp',
    ], ['timestamp', 'replayTimestamp']);

    if (!eventId || !eventType) {
      return jsonError(requestId, 'VALIDATION_ERROR', 'eventId and eventType are required.', 422, { headers });
    }

    // 4. Load webhook secret and validate through provider adapter.
    let signatureStatus = 'not_applicable';
    let replayStatus = 'not_applicable';
    let validationError: string | null = null;

    const provider = createConfiguredProvider(mapConfig(endpoint));

    if (endpoint.webhook_secret_id) {
      const secret = await getVaultSecret(adminClient, endpoint.webhook_secret_id);
      if (!secret) {
        return jsonError(requestId, 'INTERNAL_ERROR', 'Webhook secret not available.', 500, { headers });
      }

      const validation = await provider.validateWebhook({
        payload: rawBody,
        signatureHeader,
        secret,
        nonce: replayNonce,
        timestamp: replayTimestamp,
      });

      signatureStatus = validation.signatureStatus;
      replayStatus = validation.replayStatus;

      if (!validation.valid) {
        validationError = validation.signatureStatus === 'invalid'
          ? 'Webhook signature invalid.'
          : `Replay protection rejected: ${validation.replayStatus}.`;
      }
    } else if (provider.supportsCapability('webhooks')) {
      // Provider declares webhooks but no secret is configured.
      return jsonError(requestId, 'FORBIDDEN', 'Webhook signature secret not configured.', 403, { headers });
    }

    // 5. Reject before financial mutation if signature/replay is invalid.
    if (validationError) {
      return jsonError(requestId, 'UNAUTHORIZED', validationError, 401, { headers });
    }

    // 6. Atomic database processing.
    const { data: result, error: rpcError } = await adminClient.rpc('process_payment_webhook', {
      p_webhook_endpoint_id: endpointId,
      p_provider: providerId,
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: body,
      p_signature_status: signatureStatus,
      p_replay_status: replayStatus,
      p_signature_header: signatureHeader ?? null,
      p_replay_nonce: replayNonce ?? null,
      p_replay_timestamp: replayTimestamp ?? null,
      p_actor_profile_id: null,
    });

    if (rpcError) {
      return jsonError(requestId, 'INTERNAL_ERROR', rpcError.message, 500, { headers });
    }

    return jsonOk(requestId, { result }, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal webhook error';
    return jsonError(requestId, 'INTERNAL_ERROR', message, 500, { headers });
  }
});

function parseWebhookEndpointId(url: string): string | null {
  const path = new URL(url).pathname;
  const match = path.match(/\/payment-webhook-receive\/([0-9a-fA-F-]{36})$/);
  return match?.[1] ?? null;
}

function extractString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return null;
}

function extractStringFromHeadersOrBody(
  headers: Headers,
  body: Record<string, unknown>,
  headerKeys: string[],
  bodyKeys: string[],
): string | null {
  for (const key of headerKeys) {
    const value = headers.get(key);
    if (value && value !== '') {
      return value;
    }
  }
  return extractString(body, bodyKeys);
}

function mapConfig(endpoint: WebhookEndpoint): TenantProviderConfig {
  return {
    id: endpoint.provider_config_id,
    tenantId: endpoint.tenant_id,
    providerId: endpoint.provider_id as PaymentProviderId,
    environment: endpoint.environment,
    methodType: 'other',
    isActive: endpoint.config_is_active,
    isDefault: false,
    credentialsSecretId: undefined,
    webhookSecretId: endpoint.webhook_secret_id ?? undefined,
    metadata: {},
  };
}
