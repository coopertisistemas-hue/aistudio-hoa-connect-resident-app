-- ============================================================================
-- EPF-03R — Refund Domain Tests
-- ============================================================================
-- Validates:
--   • Full refund
--   • Partial refund
--   • Multiple partial refunds
--   • Over-refund rejection
--   • Repeated idempotency key
--   • Refund-aware invoice balance
--   • Ledger reversal entry
--   • Financial audit
--   • Invoice reopening after full refund
--
-- Run after: supabase db reset

BEGIN;

SET LOCAL ROLE postgres;

DO $$
DECLARE
  v_tenant_id          uuid := 'd1111111-1111-1111-1111-111111111111';
  v_property_id        uuid := 'd2222222-2222-2222-2222-222222222222';
  v_profile_id         uuid := 'd3333333-3333-3333-3333-333333333333';
  v_user_id            uuid := 'd4444444-4444-4444-4444-444444444444';
  v_billing_account_id uuid := 'd5555555-5555-5555-5555-555555555555';
  v_billing_cycle_id   uuid := 'd6666666-6666-6666-6666-666666666666';
  v_invoice_id         uuid := 'd7777777-7777-7777-7777-777777777777';
  v_config_id          uuid := 'd8888888-8888-8888-8888-888888888888';
  v_intent_id          uuid;
  v_transaction_id     uuid;
  v_result             jsonb;
  v_balance            numeric(15,2);
  v_invoice_status     text;
  v_count              integer;
  v_ledger_balance     numeric(15,2);
