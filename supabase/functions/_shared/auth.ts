import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.57.4';
import { jsonError, requestIdFromHeaders, buildCorsHeaders } from './http.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export interface RequestContext {
  requestId: string;
  request: Request;
  headers: HeadersInit;
  authClient: SupabaseClient;
  adminClient: SupabaseClient;
  user: User;
}

function requireEnv(value: string, key: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export async function buildRequestContext(request: Request): Promise<RequestContext | Response> {
  const requestId = requestIdFromHeaders(request.headers);
  const headers = buildCorsHeaders(request.headers.get('origin'));

  const authClient = createClient(
    requireEnv(supabaseUrl, 'SUPABASE_URL'),
    requireEnv(anonKey, 'SUPABASE_ANON_KEY'),
    {
      db: { schema: 'resident' },
      global: {
        headers: {
          Authorization: request.headers.get('Authorization') ?? '',
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const adminClient = createClient(
    requireEnv(supabaseUrl, 'SUPABASE_URL'),
    requireEnv(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      db: { schema: 'resident' },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { data: userData, error } = await authClient.auth.getUser();
  if (error || !userData.user) {
    return jsonError(requestId, 'UNAUTHENTICATED', 'Sessao invalida ou expirada.', 401, { headers });
  }

  return {
    requestId,
    request,
    headers,
    authClient,
    adminClient,
    user: userData.user,
  };
}
