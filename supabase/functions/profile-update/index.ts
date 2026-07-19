import { buildRequestContext } from '../_shared/auth.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';
import { readJson, optionalString } from '../_shared/validation.ts';

interface ProfileUpdateInput {
  preferred_name?: string | null;
  avatar_url?: string | null;
  locale?: string | null;
  timezone?: string | null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'PATCH,OPTIONS' } });
  }
  if (request.method !== 'PATCH') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const ctx = await buildRequestContext(request);
  if (ctx instanceof Response) return ctx;

  let body: ProfileUpdateInput;
  try {
    body = await readJson<ProfileUpdateInput>(request);
  } catch {
    return jsonError(ctx.requestId, 'VALIDATION_ERROR', 'Corpo JSON invalido.', 422, { headers: ctx.headers });
  }

  const payload = {
    preferred_name: optionalString(body.preferred_name),
    avatar_url: optionalString(body.avatar_url),
    locale: optionalString(body.locale) ?? 'pt-BR',
    timezone: optionalString(body.timezone) ?? 'America/Sao_Paulo',
  };

  const { data: currentProfile, error: currentProfileError } = await ctx.authClient
    .from('profiles')
    .select('id')
    .single();

  if (currentProfileError || !currentProfile) {
    return jsonError(ctx.requestId, 'NOT_FOUND', 'Perfil autenticado nao encontrado.', 404, { headers: ctx.headers });
  }

  const { data, error } = await ctx.authClient
    .from('profiles')
    .update(payload)
    .eq('id', currentProfile.id)
    .select('id, user_id, full_name, preferred_name, avatar_url, status, locale, timezone, created_at, updated_at')
    .single();

  if (error) {
    return jsonError(ctx.requestId, 'CONFLICT', 'Nao foi possivel atualizar o perfil.', 409, { headers: ctx.headers });
  }

  await ctx.authClient.rpc('log_audit_event', {
    target_tenant_id: null,
    target_action: 'profile.update.self',
    target_entity_type: 'profile',
    target_entity_id: currentProfile.id,
    target_request_id: ctx.requestId,
    target_source: 'edge_function:profile-update',
    target_metadata: payload,
  });

  return jsonOk(ctx.requestId, data, { headers: ctx.headers });
});
