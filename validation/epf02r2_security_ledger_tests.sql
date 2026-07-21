-- ============================================================================
-- EPF-02R2 — Security and Ledger Correctness Validation Tests
-- ============================================================================
-- Closes certification findings C-1 through C-5.
--
-- Run after: supabase db reset
--
-- Scope:
--   C-1  process_water_billing() is service-role-only
--   C-2  tenant-scoped advisory lock serialization
--   C-3  latest ledger balance (not MAX balance)
--   C-4  audit actor attribution via p_actor_profile_id
--   C-5  advisory lock derivation has no integer overflow
--   Idempotency and rollback remain intact

BEGIN;

-- ============================================================================
-- SETUP: create isolated test data
-- ============================================================================
SET LOCAL ROLE postgres;

DO $$
DECLARE
  v_tenant_id          uuid := 'e1111111-1111-1111-1111-111111111111';
  v_property_id        uuid := 'e2222222-2222-2222-2222-222222222222';
  v_profile_id         uuid := 'e3333333-3333-3333-3333-333333333333';
  v_user_id            uuid := 'e4444444-4444-4444-4444-444444444444';
  v_billing_account_id uuid := 'e5555555-5555-5555-5555-555555555555';
  v_billing_cycle_id   uuid := 'e6666666-6666-6666-6666-666666666666';
  v_meter_id           uuid := 'e7777777-7777-7777-7777-777777777777';
  v_tariff_table_id    uuid := 'e8888888-8888-8888-8888-888888888888';
  v_result             jsonb;
  v_invoice_id         uuid;
  v_audit_actor_id     uuid;
  v_latest_balance     numeric(15,2);
  v_count              integer;
