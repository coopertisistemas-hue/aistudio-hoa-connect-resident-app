// Payment Intent Create Edge Function
// EPF-03R Remediation
//
// Creates a payment intent for an invoice using the configured provider.
// The client must supply an idempotency key. The server validates the amount
// against the outstanding invoice balance and avoids issuing multiple active
// instruments whose combined amount exceeds the balance.

import { type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { buildCorsHeaders, jsonError, jsonOk, requestIdFromHeaders } from '../_shared/http.ts';
import { createConfiguredProvider } from '../_shared/payment/registry.ts';
import { methodToCapability, requireCapability } from '../_shared/payment/capabilities.ts';
import type { PaymentMethodType, PaymentProviderId, TenantProviderConfig } from '../_shared/payment/types.ts';
import { createAuthClient, createAdminClient } from '../_shared/payment/crypto.ts';
import type { RequestContext } from '../_shared/auth.ts';

interface CreatePaymentIntentInput {
  invoiceId: string;
  method: PaymentMethodType;
  amount?: number;
  idempotencyKey: string;
  providerConfigId?: string;
  environment?: 'sandbox' | 'production';
}

interface RequestContextWithActor extends RequestContext {
  actorProfileId: string;
}

async function buildContext(request: Request): Promise<RequestContextWithActor | Response> {
  const requestId = requestIdFromHeaders(request.headers);
  const headers = buildCorsHeaders(request.headers.get('origin'));

  const authClient = createAuthClient(request);
  const adminClient = createAdminClient();

  const { data: userData, error } = await authClient.auth.getUser();
  if (error || !userData.user) {
    return jsonError(requestId, 'UNAUTHENTICATED', 'Sessao invalida ou expirada.', 401, { headers });
  }

  const { data: actorProfileId, error: profileError } = await authClient.rpc('current_profile_id');
  if (profileError || !actorProfileId) {
    return jsonError(requestId, 'NOT_FOUND', 'Perfil do usuario nao encontrado.', 404, { headers });
  }

  return {
    requestId,
    request,
    headers,
    authClient,
    adminClient,
    user: userData.user,
    actorProfileId: actorProfileId as string,
  };
}

async function resolveInvoice(
  invoiceId: string,
  ctx: RequestContextWithActor,
): Promise<{ invoice: Record<string, unknown>; tenantId: string } | Response> {
  const { data: invoice, error } = await ctx.authClient
    .from('invoices')
    .select('id, tenant_id, billing_account_id, amount, status, due_date, currency')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    return jsonError(ctx.requestId, 'NOT_FOUND', 'Fatura nao encontrada.', 404, { headers: ctx.headers });
  }

  return { invoice, tenantId: invoice.tenant_id as string };
}

async function resolveProviderConfig(
  input: CreatePaymentIntentInput,
  tenantId: string,
  ctx: RequestContextWithActor,
): Promise<TenantProviderConfig | Response> {
  if (input.providerConfigId) {
    const { data: config, error } = await ctx.adminClient
      .from('tenant_payment_provider_configs')
      .select('*')
      .eq('id', input.providerConfigId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !config) {
      return jsonError(ctx.requestId, 'NOT_FOUND', 'Configuracao de provedor nao encontrada.', 404, { headers: ctx.headers });
    }

    return mapConfig(config);
  }

  const environment = input.environment ?? 'sandbox';
  const { data: config, error } = await ctx.adminClient.rpc('get_default_provider_config', {
    p_tenant_id: tenantId,
    p_method_type: input.method,
    p_environment: environment,
  });

  if (error || !config) {
    return jsonError(ctx.requestId, 'NOT_FOUND', `Nenhum provedor ${input.method} configurado para este ambiente.`, 404, { headers: ctx.headers });
  }

  const { data: fullConfig } = await ctx.adminClient
    .from('tenant_payment_provider_configs')
    .select('*')
    .eq('id', config as string)
    .eq('is_active', true)
    .single();

  if (!fullConfig) {
    return jsonError(ctx.requestId, 'NOT_FOUND', 'Configuracao de provedor nao encontrada.', 404, { headers: ctx.headers });
  }

  return mapConfig(fullConfig);
}

