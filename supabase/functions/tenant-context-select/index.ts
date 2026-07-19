import { buildRequestContext } from '../_shared/auth.ts';
import { resolveAuthContext } from '../_shared/context.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';
import { readJson, requireString } from '../_shared/validation.ts';

interface TenantContextSelectionInput {
  tenant_id?: string;
  residence_id?: string;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS' } });
  }
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const ctx = await buildRequestContext(request);
  if (ctx instanceof Response) return ctx;

  const context = await resolveAuthContext(ctx);
  if (context instanceof Response) return context;

  let body: TenantContextSelectionInput;
  try {
    body = await readJson<TenantContextSelectionInput>(request);
  } catch {
    return jsonError(ctx.requestId, 'VALIDATION_ERROR', 'Corpo JSON invalido.', 422, { headers: ctx.headers });
  }

  const requestedTenantId = body.tenant_id ? requireString(body.tenant_id, 'tenant_id') : null;
  const requestedResidenceId = body.residence_id ? requireString(body.residence_id, 'residence_id') : null;

  const activeTenant = requestedTenantId
    ? context.availableTenants.find((tenant) => tenant.id === requestedTenantId) ?? null
    : context.activeTenant;
  const activeResidence = requestedResidenceId
    ? context.availableResidences.find((residence) => residence.id === requestedResidenceId) ?? null
    : context.activeResidence;

  if (requestedTenantId && !activeTenant) {
    return jsonError(ctx.requestId, 'FORBIDDEN', 'Tenant solicitado nao pertence ao contexto autenticado.', 403, { headers: ctx.headers });
  }
  if (requestedResidenceId && !activeResidence) {
    return jsonError(ctx.requestId, 'FORBIDDEN', 'Residencia solicitada nao pertence ao contexto autenticado.', 403, { headers: ctx.headers });
  }

  return jsonOk(ctx.requestId, {
    profile: context.profile,
    activeTenant,
    activeResidence,
    availableTenants: context.availableTenants,
    availableResidences: context.availableResidences,
    platformRoles: context.platformRoles,
    statusFlags: context.statusFlags,
  }, { headers: ctx.headers });
});
