// RequireRole — Route Protection Guard
// EPF-01 Financial Domain Foundation
//
// Consideration 13: Admin routes shall be created now under role protection.
// Hidden pages are preferable to future routing refactors.
//
// When no real auth context is available (demo mode), admin pages are hidden
// rather than crashing — they show a "restricted access" placeholder.

import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { TenantRole } from './AuthContext';
import EmptyState from '@/components/base/EmptyState';

export interface RequireRoleProps {
  children: ReactNode;
  roles?: TenantRole[];
  requirePlatformAdmin?: boolean;
  fallback?: ReactNode;
}

export function RequireRole({
  children,
  roles,
  requirePlatformAdmin = false,
  fallback,
}: RequireRoleProps) {
  const {
    isAuthenticated,
    isPlatformAdmin,
    hasAnyRole,
    hasTenantRole,
    context,
  } = useAuth();

  // No auth context: show restricted placeholder (hidden, not error)
  if (!isAuthenticated) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-50 p-6">
        <EmptyState
          title="Acesso Restrito"
          description="Esta área é reservada para administradores e operadores da associação."
        />
      </div>
    );
  }

  if (requirePlatformAdmin && !isPlatformAdmin) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-50 p-6">
        <EmptyState
          title="Acesso Restrito"
          description="Esta área é reservada para administradores da plataforma."
        />
      </div>
    );
  }

  if (roles && roles.length > 0 && !hasAnyRole(roles)) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-50 p-6">
        <EmptyState
          title="Acesso Restrito"
          description="Você não possui as permissões necessárias para acessar esta área."
        />
      </div>
    );
  }

  return <>{children}</>;
}
