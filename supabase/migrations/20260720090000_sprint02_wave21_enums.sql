-- Sprint 2 Wave 2.1 — Enum Extensions
ALTER TYPE resident.tenant_role ADD VALUE IF NOT EXISTS 'association_collector';

ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'residents:read';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'residents:write';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'residence_payers:read';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'residence_payers:write';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'household:read';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'household:write';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'invitations:read';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'invitations:write';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'association_details:read';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'association_details:write';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'audit:read_association';
ALTER TYPE resident.tenant_permission ADD VALUE IF NOT EXISTS 'residences:read_routes';
