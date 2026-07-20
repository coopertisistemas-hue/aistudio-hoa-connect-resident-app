-- Sprint 2 Wave 2.3 — Residence & Household Domain Foundation
-- Implements D-05 residence_members history evolution, household_members table,
-- composite FKs (D-13), EXCLUDE constraints, RLS extension, and occupancy semantics.
--
-- Frozen list items: #1 (residence_members), #2 (properties), #7 (btree_gist extension).
-- residence_payers, residence_invitations, and RPCs are OUT OF SCOPE for this wave.

-- ============================================================================
-- 1. Extension Setup (frozen item #7)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

-- ============================================================================
-- 2. New Enums (D-07)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'residence_membership_end_reason') THEN
    CREATE TYPE resident.residence_membership_end_reason AS ENUM (
      'moved_out',
      'ownership_transferred',
      'tenancy_ended',
      'evicted',
      'deceased',
      'blocked',
      'replaced',
      'administrative'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'household_relationship') THEN
    CREATE TYPE resident.household_relationship AS ENUM (
      'spouse',
      'child',
      'parent',
      'relative',
      'dependent',
      'legal_charge',
      'other'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'household_member_status') THEN
    CREATE TYPE resident.household_member_status AS ENUM (
      'active',
      'inactive',
      'former'
    );
  END IF;
END $$;

