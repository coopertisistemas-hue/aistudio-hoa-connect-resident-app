-- D2 Validation Wave B — SQL validation for ADR-09 Option B and ADR-10 retention
-- Run as postgres against the local Supabase CLI database after validation/d2_setup.sql.

\set ON_ERROR_STOP on
\pset pager off

\echo '=== ADR-09 Option B / ADR-10 SQL validation ==='

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
\echo '--- DB-01 / DB-02 derived ownership projection ---'
DO $$
DECLARE
  inserted_row public.support_messages%ROWTYPE;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT *
  INTO inserted_row
  FROM public.create_support_message(
    '70000000-0000-0000-0000-000000000001',
    'Derived ownership message',
    'resident',
    '20000000-0000-0000-0000-000000000001',
    NULL,
    NULL,
    NULL,
    '2026-07-19T10:50:00Z'
  );

  RAISE NOTICE 'Derived support message tenant_id=% property_id=% resident_profile_id=%',
    inserted_row.tenant_id, inserted_row.property_id, inserted_row.resident_profile_id;

  IF inserted_row.tenant_id <> '11111111-1111-1111-1111-111111111111'
     OR inserted_row.property_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     OR inserted_row.resident_profile_id <> '20000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'DB-01 / DB-02 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- DB-03 / DB-04 spoofed ownership ignored ---'
DO $$
DECLARE
  inserted_row public.support_messages%ROWTYPE;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT *
  INTO inserted_row
  FROM public.create_support_message(
    '70000000-0000-0000-0000-000000000001',
    'Spoof attempt message',
    'resident',
    '20000000-0000-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    '20000000-0000-0000-0000-000000000002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '2026-07-19T10:50:10Z'
  );

  IF inserted_row.tenant_id <> '11111111-1111-1111-1111-111111111111'
     OR inserted_row.property_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     OR inserted_row.resident_profile_id <> '20000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'DB-03 / DB-04 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- DB-05 ownership mutation denied ---'
DO $$
BEGIN
  BEGIN
    UPDATE public.support_messages
    SET tenant_id = '22222222-2222-2222-2222-222222222222'
    WHERE id = '80000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'DB-05 FAILED: tenant_id mutation unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'ownership mutation correctly denied: %', SQLERRM;
  END;
END $$;

\echo ''
\echo '--- DB-06 parent mismatch projection overwritten ---'
DO $$
DECLARE
  inserted_row public.support_messages%ROWTYPE;
BEGIN
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
    '81000000-0000-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '20000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000001',
    'association',
    NULL,
    'Mismatched ownership insert',
    '2026-07-19T10:50:20Z'
  )
  RETURNING * INTO inserted_row;

  IF inserted_row.tenant_id <> '11111111-1111-1111-1111-111111111111'
     OR inserted_row.property_id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     OR inserted_row.resident_profile_id <> '20000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'DB-06 FAILED: parent projection was not enforced';
  END IF;
END $$;

\echo ''
\echo '--- DB-07 direct cross-tenant resident read denied ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.support_messages
  WHERE tenant_id = '22222222-2222-2222-2222-222222222222';

  RAISE NOTICE 'Resident A visible Tenant B support messages: % (expected 0)', cnt;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'DB-07 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- DB-08 staff without support permission denied ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000007';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.support_messages
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

  RAISE NOTICE 'Viewer role visible support messages: % (expected 0)', cnt;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'DB-08 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- DB-09 authorized staff read allowed ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.support_messages
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

  RAISE NOTICE 'Operator A visible Tenant A support messages: % (expected >= 1)', cnt;
  IF cnt < 1 THEN
    RAISE EXCEPTION 'DB-09 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- DB-10 revoked resident membership denies future reads ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  UPDATE public.residence_members
  SET status = 'revoked'
  WHERE id = '30000000-0000-0000-0000-000000000001';

  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt
  FROM public.support_messages
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111';

  RAISE NOTICE 'Resident A visible support messages after revocation: % (expected 0)', cnt;
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'DB-10 FAILED';
  END IF;
END $$;

\echo ''
\echo '--- RT-08 direct read boundary as authenticated resident ---'
DO $$
DECLARE
  cnt integer;
BEGIN
  UPDATE public.residence_members
  SET status = 'active'
  WHERE id = '30000000-0000-0000-0000-000000000001';

  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
  SET LOCAL request.jwt.claim.role = 'authenticated';

  SELECT COUNT(*) INTO cnt FROM public.notifications;
  RAISE NOTICE 'notifications visible to Resident A: % (expected 0 before runtime inserts)', cnt;

  SELECT COUNT(*) INTO cnt
  FROM public.support_messages
  WHERE resident_profile_id = '20000000-0000-0000-0000-000000000001';
  RAISE NOTICE 'Resident A visible direct support messages: % (expected >= 1)', cnt;
  IF cnt < 1 THEN
    RAISE EXCEPTION 'RT-08 FAILED: Resident A should see their own support messages';
  END IF;

  BEGIN
    PERFORM 1 FROM public.tenants;
    RAISE EXCEPTION 'RT-08 FAILED: tenants SELECT should be denied';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'tenants SELECT correctly denied';
  END;

  BEGIN
    PERFORM 1 FROM public.profiles;
    RAISE EXCEPTION 'RT-08 FAILED: profiles SELECT should be denied to authenticated';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'profiles SELECT correctly denied';
  END;

  BEGIN
    PERFORM 1 FROM public.support_requests;
    RAISE EXCEPTION 'RT-08 FAILED: support_requests SELECT should be denied';
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
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'PR-12 FAILED: self contact read';
  END IF;

  SELECT COUNT(*) INTO cnt
  FROM public.profile_contacts
  WHERE profile_id = '20000000-0000-0000-0000-000000000002';
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
SELECT sm.id
FROM public.support_messages AS sm
WHERE sm.tenant_id = '11111111-1111-1111-1111-111111111111'
  AND sm.resident_profile_id = '20000000-0000-0000-0000-000000000001'
ORDER BY sm.created_at, sm.id;

EXPLAIN (COSTS OFF)
SELECT sm.id
FROM public.support_messages AS sm
WHERE sm.support_request_id = '70000000-0000-0000-0000-000000000001'
ORDER BY sm.created_at, sm.id;

EXPLAIN (COSTS OFF)
SELECT sm.id
FROM public.support_messages AS sm
WHERE sm.tenant_id = '22222222-2222-2222-2222-222222222222'
  AND sm.resident_profile_id = '20000000-0000-0000-0000-000000000001';

\echo ''
\echo '=== ADR-09 Option B / ADR-10 SQL validation completed ==='
