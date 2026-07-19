import { buildRequestContext } from '../_shared/auth.ts';
import { jsonError, jsonOk } from '../_shared/http.ts';
import { readJson, requireString, optionalString } from '../_shared/validation.ts';

interface ContactUpsertInput {
  contact_type: 'email' | 'phone' | 'whatsapp';
  normalized_value: string;
  display_value: string;
  is_primary?: boolean;
  is_whatsapp_capable?: boolean;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'PUT,OPTIONS' } });
  }
  if (request.method !== 'PUT') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const ctx = await buildRequestContext(request);
  if (ctx instanceof Response) return ctx;

  let body: ContactUpsertInput;
  try {
    body = await readJson<ContactUpsertInput>(request);
  } catch {
    return jsonError(ctx.requestId, 'VALIDATION_ERROR', 'Corpo JSON invalido.', 422, { headers: ctx.headers });
  }

  const contactType = requireString(body.contact_type, 'contact_type');
  const normalizedValue = requireString(body.normalized_value, 'normalized_value').toLowerCase();
  const displayValue = requireString(body.display_value, 'display_value');

  const { data: profile, error: profileError } = await ctx.authClient.from('profiles').select('id').single();
  if (profileError || !profile) {
    return jsonError(ctx.requestId, 'NOT_FOUND', 'Perfil autenticado nao encontrado.', 404, { headers: ctx.headers });
  }

  if (body.is_primary === true) {
    await ctx.authClient
      .from('profile_contacts')
      .update({ is_primary: false })
      .eq('profile_id', profile.id)
      .eq('contact_type', contactType)
      .is('deleted_at', null);
  }

  const contactSelect =
    'id, profile_id, contact_type, normalized_value, display_value, verification_state, is_primary, is_whatsapp_capable, verification_sent_at, verified_at, invalidated_at, outdated_at, created_at, updated_at';

  // Partial unique index prevents ON CONFLICT upsert; select then insert/update.
  const { data: existing, error: existingError } = await ctx.authClient
    .from('profile_contacts')
    .select('id')
    .eq('profile_id', profile.id)
    .eq('contact_type', contactType)
    .eq('normalized_value', normalizedValue)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingError) {
    return jsonError(ctx.requestId, 'TEMPORARY_UNAVAILABLE', 'Nao foi possivel consultar o contato.', 503, {
      headers: ctx.headers,
    });
  }

  let data;
  let error;
  if (existing?.id) {
    const updated = await ctx.authClient
      .from('profile_contacts')
      .update({
        display_value: displayValue,
        is_primary: body.is_primary ?? false,
        is_whatsapp_capable: body.is_whatsapp_capable ?? contactType === 'whatsapp',
      })
      .eq('id', existing.id)
      .select(contactSelect)
      .single();
    data = updated.data;
    error = updated.error;
  } else {
    const inserted = await ctx.authClient
      .from('profile_contacts')
      .insert({
        profile_id: profile.id,
        contact_type: contactType,
        normalized_value: normalizedValue,
        display_value: displayValue,
        verification_state: 'unverified',
        is_primary: body.is_primary ?? false,
        is_whatsapp_capable: body.is_whatsapp_capable ?? contactType === 'whatsapp',
        verification_sent_at: null,
        verified_at: null,
        invalidated_at: null,
        outdated_at: null,
        deleted_at: null,
      })
      .select(contactSelect)
      .single();
    data = inserted.data;
    error = inserted.error;
  }

  if (error) {
    return jsonError(ctx.requestId, 'CONFLICT', 'Nao foi possivel salvar o contato.', 409, { headers: ctx.headers });
  }

  await ctx.authClient.rpc('log_audit_event', {
    target_tenant_id: null,
    target_action: 'profile_contact.upsert.self',
    target_entity_type: 'profile_contact',
    target_entity_id: data.id,
    target_request_id: ctx.requestId,
    target_source: 'edge_function:profile-contact-upsert',
    target_metadata: {
      contact_type: contactType,
      display_value: displayValue,
      is_primary: body.is_primary ?? false,
      is_whatsapp_capable: body.is_whatsapp_capable ?? contactType === 'whatsapp',
      previous_value: optionalString(null),
    },
  });

  return jsonOk(ctx.requestId, data, { headers: ctx.headers });
});
