import { buildRequestContext } from '../_shared/auth.ts';
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

  const { data, error } = await ctx.authClient
    .from('profile_contacts')
    .select('id, contact_type, normalized_value, display_value, verification_state, is_primary, is_whatsapp_capable, verification_sent_at, verified_at, invalidated_at, outdated_at, created_at, updated_at')
    .is('deleted_at', null)
    .order('contact_type');

  if (error) {
    return jsonError(ctx.requestId, 'TEMPORARY_UNAVAILABLE', 'Nao foi possivel carregar os contatos.', 503, { headers: ctx.headers });
  }

  return jsonOk(ctx.requestId, data ?? [], { headers: ctx.headers });
});
