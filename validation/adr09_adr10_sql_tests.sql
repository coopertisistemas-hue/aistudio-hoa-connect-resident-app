-- D2 Validation Wave — SQL validation for ADR-09 and ADR-10
-- Run as postgres against the local Supabase CLI database after validation/d2_setup.sql.

\set ON_ERROR_STOP on
\pset pager off

\echo '=== ADR-09 / ADR-10 SQL validation ==='

\echo ''
\echo '--- Grant inspection ---'
SELECT
  table_name,
  has_table_privilege('authenticated', table_regclass, 'SELECT') AS authenticated_select,
  has_table_privilege('authenticated', table_regclass, 'INSERT') AS authenticated_insert,
  has_table_privilege('authenticated', table_regclass, 'UPDATE') AS authenticated_update,
  has_table_privilege('authenticated', table_regclass, 'DELETE') AS authenticated_delete
FROM (
  VALUES
    ('notifications', 'public.notifications'::regclass),
    ('support_messages', 'public.support_messages'::regclass),
    ('profiles', 'public.profiles'::regclass),
    ('profile_contacts', 'public.profile_contacts'::regclass),
    ('support_requests', 'public.support_requests'::regclass),
    ('tenant_members', 'public.tenant_members'::regclass),
    ('tenants', 'public.tenants'::regclass)
) AS inspected(table_name, table_regclass);

\echo ''
\echo '--- RLS status ---'
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'notifications',
    'support_messages',
    'profiles',
    'profile_contacts',
    'support_requests',
    'residence_members',
    'tenant_members'
  )
ORDER BY c.relname;

\echo ''
\echo '--- Policy inventory ---'
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'notifications',
    'support_messages',
    'profiles',
    'profile_contacts',
    'support_requests',
    'residence_members',
    'tenant_members',
    'profile_correction_audit'
  )
ORDER BY tablename, policyname;

\echo ''
\echo '--- RT-06 direct table-read boundary as authenticated resident ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt FROM public.notifications;
  RAISE NOTICE 'notifications visible to Resident A: % (expected 0 before inserts)', cnt;

  SELECT COUNT(*) INTO cnt FROM public.support_messages;
  RAISE NOTICE 'support_messages visible to Resident A: % (expected 1 baseline)', cnt;
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'RT-06 FAILED: Resident A should see exactly the baseline support message';
  END IF;

  BEGIN
    PERFORM 1 FROM public.tenants;
    RAISE EXCEPTION 'RT-06 FAILED: tenants SELECT should be denied';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'tenants SELECT correctly denied';
  END;

  BEGIN
    PERFORM 1 FROM public.profiles;
    RAISE EXCEPTION 'RT-06 FAILED: profiles SELECT should be denied to authenticated';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'profiles SELECT correctly denied';
  END;

  BEGIN
    PERFORM 1 FROM public.support_requests;
    RAISE EXCEPTION 'RT-06 FAILED: support_requests SELECT should be denied';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'support_requests SELECT correctly denied';
  END;
END $$;

\echo ''
\echo '--- PR-01 self read ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE profile_read_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.profiles
  WHERE id = '20000000-0000-0000-0000-000000000001';

  RAISE NOTICE 'Resident A self profile count: % (expected 1)', cnt;
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'PR-01 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- PR-02 approved self update ---'
DO $$
DECLARE
  changed text;
BEGIN
  SET LOCAL ROLE profile_self_update_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  UPDATE public.profiles
  SET preferred_name = 'Ana Validated'
  WHERE user_id = '10000000-0000-0000-0000-000000000001';

  SELECT preferred_name INTO changed
  FROM public.profiles
  WHERE id = '20000000-0000-0000-0000-000000000001';

  RAISE NOTICE 'Resident A preferred_name after update: % (expected Ana Validated)', changed;
  IF changed <> 'Ana Validated' THEN
    RAISE EXCEPTION 'PR-02 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- PR-03 protected self fields blocked ---'
DO $$
BEGIN
  SET LOCAL ROLE profile_self_update_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  BEGIN
    UPDATE public.profiles
    SET document = 'CPF-HACKED'
    WHERE user_id = '10000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'PR-03 FAILED: document update unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'document update correctly denied';
  END;
END $$;

