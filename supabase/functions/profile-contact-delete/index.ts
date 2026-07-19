import { buildRequestContext } from '../_shared/auth.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'DELETE,OPTIONS' } });
  }
  if (request.method !== 'DELETE') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const ctx = await buildRequestContext(request);
  if (ctx instanceof Response) return ctx;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return jsonError(ctx.requestId, 'VALIDATION_ERROR', 'Parametro id e obrigatorio.', 422, { headers: ctx.headers });
  }

  const { data, error } = await ctx.authClient
    .from('profile_contacts')
    .update({ deleted_at: new Date().toISOString(), is_primary: false })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error || !data) {
    return jsonError(ctx.requestId, 'NOT_FOUND', 'Contato nao encontrado.', 404, { headers: ctx.headers });
  }

  await ctx.authClient.rpc('log_audit_event', {
    target_tenant_id: null,
    target_action: 'profile_contact.delete.self',
    target_entity_type: 'profile_contact',
    target_entity_id: id,
    target_request_id: ctx.requestId,
    target_source: 'edge_function:profile-contact-delete',
    target_metadata: {},
  });

  return jsonOk(ctx.requestId, { deleted: true, id }, { headers: ctx.headers });
});
