\set ON_ERROR_STOP on
\pset pager off

\echo '=== Sprint 2 Wave 2.1 Association Domain Validation ==='

BEGIN;

-- Test 1: Seed verification & 1:1 constraint
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  details_count integer;
  private_count integer;
BEGIN
  SELECT COUNT(*) INTO details_count FROM public.association_details WHERE tenant_id = tenant_a_id;
  IF details_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-ASSOC-01 failed: tenant A should have exactly 1 association_details row, got %', details_count;
  END IF;

  SELECT COUNT(*) INTO private_count FROM public.association_settings_private WHERE tenant_id = tenant_a_id;
  IF private_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-ASSOC-02 failed: tenant A should have exactly 1 association_settings_private row, got %', private_count;
  END IF;

  -- Duplicate tenant_id insert should fail 1:1 constraint
  BEGIN
    INSERT INTO public.association_details (tenant_id, trade_name)
    VALUES (tenant_a_id, 'Duplicate Tenant');
    RAISE EXCEPTION 'SPR2-ASSOC-03 failed: duplicate tenant_id insert should be rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
END $$;

-- Test 2: Global partial unique registration_number constraint
DO $$
DECLARE
  tenant_b_id uuid;
BEGIN
  INSERT INTO public.tenants (legal_name, display_name, slug)
  VALUES ('Tenant B Legal', 'Tenant B', 'tenant-b-slug')
  RETURNING id INTO tenant_b_id;

  -- Set registration number on Tenant A
  UPDATE public.association_details
  SET registration_number = '12345678000199'
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

  -- Attempt duplicate registration number on Tenant B
  BEGIN
    UPDATE public.association_details
    SET registration_number = '12345678000199'
    WHERE tenant_id = tenant_b_id;
    RAISE EXCEPTION 'SPR2-ASSOC-04 failed: duplicate registration_number across tenants should be rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;
END $$;

-- Test 3: Settings allow-list & validation check constraint
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
BEGIN
  -- Valid settings
  UPDATE public.association_details
  SET settings = '{"requires_resident_approval": true, "invitation_default_expiry_hours": 48}'::jsonb
  WHERE tenant_id = tenant_a_id;

  -- Invalid setting key
  BEGIN
    UPDATE public.association_details
    SET settings = '{"unauthorized_key": "val"}'::jsonb
    WHERE tenant_id = tenant_a_id;
    RAISE EXCEPTION 'SPR2-ASSOC-05 failed: unauthorized settings key should be rejected';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  -- Out-of-range expiry hours
  BEGIN
    UPDATE public.association_details
    SET settings = '{"invitation_default_expiry_hours": 9999}'::jsonb
    WHERE tenant_id = tenant_a_id;
    RAISE EXCEPTION 'SPR2-ASSOC-06 failed: out-of-range expiry hours should be rejected';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;
END $$;

-- Test 4: Enabled modules allow-list & validation check constraint
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
BEGIN
  -- Valid modules
  UPDATE public.association_details
  SET enabled_modules = '["residents", "residences", "household"]'::jsonb
  WHERE tenant_id = tenant_a_id;

  -- Invalid module name
  BEGIN
    UPDATE public.association_details
    SET enabled_modules = '["residents", "unauthorized_module"]'::jsonb
    WHERE tenant_id = tenant_a_id;
    RAISE EXCEPTION 'SPR2-ASSOC-07 failed: unauthorized module name should be rejected';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;
END $$;

-- Test 5: Immutability of tenant_id
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  tenant_dummy_id uuid := gen_random_uuid();
BEGIN
  BEGIN
    UPDATE public.association_details
    SET tenant_id = tenant_dummy_id
    WHERE tenant_id = tenant_a_id;
    RAISE EXCEPTION 'SPR2-ASSOC-08 failed: tenant_id mutation on association_details should be rejected';
  EXCEPTION
    WHEN feature_not_supported THEN
      NULL;
  END;

  BEGIN
    UPDATE public.association_settings_private
    SET tenant_id = tenant_dummy_id
    WHERE tenant_id = tenant_a_id;
    RAISE EXCEPTION 'SPR2-ASSOC-09 failed: tenant_id mutation on association_settings_private should be rejected';
  EXCEPTION
    WHEN feature_not_supported THEN
      NULL;
  END;
END $$;

-- Test 6: RLS Access Control & Isolation
-- Setup Tenant B with admin, operator, collector, and resident
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  tenant_b_id uuid;
  admin_b_profile_id uuid := '20000000-0000-0000-0000-000000000010'::uuid;
  admin_b_user_id uuid := '10000000-0000-0000-0000-000000000010'::uuid;
  collector_a_profile_id uuid := '20000000-0000-0000-0000-000000000011'::uuid;
  collector_a_user_id uuid := '10000000-0000-0000-0000-000000000011'::uuid;
  rec_count integer;
