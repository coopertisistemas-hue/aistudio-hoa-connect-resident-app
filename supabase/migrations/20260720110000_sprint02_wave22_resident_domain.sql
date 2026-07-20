-- Sprint 2 Wave 2.2 — Resident Domain Foundation
-- Implementation of tenant-scoped residents table, resident_staff_notes, RLS, triggers, indexes and helper functions.

-- 0. Ensure pg_trgm extension exists for trigram index
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- 1. Create resident_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resident_status') THEN
    CREATE TYPE resident.resident_status AS ENUM (
      'pending',
      'active',
      'inactive',
      'former',
      'deceased',
      'blocked'
    );
  END IF;
END $$;

-- 2. Create residents table
CREATE TABLE IF NOT EXISTS resident.residents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES resident.profiles(id) ON DELETE RESTRICT,
  registration_code text NULL,
  status resident.resident_status NOT NULL DEFAULT 'pending',
  approved_by_profile_id uuid NULL REFERENCES resident.profiles(id) ON DELETE RESTRICT,
  approved_at timestamptz NULL,
  joined_at timestamptz NULL,
  left_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT residents_tenant_profile_key UNIQUE (tenant_id, profile_id),
  CONSTRAINT residents_id_tenant_key UNIQUE (id, tenant_id)
);

-- 3. Create resident_staff_notes table (staff-internal notes / status reasons)
CREATE TABLE IF NOT EXISTS resident.resident_staff_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL,
  note text NOT NULL,
  note_kind text NOT NULL DEFAULT 'general' CHECK (note_kind IN ('general', 'status_reason')),
  author_profile_id uuid NOT NULL REFERENCES resident.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resident_staff_notes_resident_fk FOREIGN KEY (resident_id, tenant_id) REFERENCES resident.residents(id, tenant_id) ON DELETE CASCADE
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_residents_tenant_status ON resident.residents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_residents_profile ON resident.residents(profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS residents_tenant_registration_code_uidx
  ON resident.residents(tenant_id, registration_code)
  WHERE registration_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS residents_registration_code_trgm_idx
  ON resident.residents USING gin (registration_code gin_trgm_ops)
  WHERE registration_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resident_staff_notes_tenant_resident ON resident.resident_staff_notes(tenant_id, resident_id);
CREATE INDEX IF NOT EXISTS idx_resident_staff_notes_author ON resident.resident_staff_notes(author_profile_id);

-- 5. Helper function: is_active_resident
CREATE OR REPLACE FUNCTION resident.is_active_resident(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM resident.residents AS r
    WHERE r.tenant_id = target_tenant_id
      AND r.profile_id = resident.current_profile_id()
      AND r.status = 'active'
  );
$$;

-- 6. Triggers and Trigger Functions
-- 6.1 Updated_at trigger for residents
DROP TRIGGER IF EXISTS trg_residents_updated_at ON resident.residents;
CREATE TRIGGER trg_residents_updated_at
  BEFORE UPDATE ON resident.residents
  FOR EACH ROW
  EXECUTE FUNCTION resident.touch_updated_at();

-- 6.2 Protected fields immutability trigger for residents
CREATE OR REPLACE FUNCTION resident.residents_protected_fields_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable';
  END IF;
  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'profile_id is immutable';
  END IF;
  IF OLD.approved_by_profile_id IS NOT NULL AND NEW.approved_by_profile_id IS DISTINCT FROM OLD.approved_by_profile_id THEN
    RAISE EXCEPTION 'approved_by_profile_id is immutable once set';
  END IF;
  IF OLD.approved_at IS NOT NULL AND NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'approved_at is immutable once set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_residents_protected_fields ON resident.residents;
CREATE TRIGGER trg_residents_protected_fields
  BEFORE UPDATE ON resident.residents
  FOR EACH ROW
  EXECUTE FUNCTION resident.residents_protected_fields_immutable();

-- 6.3 Resident status transition validation trigger
CREATE OR REPLACE FUNCTION resident.residents_status_transition_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'deceased' THEN
      RAISE EXCEPTION 'Transition out of terminal status deceased is prohibited';
    ELSIF OLD.status = 'pending' THEN
      IF NEW.status NOT IN ('active', 'former') THEN
        RAISE EXCEPTION 'Invalid status transition from pending to %', NEW.status;
      END IF;
      IF NEW.status = 'active' THEN
        IF NEW.joined_at IS NULL THEN NEW.joined_at := now(); END IF;
        IF NEW.approved_at IS NULL THEN NEW.approved_at := now(); END IF;
        IF NEW.approved_by_profile_id IS NULL THEN NEW.approved_by_profile_id := resident.current_profile_id(); END IF;
      END IF;
    ELSIF OLD.status = 'active' THEN
      IF NEW.status NOT IN ('inactive', 'blocked', 'former', 'deceased') THEN
        RAISE EXCEPTION 'Invalid status transition from active to %', NEW.status;
      END IF;
      IF NEW.status IN ('former', 'deceased') AND NEW.left_at IS NULL THEN
        NEW.left_at := now();
      END IF;
    ELSIF OLD.status = 'inactive' THEN
      IF NEW.status NOT IN ('active', 'blocked', 'former', 'deceased') THEN
        RAISE EXCEPTION 'Invalid status transition from inactive to %', NEW.status;
      END IF;
      IF NEW.status IN ('former', 'deceased') AND NEW.left_at IS NULL THEN
        NEW.left_at := now();
      END IF;
    ELSIF OLD.status = 'blocked' THEN
      IF NEW.status NOT IN ('active', 'former', 'deceased') THEN
        RAISE EXCEPTION 'Invalid status transition from blocked to %', NEW.status;
      END IF;
      IF NEW.status IN ('former', 'deceased') AND NEW.left_at IS NULL THEN
        NEW.left_at := now();
      END IF;
    ELSIF OLD.status = 'former' THEN
      IF NEW.status != 'pending' THEN
        RAISE EXCEPTION 'Invalid status transition from former to % (must transition through pending for re-entry)', NEW.status;
      END IF;
      NEW.left_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_residents_status_transition ON resident.residents;
CREATE TRIGGER trg_residents_status_transition
  BEFORE UPDATE ON resident.residents
  FOR EACH ROW
  EXECUTE FUNCTION resident.residents_status_transition_check();

-- 6.4 Append-only triggers for resident_staff_notes
CREATE OR REPLACE FUNCTION resident.resident_staff_notes_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'resident_staff_notes is append-only: updates and deletes are prohibited';
END;
$$;

DROP TRIGGER IF EXISTS trg_resident_staff_notes_no_update ON resident.resident_staff_notes;
CREATE TRIGGER trg_resident_staff_notes_no_update
  BEFORE UPDATE ON resident.resident_staff_notes
  FOR EACH ROW
  EXECUTE FUNCTION resident.resident_staff_notes_prevent_mutation();

DROP TRIGGER IF EXISTS trg_resident_staff_notes_no_delete ON resident.resident_staff_notes;
CREATE TRIGGER trg_resident_staff_notes_no_delete
  BEFORE DELETE ON resident.resident_staff_notes
  FOR EACH ROW
  EXECUTE FUNCTION resident.resident_staff_notes_prevent_mutation();

-- 7. Enable RLS and Configure Policies
ALTER TABLE resident.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.residents FORCE ROW LEVEL SECURITY;

ALTER TABLE resident.resident_staff_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.resident_staff_notes FORCE ROW LEVEL SECURITY;

-- 7.1 RLS Policies for residents
DROP POLICY IF EXISTS residents_select_policy ON resident.residents;
CREATE POLICY residents_select_policy ON resident.residents
  FOR SELECT
  TO authenticated
  USING (
    profile_id = resident.current_profile_id()
    OR resident.has_tenant_permission(tenant_id, 'residents:read')
    OR resident.is_platform_admin()
  );

DROP POLICY IF EXISTS residents_insert_policy ON resident.residents;
CREATE POLICY residents_insert_policy ON resident.residents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    resident.has_tenant_permission(tenant_id, 'residents:write')
    AND status = 'pending'
  );

