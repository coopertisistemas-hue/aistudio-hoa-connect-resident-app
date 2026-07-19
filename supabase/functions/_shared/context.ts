import type { RequestContext } from './auth.ts';
import { jsonError } from './http.ts';

export interface AuthContextData {
  profile: Record<string, unknown> | null;
  availableTenants: Array<Record<string, unknown>>;
  availableResidences: Array<Record<string, unknown>>;
  platformRoles: string[];
  activeTenant: Record<string, unknown> | null;
  activeResidence: Record<string, unknown> | null;
  statusFlags: {
    hasProfile: boolean;
    hasTenant: boolean;
    hasResidence: boolean;
    isPlatformAdmin: boolean;
  };
}

export async function resolveAuthContext(ctx: RequestContext): Promise<AuthContextData | Response> {
  const { data, error } = await ctx.authClient.rpc('current_tenant_context');
  if (error) {
    return jsonError(ctx.requestId, 'FORBIDDEN', 'Nao foi possivel resolver o contexto autenticado.', 403, {
      headers: ctx.headers,
    });
  }

  const profile = (data?.profile ?? null) as Record<string, unknown> | null;
  const availableTenants = Array.isArray(data?.available_tenants) ? data.available_tenants as Array<Record<string, unknown>> : [];
  const availableResidences = Array.isArray(data?.available_residences) ? data.available_residences as Array<Record<string, unknown>> : [];
  const platformRoles = Array.isArray(data?.platform_roles) ? data.platform_roles as string[] : [];
  const activeTenant = availableTenants[0] ?? null;
  const activeResidence = availableResidences.find((residence) => residence.is_primary === true) ?? availableResidences[0] ?? null;

  return {
    profile,
    availableTenants,
    availableResidences,
    platformRoles,
    activeTenant,
    activeResidence,
    statusFlags: {
      hasProfile: profile !== null,
      hasTenant: availableTenants.length > 0,
      hasResidence: availableResidences.length > 0,
      isPlatformAdmin: platformRoles.includes('platform_admin'),
    },
  };
}
