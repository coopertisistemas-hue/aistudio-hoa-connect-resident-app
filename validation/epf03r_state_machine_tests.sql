-- ============================================================================
-- EPF-03R — Payment and Refund State Machine Tests
-- ============================================================================
-- Validates corrected state transitions and rejects invalid transitions with
-- specific exceptions. Never uses WHEN OTHERS THEN PASS.
--
-- Run after: supabase db reset

BEGIN;

SET LOCAL ROLE postgres;

DO $$
DECLARE
  v_tenant_id          uuid := 'c1111111-1111-1111-1111-111111111111';
  v_property_id        uuid := 'c2222222-2222-2222-2222-222222222222';
  v_profile_id         uuid := 'c3333333-3333-3333-3333-333333333333';
  v_user_id            uuid := 'c4444444-4444-4444-4444-444444444444';
  v_billing_account_id uuid := 'c5555555-5555-5555-5555-555555555555';
  v_billing_cycle_id   uuid := 'c6666666-6666-6666-6666-666666666666';
  v_invoice_id         uuid := 'c7777777-7777-7777-7777-777777777777';
  v_config_id          uuid := 'c8888888-8888-8888-8888-888888888888';
  v_intent_id          uuid;
  v_tx_id              uuid;
  v_error_raised       boolean;
