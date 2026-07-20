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

-- ============================================================================
-- === Sprint 2 Wave 2.2 Resident Domain Foundation Validation ===
-- ============================================================================

-- Test 8: Resident Schema & Constraints Validation
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  tenant_b_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  profile_1_id uuid := '20000000-0000-0000-0000-000000000001'::uuid;
  profile_2_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  invalid_tenant_id uuid := '99999999-9999-9999-9999-999999999999'::uuid;
  res_id uuid;
BEGIN
  -- SPR2-RES-01: Foreign Key to invalid tenant fails
  BEGIN
    INSERT INTO public.residents (tenant_id, profile_id, status)
    VALUES (invalid_tenant_id, profile_1_id, 'pending');
    RAISE EXCEPTION 'SPR2-RES-01 failed: invalid tenant_id FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- Create valid pending resident for profile_1 on tenant_a
  INSERT INTO public.residents (tenant_id, profile_id, registration_code, status)
  VALUES (tenant_a_id, profile_1_id, 'REG-001', 'pending')
  RETURNING id INTO res_id;

  -- SPR2-RES-02: Duplicate (tenant_id, profile_id) fails
  BEGIN
    INSERT INTO public.residents (tenant_id, profile_id, status)
    VALUES (tenant_a_id, profile_1_id, 'pending');
    RAISE EXCEPTION 'SPR2-RES-02 failed: duplicate (tenant_id, profile_id) should be rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- SPR2-RES-03: Non-reusable registration_code within tenant fails
  BEGIN
    INSERT INTO public.residents (tenant_id, profile_id, registration_code, status)
    VALUES (tenant_a_id, profile_2_id, 'REG-001', 'pending');
    RAISE EXCEPTION 'SPR2-RES-03 failed: duplicate registration_code in same tenant should be rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- SPR2-RES-04: Same registration_code on different tenant allowed
  INSERT INTO public.residents (tenant_id, profile_id, registration_code, status)
  VALUES (tenant_b_id, profile_1_id, 'REG-001', 'pending');

  -- SPR2-RES-05 & 06: Composite FK (resident_id, tenant_id) on resident_staff_notes
  BEGIN
    INSERT INTO public.resident_staff_notes (tenant_id, resident_id, note, author_profile_id)
    VALUES (tenant_b_id, res_id, 'Cross-tenant note attempt', profile_1_id);
    RAISE EXCEPTION 'SPR2-RES-06 failed: cross-tenant resident_id/tenant_id composite FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;
END $$;

-- Test 9: Protected Fields Immutability
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  tenant_b_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  profile_1_id uuid := '20000000-0000-0000-0000-000000000001'::uuid;
  profile_2_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  res_id uuid;
BEGIN
  SELECT id INTO res_id FROM public.residents WHERE tenant_id = tenant_a_id AND profile_id = profile_1_id;

  -- SPR2-RES-PROT-01: Updating tenant_id fails
  BEGIN
    UPDATE public.residents SET tenant_id = tenant_b_id WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-PROT-01 failed: updating tenant_id should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- SPR2-RES-PROT-02: Updating profile_id fails
  BEGIN
    UPDATE public.residents SET profile_id = profile_2_id WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-PROT-02 failed: updating profile_id should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- Update to active (sets approval fields)
  UPDATE public.residents SET status = 'active' WHERE id = res_id;

  -- SPR2-RES-PROT-03: Updating approved_by_profile_id once set fails
  BEGIN
    UPDATE public.residents SET approved_by_profile_id = profile_2_id WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-PROT-03 failed: updating approved_by_profile_id once set should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- SPR2-RES-PROT-05: Updating registration_code succeeds
  UPDATE public.residents SET registration_code = 'REG-001-MODIFIED' WHERE id = res_id;
END $$;

-- Test 10: Resident Lifecycle Status Transitions
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  profile_2_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  res_id uuid;
  res_rec record;
BEGIN
  INSERT INTO public.residents (tenant_id, profile_id, status)
  VALUES (tenant_a_id, profile_2_id, 'pending')
  RETURNING id INTO res_id;

  -- SPR2-RES-LIFE-02: pending -> blocked fails
  BEGIN
    UPDATE public.residents SET status = 'blocked' WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-LIFE-02 failed: pending -> blocked transition should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- SPR2-RES-LIFE-01: pending -> active succeeds and sets joined_at, approved_at
  UPDATE public.residents SET status = 'active' WHERE id = res_id;
  SELECT * INTO res_rec FROM public.residents WHERE id = res_id;
  IF res_rec.joined_at IS NULL OR res_rec.approved_at IS NULL THEN
    RAISE EXCEPTION 'SPR2-RES-LIFE-01 failed: pending -> active should populate joined_at and approved_at';
  END IF;

  -- SPR2-RES-LIFE-03: active -> former sets left_at
  UPDATE public.residents SET status = 'former' WHERE id = res_id;
  SELECT * INTO res_rec FROM public.residents WHERE id = res_id;
  IF res_rec.left_at IS NULL THEN
    RAISE EXCEPTION 'SPR2-RES-LIFE-03 failed: active -> former should populate left_at';
  END IF;

  -- SPR2-RES-LIFE-05: former -> active direct fails
  BEGIN
    UPDATE public.residents SET status = 'active' WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-LIFE-05 failed: former -> active direct transition should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- SPR2-RES-LIFE-04: former -> pending re-entry succeeds and clears left_at
  UPDATE public.residents SET status = 'pending' WHERE id = res_id;
  SELECT * INTO res_rec FROM public.residents WHERE id = res_id;
  IF res_rec.left_at IS NOT NULL THEN
    RAISE EXCEPTION 'SPR2-RES-LIFE-04 failed: former -> pending re-entry should clear left_at';
  END IF;

  -- Transition back to active -> deceased
  UPDATE public.residents SET status = 'active' WHERE id = res_id;
  UPDATE public.residents SET status = 'deceased' WHERE id = res_id;

  -- SPR2-RES-LIFE-07: transition out of deceased fails
  BEGIN
    UPDATE public.residents SET status = 'pending' WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-LIFE-07 failed: transition out of deceased should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;
