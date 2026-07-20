-- Sprint 2 Wave 2.1 — Enum Extensions
ALTER TYPE public.tenant_role ADD VALUE IF NOT EXISTS 'association_collector';

ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'residents:read';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'residents:write';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'residence_payers:read';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'residence_payers:write';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'household:read';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'household:write';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'invitations:read';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'invitations:write';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'association_details:read';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'association_details:write';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'audit:read_association';
ALTER TYPE public.tenant_permission ADD VALUE IF NOT EXISTS 'residences:read_routes';