\echo ''
\echo '--- PR-04 cross-profile resident read denied ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE profile_read_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.profiles
  WHERE id = '20000000-0000-0000-0000-000000000002';

  RAISE NOTICE 'Resident A access to Resident B profile rows: % (expected 0)', cnt;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'PR-04 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- PR-05 authorized association operator ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE profile_read_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.profiles
  WHERE id = '20000000-0000-0000-0000-000000000001';

  RAISE NOTICE 'Operator A access to Resident A profile rows: % (expected 1)', cnt;
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'PR-05 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- PR-06 cross-tenant operator denial ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE profile_read_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.profiles
  WHERE id = '20000000-0000-0000-0000-000000000002';

  RAISE NOTICE 'Operator A access to Resident B profile rows: % (expected 0)', cnt;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'PR-06 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- PR-07 generic member denial ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE profile_read_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000007';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.profiles
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  );

  RAISE NOTICE 'Generic member visible linked resident rows: % (expected 0)', cnt;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'PR-07 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- PR-08 unrelated authenticated user denied ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE profile_read_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.profiles
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  );

  RAISE NOTICE 'Unrelated authenticated visible resident rows: % (expected 0)', cnt;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'PR-08 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- PR-09 platform admin correction path and audit ---'
DO $$
DECLARE
  audit_id uuid;
  updated_document text;
  audit_count integer;
BEGIN
  SET LOCAL ROLE platform_admin_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000006';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT public.apply_profile_correction(
    '20000000-0000-0000-0000-000000000002',
    'CPF-B-CORRECTED',
    'Validation governance path'
  )
  INTO audit_id;

  SELECT document INTO updated_document
  FROM public.profiles
  WHERE id = '20000000-0000-0000-0000-000000000002';

  SELECT COUNT(*) INTO audit_count
  FROM public.profile_correction_audit
  WHERE id = audit_id
    AND actor_user_id = '10000000-0000-0000-0000-000000000006';

  RAISE NOTICE 'Platform admin updated document to % with audit rows %', updated_document, audit_count;
  IF updated_document <> 'CPF-B-CORRECTED' OR audit_count <> 1 THEN
    RAISE EXCEPTION 'PR-09 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- PR-12 contact records policy checks ---'
DO $$
DECLARE
  cnt integer;
  new_state text;
BEGIN
  SET LOCAL ROLE profile_read_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.profile_contacts
  WHERE profile_id = '20000000-0000-0000-0000-000000000001';
  RAISE NOTICE 'Resident A self contact rows: % (expected 1)', cnt;
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'PR-12 FAILED: self contact read';
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM public.profile_contacts
  WHERE profile_id = '20000000-0000-0000-0000-000000000002';
  RAISE NOTICE 'Resident A access to Resident B contacts: % (expected 0)', cnt;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'PR-12 FAILED: cross-tenant contact read';
  END IF;

  RESET ROLE;

  SET LOCAL ROLE operator_contact_test;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  UPDATE public.profile_contacts
  SET verification_state = 'verified',
      verified_at = now()
  WHERE id = '60000000-0000-0000-0000-000000000001';

  SELECT verification_state INTO new_state
  FROM public.profile_contacts
  WHERE id = '60000000-0000-0000-0000-000000000001';

  RAISE NOTICE 'Operator A updated verification_state to % (expected verified)', new_state;
  IF new_state <> 'verified' THEN
    RAISE EXCEPTION 'PR-12 FAILED: operator verification update';
  END IF;

  BEGIN
    UPDATE public.profile_contacts
    SET normalized_value = 'tampered@example.com'
    WHERE id = '60000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'PR-12 FAILED: normalized_value update unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'normalized_value update correctly denied';
  END;
END $$;

\echo ''
\echo '--- Performance evidence ---'
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'profile_contacts', 'tenant_members', 'residence_members', 'notifications', 'support_messages', 'support_requests')
ORDER BY tablename, indexname;

EXPLAIN (COSTS OFF)
SELECT p.id
FROM public.profiles AS p
WHERE EXISTS (
  SELECT 1
  FROM public.residence_members AS rm
  JOIN public.properties AS pr
    ON pr.id = rm.property_id
  JOIN public.tenant_members AS tm
    ON tm.tenant_id = pr.tenant_id
  WHERE rm.profile_id = p.id
    AND rm.status = 'active'
    AND tm.user_id = '10000000-0000-0000-0000-000000000004'
    AND tm.status = 'active'
    AND tm.role IN ('admin', 'manager', 'operator')
);

EXPLAIN (COSTS OFF)
SELECT sm.id
FROM public.support_messages AS sm
JOIN public.support_requests AS sr
  ON sr.id = sm.support_request_id
WHERE sr.profile_id = '20000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== ADR-09 / ADR-10 SQL validation completed ==='
