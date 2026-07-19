-- D2 Validation Wave B — isolated local schema setup
-- Environment: local Supabase CLI project_id aistudio-hoa-connect-resident-app
-- Safety: local-only, disposable, non-production. Do not run against a hosted project.

\set ON_ERROR_STOP on

DROP TABLE IF EXISTS public.profile_correction_audit CASCADE;
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.support_requests CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.residence_members CASCADE;
DROP TABLE IF EXISTS public.profile_contacts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.tenant_members CASCADE;
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

DROP FUNCTION IF EXISTS public.current_profile_id() CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_tenant_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_authorized_operator(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_support_request_author(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_active_resident_support_participant(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.derive_support_message_ownership() CASCADE;
DROP FUNCTION IF EXISTS public.enforce_support_message_immutability() CASCADE;
DROP FUNCTION IF EXISTS public.sync_support_message_resident_access() CASCADE;
DROP FUNCTION IF EXISTS public.create_support_message(uuid, text, text, uuid, uuid, uuid, uuid, timestamptz) CASCADE;
DROP FUNCTION IF EXISTS public.apply_profile_correction(uuid, text, text) CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'profile_read_test') THEN
    CREATE ROLE profile_read_test NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'profile_self_update_test') THEN
    CREATE ROLE profile_self_update_test NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'operator_contact_test') THEN
    CREATE ROLE operator_contact_test NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'platform_admin_test') THEN
    CREATE ROLE platform_admin_test NOLOGIN;
  END IF;
END $$;

GRANT profile_read_test TO postgres;
GRANT profile_self_update_test TO postgres;
GRANT operator_contact_test TO postgres;
GRANT platform_admin_test TO postgres;

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.properties (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  preferred_name text,
  display_name text,
  pronoun_preference text,
  document text NOT NULL,
  birth_date date NOT NULL,
  photo_path text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profile_contacts (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_type text NOT NULL CHECK (contact_type IN ('phone', 'whatsapp', 'primary_email', 'secondary_email')),
  normalized_value text NOT NULL,
  display_value text NOT NULL,
  verification_state text NOT NULL CHECK (verification_state IN ('unverified', 'pending', 'verified', 'invalid', 'outdated')),
  verification_sent_at timestamptz,
  verified_at timestamptz,
  invalidated_at timestamptz,
  outdated_at timestamptz,
  communication_preference_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT unique_profile_contact UNIQUE (profile_id, contact_type, normalized_value)
);

CREATE TABLE public.tenant_members (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'operator', 'viewer', 'collector')),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.residence_members (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  role text NOT NULL CHECK (role IN ('holder', 'financial_responsible', 'authorized_resident', 'dependent', 'representative', 'temporary_guest')),
  status text NOT NULL DEFAULT 'active',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_residence_edge UNIQUE (property_id, profile_id)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  category text NOT NULL,
  title_key text NOT NULL,
  body_key text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  protocol text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_requests_identity_projection UNIQUE (id, tenant_id, property_id, profile_id)
);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  resident_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  resident_user_id uuid NOT NULL,
  resident_access_revoked boolean NOT NULL DEFAULT false,
  support_request_id uuid NOT NULL,
  delivery_sequence bigint GENERATED ALWAYS AS IDENTITY,
  sender_type text NOT NULL CHECK (sender_type IN ('resident', 'association', 'system')),
  sender_profile_id uuid REFERENCES public.profiles(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_request_fk
    FOREIGN KEY (support_request_id)
    REFERENCES public.support_requests(id),
  CONSTRAINT support_messages_identity_projection_fk
    FOREIGN KEY (support_request_id, tenant_id, property_id, resident_profile_id)
    REFERENCES public.support_requests(id, tenant_id, property_id, profile_id)
);

