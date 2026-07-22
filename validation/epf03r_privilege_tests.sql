-- ============================================================================
-- EPF-03R — Privilege and Function Exposure Tests
-- ============================================================================
-- Validates explicit EXECUTE grants and revokes on every EPF-03/EPF-03R
-- SECURITY DEFINER function.
--
-- Run after: supabase db reset

BEGIN;

DO $$
DECLARE
  v_user_id     uuid := 'e1111111-1111-1111-1111-111111111111';
  v_profile_id  uuid := 'e2222222-2222-2222-2222-222222222222';
  v_tenant_id   uuid := 'e3333333-3333-3333-3333-333333333333';
BEGIN
  -- Setup minimal identity.
  DELETE FROM auth.identities WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
  DELETE FROM resident.tenant_members WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.profiles WHERE id = v_profile_id;
  DELETE FROM resident.tenants WHERE id = v_tenant_id;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'epf03r-priv@test.local', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', 'epf03r-priv@test.local'), 'email', v_user_id::text, now(), now(), now());

  INSERT INTO resident.tenants (id, legal_name, display_name, slug, status)
  VALUES (v_tenant_id, 'EPF-03R Privilege Test', 'EPF-03R Priv', 'epf03r-priv', 'active');

  INSERT INTO resident.profiles (id, user_id, full_name, preferred_name, status, locale, timezone)
  VALUES (v_profile_id, v_user_id, 'EPF-03R Privilege Operator', 'Operator', 'active', 'pt-BR', 'America/Sao_Paulo');

  INSERT INTO resident.tenant_members (id, tenant_id, profile_id, role, status)
  VALUES (gen_random_uuid(), v_tenant_id, v_profile_id, 'association_operator', 'active');

  -- ========================================================================
  -- PRIV-01: authenticated cannot execute Vault writers/readers
  -- ========================================================================
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM resident.create_vault_secret('x', 'name', 'desc');
    RAISE EXCEPTION 'PRIV-01 FAIL: authenticated executed create_vault_secret';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PRIV-01 PASS: authenticated denied create_vault_secret';
  END;

  BEGIN
    PERFORM resident.get_vault_secret('00000000-0000-0000-0000-000000000000'::uuid);
    RAISE EXCEPTION 'PRIV-01b FAIL: authenticated executed get_vault_secret';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PRIV-01b PASS: authenticated denied get_vault_secret';
  END;

  -- ========================================================================
  -- PRIV-02: authenticated cannot execute payment mutation RPCs
  -- ========================================================================
  BEGIN
    PERFORM resident.create_payment_intent(
      p_tenant_id => v_tenant_id,
      p_invoice_id => '00000000-0000-0000-0000-000000000000'::uuid,
      p_provider_id => 'mock',
      p_method_type => 'pix'::resident.payment_method_type,
      p_provider_config_id => '00000000-0000-0000-0000-000000000000'::uuid,
      p_provider_payment_intent_id => 'x',
      p_amount => 1.00,
      p_provider_pix_code => null::text,
      p_provider_pix_qr_base64 => null::text,
      p_provider_boleto_url => null::text,
      p_provider_boleto_barcode => null::text,
      p_provider_boleto_digitable_line => null::text,
      p_expires_at => null::timestamptz,
      p_reconciliation_id => null::text,
      p_raw_provider_response => '{}'::jsonb,
      p_idempotency_key => 'idemp-test',
      p_actor_profile_id => null::uuid
    );
    RAISE EXCEPTION 'PRIV-02 FAIL: authenticated executed create_payment_intent';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PRIV-02 PASS: authenticated denied create_payment_intent';
  END;

  BEGIN
    PERFORM resident.process_payment_refund(
      v_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid,
      1.00, 'idemp-test'
    );
    RAISE EXCEPTION 'PRIV-02b FAIL: authenticated executed process_payment_refund';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PRIV-02b PASS: authenticated denied process_payment_refund';
  END;

  -- ========================================================================
  -- PRIV-03: authenticated can execute read helpers
  -- ========================================================================
  IF NOT resident.has_provider_capability('mock', 'pix_generation') THEN
    RAISE EXCEPTION 'PRIV-03 FAIL: authenticated cannot execute has_provider_capability';
  END IF;
  RAISE NOTICE 'PRIV-03 PASS: authenticated can execute has_provider_capability';

  -- ========================================================================
  -- PRIV-04: anon cannot execute any privileged function
  -- ========================================================================
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM resident.create_vault_secret('x', 'name', 'desc');
    RAISE EXCEPTION 'PRIV-04 FAIL: anon executed create_vault_secret';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PRIV-04 PASS: anon denied create_vault_secret';
  END;

  BEGIN
    PERFORM resident.process_payment_webhook(
      '00000000-0000-0000-0000-000000000000'::uuid, 'mock', 'evt', 'type',
      '{}'::jsonb, 'valid', 'accepted'
    );
    RAISE EXCEPTION 'PRIV-04b FAIL: anon executed process_payment_webhook';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PRIV-04b PASS: anon denied process_payment_webhook';
  END;

  -- ========================================================================
  -- PRIV-05: service_role can execute all financial/security RPCs
  -- ========================================================================
  SET LOCAL ROLE service_role;
  IF NOT has_function_privilege('service_role', 'resident.create_vault_secret(text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIV-05 FAIL: service_role cannot execute create_vault_secret';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.process_payment_webhook(uuid, text, text, text, jsonb, text, text, text, text, timestamptz, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIV-05 FAIL: service_role cannot execute process_payment_webhook';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.upsert_provider_config(uuid, uuid, text, resident.payment_provider_environment, resident.payment_method_type, boolean, boolean, text, text, text, jsonb, jsonb, text, text, jsonb, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIV-05 FAIL: service_role cannot execute upsert_provider_config';
  END IF;
  RAISE NOTICE 'PRIV-05 PASS: service_role has execute on financial/security RPCs';

  -- ========================================================================
  -- PRIV-06: trigger functions are not directly executable by PUBLIC
  -- ========================================================================
  SET LOCAL ROLE postgres;
  IF has_function_privilege('public', 'resident.payment_intent_status_transition()', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIV-06 FAIL: public can execute payment_intent_status_transition';
  END IF;
  IF has_function_privilege('authenticated', 'resident.payment_intent_status_transition()', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIV-06b FAIL: authenticated can execute payment_intent_status_transition';
  END IF;
  RAISE NOTICE 'PRIV-06 PASS: trigger function not directly executable';

  RAISE NOTICE 'EPF-03R PRIVILEGE TESTS COMPLETE';
END $$;

ROLLBACK;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tests:
--   PRIV-01: authenticated denied Vault writers/readers
--   PRIV-02: authenticated denied payment mutation RPCs
--   PRIV-03: authenticated can execute read helpers
--   PRIV-04: anon denied privileged functions
--   PRIV-05: service_role can execute financial/security RPCs
--   PRIV-06: trigger functions not directly executable
-- ============================================================================