BEGIN
  -- Create Tenant B
  INSERT INTO public.tenants (id, legal_name, display_name, slug)
  VALUES ('22222222-2222-2222-2222-222222222222'::uuid, 'Associacao B', 'Assoc B', 'assoc-b')
  ON CONFLICT (id) DO NOTHING;
  tenant_b_id := '22222222-2222-2222-2222-222222222222'::uuid;

  -- Create user & profile for Admin B
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (admin_b_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.b@example.com', 'pass', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, user_id, full_name, status)
  VALUES (admin_b_profile_id, admin_b_user_id, 'Admin B', 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tenant_members (tenant_id, profile_id, role, status)
  VALUES (tenant_b_id, admin_b_profile_id, 'association_admin', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Create user & profile for Collector A
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (collector_a_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'collector.a@example.com', 'pass', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, user_id, full_name, status)
  VALUES (collector_a_profile_id, collector_a_user_id, 'Collector A', 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tenant_members (tenant_id, profile_id, role, status)
  VALUES (tenant_a_id, collector_a_profile_id, 'association_collector', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Test as Resident A (profile 20000000-0000-0000-0000-000000000001, user 10000000-0000-0000-0000-000000000001)
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  -- Resident A can read Tenant A association_details
  SELECT COUNT(*) INTO rec_count FROM public.association_details WHERE tenant_id = tenant_a_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-01 failed: Resident A should read Tenant A association_details';
  END IF;

  -- Resident A cannot read Tenant B association_details
  SELECT COUNT(*) INTO rec_count FROM public.association_details WHERE tenant_id = tenant_b_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-02 failed: Resident A should NOT read Tenant B association_details';
  END IF;

  -- Resident A cannot read association_settings_private
  SELECT COUNT(*) INTO rec_count FROM public.association_settings_private;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-03 failed: Resident A should NOT read association_settings_private';
  END IF;

  -- Test as Operator A (user 10000000-0000-0000-0000-000000000002)
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  SET LOCAL ROLE authenticated;

  -- Operator A reads Tenant A details
  SELECT COUNT(*) INTO rec_count FROM public.association_details WHERE tenant_id = tenant_a_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-04 failed: Operator A should read Tenant A association_details';
  END IF;

  -- Operator A does NOT read private settings (admin only)
  SELECT COUNT(*) INTO rec_count FROM public.association_settings_private WHERE tenant_id = tenant_a_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-05 failed: Operator A should NOT read association_settings_private';
  END IF;

  -- Test as Collector A
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', collector_a_user_id::text, true);
  SET LOCAL ROLE authenticated;

  -- Collector A reads Tenant A details (has permission association_details:read)
  SELECT COUNT(*) INTO rec_count FROM public.association_details WHERE tenant_id = tenant_a_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-06 failed: Collector A should read Tenant A association_details';
  END IF;

  -- Collector A does NOT read Tenant B details
  SELECT COUNT(*) INTO rec_count FROM public.association_details WHERE tenant_id = tenant_b_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-07 failed: Collector A should NOT read Tenant B association_details';
  END IF;

  -- Test as Admin B
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', admin_b_user_id::text, true);
  SET LOCAL ROLE authenticated;

  -- Admin B reads Tenant B association_details AND association_settings_private
  SELECT COUNT(*) INTO rec_count FROM public.association_details WHERE tenant_id = tenant_b_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-08 failed: Admin B should read Tenant B association_details';
  END IF;

  SELECT COUNT(*) INTO rec_count FROM public.association_settings_private WHERE tenant_id = tenant_b_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-09 failed: Admin B should read Tenant B association_settings_private';
  END IF;

  -- Admin B does NOT read Tenant A private settings
  SELECT COUNT(*) INTO rec_count FROM public.association_settings_private WHERE tenant_id = tenant_a_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-10 failed: Admin B should NOT read Tenant A association_settings_private';
  END IF;

  -- Test as Platform Admin (user 10000000-0000-0000-0000-000000000003)
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM public.association_details;
  IF rec_count < 2 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-11 failed: Platform admin should read all association_details';
  END IF;

  SELECT COUNT(*) INTO rec_count FROM public.association_settings_private;
  IF rec_count < 2 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-12 failed: Platform admin should read all association_settings_private';
  END IF;

  RESET ROLE;
END $$;

-- Test 7: Direct write blocking & grant layer validation (SPR2-GRANT-01 & SPR2-GRANT-02)
DO $$
DECLARE
  has_table_write boolean;
BEGIN
  -- Assert catalog contains NO INSERT, UPDATE or DELETE grant to authenticated on new Sprint 2 tables
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name IN ('association_details', 'association_settings_private')
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) INTO has_table_write;

  IF has_table_write THEN
    RAISE EXCEPTION 'SPR2-GRANT-01 failed: new Sprint 2 tables contain forbidden table write grant to authenticated';
  END IF;

  -- Direct write attempt as authenticated should raise insufficient_privilege (42501)
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    UPDATE public.association_details
    SET trade_name = 'Direct Write Attempt'
    WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
    RAISE EXCEPTION 'SPR2-GRANT-02 failed: direct table update should be denied at grant layer';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  RESET ROLE;
END $$;

ROLLBACK;

\echo '=== Sprint 2 Wave 2.1 Association Domain Validation Completed ==='
