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
  SELECT COUNT(*) INTO details_count FROM resident.association_details WHERE tenant_id = tenant_a_id;
  IF details_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-ASSOC-01 failed: tenant A should have exactly 1 association_details row, got %', details_count;
  END IF;

  SELECT COUNT(*) INTO private_count FROM resident.association_settings_private WHERE tenant_id = tenant_a_id;
  IF private_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-ASSOC-02 failed: tenant A should have exactly 1 association_settings_private row, got %', private_count;
  END IF;

  -- Duplicate tenant_id insert should fail 1:1 constraint
  BEGIN
    INSERT INTO resident.association_details (tenant_id, trade_name)
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
  INSERT INTO resident.tenants (legal_name, display_name, slug)
  VALUES ('Tenant B Legal', 'Tenant B', 'tenant-b-slug')
  RETURNING id INTO tenant_b_id;

  -- Set registration number on Tenant A
  UPDATE resident.association_details
  SET registration_number = '12345678000199'
  WHERE tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;

  -- Attempt duplicate registration number on Tenant B
  BEGIN
    UPDATE resident.association_details
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
  UPDATE resident.association_details
  SET settings = '{"requires_resident_approval": true, "invitation_default_expiry_hours": 48}'::jsonb
  WHERE tenant_id = tenant_a_id;

  -- Invalid setting key
  BEGIN
    UPDATE resident.association_details
    SET settings = '{"unauthorized_key": "val"}'::jsonb
    WHERE tenant_id = tenant_a_id;
    RAISE EXCEPTION 'SPR2-ASSOC-05 failed: unauthorized settings key should be rejected';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  -- Out-of-range expiry hours
  BEGIN
    UPDATE resident.association_details
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
  UPDATE resident.association_details
  SET enabled_modules = '["residents", "residences", "household"]'::jsonb
  WHERE tenant_id = tenant_a_id;

  -- Invalid module name
  BEGIN
    UPDATE resident.association_details
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
    UPDATE resident.association_details
    SET tenant_id = tenant_dummy_id
    WHERE tenant_id = tenant_a_id;
    RAISE EXCEPTION 'SPR2-ASSOC-08 failed: tenant_id mutation on association_details should be rejected';
  EXCEPTION
    WHEN feature_not_supported THEN
      NULL;
  END;

  BEGIN
    UPDATE resident.association_settings_private
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
  INSERT INTO resident.tenants (id, legal_name, display_name, slug)
  VALUES ('22222222-2222-2222-2222-222222222222'::uuid, 'Associacao B', 'Assoc B', 'assoc-b')
  ON CONFLICT (id) DO NOTHING;
  tenant_b_id := '22222222-2222-2222-2222-222222222222'::uuid;

  -- Create user & profile for Admin B
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (admin_b_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.b@example.com', 'pass', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO resident.profiles (id, user_id, full_name, status)
  VALUES (admin_b_profile_id, admin_b_user_id, 'Admin B', 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO resident.tenant_members (tenant_id, profile_id, role, status)
  VALUES (tenant_b_id, admin_b_profile_id, 'association_admin', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Create user & profile for Collector A
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (collector_a_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'collector.a@example.com', 'pass', now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO resident.profiles (id, user_id, full_name, status)
  VALUES (collector_a_profile_id, collector_a_user_id, 'Collector A', 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO resident.tenant_members (tenant_id, profile_id, role, status)
  VALUES (tenant_a_id, collector_a_profile_id, 'association_collector', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Test as Resident A (profile 20000000-0000-0000-0000-000000000001, user 10000000-0000-0000-0000-000000000001)
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  -- Resident A can read Tenant A association_details
  SELECT COUNT(*) INTO rec_count FROM resident.association_details WHERE tenant_id = tenant_a_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-01 failed: Resident A should read Tenant A association_details';
  END IF;

  -- Resident A cannot read Tenant B association_details
  SELECT COUNT(*) INTO rec_count FROM resident.association_details WHERE tenant_id = tenant_b_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-02 failed: Resident A should NOT read Tenant B association_details';
  END IF;

  -- Resident A cannot read association_settings_private
  SELECT COUNT(*) INTO rec_count FROM resident.association_settings_private;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-03 failed: Resident A should NOT read association_settings_private';
  END IF;

  -- Test as Operator A (user 10000000-0000-0000-0000-000000000002)
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  SET LOCAL ROLE authenticated;

  -- Operator A reads Tenant A details
  SELECT COUNT(*) INTO rec_count FROM resident.association_details WHERE tenant_id = tenant_a_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-04 failed: Operator A should read Tenant A association_details';
  END IF;

  -- Operator A does NOT read private settings (admin only)
  SELECT COUNT(*) INTO rec_count FROM resident.association_settings_private WHERE tenant_id = tenant_a_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-05 failed: Operator A should NOT read association_settings_private';
  END IF;

  -- Test as Collector A
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', collector_a_user_id::text, true);
  SET LOCAL ROLE authenticated;

  -- Collector A reads Tenant A details (has permission association_details:read)
  SELECT COUNT(*) INTO rec_count FROM resident.association_details WHERE tenant_id = tenant_a_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-06 failed: Collector A should read Tenant A association_details';
  END IF;

  -- Collector A does NOT read Tenant B details
  SELECT COUNT(*) INTO rec_count FROM resident.association_details WHERE tenant_id = tenant_b_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-07 failed: Collector A should NOT read Tenant B association_details';
  END IF;

  -- Test as Admin B
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', admin_b_user_id::text, true);
  SET LOCAL ROLE authenticated;

  -- Admin B reads Tenant B association_details AND association_settings_private
  SELECT COUNT(*) INTO rec_count FROM resident.association_details WHERE tenant_id = tenant_b_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-08 failed: Admin B should read Tenant B association_details';
  END IF;

  SELECT COUNT(*) INTO rec_count FROM resident.association_settings_private WHERE tenant_id = tenant_b_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-09 failed: Admin B should read Tenant B association_settings_private';
  END IF;

  -- Admin B does NOT read Tenant A private settings
  SELECT COUNT(*) INTO rec_count FROM resident.association_settings_private WHERE tenant_id = tenant_a_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-10 failed: Admin B should NOT read Tenant A association_settings_private';
  END IF;

  -- Test as Platform Admin (user 10000000-0000-0000-0000-000000000003)
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.association_details;
  IF rec_count < 2 THEN
    RAISE EXCEPTION 'SPR2-RLS-ASSOC-11 failed: Platform admin should read all association_details';
  END IF;

  SELECT COUNT(*) INTO rec_count FROM resident.association_settings_private;
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
    UPDATE resident.association_details
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
    INSERT INTO resident.residents (tenant_id, profile_id, status)
    VALUES (invalid_tenant_id, profile_1_id, 'pending');
    RAISE EXCEPTION 'SPR2-RES-01 failed: invalid tenant_id FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- Create valid pending resident for profile_1 on tenant_a
  INSERT INTO resident.residents (tenant_id, profile_id, registration_code, status)
  VALUES (tenant_a_id, profile_1_id, 'REG-001', 'pending')
  RETURNING id INTO res_id;

  -- SPR2-RES-02: Duplicate (tenant_id, profile_id) fails
  BEGIN
    INSERT INTO resident.residents (tenant_id, profile_id, status)
    VALUES (tenant_a_id, profile_1_id, 'pending');
    RAISE EXCEPTION 'SPR2-RES-02 failed: duplicate (tenant_id, profile_id) should be rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- SPR2-RES-03: Non-reusable registration_code within tenant fails
  BEGIN
    INSERT INTO resident.residents (tenant_id, profile_id, registration_code, status)
    VALUES (tenant_a_id, profile_2_id, 'REG-001', 'pending');
    RAISE EXCEPTION 'SPR2-RES-03 failed: duplicate registration_code in same tenant should be rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- SPR2-RES-04: Same registration_code on different tenant allowed
  INSERT INTO resident.residents (tenant_id, profile_id, registration_code, status)
  VALUES (tenant_b_id, profile_1_id, 'REG-001', 'pending');

  -- SPR2-RES-05 & 06: Composite FK (resident_id, tenant_id) on resident_staff_notes
  BEGIN
    INSERT INTO resident.resident_staff_notes (tenant_id, resident_id, note, author_profile_id)
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
  SELECT id INTO res_id FROM resident.residents WHERE tenant_id = tenant_a_id AND profile_id = profile_1_id;

  -- SPR2-RES-PROT-01: Updating tenant_id fails
  BEGIN
    UPDATE resident.residents SET tenant_id = tenant_b_id WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-PROT-01 failed: updating tenant_id should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- SPR2-RES-PROT-02: Updating profile_id fails
  BEGIN
    UPDATE resident.residents SET profile_id = profile_2_id WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-PROT-02 failed: updating profile_id should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- Update to active (sets approval fields)
  UPDATE resident.residents SET status = 'active' WHERE id = res_id;

  -- SPR2-RES-PROT-03: Updating approved_by_profile_id once set fails
  BEGIN
    UPDATE resident.residents SET approved_by_profile_id = profile_2_id WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-PROT-03 failed: updating approved_by_profile_id once set should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- SPR2-RES-PROT-05: Updating registration_code succeeds
  UPDATE resident.residents SET registration_code = 'REG-001-MODIFIED' WHERE id = res_id;
END $$;

-- Test 10: Resident Lifecycle Status Transitions
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  profile_2_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  res_id uuid;
  res_rec record;
BEGIN
  INSERT INTO resident.residents (tenant_id, profile_id, status)
  VALUES (tenant_a_id, profile_2_id, 'pending')
  RETURNING id INTO res_id;

  -- SPR2-RES-LIFE-02: pending -> blocked fails
  BEGIN
    UPDATE resident.residents SET status = 'blocked' WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-LIFE-02 failed: pending -> blocked transition should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- SPR2-RES-LIFE-01: pending -> active succeeds and sets joined_at, approved_at
  UPDATE resident.residents SET status = 'active' WHERE id = res_id;
  SELECT * INTO res_rec FROM resident.residents WHERE id = res_id;
  IF res_rec.joined_at IS NULL OR res_rec.approved_at IS NULL THEN
    RAISE EXCEPTION 'SPR2-RES-LIFE-01 failed: pending -> active should populate joined_at and approved_at';
  END IF;

  -- SPR2-RES-LIFE-03: active -> former sets left_at
  UPDATE resident.residents SET status = 'former' WHERE id = res_id;
  SELECT * INTO res_rec FROM resident.residents WHERE id = res_id;
  IF res_rec.left_at IS NULL THEN
    RAISE EXCEPTION 'SPR2-RES-LIFE-03 failed: active -> former should populate left_at';
  END IF;

  -- SPR2-RES-LIFE-05: former -> active direct fails
  BEGIN
    UPDATE resident.residents SET status = 'active' WHERE id = res_id;
    RAISE EXCEPTION 'SPR2-RES-LIFE-05 failed: former -> active direct transition should be rejected';
  EXCEPTION
    WHEN raise_exception THEN
      NULL;
  END;

  -- SPR2-RES-LIFE-04: former -> pending re-entry succeeds and clears left_at
  UPDATE resident.residents SET status = 'pending' WHERE id = res_id;
  SELECT * INTO res_rec FROM resident.residents WHERE id = res_id;
  IF res_rec.left_at IS NOT NULL THEN
    RAISE EXCEPTION 'SPR2-RES-LIFE-04 failed: former -> pending re-entry should clear left_at';
  END IF;

  -- Transition back to active -> deceased
  UPDATE resident.residents SET status = 'active' WHERE id = res_id;
  UPDATE resident.residents SET status = 'deceased' WHERE id = res_id;

  -- SPR2-RES-LIFE-07: transition out of deceased fails
  BEGIN
    UPDATE resident.residents SET status = 'pending' WHERE id = res_id;
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
  SELECT id INTO res_a_id FROM resident.residents WHERE tenant_id = tenant_a_id AND profile_id = profile_1_id;

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
    SELECT COUNT(*) INTO rec_count FROM resident.residents;
    IF rec_count <> 0 THEN
      RAISE EXCEPTION 'SPR2-RES-RLS-01 failed: anon user should read 0 residents';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    SELECT COUNT(*) INTO rec_count FROM resident.resident_staff_notes;
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
    INSERT INTO resident.residents (tenant_id, profile_id, status)
    VALUES (tenant_a_id, '20000000-0000-0000-0000-000000000003'::uuid, 'pending');
    RAISE EXCEPTION 'SPR2-RES-GRANT-02a failed: direct table insert on residents should be denied at grant layer';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    UPDATE resident.residents SET status = 'inactive' WHERE id = res_a_id;
    RAISE EXCEPTION 'SPR2-RES-GRANT-02b failed: direct table update on residents should be denied at grant layer';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    INSERT INTO resident.resident_staff_notes (tenant_id, resident_id, note, author_profile_id)
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

  SELECT COUNT(*) INTO rec_count FROM resident.residents WHERE profile_id = profile_1_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RES-RLS-03 failed: resident 1 should read own resident record';
  END IF;

  -- Resident 1 cannot read resident 2 record directly via residents table (no co-household clause)
  SELECT COUNT(*) INTO rec_count FROM resident.residents WHERE profile_id = profile_2_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RES-RLS-04 failed: resident 1 should NOT read resident 2 record directly';
  END IF;

  -- Resident 1 cannot read resident_staff_notes
  SELECT COUNT(*) INTO rec_count FROM resident.resident_staff_notes;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RES-RLS-10 failed: resident should NOT read resident_staff_notes';
  END IF;

  -- 5. Staff Operator A read check
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  SET LOCAL ROLE authenticated;

  -- Operator A reads tenant A residents
  SELECT COUNT(*) INTO rec_count FROM resident.residents WHERE tenant_id = tenant_a_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RES-RLS-05 failed: Operator A should read Tenant A residents';
  END IF;

  -- 6. Helper function test: is_active_resident
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  IF NOT resident.is_active_resident(tenant_a_id) THEN
    RAISE EXCEPTION 'SPR2-RES-HELP-01 failed: is_active_resident should return true for active resident in tenant_a';
  END IF;

  IF resident.is_active_resident(tenant_b_id) THEN
    RAISE EXCEPTION 'SPR2-RES-HELP-02 failed: is_active_resident should return false for tenant_b';
  END IF;

  RESET ROLE;
END $$;

-- ============================================================================
-- === Sprint 2 Wave 2.3 Residence & Household Domain Validation ===
-- ============================================================================

-- Test 12: Residence Membership — Schema, Constraints & Historical Occupancy
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  tenant_b_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  property_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  profile_1_id uuid := '20000000-0000-0000-0000-000000000001'::uuid;
  profile_2_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  profile_3_id uuid := '20000000-0000-0000-0000-000000000003'::uuid;
  invalid_id uuid := '99999999-9999-9999-9999-999999999999'::uuid;
  mem_id uuid;
  mem_rec record;
  second_prop_id uuid;
BEGIN
  -- Setup: create a second property on Tenant A for multi-property tests
  INSERT INTO resident.properties (id, tenant_id, label, address_line1, city, state, unit_identifier, status)
  VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', tenant_a_id, 'Casa 10', 'Rua Teste, 10', 'Curitiba', 'PR', 'Casa 10', 'active')
  ON CONFLICT (id) DO NOTHING;
  second_prop_id := 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;

  -- SPR2-RESD-01: Invalid tenant FK rejected (use fresh property to avoid seed conflicts)
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status)
    VALUES (invalid_id, second_prop_id, profile_2_id, 'resident', 'active');
    RAISE EXCEPTION 'SPR2-RESD-01 failed: invalid tenant_id FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- SPR2-RESD-02: Invalid profile FK rejected
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status)
    VALUES (tenant_a_id, second_prop_id, invalid_id, 'resident', 'active');
    RAISE EXCEPTION 'SPR2-RESD-02 failed: invalid profile_id FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- SPR2-RESD-03: Invalid property FK rejected
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status)
    VALUES (tenant_a_id, invalid_id, profile_2_id, 'resident', 'active');
    RAISE EXCEPTION 'SPR2-RESD-03 failed: invalid property_id FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- SPR2-RESD-04: Cross-tenant composite FK rejected (property on Tenant A, tenant_id = Tenant B)
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status)
    VALUES (tenant_b_id, second_prop_id, profile_2_id, 'resident', 'active');
    RAISE EXCEPTION 'SPR2-RESD-04 failed: cross-tenant composite FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- SPR2-RESD-08: Invalid date ordering rejected (end_date < start_date)
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date, end_date)
    VALUES (tenant_a_id, second_prop_id, profile_2_id, 'resident', 'active', CURRENT_DATE, CURRENT_DATE - 10);
    RAISE EXCEPTION 'SPR2-RESD-08 failed: end_date < start_date should be rejected';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  -- SPR2-RESD-09: Revoked without end_date and end_reason rejected (closure CHECK)
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
    VALUES (tenant_a_id, second_prop_id, profile_2_id, 'resident', 'revoked', CURRENT_DATE - 30);
    RAISE EXCEPTION 'SPR2-RESD-09 failed: revoked without end_date and end_reason should be rejected';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  -- Valid: insert a pending membership and verify partial unique enforcement
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date, is_primary)
  VALUES (tenant_a_id, second_prop_id, profile_1_id, 'resident', 'pending', CURRENT_DATE, false)
  RETURNING id INTO mem_id;

  -- SPR2-RESD-06: Duplicate open (active or pending) membership rejected
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
    VALUES (tenant_a_id, second_prop_id, profile_1_id, 'dependent', 'pending', CURRENT_DATE);
    RAISE EXCEPTION 'SPR2-RESD-06 failed: duplicate open membership should be rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- SPR2-RESD-06b: Duplicate active membership also rejected
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date, is_primary)
  VALUES (tenant_a_id, property_a_id, profile_2_id, 'resident', 'active', CURRENT_DATE, false)
  ON CONFLICT DO NOTHING;
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
    VALUES (tenant_a_id, property_a_id, profile_2_id, 'dependent', 'active', CURRENT_DATE);
    RAISE EXCEPTION 'SPR2-RESD-06b failed: duplicate active membership should be rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- SPR2-RESD-07: Duplicate active primary per tenant rejected
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date, is_primary)
  VALUES (tenant_a_id, second_prop_id, profile_2_id, 'owner', 'active', CURRENT_DATE, true)
  ON CONFLICT DO NOTHING;
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date, is_primary)
    VALUES (tenant_a_id, property_a_id, profile_2_id, 'owner', 'active', CURRENT_DATE, true);
    RAISE EXCEPTION 'SPR2-RESD-07 failed: duplicate active primary for same profile in same tenant should be rejected';
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- Same profile can be primary in different tenants (tenant-scoped index)
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date, is_primary)
  VALUES (tenant_b_id, property_a_id, profile_2_id, 'owner', 'active', CURRENT_DATE, true)
  ON CONFLICT DO NOTHING;

  -- SPR2-RESD-05: Historical occupancy preserved — close and reopen
  -- First, close the pending membership with proper closure data
  UPDATE resident.residence_members
  SET status = 'revoked', end_date = CURRENT_DATE, end_reason = 'administrative'
  WHERE id = mem_id;
  SELECT * INTO mem_rec FROM resident.residence_members WHERE id = mem_id;
  IF mem_rec.status <> 'revoked' THEN
    RAISE EXCEPTION 'SPR2-RESD-05 failed: membership should be revoked';
  END IF;
  -- Record the revoked row's data
  IF mem_rec.end_date IS NULL OR mem_rec.end_reason IS NULL THEN
    RAISE EXCEPTION 'SPR2-RESD-05 failed: revoked membership must have end_date and end_reason';
  END IF;

  -- SPR2-RESD-05: Immutable closed row — updating a revoked row must fail
  BEGIN
    UPDATE resident.residence_members SET start_date = CURRENT_DATE + 1 WHERE id = mem_id;
    RAISE EXCEPTION 'SPR2-RESD-05b failed: updating a revoked membership should be rejected';
  EXCEPTION
    WHEN feature_not_supported THEN
      NULL;
  END;

  -- SPR2-RESD-05c: Historical row preserved after closure
  SELECT * INTO mem_rec FROM resident.residence_members WHERE id = mem_id;
  IF mem_rec.status <> 'revoked' THEN
    RAISE EXCEPTION 'SPR2-RESD-05c failed: historical revoked row should be preserved';
  END IF;

  -- Reopen: create a NEW row (same profile, same property, new period)
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date, is_primary)
  VALUES (tenant_a_id, second_prop_id, profile_1_id, 'resident', 'active', CURRENT_DATE + 1, false);

  -- Verify historical row still exists unchanged
  SELECT * INTO mem_rec FROM resident.residence_members WHERE id = mem_id;
  IF mem_rec.status <> 'revoked' THEN
    RAISE EXCEPTION 'SPR2-RESD-05d failed: historical revoked row should be preserved after reopen';
  END IF;

  -- SPR2-RESD-05e: EXCLUDE — no overlap between new row and existing period
  -- Create and close a membership: period [CURRENT_DATE-30, CURRENT_DATE-10)
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date, end_date, end_reason)
  VALUES (tenant_a_id, second_prop_id, profile_3_id, 'resident', 'revoked',
          CURRENT_DATE - 30, CURRENT_DATE - 10, 'administrative');
  -- Now try to insert active with overlapping start → EXCLUDE should fire
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
    VALUES (tenant_a_id, second_prop_id, profile_3_id, 'resident', 'active', CURRENT_DATE - 20);
    RAISE EXCEPTION 'SPR2-RESD-05e failed: overlapping period with prior row should be rejected';
  EXCEPTION
    WHEN exclusion_violation THEN
      NULL;
  END;