CREATE TABLE public.profile_correction_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  field_name text NOT NULL,
  old_value text NOT NULL,
  new_value text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.profiles AS p
  WHERE p.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins AS pa
    WHERE pa.user_id = auth.uid()
      AND pa.active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(target_tenant_id uuid)
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
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_authorized_operator(target_tenant_id uuid)
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
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('admin', 'manager', 'operator')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_support_request_author(target_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_requests AS sr
    WHERE sr.id = target_request_id
      AND sr.profile_id = public.current_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_resident_support_participant(
  target_tenant_id uuid,
  target_property_id uuid,
  target_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.residence_members AS rm
    WHERE rm.tenant_id = target_tenant_id
      AND rm.property_id = target_property_id
      AND rm.profile_id = target_profile_id
      AND rm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.derive_support_message_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent_request public.support_requests%ROWTYPE;
  resident_user uuid;
BEGIN
  SELECT *
  INTO parent_request
  FROM public.support_requests
  WHERE id = NEW.support_request_id;

  IF parent_request.id IS NULL THEN
    RAISE EXCEPTION 'support request not found';
  END IF;

  NEW.tenant_id := parent_request.tenant_id;
  NEW.property_id := parent_request.property_id;
  NEW.resident_profile_id := parent_request.profile_id;
  SELECT p.user_id
  INTO resident_user
  FROM public.profiles AS p
  WHERE p.id = parent_request.profile_id;

  IF resident_user IS NULL THEN
    RAISE EXCEPTION 'resident user not found';
  END IF;

  NEW.resident_user_id := resident_user;
  NEW.resident_access_revoked := NOT public.is_active_resident_support_participant(
    parent_request.tenant_id,
    parent_request.property_id,
    parent_request.profile_id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_support_message_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable';
  END IF;

  IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
    RAISE EXCEPTION 'property_id is immutable';
  END IF;

  IF NEW.resident_profile_id IS DISTINCT FROM OLD.resident_profile_id THEN
    RAISE EXCEPTION 'resident_profile_id is immutable';
  END IF;

  IF NEW.support_request_id IS DISTINCT FROM OLD.support_request_id THEN
    RAISE EXCEPTION 'support_request_id is immutable';
  END IF;

  IF NEW.resident_user_id IS DISTINCT FROM OLD.resident_user_id THEN
    RAISE EXCEPTION 'resident_user_id is immutable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_support_message_resident_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.support_messages
  SET resident_access_revoked = (NEW.status <> 'active')
  WHERE tenant_id = NEW.tenant_id
    AND property_id = NEW.property_id
    AND resident_profile_id = NEW.profile_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_support_message(
  target_support_request_id uuid,
  target_content text,
  target_sender_type text DEFAULT 'resident',
  target_sender_profile_id uuid DEFAULT NULL,
  requested_tenant_id uuid DEFAULT NULL,
  requested_resident_profile_id uuid DEFAULT NULL,
  requested_property_id uuid DEFAULT NULL,
  target_created_at timestamptz DEFAULT now()
)
RETURNS public.support_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent_request public.support_requests%ROWTYPE;
  inserted_row public.support_messages%ROWTYPE;
BEGIN
  SELECT *
  INTO parent_request
  FROM public.support_requests
  WHERE id = target_support_request_id;

  IF parent_request.id IS NULL THEN
    RAISE EXCEPTION 'support request not found';
  END IF;

  IF target_sender_type = 'resident' THEN
    IF parent_request.profile_id <> public.current_profile_id() THEN
      RAISE EXCEPTION 'resident support request access denied';
    END IF;

    IF NOT public.is_active_resident_support_participant(parent_request.tenant_id, parent_request.property_id, parent_request.profile_id) THEN
      RAISE EXCEPTION 'resident support request relationship inactive';
    END IF;
  ELSIF target_sender_type = 'association' THEN
    IF NOT (public.is_authorized_operator(parent_request.tenant_id) OR public.is_platform_admin()) THEN
      RAISE EXCEPTION 'operator support request access denied';
    END IF;
  ELSIF target_sender_type = 'system' THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'system support message access denied';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported sender_type %', target_sender_type;
  END IF;

  INSERT INTO public.support_messages (
    id,
    tenant_id,
    property_id,
    resident_profile_id,
    support_request_id,
    sender_type,
    sender_profile_id,
    content,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    requested_tenant_id,
    requested_property_id,
    requested_resident_profile_id,
    target_support_request_id,
    target_sender_type,
    target_sender_profile_id,
    target_content,
    target_created_at
  )
  RETURNING * INTO inserted_row;

  RETURN inserted_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_profile_correction(
  target_profile_id uuid,
  replacement_document text,
  audit_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_document text;
  audit_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'platform admin required';
  END IF;

  SELECT p.document
  INTO previous_document
  FROM public.profiles AS p
  WHERE p.id = target_profile_id;

  IF previous_document IS NULL THEN
    RAISE EXCEPTION 'target profile not found';
  END IF;

  UPDATE public.profiles
  SET document = replacement_document,
      updated_at = now()
  WHERE id = target_profile_id;

  INSERT INTO public.profile_correction_audit (
    actor_user_id,
    target_profile_id,
    field_name,
    old_value,
    new_value,
    reason
  )
  VALUES (
    auth.uid(),
    target_profile_id,
    'document',
    previous_document,
    replacement_document,
    audit_reason
  )
  RETURNING id INTO audit_id;

  RETURN audit_id;
END;
$$;

CREATE INDEX idx_properties_tenant ON public.properties(tenant_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profile_contacts_profile_active ON public.profile_contacts(profile_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profile_contacts_normalized ON public.profile_contacts(normalized_value) WHERE deleted_at IS NULL;
CREATE INDEX idx_tenant_members_lookup ON public.tenant_members(tenant_id, user_id, role) WHERE status = 'active';
CREATE INDEX idx_platform_admins_lookup ON public.platform_admins(user_id) WHERE active = true;
CREATE INDEX idx_residence_members_profile_active ON public.residence_members(profile_id) WHERE status = 'active';
CREATE INDEX idx_residence_members_property_active ON public.residence_members(property_id) WHERE status = 'active';
CREATE INDEX idx_notifications_profile_created ON public.notifications(profile_id, created_at DESC);
CREATE INDEX idx_support_requests_profile ON public.support_requests(profile_id);
CREATE INDEX idx_support_messages_tenant_resident_created ON public.support_messages(tenant_id, resident_profile_id, created_at, id);
CREATE INDEX idx_support_messages_resident_user_active_created ON public.support_messages(resident_user_id, resident_access_revoked, created_at, id);
CREATE INDEX idx_support_messages_request_created ON public.support_messages(support_request_id, created_at, id);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residence_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_correction_audit ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.properties FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profile_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins FORCE ROW LEVEL SECURITY;
ALTER TABLE public.residence_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profile_correction_audit FORCE ROW LEVEL SECURITY;

CREATE POLICY tenants_select_policy
ON public.tenants
FOR SELECT
USING (public.is_tenant_member(id) OR public.is_platform_admin());

CREATE POLICY properties_select_policy
ON public.properties
FOR SELECT
USING (
  public.is_tenant_member(tenant_id)
  OR EXISTS (
    SELECT 1
    FROM public.residence_members AS rm
    WHERE rm.property_id = properties.id
      AND rm.profile_id = public.current_profile_id()
      AND rm.status = 'active'
  )
  OR public.is_platform_admin()
);

CREATE POLICY tenant_members_select_policy
ON public.tenant_members
FOR SELECT
USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY platform_admins_select_policy
ON public.platform_admins
FOR SELECT
USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY residence_members_select_policy
ON public.residence_members
FOR SELECT
USING (
  profile_id = public.current_profile_id()
  OR public.is_authorized_operator(tenant_id)
  OR public.is_platform_admin()
);

CREATE POLICY profiles_select_self_policy
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY profiles_select_association_policy
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.residence_members AS rm
    JOIN public.properties AS p
      ON p.id = rm.property_id
    JOIN public.tenant_members AS tm
      ON tm.tenant_id = p.tenant_id
    WHERE rm.profile_id = profiles.id
      AND rm.status = 'active'
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('admin', 'manager', 'operator')
  )
);

CREATE POLICY profiles_select_platform_admin_policy
ON public.profiles
FOR SELECT
USING (public.is_platform_admin());

CREATE POLICY profiles_update_self_policy
ON public.profiles
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY profile_contacts_select_self_policy
ON public.profile_contacts
FOR SELECT
USING (profile_id = public.current_profile_id());

CREATE POLICY profile_contacts_select_association_policy
ON public.profile_contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.residence_members AS rm
    JOIN public.properties AS p
      ON p.id = rm.property_id
    JOIN public.tenant_members AS tm
      ON tm.tenant_id = p.tenant_id
    WHERE rm.profile_id = profile_contacts.profile_id
      AND rm.status = 'active'
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('admin', 'manager', 'operator')
  )
  OR public.is_platform_admin()
);

CREATE POLICY profile_contacts_update_self_policy
ON public.profile_contacts
FOR UPDATE
USING (profile_id = public.current_profile_id())
WITH CHECK (profile_id = public.current_profile_id());

CREATE POLICY profile_contacts_update_operator_policy
ON public.profile_contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.residence_members AS rm
    JOIN public.properties AS p
      ON p.id = rm.property_id
    JOIN public.tenant_members AS tm
      ON tm.tenant_id = p.tenant_id
    WHERE rm.profile_id = profile_contacts.profile_id
      AND rm.status = 'active'
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('admin', 'manager', 'operator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.residence_members AS rm
    JOIN public.properties AS p
      ON p.id = rm.property_id
    JOIN public.tenant_members AS tm
      ON tm.tenant_id = p.tenant_id
    WHERE rm.profile_id = profile_contacts.profile_id
      AND rm.status = 'active'
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('admin', 'manager', 'operator')
  )
);

CREATE POLICY notifications_select_self_policy
ON public.notifications
FOR SELECT
USING (profile_id = public.current_profile_id());

CREATE POLICY notifications_update_self_policy
ON public.notifications
FOR UPDATE
USING (profile_id = public.current_profile_id())
WITH CHECK (profile_id = public.current_profile_id());

CREATE POLICY support_requests_select_self_policy
ON public.support_requests
FOR SELECT
USING (profile_id = public.current_profile_id());

CREATE POLICY support_messages_select_resident_policy
ON public.support_messages
FOR SELECT
TO authenticated
USING (
  resident_user_id = auth.uid()
  AND resident_access_revoked = false
);

CREATE POLICY support_messages_select_operator_policy
ON public.support_messages
FOR SELECT
TO authenticated
USING (public.is_authorized_operator(tenant_id));

CREATE POLICY support_messages_select_platform_admin_policy
ON public.support_messages
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY profile_correction_audit_select_platform_admin_policy
ON public.profile_correction_audit
FOR SELECT
USING (public.is_platform_admin());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.support_messages';
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications, public.support_messages;

CREATE TRIGGER derive_support_message_ownership_before_insert
BEFORE INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.derive_support_message_ownership();

CREATE TRIGGER enforce_support_message_immutability_before_update
BEFORE UPDATE ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_support_message_immutability();

CREATE TRIGGER sync_support_message_resident_access_after_membership_change
AFTER UPDATE OF status ON public.residence_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_support_message_resident_access();

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT ON public.support_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_message(uuid, text, text, uuid, uuid, uuid, uuid, timestamptz) TO authenticated;

GRANT USAGE ON SCHEMA public TO profile_read_test, profile_self_update_test, operator_contact_test, platform_admin_test;

GRANT SELECT ON public.tenants, public.properties, public.profiles, public.profile_contacts,
  public.tenant_members, public.platform_admins, public.residence_members, public.profile_correction_audit, public.support_messages
TO profile_read_test, profile_self_update_test, operator_contact_test, platform_admin_test;

GRANT USAGE ON SCHEMA auth TO profile_read_test, profile_self_update_test, operator_contact_test, platform_admin_test;
GRANT EXECUTE ON FUNCTION auth.uid() TO profile_read_test, profile_self_update_test, operator_contact_test, platform_admin_test;

GRANT UPDATE (preferred_name, display_name, pronoun_preference, photo_path)
ON public.profiles TO profile_self_update_test;

GRANT UPDATE (display_value, communication_preference_flags)
ON public.profile_contacts TO profile_self_update_test;

GRANT UPDATE (verification_state, verified_at, invalidated_at, outdated_at)
ON public.profile_contacts TO operator_contact_test;

GRANT EXECUTE ON FUNCTION public.apply_profile_correction(uuid, text, text) TO platform_admin_test;

INSERT INTO public.tenants (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Tenant A'),
  ('22222222-2222-2222-2222-222222222222', 'Tenant B');

INSERT INTO public.properties (id, tenant_id, address) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Tenant A Residence'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Tenant B Residence');

INSERT INTO public.profiles (id, user_id, full_name, preferred_name, display_name, pronoun_preference, document, birth_date, photo_path) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Resident A', 'Ana', 'Ana A', 'ela/dela', 'CPF-A', '1990-01-01', 'profiles/a.jpg'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Resident B', 'Bruno', 'Bruno B', 'ele/dele', 'CPF-B', '1991-02-02', 'profiles/b.jpg'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Unrelated Auth', 'Caio', 'Caio U', 'ele/dele', 'CPF-U', '1992-03-03', 'profiles/u.jpg'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'Operator A', 'Olivia', 'Operator A', 'ela/dela', 'CPF-OA', '1985-04-04', 'profiles/oa.jpg'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'Operator B', 'Otavio', 'Operator B', 'ele/dele', 'CPF-OB', '1986-05-05', 'profiles/ob.jpg'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'Platform Admin', 'Paula', 'Platform Admin', 'ela/dela', 'CPF-PA', '1980-06-06', 'profiles/pa.jpg'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', 'Generic Member A', 'Gabi', 'Generic Member A', 'ela/dela', 'CPF-GA', '1988-07-07', 'profiles/ga.jpg');