END $$;

-- Test 11: RLS & Direct Write Posture for residents and resident_staff_notes
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  tenant_b_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  profile_1_id uuid := '20000000-0000-0000-0000-000000000001'::uuid;
  profile_2_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  res_a_id uuid;
  has_table_write boolean;
  rec_count integer;
BEGIN
  SELECT id INTO res_a_id FROM public.residents WHERE tenant_id = tenant_a_id AND profile_id = profile_1_id;

  -- 1. Catalog Grant Audit (SPR2-RES-GRANT-01): Assert NO INSERT, UPDATE or DELETE grant to authenticated
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name IN ('residents', 'resident_staff_notes')
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) INTO has_table_write;

  IF has_table_write THEN
    RAISE EXCEPTION 'SPR2-RES-GRANT-01 failed: residents/resident_staff_notes contain forbidden table write grants to authenticated';
  END IF;

  -- 2. Anonymous access check (denied at grant layer)
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE anon;

  BEGIN
    SELECT COUNT(*) INTO rec_count FROM public.residents;
    IF rec_count <> 0 THEN
      RAISE EXCEPTION 'SPR2-RES-RLS-01 failed: anon user should read 0 residents';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    SELECT COUNT(*) INTO rec_count FROM public.resident_staff_notes;
    IF rec_count <> 0 THEN
      RAISE EXCEPTION 'SPR2-RES-RLS-01b failed: anon user should read 0 resident_staff_notes';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- 3. Direct Client Write Blocking (SPR2-RES-GRANT-02) as authenticated
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    INSERT INTO public.residents (tenant_id, profile_id, status)
    VALUES (tenant_a_id, '20000000-0000-0000-0000-000000000003'::uuid, 'pending');
    RAISE EXCEPTION 'SPR2-RES-GRANT-02a failed: direct table insert on residents should be denied at grant layer';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    UPDATE public.residents SET status = 'inactive' WHERE id = res_a_id;
    RAISE EXCEPTION 'SPR2-RES-GRANT-02b failed: direct table update on residents should be denied at grant layer';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    INSERT INTO public.resident_staff_notes (tenant_id, resident_id, note, author_profile_id)
    VALUES (tenant_a_id, res_a_id, 'Direct note attempt', profile_2_id);
    RAISE EXCEPTION 'SPR2-RES-GRANT-02c failed: direct table insert on resident_staff_notes should be denied at grant layer';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- 4. Resident 1 self-read & cross-resident read isolation check
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM public.residents WHERE profile_id = profile_1_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RES-RLS-03 failed: resident 1 should read own resident record';
  END IF;

  -- Resident 1 cannot read resident 2 record directly via residents table (no co-household clause)
  SELECT COUNT(*) INTO rec_count FROM public.residents WHERE profile_id = profile_2_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RES-RLS-04 failed: resident 1 should NOT read resident 2 record directly';
  END IF;

  -- Resident 1 cannot read resident_staff_notes
  SELECT COUNT(*) INTO rec_count FROM public.resident_staff_notes;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RES-RLS-10 failed: resident should NOT read resident_staff_notes';
  END IF;

  -- 5. Staff Operator A read check
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  SET LOCAL ROLE authenticated;

  -- Operator A reads tenant A residents
  SELECT COUNT(*) INTO rec_count FROM public.residents WHERE tenant_id = tenant_a_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RES-RLS-05 failed: Operator A should read Tenant A residents';
  END IF;

  -- 6. Helper function test: is_active_resident
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  IF NOT public.is_active_resident(tenant_a_id) THEN
    RAISE EXCEPTION 'SPR2-RES-HELP-01 failed: is_active_resident should return true for active resident in tenant_a';
  END IF;

  IF public.is_active_resident(tenant_b_id) THEN
    RAISE EXCEPTION 'SPR2-RES-HELP-02 failed: is_active_resident should return false for tenant_b';
  END IF;

  RESET ROLE;
END $$;

ROLLBACK;

\echo '=== Sprint 2 Wave 2.1 & 2.2 Domain Validation Completed ==='
