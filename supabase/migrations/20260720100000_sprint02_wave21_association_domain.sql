-- Sprint 2 Wave 2.1 — Association Domain Foundation Extension
-- Implementation of tenant-scoped association_details, association_settings_private, RLS and constraints.

-- 1. Update has_tenant_permission() function with extended matrix
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
        (target_permission = 'tenant_context:admin' AND tm.role = 'association_admin') OR
        (target_permission = 'residents:read' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_finance', 'association_viewer')) OR
        (target_permission = 'residents:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'residence_payers:read' AND tm.role IN ('association_admin', 'association_operator', 'association_finance', 'association_viewer')) OR
        (target_permission = 'residence_payers:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'household:read' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_viewer')) OR
        (target_permission = 'household:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'invitations:read' AND tm.role IN ('association_admin', 'association_operator', 'association_viewer')) OR
        (target_permission = 'invitations:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'association_details:read' AND tm.role IN ('association_admin', 'association_operator', 'association_finance', 'association_support', 'association_viewer', 'association_collector')) OR
        (target_permission = 'association_details:write' AND tm.role = 'association_admin') OR
        (target_permission = 'audit:read_association' AND tm.role IN ('association_admin', 'association_finance')) OR
        (target_permission = 'residences:read_routes' AND tm.role IN ('association_admin', 'association_operator', 'association_collector'))
      )
  );
$$;

-- 2. Validation helper functions for JSONB constraints
CREATE OR REPLACE FUNCTION public.check_association_details_settings(s jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  k text;
BEGIN
  IF s IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(s) != 'object' THEN
    RETURN false;
  END IF;
  FOR k IN SELECT jsonb_object_keys(s) LOOP
    IF k NOT IN ('requires_resident_approval', 'allows_resident_invitations', 'allows_self_moveout_request', 'invitation_default_expiry_hours') THEN
      RETURN false;
    END IF;
  END LOOP;
  IF s ? 'requires_resident_approval' AND jsonb_typeof(s->'requires_resident_approval') != 'boolean' THEN
    RETURN false;
  END IF;
  IF s ? 'allows_resident_invitations' AND jsonb_typeof(s->'allows_resident_invitations') != 'boolean' THEN
    RETURN false;
  END IF;
  IF s ? 'allows_self_moveout_request' AND jsonb_typeof(s->'allows_self_moveout_request') != 'boolean' THEN
    RETURN false;
  END IF;
  IF s ? 'invitation_default_expiry_hours' THEN
    IF jsonb_typeof(s->'invitation_default_expiry_hours') != 'number' THEN
      RETURN false;
    END IF;
    IF (s->>'invitation_default_expiry_hours')::int < 1 OR (s->>'invitation_default_expiry_hours')::int > 720 THEN
      RETURN false;
    END IF;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_association_details_enabled_modules(m jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  elem text;
BEGIN
  IF m IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(m) != 'array' THEN
    RETURN false;
  END IF;
  FOR elem IN SELECT jsonb_array_elements_text(m) LOOP
    IF elem NOT IN ('residents', 'residences', 'household', 'payers', 'invitations') THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- 3. Table: association_details
CREATE TABLE IF NOT EXISTS public.association_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  trade_name text,
  registration_number text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  district text,
  city text,
  state text,
  postal_code text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_association_details_settings CHECK (public.check_association_details_settings(settings)),
  CONSTRAINT chk_association_details_enabled_modules CHECK (public.check_association_details_enabled_modules(enabled_modules))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_association_details_registration_number_unique
  ON public.association_details(registration_number)
  WHERE registration_number IS NOT NULL;

-- Triggers for association_details
DROP TRIGGER IF EXISTS touch_association_details_updated_at ON public.association_details;
CREATE TRIGGER touch_association_details_updated_at
  BEFORE UPDATE ON public.association_details
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.association_details_protected_fields_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable on association_details'
      USING ERRCODE = 'feature_not_supported';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS association_details_protected_fields_immutable ON public.association_details;
CREATE TRIGGER association_details_protected_fields_immutable
  BEFORE UPDATE ON public.association_details
  FOR EACH ROW
  EXECUTE FUNCTION public.association_details_protected_fields_immutable();

-- 4. Table: association_settings_private
CREATE TABLE IF NOT EXISTS public.association_settings_private (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers for association_settings_private
DROP TRIGGER IF EXISTS touch_association_settings_private_updated_at ON public.association_settings_private;
CREATE TRIGGER touch_association_settings_private_updated_at
  BEFORE UPDATE ON public.association_settings_private
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.association_settings_private_protected_fields_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable on association_settings_private'
      USING ERRCODE = 'feature_not_supported';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS association_settings_private_protected_fields_immutable ON public.association_settings_private;
CREATE TRIGGER association_settings_private_protected_fields_immutable
  BEFORE UPDATE ON public.association_settings_private
  FOR EACH ROW
  EXECUTE FUNCTION public.association_settings_private_protected_fields_immutable();

-- 5. Automatic Seeding Trigger on Tenants
CREATE OR REPLACE FUNCTION public.handle_tenant_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.association_details (tenant_id, trade_name)
  VALUES (NEW.id, NEW.display_name)
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO public.association_settings_private (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tenant_created ON public.tenants;
CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tenant_created();

-- Backfill pre-existing tenants
INSERT INTO public.association_details (tenant_id, trade_name)
SELECT id, display_name FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO public.association_settings_private (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- 6. Security & RLS Posture
ALTER TABLE public.association_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_details FORCE ROW LEVEL SECURITY;

ALTER TABLE public.association_settings_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_settings_private FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.association_details FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.association_details TO authenticated;

REVOKE ALL ON TABLE public.association_settings_private FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.association_settings_private TO authenticated;

-- RLS Policies on association_details
DROP POLICY IF EXISTS association_details_select_policy ON public.association_details;
CREATE POLICY association_details_select_policy
  ON public.association_details
  FOR SELECT
  TO authenticated
  USING (
    public.has_tenant_permission(tenant_id, 'association_details:read')
    OR public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.residence_members rm ON rm.property_id = p.id
      WHERE p.tenant_id = association_details.tenant_id
        AND rm.profile_id = public.current_profile_id()
        AND rm.status = 'active'
    )
  );

DROP POLICY IF EXISTS association_details_update_policy ON public.association_details;
CREATE POLICY association_details_update_policy
  ON public.association_details
  FOR UPDATE
  TO authenticated
  USING (
    public.has_tenant_permission(tenant_id, 'association_details:write')
  )
  WITH CHECK (
    public.has_tenant_permission(tenant_id, 'association_details:write')
  );

DROP POLICY IF EXISTS association_details_insert_policy ON public.association_details;
CREATE POLICY association_details_insert_policy
  ON public.association_details
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_tenant_permission(tenant_id, 'association_details:write')
  );

-- RLS Policies on association_settings_private
DROP POLICY IF EXISTS association_settings_private_select_policy ON public.association_settings_private;
CREATE POLICY association_settings_private_select_policy
  ON public.association_settings_private
  FOR SELECT
  TO authenticated
  USING (
    public.has_tenant_permission(tenant_id, 'association_details:write')
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS association_settings_private_update_policy ON public.association_settings_private;
CREATE POLICY association_settings_private_update_policy
  ON public.association_settings_private
  FOR UPDATE
  TO authenticated
  USING (
    public.has_tenant_permission(tenant_id, 'association_details:write')
  )
  WITH CHECK (
    public.has_tenant_permission(tenant_id, 'association_details:write')
  );

DROP POLICY IF EXISTS association_settings_private_insert_policy ON public.association_settings_private;
CREATE POLICY association_settings_private_insert_policy
  ON public.association_settings_private
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_tenant_permission(tenant_id, 'association_details:write')
  );