INSERT INTO public.residence_members (id, tenant_id, property_id, profile_id, role, status, is_primary) VALUES
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000001', 'holder', 'active', true),
  ('30000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '20000000-0000-0000-0000-000000000002', 'holder', 'active', true);

INSERT INTO public.tenant_members (id, tenant_id, user_id, role, status) VALUES
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000004', 'operator', 'active'),
  ('40000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '10000000-0000-0000-0000-000000000005', 'operator', 'active'),
  ('40000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '10000000-0000-0000-0000-000000000007', 'viewer', 'active');

INSERT INTO public.platform_admins (id, user_id, active) VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', true);

INSERT INTO public.profile_contacts (id, profile_id, contact_type, normalized_value, display_value, verification_state, communication_preference_flags) VALUES
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'primary_email', 'resident.a@example.com', 'resident.a@example.com', 'verified', '{"invoiceDelivery":"email"}'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'primary_email', 'resident.b@example.com', 'resident.b@example.com', 'pending', '{"invoiceDelivery":"whatsapp"}');

INSERT INTO public.support_requests (id, tenant_id, property_id, profile_id, protocol, category, subject) VALUES
  ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '20000000-0000-0000-0000-000000000001', 'SUP-A-001', 'other', 'Support request A'),
  ('70000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '20000000-0000-0000-0000-000000000002', 'SUP-B-001', 'other', 'Support request B');

INSERT INTO public.support_messages (id, support_request_id, sender_type, sender_profile_id, content, created_at) VALUES
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'resident', '20000000-0000-0000-0000-000000000001', 'Initial message A', '2026-07-19T09:00:00Z');