DROP POLICY IF EXISTS residents_update_policy ON resident.residents;
CREATE POLICY residents_update_policy ON resident.residents
  FOR UPDATE
  TO authenticated
  USING (
    resident.has_tenant_permission(tenant_id, 'residents:write')
  )
  WITH CHECK (
    resident.has_tenant_permission(tenant_id, 'residents:write')
  );

-- 7.2 RLS Policies for resident_staff_notes
DROP POLICY IF EXISTS resident_staff_notes_select_policy ON resident.resident_staff_notes;
CREATE POLICY resident_staff_notes_select_policy ON resident.resident_staff_notes
  FOR SELECT
  TO authenticated
  USING (
    resident.has_tenant_permission(tenant_id, 'residents:write')
    OR resident.is_platform_admin()
  );

DROP POLICY IF EXISTS resident_staff_notes_insert_policy ON resident.resident_staff_notes;
CREATE POLICY resident_staff_notes_insert_policy ON resident.resident_staff_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    resident.has_tenant_permission(tenant_id, 'residents:write')
    AND author_profile_id = resident.current_profile_id()
  );

-- 8. Grants (STRICT Sprint 2 Mutation-Boundary Posture: SELECT only, NO direct table write grants)
GRANT SELECT ON TABLE resident.residents TO authenticated;
GRANT SELECT ON TABLE resident.resident_staff_notes TO authenticated;
GRANT EXECUTE ON FUNCTION resident.is_active_resident(uuid) TO authenticated;
