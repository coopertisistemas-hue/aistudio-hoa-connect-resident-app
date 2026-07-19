\set ON_ERROR_STOP on
\pset pager off

\echo '=== Sprint 1 foundation validation ==='

BEGIN;

DO $$
DECLARE
  self_profile_id uuid;
  tenant_count integer;
  residence_count integer;
  other_profile_count integer;
  operator_profile_count integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  SELECT public.current_profile_id() INTO self_profile_id;
  IF self_profile_id <> '20000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'SPR1-AUTH-01 failed: current_profile_id mismatch';
  END IF;

  IF NOT public.can_access_residence('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) THEN
    RAISE EXCEPTION 'SPR1-AUTH-02 failed: resident should access linked residence';
  END IF;

  SELECT COUNT(*) INTO tenant_count FROM public.tenants;
  IF tenant_count <> 1 THEN
    RAISE EXCEPTION 'SPR1-RLS-01 failed: resident tenant enumeration should return exactly one linked tenant';
  END IF;

  SELECT COUNT(*) INTO residence_count FROM public.properties;
  IF residence_count <> 1 THEN
    RAISE EXCEPTION 'SPR1-RLS-02 failed: resident residence enumeration should return exactly one linked residence';
  END IF;

  SELECT COUNT(*) INTO other_profile_count
  FROM public.profiles
  WHERE id <> self_profile_id;
  IF other_profile_count <> 0 THEN
    RAISE EXCEPTION 'SPR1-RLS-03 failed: resident profile enumeration should be blocked';
  END IF;

  BEGIN
    UPDATE public.profiles
    SET full_name = 'Escalated Resident'
    WHERE id = self_profile_id;
    RAISE EXCEPTION 'SPR1-RLS-04 failed: protected full_name update should be denied';
  EXCEPTION
    WHEN others THEN
      NULL;
  END;

  BEGIN
    UPDATE public.profile_contacts
    SET verification_state = 'verified',
        verified_at = now()
    WHERE profile_id = self_profile_id
      AND contact_type = 'email';
    RAISE EXCEPTION 'SPR1-RLS-05 failed: resident forged contact verification';
  EXCEPTION
    WHEN others THEN
      NULL;
  END;

  RESET ROLE;
END $$;

DO $$
DECLARE
  visible_profiles integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO visible_profiles
  FROM public.profiles;
  IF visible_profiles < 2 THEN
    RAISE EXCEPTION 'SPR1-RLS-06 failed: authorized operator should read linked resident profiles';
  END IF;

  RESET ROLE;
END $$;

DO $$
DECLARE
  visible_tenants integer;
  total_tenants integer;
BEGIN
  SELECT COUNT(*) INTO total_tenants FROM public.tenants;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO visible_tenants
  FROM public.tenants;
  IF visible_tenants < 1 OR visible_tenants <> total_tenants THEN
    RAISE EXCEPTION 'SPR1-RLS-07 failed: platform admin should read all tenants (visible=%, total=%)',
      visible_tenants, total_tenants;
  END IF;

  RESET ROLE;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
    SET LOCAL ROLE authenticated;
    UPDATE public.audit_events
    SET action = 'tamper';
    RAISE EXCEPTION 'SPR1-RLS-08 failed: audit events should be immutable';
  EXCEPTION
    WHEN others THEN
      RESET ROLE;
  END;
END $$;

ROLLBACK;

\echo '=== Sprint 1 foundation validation completed ==='