function mapConfig(row: Record<string, unknown>): TenantProviderConfig {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    providerId: row.provider_id as PaymentProviderId,
    environment: row.environment as 'sandbox' | 'production',
    methodType: row.method_type as PaymentMethodType,
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

async function createIntent(
  input: CreatePaymentIntentInput,
  invoice: Record<string, unknown>,
  config: TenantProviderConfig,
  ctx: RequestContextWithActor,
): Promise<Record<string, unknown> | Response> {
  const provider = createConfiguredProvider(config);
  const capability = methodToCapability(input.method);

  if (capability) {
    requireCapability(provider, capability);
  }

  const amount = input.amount ?? Number(invoice.amount);
  const invoiceCurrency = (invoice.currency as string) ?? 'BRL';

  let providerResult;
  if (input.method === 'pix') {
    providerResult = await provider.createPix({
      invoiceId: input.invoiceId,
      amount,
      description: `Fatura ${invoice.id}`,
      expiresInMinutes: 30,
    });
  } else if (input.method === 'boleto') {
    providerResult = await provider.createBoleto({
      invoiceId: input.invoiceId,
      amount,
      description: `Fatura ${invoice.id}`,
      dueDate: String(invoice.due_date),
    });
  } else {
    return jsonError(ctx.requestId, 'VALIDATION_ERROR', `Metodo de pagamento nao suportado: ${input.method}`, 422, { headers: ctx.headers });
  }

  const { data: intentId, error: rpcError } = await ctx.adminClient.rpc('create_payment_intent', {
    p_tenant_id: config.tenantId,
    p_invoice_id: input.invoiceId,
    p_provider_id: config.providerId,
    p_method_type: input.method,
    p_provider_config_id: config.id,
    p_provider_payment_intent_id: providerResult.providerPaymentIntentId,
    p_amount: providerResult.amount,
    p_provider_pix_code: providerResult.pixCode ?? null,
    p_provider_pix_qr_base64: providerResult.pixQrBase64 ?? null,
    p_provider_boleto_url: providerResult.boletoUrl ?? null,
    p_provider_boleto_barcode: providerResult.boletoBarcode ?? null,
    p_provider_boleto_digitable_line: providerResult.boletoDigitableLine ?? null,
    p_expires_at: providerResult.expiresAt ?? null,
    p_reconciliation_id: providerResult.reconciliationId,
    p_raw_provider_response: providerResult.rawProviderResponse ?? {},
    p_idempotency_key: input.idempotencyKey,
    p_actor_profile_id: ctx.actorProfileId,
  });

  if (rpcError || !intentId) {
    if (rpcError?.message?.includes('Idempotency key reused with conflicting payload')) {
      return jsonError(ctx.requestId, 'CONFLICT', 'Chave de idempotencia reutilizada com payload conflitante.', 409, { headers: ctx.headers });
    }
    if (rpcError?.message?.includes('exceeds remaining issuable balance')) {
      return jsonError(ctx.requestId, 'VALIDATION_ERROR', `Valor excede saldo remanescente: ${rpcError.message}`, 422, { headers: ctx.headers });
    }
    return jsonError(ctx.requestId, 'INTERNAL_ERROR', `Erro ao criar payment intent: ${rpcError?.message ?? 'unknown'}`, 500, { headers: ctx.headers });
  }

  const { data: intent, error: fetchError } = await ctx.adminClient
    .from('payment_intents')
    .select('*')
    .eq('id', intentId)
    .single();

  if (fetchError || !intent) {
    return jsonError(ctx.requestId, 'INTERNAL_ERROR', 'Payment intent criado mas nao pode ser recuperado.', 500, { headers: ctx.headers });
  }

  return {
    paymentIntent: intent,
    providerResponse: providerResult,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(request.headers.get('origin')) });
  }

  if (request.method !== 'POST') {
    return jsonError('n/a', 'VALIDATION_ERROR', 'Method not allowed. Use POST.', 405, { headers: buildCorsHeaders(request.headers.get('origin')) });
  }

  const ctx = await buildContext(request);
  if (ctx instanceof Response) return ctx;

  let body: CreatePaymentIntentInput;
  try {
    body = await request.json() as CreatePaymentIntentInput;
  } catch {
    return jsonError(ctx.requestId, 'VALIDATION_ERROR', 'Invalid JSON body.', 422, { headers: ctx.headers });
  }

  if (!body.invoiceId || !body.method || !body.idempotencyKey) {
    return jsonError(ctx.requestId, 'VALIDATION_ERROR', 'invoiceId, method and idempotencyKey are required.', 422, { headers: ctx.headers });
  }

  if (body.idempotencyKey.length < 8) {
    return jsonError(ctx.requestId, 'VALIDATION_ERROR', 'idempotencyKey must be at least 8 characters.', 422, { headers: ctx.headers });
  }

  const invoiceResult = await resolveInvoice(body.invoiceId, ctx);
  if (invoiceResult instanceof Response) return invoiceResult;

  const { data: hasPermission } = await ctx.authClient.rpc('has_tenant_permission', {
    target_tenant_id: invoiceResult.tenantId,
    target_permission: 'payments:write',
  });
  if (!hasPermission) {
    return jsonError(ctx.requestId, 'FORBIDDEN', 'Permissao insuficiente.', 403, { headers: ctx.headers });
  }

  const configResult = await resolveProviderConfig(body, invoiceResult.tenantId, ctx);
  if (configResult instanceof Response) return configResult;

  try {
    const result = await createIntent(body, invoiceResult.invoice, configResult, ctx);
    if (result instanceof Response) return result;
    return jsonOk(ctx.requestId, result, { headers: ctx.headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal payment error';
    return jsonError(ctx.requestId, 'INTERNAL_ERROR', message, 500, { headers: ctx.headers });
  }
});
