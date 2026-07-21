// Auth Context
// EPF-01 Financial Domain Foundation
//
// Minimal auth context provider for role-based route protection.
// Consideration 13: Admin routes shall be created now under role protection.
//
// Currently returns demo/mock data.
// Wire up to resident-auth Edge Function when Supabase integration is ready.

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AuthContextContract } from '@/lib/supabase/contracts';

export type TenantRole =
  | 'association_admin'
  | 'association_operator'
  | 'association_finance'
  | 'association_support'
  | 'association_viewer'
  | 'association_collector';

export type PlatformRole = 'platform_admin' | 'platform_support';

export interface AuthState {
  context: AuthContextContract | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  hasTenantRole: (role: TenantRole) => boolean;
  hasPlatformRole: (role: PlatformRole) => boolean;
  hasAnyRole: (roles: TenantRole[]) => boolean;
  isPlatformAdmin: boolean;
  isAssociationAdmin: boolean;
  isAssociationFinance: boolean;
  isAssociationOperator: boolean;
  setContext: (ctx: AuthContextContract | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AuthContextContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = context !== null && context.profile !== null;

  const hasTenantRole = useCallback(
    (role: TenantRole): boolean => {
      if (!context?.activeTenant) return false;
      return context.activeTenant.role === role;
    },
    [context]
  );

  const hasPlatformRole = useCallback(
    (role: PlatformRole): boolean => {
      if (!context?.platformRoles) return false;
      return context.platformRoles.includes(role);
    },
    [context]
  );

  const hasAnyRole = useCallback(
    (roles: TenantRole[]): boolean => {
      if (!context?.activeTenant) return false;
      return roles.includes(context.activeTenant.role as TenantRole);
    },
    [context]
  );

  const isPlatformAdmin = hasPlatformRole('platform_admin');
  const isAssociationAdmin = hasTenantRole('association_admin');
  const isAssociationFinance = hasTenantRole('association_finance');
  const isAssociationOperator = hasTenantRole('association_operator');

  return (
    <AuthContext.Provider
      value={{
        context,
        isLoading,
        isAuthenticated,
        hasTenantRole,
        hasPlatformRole,
        hasAnyRole,
        isPlatformAdmin,
        isAssociationAdmin,
        isAssociationFinance,
        isAssociationOperator,
        setContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
