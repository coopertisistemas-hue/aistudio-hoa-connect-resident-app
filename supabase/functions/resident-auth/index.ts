import { buildRequestContext } from '../_shared/auth.ts';
import { resolveAuthContext } from '../_shared/context.ts';
import { jsonOk } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' } });
  }

  const ctx = await buildRequestContext(request);
  if (ctx instanceof Response) return ctx;
  const context = await resolveAuthContext(ctx);
  if (context instanceof Response) return context;

  return jsonOk(ctx.requestId, {
    session: {
      userId: ctx.user.id,
      email: ctx.user.email,
    },
    context,
  }, { headers: ctx.headers });
});
