-- ============================================================================
-- EPF-03R — Tenant Isolation Tests
-- ============================================================================
-- Validates that payment operations cannot cross tenant boundaries.
--
-- Run after: supabase db reset

BEGIN;

SET LOCAL ROLE postgres;

DO $$
DECLARE
  v_tenant_a         uuid := 'b1111111-1111-1111-1111-111111111111';
  v_tenant_b         uuid := 'b2222222-2222-2222-2222-222222222222';
  v_property_a       uuid := 'b3333333-3333-3333-3333-333333333333';
  v_property_b       uuid := 'b4444444-4444-4444-4444-444444444444';
  v_profile_a        uuid := 'b5555555-5555-5555-5555-555555555555';
  v_profile_b        uuid := 'b6666666-6666-6666-6666-666666666666';
  v_user_a           uuid := 'b7777777-7777-7777-7777-777777777777';
  v_user_b           uuid := 'b8888888-8888-8888-8888-888888888888';
  v_billing_account_a uuid := 'b9999999-9999-9999-9999-999999999999';
  v_billing_account_b uuid := 'baaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_billing_cycle_a  uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_billing_cycle_b  uuid := 'bccccccc-cccc-cccc-cccc-cccccccccccc';
  v_config_a         uuid := 'bddddddd-dddd-dddd-dddd-dddddddddddd';
  v_config_b         uuid := 'beeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_invoice_a        uuid := 'bfffffff-ffff-ffff-ffff-ffffffffffff';
  v_invoice_b        uuid := 'c1111111-1111-1111-1111-111111111111';
  v_intent_a         uuid;
  v_intent_b         uuid;
  v_transaction_b    uuid;
  v_result           jsonb;
  v_error_raised     boolean;