END $$;

-- Test 13: Household Members — Schema, Constraints & Append-Only
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  tenant_b_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  property_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  profile_1_id uuid := '20000000-0000-0000-0000-000000000001'::uuid;
  profile_2_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  invalid_id uuid := '99999999-9999-9999-9999-999999999999'::uuid;
  hhm_id uuid;
BEGIN
  -- SPR2-HHM-01: Invalid tenant FK rejected
  BEGIN
    INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status)
    VALUES (invalid_id, property_a_id, profile_1_id, 'Test Kid', 'child', 'active');
    RAISE EXCEPTION 'SPR2-HHM-01 failed: invalid tenant_id FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- SPR2-HHM-02: Invalid property FK rejected
  BEGIN
    INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status)
    VALUES (tenant_a_id, invalid_id, profile_1_id, 'Test Kid', 'child', 'active');
    RAISE EXCEPTION 'SPR2-HHM-02 failed: invalid property_id FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- SPR2-HHM-03: Invalid responsible_profile_id FK rejected
  BEGIN
    INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status)
    VALUES (tenant_a_id, property_a_id, invalid_id, 'Test Kid', 'child', 'active');
    RAISE EXCEPTION 'SPR2-HHM-03 failed: invalid responsible_profile_id FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- SPR2-HHM-04: Cross-tenant composite FK rejected
  BEGIN
    INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status)
    VALUES (tenant_b_id, property_a_id, profile_1_id, 'Test Kid', 'child', 'active');
    RAISE EXCEPTION 'SPR2-HHM-04 failed: cross-tenant composite FK should be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN
      NULL;
  END;

  -- SPR2-HHM-05: Valid insert
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, start_date)
  VALUES (tenant_a_id, property_a_id, profile_1_id, 'Joao Junior', 'child', 'active', CURRENT_DATE)
  RETURNING id INTO hhm_id;

  -- SPR2-HHM-06: Invalid date ordering rejected
  BEGIN
    UPDATE resident.household_members SET end_date = start_date - 1 WHERE id = hhm_id;
    RAISE EXCEPTION 'SPR2-HHM-06 failed: end_date < start_date should be rejected';
  EXCEPTION
    WHEN check_violation THEN
      NULL;
  END;

  -- SPR2-HHM-07: Append-only — delete must be rejected
  BEGIN
    DELETE FROM resident.household_members WHERE id = hhm_id;
    RAISE EXCEPTION 'SPR2-HHM-07 failed: delete on household_members should be rejected';
  EXCEPTION
    WHEN feature_not_supported THEN
      NULL;
  END;

  -- SPR2-HHM-08: Protected fields immutability — tenant_id
  BEGIN
    UPDATE resident.household_members SET tenant_id = tenant_b_id WHERE id = hhm_id;
    RAISE EXCEPTION 'SPR2-HHM-08 failed: tenant_id mutation should be rejected';
  EXCEPTION
    WHEN feature_not_supported THEN
      NULL;
  END;

  -- SPR2-HHM-09: Protected fields immutability — property_id
  BEGIN
    UPDATE resident.household_members SET property_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid WHERE id = hhm_id;
    RAISE EXCEPTION 'SPR2-HHM-09 failed: property_id mutation should be rejected';
  EXCEPTION
    WHEN feature_not_supported THEN
      NULL;
  END;

  -- SPR2-HHM-10: Protected fields immutability — responsible_profile_id
  BEGIN
    UPDATE resident.household_members SET responsible_profile_id = profile_2_id WHERE id = hhm_id;
    RAISE EXCEPTION 'SPR2-HHM-10 failed: responsible_profile_id mutation should be rejected';
  EXCEPTION
    WHEN feature_not_supported THEN
      NULL;
  END;

  -- SPR2-HHM-11: Soft-delete via status='former' works (not hard-delete)
  UPDATE resident.household_members SET status = 'former', end_date = CURRENT_DATE WHERE id = hhm_id;