BEGIN
  -- Cleanup
  DELETE FROM resident.payment_transactions WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_intents WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_refunds WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.financial_audit_log WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.ledger_entries WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.invoices WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.billing_cycles WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.billing_accounts WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.residence_members WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.properties WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.tenant_members WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.profiles WHERE id = v_profile_id;
  DELETE FROM auth.identities WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
  DELETE FROM resident.tenants WHERE id = v_tenant_id;
  DELETE FROM resident.tenant_payment_provider_configs WHERE tenant_id = v_tenant_id;

  -- Setup
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'epf03r-sm@test.local', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', 'epf03r-sm@test.local'), 'email', v_user_id::text, now(), now(), now());

  INSERT INTO resident.tenants (id, legal_name, display_name, slug, status)
  VALUES (v_tenant_id, 'EPF-03R State Machine Test', 'EPF-03R SM', 'epf03r-sm', 'active');

  INSERT INTO resident.profiles (id, user_id, full_name, preferred_name, status, locale, timezone)
  VALUES (v_profile_id, v_user_id, 'EPF-03R SM Operator', 'Operator', 'active', 'pt-BR', 'America/Sao_Paulo');

  INSERT INTO resident.tenant_members (id, tenant_id, profile_id, role, status)
  VALUES (gen_random_uuid(), v_tenant_id, v_profile_id, 'association_operator', 'active');

  INSERT INTO resident.properties (id, tenant_id, label, nickname, address_line1, city, state, unit_identifier, status)
  VALUES (v_property_id, v_tenant_id, 'Apto 101', 'Apto 101', 'Rua Test', 'Curitiba', 'PR', '101', 'active');

  INSERT INTO resident.billing_accounts (id, tenant_id, property_id, status)
  VALUES (v_billing_account_id, v_tenant_id, v_property_id, 'active');

  INSERT INTO resident.billing_cycles (id, tenant_id, billing_account_id, cycle_start, cycle_end, due_date, reference_period, status)
  VALUES (v_billing_cycle_id, v_tenant_id, v_billing_account_id, CURRENT_DATE - 30, CURRENT_DATE - 1, CURRENT_DATE + 5, '2026/07', 'open');

  INSERT INTO resident.invoices (id, tenant_id, billing_account_id, billing_cycle_id, document_number, amount, due_date, status)
  VALUES (v_invoice_id, v_tenant_id, v_billing_account_id, v_billing_cycle_id, 'DOC-SM-001', 100.00, CURRENT_DATE + 5, 'open');

  INSERT INTO resident.tenant_payment_provider_configs (
    id, tenant_id, provider_id, environment, method_type, is_active, is_default
  ) VALUES (v_config_id, v_tenant_id, 'mock', 'sandbox', 'pix', true, true);

  INSERT INTO resident.payment_intents (
    id, tenant_id, invoice_id, amount, status, provider, method_type,
    provider_payment_intent_id, reconciliation_id, idempotency_key, provider_config_id
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_invoice_id, 100.00, 'processing', 'mock', 'pix',
    'mock-pix-sm-001', 'rec-sm-001', 'idemp-sm-001', v_config_id
  )
  RETURNING id INTO v_intent_id;

  -- =======================================================================
  -- SM-01: processing → confirmed (intent and transaction)
  -- =======================================================================
  UPDATE resident.payment_intents SET status = 'confirmed' WHERE id = v_intent_id;
  RAISE NOTICE 'SM-01 PASS: processing → confirmed accepted';

  INSERT INTO resident.payment_transactions (
    id, tenant_id, invoice_id, payment_intent_id, amount, status, provider,
    provider_config_id, payment_method_type, reconciliation_id
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_invoice_id, v_intent_id, 100.00, 'confirmed',
    'mock', v_config_id, 'pix', 'rec-sm-001'
  )
  RETURNING id INTO v_tx_id;

  -- =======================================================================
  -- SM-02: confirmed → partially_refunded (transaction)
  -- =======================================================================
  UPDATE resident.payment_transactions SET status = 'partially_refunded' WHERE id = v_tx_id;
  RAISE NOTICE 'SM-02 PASS: confirmed → partially_refunded accepted';

  -- =======================================================================
  -- SM-03: partially_refunded → refunded (transaction escalation)
  -- =======================================================================
  UPDATE resident.payment_transactions SET status = 'refunded' WHERE id = v_tx_id;
  RAISE NOTICE 'SM-03 PASS: partially_refunded → refunded accepted';

  -- =======================================================================
  -- SM-04: refunded → partially_refunded rejected
  -- =======================================================================
  v_error_raised := false;
  BEGIN
    UPDATE resident.payment_transactions SET status = 'partially_refunded' WHERE id = v_tx_id;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%Cannot transition payment_transaction from terminal status%' THEN
      v_error_raised := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'SM-04 FAIL: refunded → partially_refunded was allowed';
  END IF;
  RAISE NOTICE 'SM-04 PASS: refunded → partially_refunded rejected';

  -- =======================================================================
  -- SM-05: confirmed → pending rejected
  -- =======================================================================
  INSERT INTO resident.payment_intents (
    id, tenant_id, invoice_id, amount, status, provider, method_type,
    provider_payment_intent_id, reconciliation_id, idempotency_key, provider_config_id
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_invoice_id, 50.00, 'confirmed', 'mock', 'pix',
    'mock-pix-sm-002', 'rec-sm-002', 'idemp-sm-002', v_config_id
  );

  v_error_raised := false;
  BEGIN
    UPDATE resident.payment_intents SET status = 'pending' WHERE reconciliation_id = 'rec-sm-002';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%Invalid payment_intent transition%' THEN
      v_error_raised := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'SM-05 FAIL: confirmed → pending was allowed';
  END IF;
  RAISE NOTICE 'SM-05 PASS: confirmed → pending rejected';

  -- =======================================================================
  -- SM-06: cancelled terminal state blocks further transitions
  -- =======================================================================
  INSERT INTO resident.payment_intents (
    id, tenant_id, invoice_id, amount, status, provider, method_type,
    provider_payment_intent_id, reconciliation_id, idempotency_key, provider_config_id
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_invoice_id, 25.00, 'pending', 'mock', 'pix',
    'mock-pix-sm-003', 'rec-sm-003', 'idemp-sm-003', v_config_id
  );

  UPDATE resident.payment_intents SET status = 'cancelled' WHERE reconciliation_id = 'rec-sm-003';

  v_error_raised := false;
  BEGIN
    UPDATE resident.payment_intents SET status = 'confirmed' WHERE reconciliation_id = 'rec-sm-003';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%Cannot transition payment_intent from terminal status%' THEN
      v_error_raised := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_error_raised THEN
    RAISE EXCEPTION 'SM-06 FAIL: cancelled → confirmed was allowed';
  END IF;
  RAISE NOTICE 'SM-06 PASS: cancelled is terminal';

  RAISE NOTICE 'EPF-03R STATE MACHINE TESTS COMPLETE';
END $$;

ROLLBACK;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tests:
--   SM-01: processing → confirmed
--   SM-02: confirmed → partially_refunded
--   SM-03: partially_refunded → refunded
--   SM-04: refunded → partially_refunded rejected
--   SM-05: confirmed → pending rejected
--   SM-06: cancelled terminal state
-- ============================================================================