BEGIN
  -- Cleanup
  DELETE FROM resident.payment_transactions WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.payment_intents WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.payment_refunds WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.payment_provider_events WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.payment_provider_event_signatures WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.payment_webhooks WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.tenant_payment_provider_configs WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.financial_audit_log WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.ledger_entries WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.invoice_items WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.invoices WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.billing_cycles WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.billing_accounts WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.residence_members WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.properties WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.tenant_members WHERE tenant_id IN (v_tenant_a, v_tenant_b);
  DELETE FROM resident.profiles WHERE id IN (v_profile_a, v_profile_b);
  DELETE FROM auth.identities WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
  DELETE FROM resident.tenants WHERE id IN (v_tenant_a, v_tenant_b);

  -- Setup tenants
  INSERT INTO resident.tenants (id, legal_name, display_name, slug, status) VALUES
    (v_tenant_a, 'Tenant A', 'Tenant A', 'tenant-a', 'active'),
    (v_tenant_b, 'Tenant B', 'Tenant B', 'tenant-b', 'active');

  -- Setup users and profiles
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tenant-a@test.local', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tenant-b@test.local', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES
    (gen_random_uuid(), v_user_a, jsonb_build_object('sub', v_user_a::text, 'email', 'tenant-a@test.local'), 'email', v_user_a::text, now(), now(), now()),
    (gen_random_uuid(), v_user_b, jsonb_build_object('sub', v_user_b::text, 'email', 'tenant-b@test.local'), 'email', v_user_b::text, now(), now(), now());

  INSERT INTO resident.profiles (id, user_id, full_name, preferred_name, status, locale, timezone) VALUES
    (v_profile_a, v_user_a, 'Operator A', 'Op A', 'active', 'pt-BR', 'America/Sao_Paulo'),
    (v_profile_b, v_user_b, 'Operator B', 'Op B', 'active', 'pt-BR', 'America/Sao_Paulo');

  INSERT INTO resident.tenant_members (id, tenant_id, profile_id, role, status) VALUES
    (gen_random_uuid(), v_tenant_a, v_profile_a, 'association_operator', 'active'),
    (gen_random_uuid(), v_tenant_b, v_profile_b, 'association_operator', 'active');

  -- Setup properties and billing
  INSERT INTO resident.properties (id, tenant_id, label, nickname, address_line1, city, state, unit_identifier, status) VALUES
    (v_property_a, v_tenant_a, 'Apto A', 'Apto A', 'Rua A', 'Curitiba', 'PR', '101', 'active'),
    (v_property_b, v_tenant_b, 'Apto B', 'Apto B', 'Rua B', 'Curitiba', 'PR', '102', 'active');

  INSERT INTO resident.billing_accounts (id, tenant_id, property_id, status) VALUES
    (v_billing_account_a, v_tenant_a, v_property_a, 'active'),
    (v_billing_account_b, v_tenant_b, v_property_b, 'active');

  INSERT INTO resident.billing_cycles (id, tenant_id, billing_account_id, cycle_start, cycle_end, due_date, reference_period, status) VALUES
    (v_billing_cycle_a, v_tenant_a, v_billing_account_a, CURRENT_DATE - 30, CURRENT_DATE - 1, CURRENT_DATE + 5, '2026/07', 'open'),
    (v_billing_cycle_b, v_tenant_b, v_billing_account_b, CURRENT_DATE - 30, CURRENT_DATE - 1, CURRENT_DATE + 5, '2026/07', 'open');

  INSERT INTO resident.invoices (id, tenant_id, billing_account_id, billing_cycle_id, document_number, amount, due_date, status) VALUES
    (v_invoice_a, v_tenant_a, v_billing_account_a, v_billing_cycle_a, 'DOC-A-001', 100.00, CURRENT_DATE + 5, 'open'),
    (v_invoice_b, v_tenant_b, v_billing_account_b, v_billing_cycle_b, 'DOC-B-001', 200.00, CURRENT_DATE + 5, 'open');

  INSERT INTO resident.tenant_payment_provider_configs (
    id, tenant_id, provider_id, environment, method_type, is_active, is_default
  ) VALUES
    (v_config_a, v_tenant_a, 'mock', 'sandbox', 'pix', true, true),
    (v_config_b, v_tenant_b, 'mock', 'sandbox', 'pix', true, true);

  INSERT INTO resident.payment_intents (
    id, tenant_id, invoice_id, amount, status, provider, method_type,
    provider_payment_intent_id, reconciliation_id, idempotency_key, provider_config_id
  ) VALUES
    (gen_random_uuid(), v_tenant_a, v_invoice_a, 100.00, 'confirmed', 'mock', 'pix',
     'mock-pix-a-001', 'rec-a-001', 'idemp-a-001', v_config_a)
  RETURNING id INTO v_intent_a;

  INSERT INTO resident.payment_intents (
    id, tenant_id, invoice_id, amount, status, provider, method_type,
    provider_payment_intent_id, reconciliation_id, idempotency_key, provider_config_id
  ) VALUES
    (gen_random_uuid(), v_tenant_b, v_invoice_b, 200.00, 'confirmed', 'mock', 'pix',
     'mock-pix-b-001', 'rec-b-001', 'idemp-b-001', v_config_b)
  RETURNING id INTO v_intent_b;

  INSERT INTO resident.payment_transactions (
    id, tenant_id, invoice_id, payment_intent_id, amount, status, provider,
    provider_config_id, payment_method_type, reconciliation_id
  ) VALUES
    (gen_random_uuid(), v_tenant_b, v_invoice_b, v_intent_b, 200.00, 'confirmed',
     'mock', v_config_b, 'pix', 'rec-b-001')
  RETURNING id INTO v_transaction_b;

  SET LOCAL ROLE service_role;

  -- =======================================================================
  -- ISO-01: create_payment_intent rejects config from different tenant
  -- =======================================================================
  v_error_raised := false;
  BEGIN
    PERFORM resident.create_payment_intent(
      p_tenant_id => v_tenant_a,
      p_invoice_id => v_invoice_a,
      p_provider_id => 'mock',
      p_method_type => 'pix'::resident.payment_method_type,
      p_provider_config_id => v_config_b,
      p_provider_payment_intent_id => 'mock-pix-cross',
      p_amount => 50.00,
      p_provider_pix_code => null::text,
      p_provider_pix_qr_base64 => null::text,
      p_provider_boleto_url => null::text,
      p_provider_boleto_barcode => null::text,
      p_provider_boleto_digitable_line => null::text,
      p_expires_at => null::timestamptz,
      p_reconciliation_id => null::text,
      p_raw_provider_response => '{}'::jsonb,
      p_idempotency_key => 'idemp-cross-001',
      p_actor_profile_id => v_profile_a
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%Provider configuration not found or inactive for tenant%' THEN
      v_error_raised := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'ISO-01 FAIL: cross-tenant config accepted';
  END IF;
  RAISE NOTICE 'ISO-01 PASS: create_payment_intent rejects cross-tenant config';

  -- =======================================================================
  -- ISO-02: upsert_provider_config rejects config id from different tenant
  -- =======================================================================
  v_error_raised := false;
  BEGIN
    PERFORM resident.upsert_provider_config(
      p_tenant_id => v_tenant_a,
      p_config_id => v_config_b,
      p_provider_id => 'mock',
      p_environment => 'sandbox'::resident.payment_provider_environment,
      p_method_type => 'pix'::resident.payment_method_type,
      p_is_active => true,
      p_is_default => true,
      p_agreement_number => null::text,
      p_wallet => null::text,
      p_portfolio => null::text,
      p_bank_account => '{}'::jsonb,
      p_pix_keys => '{}'::jsonb,
      p_credentials => null::text,
      p_webhook_secret => null::text,
      p_metadata => '{}'::jsonb,
      p_actor_profile_id => v_profile_a
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%Provider configuration not found for tenant%' THEN
      v_error_raised := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'ISO-02 FAIL: cross-tenant config upsert accepted';
  END IF;
  RAISE NOTICE 'ISO-02 PASS: upsert_provider_config rejects cross-tenant config id';

  -- =======================================================================
  -- ISO-03: process_payment_refund rejects transaction from different tenant
  -- =======================================================================
  v_error_raised := false;
  BEGIN
    PERFORM resident.process_payment_refund(
      v_tenant_a, v_transaction_b, 50.00, 'idemp-refund-cross',
      'mock-refund-cross', '{}'::jsonb, v_profile_a
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%Payment transaction not found for tenant%' THEN
      v_error_raised := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'ISO-03 FAIL: cross-tenant refund accepted';
  END IF;
  RAISE NOTICE 'ISO-03 PASS: process_payment_refund rejects cross-tenant transaction';

  -- =======================================================================
  -- ISO-04: cancel_payment_intent rejects intent from different tenant
  -- =======================================================================
  v_error_raised := false;
  BEGIN
    PERFORM resident.cancel_payment_intent(
      v_tenant_b, v_intent_a, '{}'::jsonb, v_profile_b
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%Payment intent not found for tenant%' THEN
      v_error_raised := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'ISO-04 FAIL: cross-tenant cancellation accepted';
  END IF;
  RAISE NOTICE 'ISO-04 PASS: cancel_payment_intent rejects cross-tenant intent';

  RAISE NOTICE 'EPF-03R TENANT ISOLATION TESTS COMPLETE';
END $$;

ROLLBACK;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tests:
--   ISO-01: create_payment_intent rejects cross-tenant config
--   ISO-02: upsert_provider_config rejects cross-tenant config id
--   ISO-03: process_payment_refund rejects cross-tenant transaction
--   ISO-04: cancel_payment_intent rejects cross-tenant intent
-- ============================================================================