END $$;

-- Test 14: RLS / Authorization — Anonymous, Unauthenticated, and Collector Denial
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  collector_uuid uuid := '10000000-0000-0000-0000-000000000011'::uuid;
  rec_count integer;
  has_write_grant boolean;
  anon_collector_exists boolean;
BEGIN
  -- Ensure collector user exists for standalone test runs (may already exist from fixtures)
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = collector_uuid) INTO anon_collector_exists;
  IF NOT anon_collector_exists THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
    VALUES (collector_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'collector.w23@example.com', 'pass', now())
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO resident.profiles (id, user_id, full_name, status)
    VALUES ('20000000-0000-0000-0000-000000000011', collector_uuid, 'W23 Collector', 'active')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO resident.tenant_members (tenant_id, profile_id, role, status)
    VALUES (tenant_a_id, '20000000-0000-0000-0000-000000000011', 'association_collector', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Catalog check: no write grants to authenticated on new tables
  SELECT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name = 'household_members'
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) INTO has_write_grant;
  IF has_write_grant THEN
    RAISE EXCEPTION 'SPR2-RESD-GRANT-01 failed: household_members contains forbidden table write grant to authenticated';
  END IF;

  -- SPR2-RESD-10: Anonymous denied
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE anon;

  BEGIN
    SELECT COUNT(*) INTO rec_count FROM resident.residence_members;
    IF rec_count <> 0 THEN
      RAISE EXCEPTION 'SPR2-RESD-10a failed: anon should read 0 residence_members';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    SELECT COUNT(*) INTO rec_count FROM resident.household_members;
    IF rec_count <> 0 THEN
      RAISE EXCEPTION 'SPR2-RESD-10b failed: anon should read 0 household_members';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  -- SPR2-RESD-12: Collector denied on residence_members
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.residence_members WHERE tenant_id = tenant_a_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RESD-12 failed: collector (no residences:read) should read 0 residence_members';
  END IF;

  -- SPR2-RESD-12b: Collector denied on household_members
  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE tenant_id = tenant_a_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RESD-12b failed: collector should read 0 household_members';
  END IF;

  RESET ROLE;
