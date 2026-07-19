-- Sprint 1 foundation, identity, tenant security and RLS baseline
-- Local validation only until explicitly deployed.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role') THEN
    CREATE TYPE public.platform_role AS ENUM ('platform_admin', 'platform_support');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_assignment_status') THEN
    CREATE TYPE public.platform_assignment_status AS ENUM ('active', 'revoked');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_status') THEN
    CREATE TYPE public.profile_status AS ENUM ('active', 'inactive', 'under_review', 'disabled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_type') THEN
    CREATE TYPE public.contact_type AS ENUM ('email', 'phone', 'whatsapp');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_state') THEN
    CREATE TYPE public.verification_state AS ENUM ('unverified', 'pending', 'verified', 'invalid', 'outdated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
    CREATE TYPE public.tenant_status AS ENUM ('active', 'inactive', 'under_review');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_status') THEN
    CREATE TYPE public.property_status AS ENUM ('active', 'inactive', 'under_review');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_role') THEN
    CREATE TYPE public.tenant_role AS ENUM ('association_admin', 'association_operator', 'association_finance', 'association_support', 'association_viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_membership_status') THEN
    CREATE TYPE public.tenant_membership_status AS ENUM ('active', 'pending', 'revoked');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'residence_role') THEN
    CREATE TYPE public.residence_role AS ENUM ('owner', 'tenant', 'resident', 'dependent', 'authorized_contact');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'residence_membership_status') THEN
    CREATE TYPE public.residence_membership_status AS ENUM ('active', 'pending', 'revoked');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_permission') THEN
    CREATE TYPE public.tenant_permission AS ENUM (
      'tenant_members:read',
      'tenant_members:write',
      'residences:read',
      'residences:write',
      'profiles:read_association',
      'profiles:update_association',
      'profile_contacts:read_association',
      'profile_contacts:verify',
      'tenant_context:admin'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status public.tenant_status NOT NULL DEFAULT 'active',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  locale text NOT NULL DEFAULT 'pt-BR',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  nickname text,
  address_line1 text NOT NULL,
  address_line2 text,
  district text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text,
  country text NOT NULL DEFAULT 'BR',
  unit_identifier text NOT NULL,
  block_identifier text,
  status public.property_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, unit_identifier)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  preferred_name text,
  avatar_url text,
  status public.profile_status NOT NULL DEFAULT 'active',
  locale text NOT NULL DEFAULT 'pt-BR',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_type public.contact_type NOT NULL,
  normalized_value text NOT NULL,
  display_value text NOT NULL,
  verification_state public.verification_state NOT NULL DEFAULT 'unverified',
  is_primary boolean NOT NULL DEFAULT false,
  is_whatsapp_capable boolean NOT NULL DEFAULT false,
  verification_sent_at timestamptz,
  verified_at timestamptz,
  invalidated_at timestamptz,
  outdated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT profile_contacts_state_consistency CHECK (
    (verification_state <> 'verified' OR verified_at IS NOT NULL)
    AND (verification_state <> 'invalid' OR invalidated_at IS NOT NULL)
    AND (verification_state <> 'outdated' OR outdated_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.platform_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.platform_role NOT NULL,
  status public.platform_assignment_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (profile_id, role)
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.tenant_role NOT NULL,
  status public.tenant_membership_status NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.residence_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.residence_role NOT NULL,
  status public.residence_membership_status NOT NULL DEFAULT 'active',
  is_primary boolean NOT NULL DEFAULT false,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (property_id, profile_id),
  CONSTRAINT residence_members_period_valid CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.profile_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'pt-BR',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  accessibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  app_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  device_platform text NOT NULL,
  app_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  request_id text NOT NULL,
  source text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_contacts_profile_type_normalized_active
  ON public.profile_contacts(profile_id, contact_type, normalized_value)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_contacts_primary_per_type
  ON public.profile_contacts(profile_id, contact_type)
  WHERE is_primary = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_contacts_profile_active ON public.profile_contacts(profile_id, contact_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profile_contacts_normalized_active ON public.profile_contacts(normalized_value) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_members_profile_active ON public.tenant_members(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_status ON public.tenant_members(tenant_id, status, role);
CREATE INDEX IF NOT EXISTS idx_residence_members_profile_active ON public.residence_members(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_residence_members_property_active ON public.residence_members(property_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_tenant_status ON public.properties(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created ON public.audit_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created ON public.audit_events(actor_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_role_assignments_profile_status ON public.platform_role_assignments(profile_id, status);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.has_platform_role(target_role public.platform_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_role_assignments AS pra
    WHERE pra.profile_id = public.current_profile_id()
      AND pra.role = target_role
      AND pra.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_platform_role('platform_admin'::public.platform_role);
$$;

CREATE OR REPLACE FUNCTION public.is_active_tenant_member(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members AS tm
    WHERE tm.tenant_id = target_tenant_id
      AND tm.profile_id = public.current_profile_id()
      AND tm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(target_tenant_id uuid, target_role public.tenant_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members AS tm
    WHERE tm.tenant_id = target_tenant_id
      AND tm.profile_id = public.current_profile_id()
      AND tm.status = 'active'
      AND tm.role = target_role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_permission(target_tenant_id uuid, target_permission public.tenant_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members AS tm
    WHERE tm.tenant_id = target_tenant_id
      AND tm.profile_id = public.current_profile_id()
      AND tm.status = 'active'
      AND (
        (target_permission = 'tenant_members:read' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_finance', 'association_viewer')) OR
        (target_permission = 'tenant_members:write' AND tm.role = 'association_admin') OR
        (target_permission = 'residences:read' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_finance', 'association_viewer')) OR
        (target_permission = 'residences:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'profiles:read_association' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_finance', 'association_viewer')) OR
        (target_permission = 'profiles:update_association' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'profile_contacts:read_association' AND tm.role IN ('association_admin', 'association_operator', 'association_support')) OR
        (target_permission = 'profile_contacts:verify' AND tm.role IN ('association_admin', 'association_operator', 'association_support')) OR
        (target_permission = 'tenant_context:admin' AND tm.role = 'association_admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_residence_member(target_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.residence_members AS rm
    WHERE rm.property_id = target_property_id
      AND rm.profile_id = public.current_profile_id()
      AND rm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_residence(target_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties AS p
    WHERE p.id = target_property_id
      AND (
        public.is_active_residence_member(target_property_id)
        OR public.is_active_tenant_member(p.tenant_id)
        OR public.is_platform_admin()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_profile(target_profile_id uuid, target_tenant_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    target_profile_id = public.current_profile_id()
    OR public.is_platform_admin()
    OR (
      target_tenant_id IS NOT NULL
      AND public.has_tenant_permission(target_tenant_id, 'profiles:update_association'::public.tenant_permission)
    );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH profile_row AS (
    SELECT p.id, p.user_id, p.full_name, p.preferred_name, p.status, p.locale, p.timezone
    FROM public.profiles AS p
    WHERE p.id = public.current_profile_id()
  ),
  tenant_rows AS (
    SELECT t.id, t.display_name, t.slug, tm.role::text AS role, 'staff'::text AS membership_kind
    FROM public.tenant_members AS tm
    JOIN public.tenants AS t
      ON t.id = tm.tenant_id
    WHERE tm.profile_id = public.current_profile_id()
      AND tm.status = 'active'
    UNION ALL
    SELECT t.id, t.display_name, t.slug, rm.role::text AS role, 'residence'::text AS membership_kind
    FROM public.residence_members AS rm
    JOIN public.tenants AS t
      ON t.id = rm.tenant_id
    WHERE rm.profile_id = public.current_profile_id()
      AND rm.status = 'active'
  ),
  residence_rows AS (
    SELECT p.id, p.tenant_id, p.label, p.nickname, p.unit_identifier, p.block_identifier, rm.role::text AS role, rm.is_primary
    FROM public.residence_members AS rm
    JOIN public.properties AS p
      ON p.id = rm.property_id
    WHERE rm.profile_id = public.current_profile_id()
      AND rm.status = 'active'
  )
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(profile_row.*) FROM profile_row),
    'available_tenants', COALESCE((SELECT jsonb_agg(to_jsonb(tenant_rows.*)) FROM tenant_rows), '[]'::jsonb),
    'available_residences', COALESCE((SELECT jsonb_agg(to_jsonb(residence_rows.*)) FROM residence_rows), '[]'::jsonb),
    'platform_roles', COALESCE((
      SELECT jsonb_agg(to_jsonb(role_name))
      FROM (
        SELECT pra.role::text AS role_name
        FROM public.platform_role_assignments AS pra
        WHERE pra.profile_id = public.current_profile_id()
          AND pra.status = 'active'
      ) AS platform_roles
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  target_tenant_id uuid,
  target_action text,
  target_entity_type text,
  target_entity_id uuid,
  target_request_id text,
  target_source text,
  target_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  INSERT INTO public.audit_events (
    tenant_id,
    actor_user_id,
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    request_id,
    source,
    metadata
  )
  VALUES (
    target_tenant_id,
    auth.uid(),
    public.current_profile_id(),
    target_action,
    target_entity_type,
    target_entity_id,
    target_request_id,
    target_source,
    COALESCE(target_metadata, '{}'::jsonb)
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.profiles_protected_fields_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'profiles.user_id is immutable';
  END IF;
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    RAISE EXCEPTION 'profiles.full_name is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.profile_contacts_protected_fields_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.normalized_value IS DISTINCT FROM OLD.normalized_value THEN
    RAISE EXCEPTION 'profile_contacts.normalized_value is immutable via self update';
  END IF;
  IF NEW.verification_state IS DISTINCT FROM OLD.verification_state THEN
    RAISE EXCEPTION 'profile_contacts.verification_state is immutable via self update';
  END IF;
  IF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
    RAISE EXCEPTION 'profile_contacts.verified_at is immutable via self update';
  END IF;
  IF NEW.invalidated_at IS DISTINCT FROM OLD.invalidated_at THEN
    RAISE EXCEPTION 'profile_contacts.invalidated_at is immutable via self update';
  END IF;
  IF NEW.outdated_at IS DISTINCT FROM OLD.outdated_at THEN
    RAISE EXCEPTION 'profile_contacts.outdated_at is immutable via self update';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_touch_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_touch_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_properties_touch_updated_at ON public.properties;
CREATE TRIGGER trg_properties_touch_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_touch_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_profiles_protected_fields_immutable ON public.profiles;
CREATE TRIGGER trg_profiles_protected_fields_immutable BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_protected_fields_immutable();
DROP TRIGGER IF EXISTS trg_profile_contacts_touch_updated_at ON public.profile_contacts;
CREATE TRIGGER trg_profile_contacts_touch_updated_at BEFORE UPDATE ON public.profile_contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_profile_contacts_protected_fields_immutable ON public.profile_contacts;
CREATE TRIGGER trg_profile_contacts_protected_fields_immutable BEFORE UPDATE ON public.profile_contacts FOR EACH ROW EXECUTE FUNCTION public.profile_contacts_protected_fields_immutable();
DROP TRIGGER IF EXISTS trg_platform_role_assignments_touch_updated_at ON public.platform_role_assignments;
CREATE TRIGGER trg_platform_role_assignments_touch_updated_at BEFORE UPDATE ON public.platform_role_assignments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_tenant_members_touch_updated_at ON public.tenant_members;
CREATE TRIGGER trg_tenant_members_touch_updated_at BEFORE UPDATE ON public.tenant_members FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_residence_members_touch_updated_at ON public.residence_members;
CREATE TRIGGER trg_residence_members_touch_updated_at BEFORE UPDATE ON public.residence_members FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_audit_events_immutable_update ON public.audit_events;
CREATE TRIGGER trg_audit_events_immutable_update BEFORE UPDATE OR DELETE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_role_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.residence_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residence_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profile_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profile_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_devices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select_policy ON public.tenants;
CREATE POLICY tenants_select_policy ON public.tenants
  FOR SELECT
  USING (public.is_active_tenant_member(id) OR EXISTS (
    SELECT 1 FROM public.residence_members AS rm
    WHERE rm.tenant_id = tenants.id
      AND rm.profile_id = public.current_profile_id()
      AND rm.status = 'active'
  ) OR public.is_platform_admin());

DROP POLICY IF EXISTS properties_select_policy ON public.properties;
CREATE POLICY properties_select_policy ON public.properties
  FOR SELECT
  USING (public.can_access_residence(id));

DROP POLICY IF EXISTS profiles_select_self_policy ON public.profiles;
CREATE POLICY profiles_select_self_policy ON public.profiles
  FOR SELECT
  USING (id = public.current_profile_id());

DROP POLICY IF EXISTS profiles_select_association_policy ON public.profiles;
CREATE POLICY profiles_select_association_policy ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.residence_members AS rm
      JOIN public.properties AS p
        ON p.id = rm.property_id
      WHERE rm.profile_id = profiles.id
        AND rm.status = 'active'
        AND public.has_tenant_permission(p.tenant_id, 'profiles:read_association'::public.tenant_permission)
    )
  );

DROP POLICY IF EXISTS profiles_select_platform_policy ON public.profiles;
CREATE POLICY profiles_select_platform_policy ON public.profiles
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS profiles_update_self_policy ON public.profiles;
CREATE POLICY profiles_update_self_policy ON public.profiles
  FOR UPDATE
  USING (id = public.current_profile_id())
  WITH CHECK (id = public.current_profile_id());

DROP POLICY IF EXISTS profile_contacts_select_self_policy ON public.profile_contacts;
CREATE POLICY profile_contacts_select_self_policy ON public.profile_contacts
  FOR SELECT
  USING (
    profile_id = public.current_profile_id()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS profile_contacts_select_association_policy ON public.profile_contacts;
CREATE POLICY profile_contacts_select_association_policy ON public.profile_contacts
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.residence_members AS rm
      JOIN public.properties AS p
        ON p.id = rm.property_id
      WHERE rm.profile_id = profile_contacts.profile_id
        AND rm.status = 'active'
        AND public.has_tenant_permission(p.tenant_id, 'profile_contacts:read_association'::public.tenant_permission)
    )
  );

DROP POLICY IF EXISTS profile_contacts_insert_self_policy ON public.profile_contacts;
CREATE POLICY profile_contacts_insert_self_policy ON public.profile_contacts
  FOR INSERT
  WITH CHECK (
    profile_id = public.current_profile_id()
    AND verification_state = 'unverified'
    AND verified_at IS NULL
    AND invalidated_at IS NULL
    AND outdated_at IS NULL
  );

DROP POLICY IF EXISTS profile_contacts_update_self_policy ON public.profile_contacts;
CREATE POLICY profile_contacts_update_self_policy ON public.profile_contacts
  FOR UPDATE
  USING (profile_id = public.current_profile_id() AND deleted_at IS NULL)
  WITH CHECK (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS profile_contacts_delete_self_policy ON public.profile_contacts;
CREATE POLICY profile_contacts_delete_self_policy ON public.profile_contacts
  FOR DELETE
  USING (profile_id = public.current_profile_id() AND deleted_at IS NULL);

DROP POLICY IF EXISTS platform_role_assignments_select_platform_policy ON public.platform_role_assignments;
CREATE POLICY platform_role_assignments_select_platform_policy ON public.platform_role_assignments
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS tenant_members_select_self_policy ON public.tenant_members;
CREATE POLICY tenant_members_select_self_policy ON public.tenant_members
  FOR SELECT
  USING (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS tenant_members_select_admin_policy ON public.tenant_members;
CREATE POLICY tenant_members_select_admin_policy ON public.tenant_members
  FOR SELECT
  USING (public.has_tenant_permission(tenant_id, 'tenant_members:read'::public.tenant_permission) OR public.is_platform_admin());

DROP POLICY IF EXISTS residence_members_select_self_policy ON public.residence_members;
CREATE POLICY residence_members_select_self_policy ON public.residence_members
  FOR SELECT
  USING (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS residence_members_select_tenant_policy ON public.residence_members;
CREATE POLICY residence_members_select_tenant_policy ON public.residence_members
  FOR SELECT
  USING (public.has_tenant_permission(tenant_id, 'residences:read'::public.tenant_permission) OR public.is_platform_admin());

DROP POLICY IF EXISTS profile_preferences_select_self_policy ON public.profile_preferences;
CREATE POLICY profile_preferences_select_self_policy ON public.profile_preferences
  FOR SELECT
  USING (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS profile_preferences_upsert_self_policy ON public.profile_preferences;
CREATE POLICY profile_preferences_upsert_self_policy ON public.profile_preferences
  FOR INSERT
  WITH CHECK (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS profile_preferences_update_self_policy ON public.profile_preferences;
CREATE POLICY profile_preferences_update_self_policy ON public.profile_preferences
  FOR UPDATE
  USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS profile_devices_select_self_policy ON public.profile_devices;
CREATE POLICY profile_devices_select_self_policy ON public.profile_devices
  FOR SELECT
  USING (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS profile_devices_insert_self_policy ON public.profile_devices;
CREATE POLICY profile_devices_insert_self_policy ON public.profile_devices
  FOR INSERT
  WITH CHECK (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS profile_devices_update_self_policy ON public.profile_devices;
CREATE POLICY profile_devices_update_self_policy ON public.profile_devices
  FOR UPDATE
  USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS audit_events_select_platform_policy ON public.audit_events;
CREATE POLICY audit_events_select_platform_policy ON public.audit_events
  FOR SELECT
  USING (public.is_platform_admin());

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_platform_role(public.platform_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_tenant_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, public.tenant_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_permission(uuid, public.tenant_permission) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_residence_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_residence(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_profile(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, uuid, text, text, jsonb) TO authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_contacts TO authenticated;
GRANT SELECT ON public.tenants TO authenticated;
GRANT SELECT ON public.properties TO authenticated;
GRANT SELECT ON public.tenant_members TO authenticated;
GRANT SELECT ON public.residence_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profile_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profile_devices TO authenticated;

COMMENT ON FUNCTION public.current_profile_id() IS 'SECURITY DEFINER. Required to resolve the current platform profile from auth.uid() without exposing profiles broadly.';
COMMENT ON FUNCTION public.has_platform_role(public.platform_role) IS 'SECURITY DEFINER. Required to evaluate platform-scoped roles for the current profile.';
COMMENT ON FUNCTION public.is_platform_admin() IS 'SECURITY DEFINER. Convenience wrapper over has_platform_role(platform_admin).';
COMMENT ON FUNCTION public.is_active_tenant_member(uuid) IS 'SECURITY DEFINER. Evaluates active tenant membership for the current profile.';
COMMENT ON FUNCTION public.has_tenant_role(uuid, public.tenant_role) IS 'SECURITY DEFINER. Evaluates whether the current profile holds a specific tenant role.';
COMMENT ON FUNCTION public.has_tenant_permission(uuid, public.tenant_permission) IS 'SECURITY DEFINER. Maps normalized tenant roles to explicit permissions for policy and Edge Function authorization.';
COMMENT ON FUNCTION public.is_active_residence_member(uuid) IS 'SECURITY DEFINER. Evaluates active residence membership for the current profile.';
COMMENT ON FUNCTION public.can_access_residence(uuid) IS 'SECURITY DEFINER. Cross-checks residence access through either active residence membership, active tenant membership, or platform admin access.';
COMMENT ON FUNCTION public.can_manage_profile(uuid, uuid) IS 'SECURITY DEFINER. Evaluates self, tenant-scoped operational, and platform-admin profile management paths.';
COMMENT ON FUNCTION public.current_tenant_context() IS 'SECURITY DEFINER. Returns backend-validated profile, tenant, residence, and role context for the authenticated user.';
COMMENT ON FUNCTION public.log_audit_event(uuid, text, text, uuid, text, text, jsonb) IS 'SECURITY DEFINER. Writes immutable audit events for identity and tenancy actions.';
