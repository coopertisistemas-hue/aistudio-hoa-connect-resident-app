import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { buildCorsHeaders } from '../_shared/http.ts';

interface RequestContext {
  requestId: string;
  authClient: SupabaseClient;
  adminClient: SupabaseClient;
  headers: Record<string, string>;
  actorProfileId: string;
}

interface BillingExecuteInput {
  billingCycleId: string;
  preview?: boolean;
}

interface BillingResult {
  success: boolean;
  billingCycleId: string;
  invoicesGenerated: number;
  totalAmount: number;
  invoiceIds: string[];
  previewItems: PreviewItem[];
  errors: ErrorRecord[];
}

interface PreviewItem {
  meterId: string;
  meterNumber: string;
  consumption: number;
  tariffResult: Record<string, unknown>;
}

interface ErrorRecord {
  meterId: string;
  meterNumber: string;
  error: string;
}

async function buildRequestContext(request: Request): Promise<RequestContext | Response> {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const headers = buildCorsHeaders('*');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization')! } },
    db: { schema: 'resident' },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    db: { schema: 'resident' },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: user, error: userError } = await authClient.auth.getUser();

  if (userError || !user) {
    return new Response(
      JSON.stringify({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'Autenticacao necessaria', requestId },
        meta: { requestId, generatedAt: new Date().toISOString() },
      }),
      { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  }

  // Resolve the authenticated actor profile id from the user JWT context.
  // This is passed to process_water_billing so the financial audit record is
  // attributed to the real operator, not derived from the service-role client.
  const { data: actorProfileId, error: profileError } = await authClient.rpc('current_profile_id');
  if (profileError || !actorProfileId) {
    return new Response(
      JSON.stringify({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Perfil do operador nao encontrado.', requestId },
        meta: { requestId, generatedAt: new Date().toISOString() },
      }),
      { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  }

  return { requestId, authClient, adminClient, headers, actorProfileId };
}

async function processBilling(
  input: BillingExecuteInput,
  ctx: RequestContext,
): Promise<BillingResult> {
  const preview = input.preview === true;
  const result: BillingResult = {
    success: true,
    billingCycleId: input.billingCycleId,
    invoicesGenerated: 0,
    totalAmount: 0,
    invoiceIds: [],
    previewItems: [],
    errors: [],
  };

  // 1. Get the billing cycle
  const { data: cycle, error: cycleError } = await ctx.authClient
    .from('billing_cycles')
    .select('*')
    .eq('id', input.billingCycleId)
    .single();

  if (cycleError || !cycle) {
    result.success = false;
    result.errors.push({
      meterId: 'n/a',
      meterNumber: 'n/a',
      error: `Billing cycle not found: ${input.billingCycleId}`,
    });
    return result;
  }

  const billingAccountId = cycle.billing_account_id;
  const tenantId = cycle.tenant_id;
  const cycleStart = cycle.cycle_start;
  const cycleEnd = cycle.cycle_end;

  // 2. Get the billing account to find the property
  const { data: billingAccount, error: baError } = await ctx.adminClient
    .from('billing_accounts')
    .select('property_id')
    .eq('id', billingAccountId)
    .single();

  if (baError || !billingAccount) {
    result.success = false;
    result.errors.push({
      meterId: 'n/a',
      meterNumber: 'n/a',
      error: `Billing account not found: ${billingAccountId}`,
    });
    return result;
  }

  const propertyId = billingAccount.property_id;

  // 3. Find active water meters for the property
  const { data: meters, error: metersError } = await ctx.authClient
    .from('water_meters')
    .select('*')
    .eq('property_id', propertyId)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (metersError || !meters || meters.length === 0) {
    result.success = false;
    result.errors.push({
      meterId: 'n/a',
      meterNumber: 'n/a',
      error: `No active water meters found for property ${propertyId}`,
    });
    return result;
  }

  // 4. Find active tariff table for the tenant
  const { data: tariffTable, error: tariffError } = await ctx.authClient
    .from('tariff_tables')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single();

  if (tariffError || !tariffTable) {
    result.success = false;
    result.errors.push({
      meterId: 'n/a',
      meterNumber: 'n/a',
      error: 'No active tariff table found for this tenant',
    });
    return result;
  }

  // 5. Process each meter
  for (const meter of meters) {
    try {
      await processMeter(
        meter, cycle, billingAccountId, tenantId, tariffTable.id,
        preview, ctx, result,
      );
    } catch (err) {
      result.errors.push({
        meterId: meter.id,
        meterNumber: meter.meter_number,
        error: err instanceof Error ? err.message : 'Unknown error during billing',
      });
    }
  }

  return result;
}

async function processMeter(
  meter: Record<string, unknown>,
  cycle: Record<string, unknown>,
  billingAccountId: string,
  tenantId: string,
  tariffTableId: string,
  preview: boolean,
  ctx: RequestContext,
  result: BillingResult,
): Promise<void> {
  const meterId = meter.id as string;
  const meterNumber = (meter.meter_number as string) || meterId;

  // 5a. Calculate consumption
  const { data: consumption, error: consError } = await ctx.authClient.rpc(
    'calculate_consumption',
    {
      p_meter_id: meterId,
      p_from_date: cycle.cycle_start as string,
      p_to_date: cycle.cycle_end as string,
    },
  );

  if (consError) {
    throw new Error(`Consumption calculation error: ${consError.message}`);
  }

  if (consumption === null || consumption < 0) {
    result.errors.push({
      meterId,
      meterNumber,
      error: `Insufficient readings for consumption calculation`,
    });
    return;
  }

  if (consumption === 0) {
    result.errors.push({
      meterId,
      meterNumber,
      error: `Zero consumption (no change in readings)`,
    });
    return;
  }

  // 5b. Apply tariff
  const { data: tariffResult, error: tariffErr } = await ctx.authClient.rpc(
    'apply_tariff',
    {
      p_consumption: consumption,
      p_tariff_table_id: tariffTableId,
    },
  );

  if (tariffErr) {
    throw new Error(`Tariff application error: ${tariffErr.message}`);
  }

  const tariffData = tariffResult as Record<string, unknown>;

  // 5c. Build preview item
  result.previewItems.push({
    meterId,
    meterNumber,
    consumption: consumption as number,
    tariffResult: tariffData,
  });

  if (preview) {
    // Preview only — do not persist
    return;
  }

  // 5d. Atomic billing execution (all writes in single DB transaction)
  const documentNumber = `AGUA-${(cycle.reference_period as string)?.replace('/', '-')}-${meterNumber}`;
  const invoiceAmount = tariffData.total_amount as number;

  const { data: billingResult, error: billingError } = await ctx.adminClient.rpc(
    'process_water_billing',
    {
      p_tenant_id: tenantId,
      p_billing_account_id: billingAccountId,
      p_billing_cycle_id: cycle.id,
      p_document_number: documentNumber,
      p_amount: invoiceAmount,
      p_due_date: cycle.due_date,
      p_reference_period: cycle.reference_period,
      p_meter_id: meterId,
      p_meter_number: meterNumber,
      p_consumption: consumption,
      p_tariff_result: tariffData,
      p_actor_profile_id: ctx.actorProfileId,
    },
  );

  if (billingError) {
    throw new Error(`Billing execution error: ${billingError.message}`);
  }

  const billingData = billingResult as Record<string, unknown>;

  if (billingData.status === 'duplicate') {
    result.errors.push({
      meterId,
      meterNumber,
      error: `Duplicate invoice — already processed: ${billingData.invoice_id}`,
    });
    return;
  }

  result.invoiceIds.push(billingData.invoice_id as string);
  result.invoicesGenerated++;
  result.totalAmount += invoiceAmount;
}

// ============================================================================
// Main Entry Point
// ============================================================================

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    const headers = buildCorsHeaders('*');
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    const headers = buildCorsHeaders('*');
    return new Response(
      JSON.stringify({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Method not allowed. Use POST.', requestId: 'n/a' },
        meta: { requestId: 'n/a', generatedAt: new Date().toISOString() },
      }),
      { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } },
    );
  }

  const ctx = await buildRequestContext(request);
  if (ctx instanceof Response) return ctx;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body', requestId: ctx.requestId },
        meta: { requestId: ctx.requestId, generatedAt: new Date().toISOString() },
      }),
      { status: 422, headers: { ...ctx.headers, 'Content-Type': 'application/json' } },
    );
  }

  const billingCycleId = body.billingCycleId as string;
  const preview = body.preview === true;

  if (!billingCycleId) {
    return new Response(
      JSON.stringify({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'billingCycleId is required', requestId: ctx.requestId },
        meta: { requestId: ctx.requestId, generatedAt: new Date().toISOString() },
      }),
      { status: 422, headers: { ...ctx.headers, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const result = await processBilling({ billingCycleId, preview }, ctx);

    return new Response(
      JSON.stringify({
        data: result,
        error: null,
        meta: { requestId: ctx.requestId, generatedAt: new Date().toISOString() },
      }),
      {
        status: 200,
        headers: { ...ctx.headers, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Internal billing error',
          requestId: ctx.requestId,
        },
        meta: { requestId: ctx.requestId, generatedAt: new Date().toISOString() },
      }),
      { status: 500, headers: { ...ctx.headers, 'Content-Type': 'application/json' } },
    );
  }
});