END $$;

-- Test 15: RLS — Resident Self-Read, Staff Access, and Household Visibility
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  tenant_b_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  property_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  profile_1_id uuid := '20000000-0000-0000-0000-000000000001'::uuid;
  rec_count integer;
  hhm_id uuid;
  unrelated_user_id uuid := '10000000-0000-0000-0000-000000000088'::uuid;
  unrelated_profile_id uuid := '20000000-0000-0000-0000-000000000088'::uuid;
BEGIN
  -- Ensure unrelated user exists for standalone test runs (must run before any SET LOCAL ROLE)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (unrelated_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'unrelated.w23@example.com', 'pass', now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO resident.profiles (id, user_id, full_name, status)
  VALUES (unrelated_profile_id, unrelated_user_id, 'W23 Unrelated', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Create a household member for Tenant A Property A, responsible = profile 1 (Ana)
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, start_date)
  VALUES (tenant_a_id, property_a_id, profile_1_id, 'Maria Filha', 'child', 'active', CURRENT_DATE)
  RETURNING id INTO hhm_id;

  -- SPR2-RESD-13: Resident self-read — Ana (profile 1) reads her own residence_members
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  -- Ana sees her own residence_members rows (seed row + any test-created)
  SELECT COUNT(*) INTO rec_count FROM resident.residence_members WHERE profile_id = profile_1_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RESD-13a failed: resident should read own residence_members';
  END IF;

  -- Ana sees household_members where she is responsible
  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE responsible_profile_id = profile_1_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RESD-13b failed: resident should read household_members she is responsible for';
  END IF;

  -- Ana sees household_members where she is co-household (is_active_residence_member)
  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE property_id = property_a_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RESD-13c failed: co-household resident should read household_members for same property';
  END IF;

  -- SPR2-RESD-13d: Resident cross-tenant — Ana should NOT see household_members on Tenant B
  -- (There might be some if Test 13 created them, but they shouldn't be visible)
  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE tenant_id = tenant_b_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RESD-13d failed: resident should NOT read household_members in other tenants';
  END IF;

  -- SPR2-RESD-13e: Operator Olivia (profile 2, residences:read + household:read) reads all Tenant A members
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.residence_members WHERE tenant_id = tenant_a_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RESD-13e failed: operator with residences:read should read Tenant A residence_members';
  END IF;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE tenant_id = tenant_a_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RESD-13f failed: operator with household:read should read Tenant A household_members';
  END IF;

  -- Operator Olivia should NOT read cross-tenant
  SELECT COUNT(*) INTO rec_count FROM resident.residence_members WHERE tenant_id = tenant_b_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RESD-13g failed: operator should NOT read cross-tenant residence_members';
  END IF;

  -- SPR2-RESD-11: Authenticated without tenant membership — unrelated user sees nothing
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000088', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.residence_members;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RESD-11a failed: unrelated user should read 0 residence_members';
  END IF;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-RESD-11b failed: unrelated user should read 0 household_members';
  END IF;

  -- SPR2-RESD-13h: Platform admin Paula sees all tenants
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.residence_members;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RESD-13h failed: platform admin should read all residence_members';
  END IF;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-RESD-13i failed: platform admin should read all household_members';
  END IF;

  RESET ROLE;
END $$;

-- ============================================================================
-- Test 16: is_household_responsible Authorization — Finding 1 Remediation Gates
-- ============================================================================
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  tenant_b_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  property_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  property_c_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;
  profile_1_id uuid := '20000000-0000-0000-0000-000000000001'::uuid;
  fu uuid := '10000000-0000-0000-0000-000000000061'::uuid;
  fp uuid := '20000000-0000-0000-0000-000000000061'::uuid;
  ru uuid := '10000000-0000-0000-0000-000000000062'::uuid;
  rp uuid := '20000000-0000-0000-0000-000000000062'::uuid;
  mu uuid := '10000000-0000-0000-0000-000000000063'::uuid;
  mp uuid := '20000000-0000-0000-0000-000000000063'::uuid;
  crossprop_u uuid := '10000000-0000-0000-0000-000000000064'::uuid;
  crossprop_p uuid := '20000000-0000-0000-0000-000000000064'::uuid;
  crossprop2_u uuid := '10000000-0000-0000-0000-000000000065'::uuid;
  crossprop2_p uuid := '20000000-0000-0000-0000-000000000065'::uuid;
  crossprop2_hm uuid;
  collector_u uuid := '10000000-0000-0000-0000-000000000011'::uuid;
  no_member_u uuid := '10000000-0000-0000-0000-000000000066'::uuid;
  no_member_p uuid := '20000000-0000-0000-0000-000000000066'::uuid;
  rec_count integer;
  hhm_former_id uuid;
  hhm_revoked_id uuid;
  hhm_moved_out_id uuid;
  mem_id uuid;
  hhm_cross_tenant_id uuid;
  cross_tenant_prop_id uuid;
  hhm_ana_id uuid;
BEGIN
  -- Seed a household member for Ana on Property A (the active responsible baseline)
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, start_date)
  VALUES (tenant_a_id, property_a_id, profile_1_id, 'Ana Dependent 16', 'child', 'active', CURRENT_DATE)
  RETURNING id INTO hhm_ana_id;

  -- Create "former responsible" (will be active, then closed with moved_out)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (fu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'former.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status)
  VALUES (fp, fu, 'Former Responsible', 'active');
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_c_id, fp, 'resident', 'active', CURRENT_DATE - 10) RETURNING id INTO mem_id;
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, start_date)
  VALUES (tenant_a_id, property_c_id, fp, 'Former Kid', 'child', 'active', CURRENT_DATE) RETURNING id INTO hhm_former_id;
  UPDATE resident.residence_members SET status = 'revoked', end_date = CURRENT_DATE, end_reason = 'moved_out' WHERE id = mem_id;

  -- Create "revoked responsible" (blocked)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (ru, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revoked.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status)
  VALUES (rp, ru, 'Revoked Responsible', 'active');
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_c_id, rp, 'resident', 'active', CURRENT_DATE - 10) RETURNING id INTO mem_id;
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, start_date)
  VALUES (tenant_a_id, property_c_id, rp, 'Revoked Kid', 'child', 'active', CURRENT_DATE) RETURNING id INTO hhm_revoked_id;
  UPDATE resident.residence_members SET status = 'revoked', end_date = CURRENT_DATE, end_reason = 'blocked' WHERE id = mem_id;

  -- Create "moved-out responsible"
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (mu, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'movedout.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status)
  VALUES (mp, mu, 'MovedOut Responsible', 'active');
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_c_id, mp, 'resident', 'active', CURRENT_DATE - 10) RETURNING id INTO mem_id;
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, start_date)
  VALUES (tenant_a_id, property_c_id, mp, 'MovedOut Kid', 'child', 'active', CURRENT_DATE) RETURNING id INTO hhm_moved_out_id;
  UPDATE resident.residence_members SET status = 'revoked', end_date = CURRENT_DATE, end_reason = 'moved_out' WHERE id = mem_id;

  -- Create "cross-property" scenario: responsible on Property C tries to read Property A household
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (crossprop_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crossprop.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status)
  VALUES (crossprop_p, crossprop_u, 'Cross Property Responsible', 'active');
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_c_id, crossprop_p, 'resident', 'active', CURRENT_DATE);

  -- Create another profile on Property C for cross-property household read test
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (crossprop2_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crossprop2.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status)
  VALUES (crossprop2_p, crossprop2_u, 'Cross Prop 2', 'active');
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_c_id, crossprop2_p, 'resident', 'active', CURRENT_DATE);
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, start_date)
  VALUES (tenant_a_id, property_a_id, profile_1_id, 'Cross Prop Target', 'child', 'active', CURRENT_DATE) RETURNING id INTO crossprop2_hm;

  -- Create cross-tenant scenario: household member in Tenant B, responsible in Tenant B
  INSERT INTO resident.properties (id, tenant_id, label, address_line1, city, state, unit_identifier, status)
  VALUES ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', tenant_b_id, 'CrossTenant Unit', 'Rua CT', 'Curitiba', 'PR', 'CT-1', 'active')
  ON CONFLICT (id) DO NOTHING;
  cross_tenant_prop_id := 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'::uuid;
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, start_date)
  VALUES (tenant_b_id, cross_tenant_prop_id, '20000000-0000-0000-0000-000000000011'::uuid, 'CrossTenant Kid', 'child', 'active', CURRENT_DATE)
  RETURNING id INTO hhm_cross_tenant_id;

  -- Create authenticated user with NO residence membership
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (no_member_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nomember.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status)
  VALUES (no_member_p, no_member_u, 'No Member User', 'active');

  -- ====== GATE 16.1: Active responsible resident reads authorized household members ======
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members
  WHERE responsible_profile_id = profile_1_id AND id = hhm_ana_id;
  IF rec_count <> 1 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-01 failed: active responsible should read own household members (got %)', rec_count;
  END IF;

  -- Verify is_household_responsible helper returns true
  IF NOT resident.is_household_responsible(hhm_ana_id) THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-01b failed: is_household_responsible should return true for active responsible';
  END IF;

  -- ====== GATE 16.2: Former responsible (membership closed with moved_out) cannot read ======
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', fu::text, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE id = hhm_former_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-02 failed: former responsible (moved_out) should read 0 household_members (got %)', rec_count;
  END IF;

  -- ====== GATE 16.3: Revoked responsible cannot read ======
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', ru::text, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE id = hhm_revoked_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-03 failed: revoked responsible should read 0 household_members (got %)', rec_count;
  END IF;

  -- ====== GATE 16.4: Moved-out responsible cannot read ======
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', mu::text, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE id = hhm_moved_out_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-04 failed: moved-out responsible should read 0 household_members (got %)', rec_count;
  END IF;

  -- ====== GATE 16.5: Responsible from another property cannot read the row ======
  -- crossprop_p has active residence on Property C; hhm_ana_id is on Property A under profile_1
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', crossprop_u::text, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE id = hhm_ana_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-05 failed: cross-property responsible should read 0 foreign household_members (got %)', rec_count;
  END IF;

  -- crossprop2_p has active residence on Property C; crossprop2_hm is on Property A under profile_1
  -- Even though crossprop2_p is on same tenant, they're on a different property
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', crossprop2_u::text, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE id = crossprop2_hm;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-05b failed: cross-property resident should read 0 household_members on different property (got %)', rec_count;
  END IF;

  -- ====== GATE 16.6: Responsible profile from another tenant cannot read ======
  -- Ana is on Tenant A; hhm_cross_tenant_id is on Tenant B
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE id = hhm_cross_tenant_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-06 failed: cross-tenant responsible should read 0 household_members (got %)', rec_count;
  END IF;

  -- ====== GATE 16.7: Authenticated user with no active residence membership cannot read ======
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', no_member_u::text, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-07 failed: no-membership user should read 0 household_members (got %)', rec_count;
  END IF;

  -- ====== GATE 16.8: Collector remains denied ======
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', collector_u::text, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE tenant_id = tenant_a_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-08 failed: collector should read 0 household_members (got %)', rec_count;
  END IF;

  -- ====== GATE 16.9: Anonymous remains denied ======
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE anon;

  BEGIN
    SELECT COUNT(*) INTO rec_count FROM resident.household_members;
    IF rec_count <> 0 THEN
      RAISE EXCEPTION 'SPR2-HH-RESP-09 failed: anon should read 0 household_members (got %)', rec_count;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  -- ====== GATE 16.10: Authorized staff (household:read) access remains unchanged ======
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE tenant_id = tenant_a_id;
  IF rec_count < 1 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-10 failed: operator with household:read should read Tenant A household_members (got %)', rec_count;
  END IF;

  -- Cross-tenant isolation: operator A should NOT read Tenant B household_members
  SELECT COUNT(*) INTO rec_count FROM resident.household_members WHERE tenant_id = tenant_b_id;
  IF rec_count <> 0 THEN
    RAISE EXCEPTION 'SPR2-HH-RESP-10b failed: operator should NOT read cross-tenant household_members (got %)', rec_count;
  END IF;

  RESET ROLE;
