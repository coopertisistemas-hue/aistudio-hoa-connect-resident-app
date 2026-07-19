import { buildRequestContext } from '../_shared/auth.ts';
import { resolveAuthContext } from '../_shared/context.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' } });
  }
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const ctx = await buildRequestContext(request);
  if (ctx instanceof Response) return ctx;

  const context = await resolveAuthContext(ctx);
  if (context instanceof Response) return context;
  if (!context.profile) {
    return jsonError(ctx.requestId, 'NOT_FOUND', 'Perfil nao encontrado para o usuario autenticado.', 404, { headers: ctx.headers });
  }

  const { data: contacts, error: contactsError } = await ctx.authClient
    .from('profile_contacts')
    .select('id, contact_type, normalized_value, display_value, verification_state, is_primary, is_whatsapp_capable, verification_sent_at, verified_at, invalidated_at, outdated_at, created_at, updated_at')
    .is('deleted_at', null)
    .order('contact_type');

  if (contactsError) {
    return jsonError(ctx.requestId, 'TEMPORARY_UNAVAILABLE', 'Nao foi possivel carregar os contatos do perfil.', 503, {
      headers: ctx.headers,
    });
  }

  return jsonOk(ctx.requestId, {
    profile: context.profile,
    contacts: contacts ?? [],
    availableTenants: context.availableTenants,
    availableResidences: context.availableResidences,
    activeTenant: context.activeTenant,
    activeResidence: context.activeResidence,
    statusFlags: context.statusFlags,
  }, { headers: ctx.headers });
});
