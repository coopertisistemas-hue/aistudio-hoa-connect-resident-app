-- ============================================================================
-- EPF-01 — Financial Foundation Regression Tests
-- ============================================================================
-- Validates that the certified EPF-01 financial domain remains intact.
--
-- Run after: supabase db reset

BEGIN;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM resident.billing_accounts;
  RAISE NOTICE 'EPF01-REG-01 PASS: billing_accounts accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.invoices;
  RAISE NOTICE 'EPF01-REG-02 PASS: invoices accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.invoice_items;
  RAISE NOTICE 'EPF01-REG-03 PASS: invoice_items accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.payment_intents;
  RAISE NOTICE 'EPF01-REG-04 PASS: payment_intents accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.payment_transactions;
  RAISE NOTICE 'EPF01-REG-05 PASS: payment_transactions accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.payment_receipts;
  RAISE NOTICE 'EPF01-REG-06 PASS: payment_receipts accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.ledger_entries;
  RAISE NOTICE 'EPF01-REG-07 PASS: ledger_entries accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.financial_adjustments;
  RAISE NOTICE 'EPF01-REG-08 PASS: financial_adjustments accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.financial_audit_log;
  RAISE NOTICE 'EPF01-REG-09 PASS: financial_audit_log accessible (count: %)', v_count;

  RAISE NOTICE 'EPF-01 FINANCIAL REGRESSION TESTS COMPLETE';
END $$;

ROLLBACK;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tests:
--   EPF01-REG-01 to EPF01-REG-09: EPF-01 financial tables accessible
-- ============================================================================