END $$;

-- ============================================================================
-- Test 17: Cross-Table Platform-User Duplication Invariant — Finding 2 Remediation Gates
-- ============================================================================
DO $$
DECLARE
  tenant_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  property_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  property_c_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;
  du_p uuid := '20000000-0000-0000-0000-000000000071'::uuid;
  du_u uuid := '10000000-0000-0000-0000-000000000071'::uuid;
  du2_p uuid := '20000000-0000-0000-0000-000000000072'::uuid;
  du2_u uuid := '10000000-0000-0000-0000-000000000072'::uuid;
  du3_p uuid := '20000000-0000-0000-0000-000000000073'::uuid;
  du3_u uuid := '10000000-0000-0000-0000-000000000073'::uuid;
  du4_p uuid := '20000000-0000-0000-0000-000000000074'::uuid;
  du4_u uuid := '10000000-0000-0000-0000-000000000074'::uuid;
  du5_p uuid := '20000000-0000-0000-0000-000000000075'::uuid;
  du5_u uuid := '10000000-0000-0000-0000-000000000075'::uuid;
  du6_p uuid := '20000000-0000-0000-0000-000000000076'::uuid;
  du6_u uuid := '10000000-0000-0000-0000-000000000076'::uuid;
  du7_p uuid := '20000000-0000-0000-0000-000000000077'::uuid;
  du7_u uuid := '10000000-0000-0000-0000-000000000077'::uuid;
  du_rm_id uuid;
  du_hm_id uuid;
  before_count integer;
  after_count integer;
  hhm_id uuid;