-- ============================================================================
-- 3. properties — Composite FK Parent (frozen item #2, D-13)
-- ============================================================================
ALTER TABLE resident.properties ADD CONSTRAINT properties_id_tenant_key UNIQUE (id, tenant_id);

-- ============================================================================
-- 4. residence_members — D-05 History Evolution (frozen item #1)
-- ============================================================================

-- 4.1 Add new columns
ALTER TABLE resident.residence_members
  ADD COLUMN IF NOT EXISTS end_reason resident.residence_membership_end_reason NULL;

ALTER TABLE resident.residence_members
  ADD COLUMN IF NOT EXISTS requested_end_date date NULL;

ALTER TABLE resident.residence_members
  ADD COLUMN IF NOT EXISTS moveout_requested_at timestamptz NULL;

-- 4.2 Add composite UNIQUE (id, tenant_id) for composite FK support (D-13)
ALTER TABLE resident.residence_members ADD CONSTRAINT residence_members_id_tenant_key UNIQUE (id, tenant_id);

-- 4.3 Add composite FK (property_id, tenant_id) → properties (id, tenant_id) (D-13)
ALTER TABLE resident.residence_members
  ADD CONSTRAINT residence_members_property_composite_fk
  FOREIGN KEY (property_id, tenant_id) REFERENCES resident.properties(id, tenant_id);

-- 4.4 Drop old global UNIQUE (property_id, profile_id)
ALTER TABLE resident.residence_members DROP CONSTRAINT IF EXISTS residence_members_property_id_profile_id_key;

-- 4.5 Add partial unique: one open membership per (property, profile) pair
CREATE UNIQUE INDEX IF NOT EXISTS residence_members_property_profile_open_uidx
  ON resident.residence_members(property_id, profile_id)
  WHERE status IN ('active', 'pending');

-- 4.6 Add tenant-scoped one-active-primary unique (per doc 28 §6.9)
CREATE UNIQUE INDEX IF NOT EXISTS idx_residence_members_one_primary_active
  ON resident.residence_members(tenant_id, profile_id)
  WHERE status = 'active' AND is_primary = true;

-- 4.7 Closure completeness CHECK constraint
ALTER TABLE resident.residence_members
  ADD CONSTRAINT residence_members_closure_complete
  CHECK (
    (status = 'revoked' AND end_date IS NOT NULL AND end_reason IS NOT NULL)
    OR
    (status <> 'revoked' AND end_reason IS NULL)
  );

-- 4.8 EXCLUDE constraint: no overlapping occupancy periods per (property, profile)
ALTER TABLE resident.residence_members
  ADD CONSTRAINT residence_members_no_overlap
  EXCLUDE USING gist (
    property_id WITH =,
    profile_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  ) WHERE (start_date IS NOT NULL);

-- 4.9 Trigger: closed residence_members rows are immutable
CREATE OR REPLACE FUNCTION resident.residence_members_closed_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'revoked' THEN
    RAISE EXCEPTION 'residence_members rows with status=revoked are immutable'
      USING ERRCODE = 'feature_not_supported';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_residence_members_closed_immutable ON resident.residence_members;
CREATE TRIGGER trg_residence_members_closed_immutable
  BEFORE UPDATE ON resident.residence_members
  FOR EACH ROW
  EXECUTE FUNCTION resident.residence_members_closed_immutable();

-- 4.10 Add partial indexes for open membership lookups (per doc 28 §5.4)
CREATE INDEX IF NOT EXISTS idx_residence_members_profile_open
  ON resident.residence_members(profile_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_residence_members_property_open
  ON resident.residence_members(property_id)
  WHERE status = 'active';

-- ============================================================================
-- 5. household_members — Non-Platform Household Persons (D-03 / doc 28 §6.3)
-- ============================================================================
CREATE TABLE IF NOT EXISTS resident.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  responsible_profile_id uuid NOT NULL REFERENCES resident.profiles(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  birth_date date,
  relationship resident.household_relationship NOT NULL,
  status resident.household_member_status NOT NULL DEFAULT 'active',
  start_date date,
  end_date date,
  notes text,
  linked_profile_id uuid NULL REFERENCES resident.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT household_members_period_valid CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT household_members_property_composite_fk FOREIGN KEY (property_id, tenant_id) REFERENCES resident.properties(id, tenant_id)
);

-- 5.1 Indexes for household_members
CREATE INDEX IF NOT EXISTS idx_household_members_property_status ON resident.household_members(property_id, status);
CREATE INDEX IF NOT EXISTS idx_household_members_responsible_status ON resident.household_members(responsible_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_household_members_tenant_status ON resident.household_members(tenant_id, status);

-- 5.2 Partial unique: no duplicate linked active person per property
CREATE UNIQUE INDEX IF NOT EXISTS household_members_property_linked_active_uidx
  ON resident.household_members(property_id, linked_profile_id)
  WHERE linked_profile_id IS NOT NULL AND status = 'active';

-- 5.3 touch_updated_at trigger
DROP TRIGGER IF EXISTS trg_household_members_touch_updated_at ON resident.household_members;
CREATE TRIGGER trg_household_members_touch_updated_at
  BEFORE UPDATE ON resident.household_members
  FOR EACH ROW
  EXECUTE FUNCTION resident.touch_updated_at();

-- 5.4 Protected fields immutability trigger
CREATE OR REPLACE FUNCTION resident.household_members_protected_fields_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable on household_members'
      USING ERRCODE = 'feature_not_supported';
  END IF;
  IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    RAISE EXCEPTION 'property_id is immutable on household_members'
      USING ERRCODE = 'feature_not_supported';
  END IF;
  IF NEW.responsible_profile_id IS DISTINCT FROM OLD.responsible_profile_id THEN
    RAISE EXCEPTION 'responsible_profile_id is immutable on household_members'
      USING ERRCODE = 'feature_not_supported';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_household_members_protected_fields ON resident.household_members;
CREATE TRIGGER trg_household_members_protected_fields
  BEFORE UPDATE ON resident.household_members
  FOR EACH ROW
  EXECUTE FUNCTION resident.household_members_protected_fields_immutable();

-- 5.5 Append-only: no deletes (soft-delete via status = 'former')
CREATE OR REPLACE FUNCTION resident.household_members_prevent_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'household_members deletes are prohibited; use status=''former'''
    USING ERRCODE = 'feature_not_supported';
END;
$$;

DROP TRIGGER IF EXISTS trg_household_members_no_delete ON resident.household_members;
CREATE TRIGGER trg_household_members_no_delete
  BEFORE DELETE ON resident.household_members
  FOR EACH ROW
  EXECUTE FUNCTION resident.household_members_prevent_delete();

-- 5.6 is_household_responsible helper (doc 29 §4)
CREATE OR REPLACE FUNCTION resident.is_household_responsible(target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM resident.household_members AS hm
    WHERE hm.id = target_id
      AND hm.responsible_profile_id = resident.current_profile_id()
      AND EXISTS (
        SELECT 1
        FROM resident.residence_members AS rm
        WHERE rm.property_id = hm.property_id
          AND rm.profile_id = resident.current_profile_id()
          AND rm.status = 'active'
      )
  );
$$;

-- 5.7 Cross-table platform-user duplication invariant (doc 28 §6.3, invariant 6)
CREATE OR REPLACE FUNCTION resident.prevent_platform_user_household_duplicate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  lock_key bigint;
  lock_profile_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'household_members' THEN
    lock_profile_id := NEW.linked_profile_id;
  ELSE
    lock_profile_id := NEW.profile_id;
  END IF;

  lock_key := ('x' || substr(md5(
    COALESCE(NEW.property_id::text, '00000000-0000-0000-0000-000000000000') ||
    COALESCE(lock_profile_id::text, '00000000-0000-0000-0000-000000000000')
  ), 1, 16))::bit(64)::bigint;

  PERFORM pg_advisory_xact_lock(lock_key);

  IF TG_TABLE_NAME = 'household_members' THEN
    IF NEW.linked_profile_id IS NOT NULL AND NEW.status = 'active' THEN
      IF EXISTS (
        SELECT 1 FROM resident.residence_members
        WHERE property_id = NEW.property_id
          AND profile_id = NEW.linked_profile_id
          AND status IN ('active', 'pending')
      ) THEN
        RAISE EXCEPTION 'Profile already has active residence membership for this property'
          USING ERRCODE = 'unique_violation';
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_TABLE_NAME = 'residence_members' THEN
    IF NEW.status IN ('active', 'pending') THEN
      IF EXISTS (
        SELECT 1 FROM resident.household_members
        WHERE property_id = NEW.property_id
          AND linked_profile_id = NEW.profile_id
          AND status = 'active'
      ) THEN
        RAISE EXCEPTION 'Profile is already an active household member for this property'
          USING ERRCODE = 'unique_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 6. Security & RLS Posture
-- ============================================================================
ALTER TABLE resident.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.household_members FORCE ROW LEVEL SECURITY;

-- 6.1 Grants: SELECT only to authenticated (zero INSERT/UPDATE/DELETE grants)
REVOKE ALL ON TABLE resident.household_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE resident.household_members TO authenticated;
GRANT EXECUTE ON FUNCTION resident.is_household_responsible(uuid) TO authenticated;

-- ============================================================================
-- 7. RLS Policies — residence_members (extend)
-- ============================================================================

-- 7.1 INSERT — staff residences:write only
DROP POLICY IF EXISTS residence_members_insert_policy ON resident.residence_members;
CREATE POLICY residence_members_insert_policy ON resident.residence_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    resident.has_tenant_permission(tenant_id, 'residences:write')
  );

-- 7.2 UPDATE — staff residences:write only
DROP POLICY IF EXISTS residence_members_update_policy ON resident.residence_members;
CREATE POLICY residence_members_update_policy ON resident.residence_members
  FOR UPDATE
  TO authenticated
  USING (
    resident.has_tenant_permission(tenant_id, 'residences:write')
  )
  WITH CHECK (
    resident.has_tenant_permission(tenant_id, 'residences:write')
  );

-- Note: existing SELECT policies (self + residences:read) remain unchanged.
-- No DELETE policy — membership closure is an UPDATE to status='revoked'.

-- ============================================================================
-- 8. RLS Policies — household_members (new)
-- ============================================================================

-- 8.1 SELECT — co-household, responsible resident (active authority verified), staff household:read, platform admin
DROP POLICY IF EXISTS household_members_select_policy ON resident.household_members;
CREATE POLICY household_members_select_policy ON resident.household_members
  FOR SELECT
  TO authenticated
  USING (
    resident.is_active_residence_member(property_id)
    OR resident.is_household_responsible(id)
    OR resident.has_tenant_permission(tenant_id, 'household:read')
    OR resident.is_platform_admin()
  );

-- 8.2 INSERT — staff household:write only
DROP POLICY IF EXISTS household_members_insert_policy ON resident.household_members;
CREATE POLICY household_members_insert_policy ON resident.household_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    resident.has_tenant_permission(tenant_id, 'household:write')
  );

-- 8.3 UPDATE — staff household:write only
DROP POLICY IF EXISTS household_members_update_policy ON resident.household_members;
CREATE POLICY household_members_update_policy ON resident.household_members
  FOR UPDATE
  TO authenticated
  USING (
    resident.has_tenant_permission(tenant_id, 'household:write')
  )
  WITH CHECK (
    resident.has_tenant_permission(tenant_id, 'household:write')
  );

-- No DELETE policy — table is append-only (trigger-enforced).

-- ============================================================================
-- 9. Cross-Table Invariant — Platform-User Duplication Prevention (doc 28 §9 invariant 6)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_household_members_no_platform_dup ON resident.household_members;
CREATE TRIGGER trg_household_members_no_platform_dup
  BEFORE INSERT OR UPDATE ON resident.household_members
  FOR EACH ROW
  EXECUTE FUNCTION resident.prevent_platform_user_household_duplicate();

DROP TRIGGER IF EXISTS trg_residence_members_no_household_dup ON resident.residence_members;
CREATE TRIGGER trg_residence_members_no_household_dup
  BEFORE INSERT OR UPDATE ON resident.residence_members
  FOR EACH ROW
  EXECUTE FUNCTION resident.prevent_platform_user_household_duplicate();