BEGIN
  -- Cleanup
  DELETE FROM resident.payment_provider_event_signatures WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_provider_events WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_webhooks WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.tenant_payment_provider_configs WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_transactions WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_intents WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_refunds WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.financial_audit_log WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.ledger_entries WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.invoice_items WHERE tenant_id = v_tenant_id;
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

  -- Setup
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'epf03r-ref@test.local', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', 'epf03r-ref@test.local'), 'email', v_user_id::text, now(), now(), now());

  INSERT INTO resident.tenants (id, legal_name, display_name, slug, status)
  VALUES (v_tenant_id, 'EPF-03R Refund Test', 'EPF-03R Ref', 'epf03r-ref', 'active');

  INSERT INTO resident.profiles (id, user_id, full_name, preferred_name, status, locale, timezone)
  VALUES (v_profile_id, v_user_id, 'EPF-03R Refund Operator', 'Operator', 'active', 'pt-BR', 'America/Sao_Paulo');

  INSERT INTO resident.tenant_members (id, tenant_id, profile_id, role, status)
  VALUES (gen_random_uuid(), v_tenant_id, v_profile_id, 'association_operator', 'active');

  INSERT INTO resident.properties (id, tenant_id, label, nickname, address_line1, city, state, unit_identifier, status)
  VALUES (v_property_id, v_tenant_id, 'Apto 101', 'Apto 101', 'Rua Test', 'Curitiba', 'PR', '101', 'active');

  INSERT INTO resident.billing_accounts (id, tenant_id, property_id, status)
  VALUES (v_billing_account_id, v_tenant_id, v_property_id, 'active');

  INSERT INTO resident.billing_cycles (id, tenant_id, billing_account_id, cycle_start, cycle_end, due_date, reference_period, status)
  VALUES (v_billing_cycle_id, v_tenant_id, v_billing_account_id, CURRENT_DATE - 30, CURRENT_DATE - 1, CURRENT_DATE + 5, '2026/07', 'open');

  INSERT INTO resident.invoices (id, tenant_id, billing_account_id, billing_cycle_id, document_number, amount, due_date, status)
  VALUES (v_invoice_id, v_tenant_id, v_billing_account_id, v_billing_cycle_id, 'DOC-REF-001', 100.00, CURRENT_DATE + 5, 'open');

  INSERT INTO resident.tenant_payment_provider_configs (
    id, tenant_id, provider_id, environment, method_type, is_active, is_default
  ) VALUES (v_config_id, v_tenant_id, 'mock', 'sandbox', 'pix', true, true);

  INSERT INTO resident.payment_intents (
    id, tenant_id, invoice_id, amount, status, provider, method_type,
    provider_payment_intent_id, reconciliation_id, idempotency_key, provider_config_id
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_invoice_id, 100.00, 'confirmed', 'mock', 'pix',
    'mock-pix-ref-001', 'rec-ref-001', 'idemp-ref-001', v_config_id
  )
  RETURNING id INTO v_intent_id;

  INSERT INTO resident.payment_transactions (
    id, tenant_id, invoice_id, payment_intent_id, amount, status, provider,
    provider_config_id, payment_method_type, reconciliation_id
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_invoice_id, v_intent_id, 100.00, 'confirmed',
    'mock', v_config_id, 'pix', 'rec-ref-001'
  )
  RETURNING id INTO v_transaction_id;

  -- Set invoice paid.
  UPDATE resident.invoices SET status = 'paid' WHERE id = v_invoice_id;

  SET LOCAL ROLE service_role;

  -- =======================================================================
  -- REF-01: Partial refund
  -- =======================================================================
  v_result := resident.process_payment_refund(
    v_tenant_id, v_transaction_id, 30.00, 'refund-key-001',
    'mock-refund-001', '{}'::jsonb, v_profile_id
  );
  IF (v_result->>'status') <> 'confirmed' THEN
    RAISE EXCEPTION 'REF-01 FAIL: expected confirmed, got %', v_result;
  END IF;

  v_balance := resident.get_invoice_balance(v_invoice_id);
  IF v_balance <> 30.00 THEN
    RAISE EXCEPTION 'REF-01 FAIL: expected invoice balance 30.00 after 30 refund, got %', v_balance;
  END IF;

  SELECT status INTO v_invoice_status FROM resident.invoices WHERE id = v_invoice_id;
  IF v_invoice_status NOT IN ('open', 'payment_pending') THEN
    RAISE EXCEPTION 'REF-01 FAIL: expected invoice open or payment_pending after partial refund, got %', v_invoice_status;
  END IF;

  SELECT balance INTO v_ledger_balance FROM resident.ledger_entries
  WHERE tenant_id = v_tenant_id ORDER BY entry_date DESC, created_at DESC, id DESC LIMIT 1;
  IF v_ledger_balance IS NULL OR v_ledger_balance <= 0 THEN
    RAISE EXCEPTION 'REF-01 FAIL: expected positive ledger balance after refund reversal';
  END IF;

  RAISE NOTICE 'REF-01 PASS: partial refund updates balance and invoice status';

  -- =======================================================================
  -- REF-02: Second partial refund
  -- =======================================================================
  v_result := resident.process_payment_refund(
    v_tenant_id, v_transaction_id, 20.00, 'refund-key-002',
    'mock-refund-002', '{}'::jsonb, v_profile_id
  );
  IF (v_result->>'status') <> 'confirmed' THEN
    RAISE EXCEPTION 'REF-02 FAIL: expected confirmed, got %', v_result;
  END IF;

  v_balance := resident.get_invoice_balance(v_invoice_id);
  IF v_balance <> 50.00 THEN
    RAISE EXCEPTION 'REF-02 FAIL: expected invoice balance 50.00 after 50 total refund, got %', v_balance;
  END IF;
  RAISE NOTICE 'REF-02 PASS: second partial refund accumulates correctly';

  -- =======================================================================
  -- REF-03: Repeated idempotency key returns existing refund
  -- =======================================================================
  v_result := resident.process_payment_refund(
    v_tenant_id, v_transaction_id, 999.00, 'refund-key-002',
    'mock-refund-002', '{}'::jsonb, v_profile_id
  );
  IF (v_result->>'status') <> 'confirmed' THEN
    RAISE EXCEPTION 'REF-03 FAIL: expected confirmed from idempotency, got %', v_result;
  END IF;
  IF (v_result->>'amount')::numeric <> 20.00 THEN
    RAISE EXCEPTION 'REF-03 FAIL: idempotency returned different amount %', v_result->>'amount';
  END IF;
  RAISE NOTICE 'REF-03 PASS: repeated idempotency key returns original refund';

  -- =======================================================================
  -- REF-04: Over-refund rejected
  -- =======================================================================
  BEGIN
    v_result := resident.process_payment_refund(
      v_tenant_id, v_transaction_id, 60.00, 'refund-key-003',
      'mock-refund-003', '{}'::jsonb, v_profile_id
    );
    RAISE EXCEPTION 'REF-04 FAIL: over-refund was allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%exceeds remaining refundable amount%' THEN
      RAISE NOTICE 'REF-04 PASS: over-refund rejected';
    ELSE
      RAISE;
    END IF;
  END;

  -- =======================================================================
  -- REF-05: Full refund reopens invoice
  -- =======================================================================
  v_result := resident.process_payment_refund(
    v_tenant_id, v_transaction_id, 50.00, 'refund-key-004',
    'mock-refund-004', '{}'::jsonb, v_profile_id
  );
  IF (v_result->>'status') <> 'confirmed' THEN
    RAISE EXCEPTION 'REF-05 FAIL: expected confirmed, got %', v_result;
  END IF;

  v_balance := resident.get_invoice_balance(v_invoice_id);
  IF v_balance <> 100.00 THEN
    RAISE EXCEPTION 'REF-05 FAIL: expected invoice balance restored to 100.00, got %', v_balance;
  END IF;

  SELECT status INTO v_invoice_status FROM resident.invoices WHERE id = v_invoice_id;
  IF v_invoice_status NOT IN ('open', 'overdue') THEN
    RAISE EXCEPTION 'REF-05 FAIL: expected invoice open/overdue after full refund, got %', v_invoice_status;
  END IF;

  SELECT COUNT(*) INTO v_count FROM resident.payment_refunds
  WHERE tenant_id = v_tenant_id AND payment_transaction_id = v_transaction_id AND status = 'confirmed';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'REF-05 FAIL: expected 3 confirmed refunds, got %', v_count;
  END IF;
  RAISE NOTICE 'REF-05 PASS: full refund reopens invoice';

  -- =======================================================================
  -- REF-06: Audit records exist
  -- =======================================================================
  SELECT COUNT(*) INTO v_count FROM resident.financial_audit_log
  WHERE tenant_id = v_tenant_id
    AND action IN ('payment_partially_refunded', 'payment_refunded');
  IF v_count < 3 THEN
    RAISE EXCEPTION 'REF-06 FAIL: expected at least 3 refund audit records, got %', v_count;
  END IF;
  RAISE NOTICE 'REF-06 PASS: refund audit records exist';

  RAISE NOTICE 'EPF-03R REFUND TESTS COMPLETE';
END $$;

ROLLBACK;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tests:
--   REF-01: partial refund
--   REF-02: second partial refund
--   REF-03: repeated idempotency key
--   REF-04: over-refund rejection
--   REF-05: full refund reopens invoice
--   REF-06: audit records
-- ============================================================================