BEGIN
  -- Create test profile for Direction A scenarios
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (du_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dup1.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status) VALUES (du_p, du_u, 'Dup Test 1', 'active');

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (du2_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dup2.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status) VALUES (du2_p, du2_u, 'Dup Test 2', 'active');

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (du3_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dup3.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status) VALUES (du3_p, du3_u, 'Dup Test 3', 'active');

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (du4_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dup4.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status) VALUES (du4_p, du4_u, 'Dup Test 4', 'active');

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (du5_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dup5.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status) VALUES (du5_p, du5_u, 'Dup Test 5', 'active');

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (du6_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dup6.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status) VALUES (du6_p, du6_u, 'Dup Test 6', 'active');

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  VALUES (du7_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dup7.hh@example.com', 'pass', now());
  INSERT INTO resident.profiles (id, user_id, full_name, status) VALUES (du7_p, du7_u, 'Dup Test 7', 'active');

  -- ====== GATE 17.1: Direction A — Active residence_members profile rejected as active household_member (linked) for same property ======
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_a_id, du_p, 'resident', 'active', CURRENT_DATE) RETURNING id INTO du_rm_id;

  BEGIN
    INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, linked_profile_id)
    VALUES (tenant_a_id, property_a_id, du2_p, 'Dup Kid', 'child', 'active', du_p);
    RAISE EXCEPTION 'SPR2-DUP-01 failed: household_member with linked_profile_id on same property as active residence should be rejected';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  -- Cleanup: close the residence_members for du_p (we'll reuse the profile for other tests)
  UPDATE resident.residence_members SET status = 'revoked', end_date = CURRENT_DATE, end_reason = 'administrative' WHERE id = du_rm_id;

  -- ====== GATE 17.2: Direction B — Active linked household_member rejects new active residence_members for same property ======
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, linked_profile_id)
  VALUES (tenant_a_id, property_a_id, du2_p, 'Dup2 Kid', 'child', 'active', du3_p)
  RETURNING id INTO hhm_id;

  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
    VALUES (tenant_a_id, property_a_id, du3_p, 'resident', 'active', CURRENT_DATE);
    RAISE EXCEPTION 'SPR2-DUP-02 failed: active residence_members for profile with active linked household_member should be rejected';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  -- ====== GATE 17.3: Direction A — UPDATE household_members to set conflicting linked_profile_id rejected ======
  -- First create a household member WITHOUT linked_profile_id
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status)
  VALUES (tenant_a_id, property_a_id, du2_p, 'NoLink Kid', 'child', 'active') RETURNING id INTO hhm_id;

  -- du3_p already has active household_members link, so trying to link du3_p to another household member on same property should fail at partial unique
  -- Instead, create an active residence and then try to link the household_member to it
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_a_id, du4_p, 'resident', 'active', CURRENT_DATE) RETURNING id INTO du_rm_id;

  BEGIN
    UPDATE resident.household_members SET linked_profile_id = du4_p WHERE id = hhm_id;
    RAISE EXCEPTION 'SPR2-DUP-03 failed: updating household_member to link profile with active residence should be rejected';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  SELECT COUNT(*) INTO before_count FROM resident.household_members WHERE id = hhm_id;
  -- Cleanup the active residence
  UPDATE resident.residence_members SET status = 'revoked', end_date = CURRENT_DATE, end_reason = 'administrative' WHERE id = du_rm_id;

  -- ====== GATE 17.4: Direction B — New active residence_members conflicting with active household_member ======
  -- Create active household_member with linked_profile_id = du5_p
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, linked_profile_id)
  VALUES (tenant_a_id, property_a_id, du2_p, 'Gate4 Kid', 'child', 'active', du5_p);
  -- Now attempt to create a NEW active residence_members row for du5_p on property A — should be rejected
  BEGIN
    INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
    VALUES (tenant_a_id, property_a_id, du5_p, 'resident', 'active', CURRENT_DATE);
    RAISE EXCEPTION 'SPR2-DUP-04 failed: new active residence_members conflicting with active household_member should be rejected';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  -- ====== GATE 17.5: Same profile in different property — allowed ======
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_c_id, du6_p, 'resident', 'active', CURRENT_DATE);

  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, linked_profile_id)
  VALUES (tenant_a_id, property_a_id, du2_p, 'Diff Prop Kid', 'child', 'active', du6_p);

  -- Gate passes: du6_p has residence on Property C AND household_member (linked) on Property A — allowed (different properties)

  -- ====== GATE 17.6: Historical (inactive/revoked) rows don't conflict ======
  -- du7_p has a revoked residence on Property A
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date, end_date, end_reason)
  VALUES (tenant_a_id, property_a_id, du7_p, 'resident', 'revoked', CURRENT_DATE - 90, CURRENT_DATE - 60, 'moved_out');

  -- Should be able to create an active household_member with linked_profile_id = du7_p since the residence is revoked
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, linked_profile_id)
  VALUES (tenant_a_id, property_a_id, du2_p, 'Historical Kid', 'child', 'active', du7_p)
  RETURNING id INTO hhm_id;

  -- Clean up by setting to former
  UPDATE resident.household_members SET status = 'former', end_date = CURRENT_DATE WHERE id = hhm_id;

  -- Similarly, inactive household members should not block residence
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, linked_profile_id)
  VALUES (tenant_a_id, property_a_id, du2_p, 'Inactive Kid', 'child', 'inactive', du_p)
  RETURNING id INTO hhm_id;

  -- du_p now has an INACTIVE household_member link — creating active residence for du_p should succeed
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_c_id, du_p, 'resident', 'active', CURRENT_DATE);

  -- ====== GATE 17.7: Non-linked household members remain valid ======
  INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status)
  VALUES (tenant_a_id, property_a_id, du2_p, 'NoLink Valid Kid', 'child', 'active');

  -- ====== GATE 17.8: Failed conflicting mutations leave no partial data ======
  SELECT COUNT(*) INTO before_count FROM resident.household_members WHERE full_name = 'Failed Insert Test';
  BEGIN
    INSERT INTO resident.household_members (tenant_id, property_id, responsible_profile_id, full_name, relationship, status, linked_profile_id)
    VALUES (tenant_a_id, property_a_id, du2_p, 'Failed Insert Test', 'child', 'active', du3_p);
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
  SELECT COUNT(*) INTO after_count FROM resident.household_members WHERE full_name = 'Failed Insert Test';
  IF after_count <> before_count THEN
    RAISE EXCEPTION 'SPR2-DUP-08 failed: failed conflicting insert should leave no partial data (before=%, after=%)', before_count, after_count;
  END IF;

  -- ====== GATE 17.9: Existing residence_members without conflict inserts normally ======
  INSERT INTO resident.residence_members (tenant_id, property_id, profile_id, role, status, start_date)
  VALUES (tenant_a_id, property_a_id, du2_p, 'tenant', 'active', CURRENT_DATE);

  -- ====== GATE 17.10: Self-referencing household (linked to self through residence) ======
  -- du2_p has active residence AND no linked household_members → should allow creating a non-linked household member
  -- (already tested above in 17.7)
END $$;

ROLLBACK;

\echo '=== Sprint 2 Wave 2.1, 2.2 & 2.3 Domain Validation Completed ==='