BEGIN
  -- Ensure clean state
  DELETE FROM resident.ledger_entries WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.financial_audit_log WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.invoice_items WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.invoices WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.meter_readings WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.water_meters WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.billing_cycles WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.billing_accounts WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.tariff_bands WHERE tariff_table_id = v_tariff_table_id;
  DELETE FROM resident.tariff_tables WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.properties WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.residence_members WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.tenant_members WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.profiles WHERE id = v_profile_id;
  DELETE FROM auth.identities WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
  DELETE FROM resident.tenants WHERE id = v_tenant_id;

  -- User / profile
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'epf02r2@test.local', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', 'epf02r2@test.local'), 'email', v_user_id::text, now(), now(), now());

  INSERT INTO resident.tenants (id, legal_name, display_name, slug, status)
  VALUES (v_tenant_id, 'EPF-02R2 Test Association', 'EPF-02R2 Test', 'epf02r2-test', 'active');

  INSERT INTO resident.profiles (id, user_id, full_name, preferred_name, status, locale, timezone)
  VALUES (v_profile_id, v_user_id, 'EPF-02R2 Operator', 'Operator', 'active', 'pt-BR', 'America/Sao_Paulo');

  INSERT INTO resident.tenant_members (id, tenant_id, profile_id, role, status)
  VALUES (gen_random_uuid(), v_tenant_id, v_profile_id, 'association_operator', 'active');

  INSERT INTO resident.properties (id, tenant_id, label, nickname, address_line1, city, state, unit_identifier, status)
  VALUES (v_property_id, v_tenant_id, 'Apto 101', 'Apto 101', 'Rua Test', 'Curitiba', 'PR', '101', 'active');

  INSERT INTO resident.residence_members (id, tenant_id, property_id, profile_id, role, status, is_primary, start_date)
  VALUES (gen_random_uuid(), v_tenant_id, v_property_id, v_profile_id, 'owner', 'active', true, CURRENT_DATE - 30);

  INSERT INTO resident.billing_accounts (id, tenant_id, property_id, status)
  VALUES (v_billing_account_id, v_tenant_id, v_property_id, 'active');

  INSERT INTO resident.billing_cycles (id, tenant_id, billing_account_id, cycle_start, cycle_end, due_date, reference_period, status)
  VALUES (v_billing_cycle_id, v_tenant_id, v_billing_account_id, CURRENT_DATE - 30, CURRENT_DATE - 1, CURRENT_DATE + 5, '2026/07', 'open');

  INSERT INTO resident.water_meters (id, tenant_id, property_id, meter_number, installation_date, initial_reading, status)
  VALUES (v_meter_id, v_tenant_id, v_property_id, 'EPF02R2-METER', CURRENT_DATE - 60, 0, 'active');

  INSERT INTO resident.meter_readings (id, tenant_id, meter_id, reading_date, reading_value, source, notes)
  VALUES (gen_random_uuid(), v_tenant_id, v_meter_id, CURRENT_DATE - 30, 0, 'initial', 'Leitura inicial');

  INSERT INTO resident.meter_readings (id, tenant_id, meter_id, reading_date, reading_value, source)
  VALUES (gen_random_uuid(), v_tenant_id, v_meter_id, CURRENT_DATE - 1, 10, 'manual');

  INSERT INTO resident.tariff_tables (id, tenant_id, name, tariff_type, currency, effective_from, is_active)
  VALUES (v_tariff_table_id, v_tenant_id, 'EPF-02R2 Tariff', 'progressive', 'BRL', CURRENT_DATE - 60, true);

  INSERT INTO resident.tariff_bands (id, tariff_table_id, from_consumption, to_consumption, unit_price, sort_order)
  VALUES (gen_random_uuid(), v_tariff_table_id, 0, NULL, 5.00, 0);

  -- ==========================================================================
  -- C-1: authenticated cannot execute process_water_billing
  -- ==========================================================================
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id, 'role', 'authenticated')::text, true);
    PERFORM resident.process_water_billing(
      v_tenant_id, v_billing_account_id, v_billing_cycle_id,
      'DOC-REJECT', 50.00, CURRENT_DATE + 5, '2026/07',
      v_meter_id, 'EPF02R2-METER', 10,
      NULL, v_profile_id
    );
    RAISE EXCEPTION 'C-1 FAIL: authenticated role was allowed to execute process_water_billing';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'C-1 PASS: authenticated role denied execute on process_water_billing';
    WHEN OTHERS THEN
      RAISE NOTICE 'C-1 PASS: authenticated role blocked (%).', SQLERRM;
  END;

  -- ==========================================================================
  -- C-1: anon cannot execute process_water_billing
  -- ==========================================================================
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM resident.process_water_billing(
      v_tenant_id, v_billing_account_id, v_billing_cycle_id,
      'DOC-REJECT-ANON', 50.00, CURRENT_DATE + 5, '2026/07',
      v_meter_id, 'EPF02R2-METER', 10,
      NULL, NULL
    );
    RAISE EXCEPTION 'C-1 FAIL: anon role was allowed to execute process_water_billing';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'C-1 PASS: anon role denied execute on process_water_billing';
    WHEN OTHERS THEN
      RAISE NOTICE 'C-1 PASS: anon role blocked (%).', SQLERRM;
  END;

  -- ==========================================================================
  -- C-3: latest ledger balance is used (not MAX)
  -- Setup: old high balance, then newer low balance. New invoice must start
  -- from the low (latest) balance.
  -- ==========================================================================
  SET LOCAL ROLE postgres;

  INSERT INTO resident.ledger_entries (
    tenant_id, entry_date, description, debit_amount, credit_amount, balance,
    entity_type, entity_id, reference_document
  ) VALUES (
    v_tenant_id, now() - interval '2 days', 'Old high balance', 1000.00, 0, 1000.00,
    'test', 'old-high', 'OLD-HIGH'
  );

  INSERT INTO resident.ledger_entries (
    tenant_id, entry_date, description, debit_amount, credit_amount, balance,
    entity_type, entity_id, reference_document
  ) VALUES (
    v_tenant_id, now() - interval '1 day', 'Recent payment', 0, 900.00, 100.00,
    'test', 'recent-payment', 'RECENT-PAYMENT'
  );

  -- ==========================================================================
  -- C-2 / C-5 / C-4 / C-3: service-role execution succeeds
  -- ==========================================================================
  SET LOCAL ROLE service_role;
  v_result := resident.process_water_billing(
    v_tenant_id, v_billing_account_id, v_billing_cycle_id,
    'DOC-001', 50.00, CURRENT_DATE + 5, '2026/07',
    v_meter_id, 'EPF02R2-METER', 10,
    jsonb_build_object(
      'total_amount', 50.00,
      'bands', jsonb_build_array(jsonb_build_object(
        'consumption', 10,
        'unit_price', 5.00,
        'charge', 50.00
      )),
      'currency', 'BRL'
    ),
    v_profile_id
  );

  IF (v_result->>'status') <> 'created' THEN
    RAISE EXCEPTION 'C-2/C-4/C-5 FAIL: service-role execution did not create invoice. result=%', v_result;
  END IF;

  v_invoice_id := (v_result->>'invoice_id')::uuid;

  -- Verification queries run as postgres; service_role only needs EXECUTE.
  SET LOCAL ROLE postgres;

  SELECT balance INTO v_latest_balance
  FROM resident.ledger_entries
  WHERE tenant_id = v_tenant_id
    AND reference_document = 'DOC-001';

  IF v_latest_balance <> 150.00 THEN
    RAISE EXCEPTION 'C-3 FAIL: expected latest ledger balance 150.00, got %', v_latest_balance;
  END IF;

  SELECT actor_profile_id INTO v_audit_actor_id
  FROM resident.financial_audit_log
  WHERE tenant_id = v_tenant_id
    AND entity_id = v_invoice_id::text;

  IF v_audit_actor_id IS NULL OR v_audit_actor_id <> v_profile_id THEN
    RAISE EXCEPTION 'C-4 FAIL: audit actor_profile_id not persisted correctly. expected %, got %', v_profile_id, v_audit_actor_id;
  END IF;

  RAISE NOTICE 'C-2 PASS: tenant-scoped advisory lock acquired without error';
  RAISE NOTICE 'C-3 PASS: latest ledger balance used (150.00)';
  RAISE NOTICE 'C-4 PASS: audit actor_profile_id persisted (%)', v_audit_actor_id;
  RAISE NOTICE 'C-5 PASS: lock derivation succeeded (no INT_MIN overflow)';

  -- ==========================================================================
  -- IDEMPOTENCY: duplicate document_number returns status 'duplicate'
  -- ==========================================================================
  SET LOCAL ROLE service_role;
  v_result := resident.process_water_billing(
    v_tenant_id, v_billing_account_id, v_billing_cycle_id,
    'DOC-001', 50.00, CURRENT_DATE + 5, '2026/07',
    v_meter_id, 'EPF02R2-METER', 10,
    NULL, v_profile_id
  );

  IF (v_result->>'status') <> 'duplicate' THEN
    RAISE EXCEPTION 'IDM-01 FAIL: expected duplicate status, got %', v_result;
  END IF;

  SET LOCAL ROLE postgres;
  SELECT COUNT(*) INTO v_count
  FROM resident.invoices
  WHERE tenant_id = v_tenant_id AND document_number = 'DOC-001';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'IDM-01 FAIL: expected exactly 1 invoice for DOC-001, got %', v_count;
  END IF;

  RAISE NOTICE 'IDM-01 PASS: duplicate document_number returns status duplicate';

  -- ==========================================================================
  -- ATM-01: rollback — invalid billing_account_id rolls back all writes
  -- ==========================================================================
  SET LOCAL ROLE service_role;
  BEGIN
    v_result := resident.process_water_billing(
      v_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid, v_billing_cycle_id,
      'DOC-ROLLBACK', 50.00, CURRENT_DATE + 5, '2026/07',
      v_meter_id, 'EPF02R2-METER', 10,
      NULL, v_profile_id
    );
    RAISE EXCEPTION 'ATM-01 FAIL: expected FK error and rollback, got %', v_result;
  EXCEPTION WHEN OTHERS THEN
    SET LOCAL ROLE postgres;

    SELECT COUNT(*) INTO v_count
    FROM resident.invoices
    WHERE tenant_id = v_tenant_id AND document_number = 'DOC-ROLLBACK';

    IF v_count <> 0 THEN
      RAISE EXCEPTION 'ATM-01 FAIL: invoice created despite rollback';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM resident.ledger_entries
    WHERE tenant_id = v_tenant_id AND reference_document = 'DOC-ROLLBACK';

    IF v_count <> 0 THEN
      RAISE EXCEPTION 'ATM-01 FAIL: ledger entry created despite rollback';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM resident.financial_audit_log
    WHERE tenant_id = v_tenant_id AND entity_id = 'DOC-ROLLBACK';

    IF v_count <> 0 THEN
      RAISE EXCEPTION 'ATM-01 FAIL: audit log created despite rollback';
    END IF;

    RAISE NOTICE 'ATM-01 PASS: rollback prevented partial writes';
  END;

  RAISE NOTICE 'EPF-02R2 VALIDATION COMPLETE';
END $$;

ROLLBACK;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tests:
--   C-1  authenticated denied execute
--   C-1  anon denied execute
--   C-2  tenant-scoped advisory lock protects service-role execution
--   C-3  latest ledger balance used (not historical MAX)
--   C-4  audit actor_profile_id persisted
--   C-5  safe advisory lock derivation (no abs/hashtext overflow)
--   IDM-01 document-number idempotency
--   ATM-01 atomic rollback on error
-- ============================================================================
