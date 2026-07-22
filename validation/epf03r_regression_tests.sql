-- ============================================================================
-- EPF-03R — Regression Tests
-- ============================================================================
-- Validates that EPF-01 financial foundation and EPF-02 water billing domain
-- remain intact after EPF-03R remediation.
--
-- Run after: supabase db reset

BEGIN;

DO $$
DECLARE
  v_count integer;
BEGIN
  -- ========================================================================
  -- REG-01: EPF-01 financial tables accessible
  -- ========================================================================
  SELECT COUNT(*) INTO v_count FROM resident.billing_accounts;
  RAISE NOTICE 'REG-01 PASS: billing_accounts accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.invoices;
  RAISE NOTICE 'REG-02 PASS: invoices accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.ledger_entries;
  RAISE NOTICE 'REG-03 PASS: ledger_entries accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.financial_audit_log;
  RAISE NOTICE 'REG-04 PASS: financial_audit_log accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.payment_intents;
  RAISE NOTICE 'REG-05 PASS: payment_intents accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.payment_transactions;
  RAISE NOTICE 'REG-06 PASS: payment_transactions accessible (count: %)', v_count;

  -- ========================================================================
  -- REG-02: EPF-02 water tables accessible
  -- ========================================================================
  SELECT COUNT(*) INTO v_count FROM resident.water_meters;
  RAISE NOTICE 'REG-07 PASS: water_meters accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.meter_readings;
  RAISE NOTICE 'REG-08 PASS: meter_readings accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.tariff_tables;
  RAISE NOTICE 'REG-09 PASS: tariff_tables accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.billing_rules;
  RAISE NOTICE 'REG-10 PASS: billing_rules accessible (count: %)', v_count;

  -- ========================================================================
  -- REG-03: Provider registry seeded
  -- ========================================================================
  SELECT COUNT(*) INTO v_count FROM resident.payment_providers WHERE id = 'mock';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'REG-03 FAIL: mock provider not found';
  END IF;
  RAISE NOTICE 'REG-11 PASS: mock provider present';

  SELECT COUNT(*) INTO v_count
  FROM resident.payment_provider_capabilities
  WHERE provider_id = 'mock' AND capability = 'pix_generation' AND is_active = true;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'REG-12 FAIL: mock pix_generation capability not found';
  END IF;
  RAISE NOTICE 'REG-12 PASS: mock pix_generation capability present';

  RAISE NOTICE 'EPF-03R REGRESSION TESTS COMPLETE';
END $$;

ROLLBACK;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tests:
--   REG-01 to REG-06: EPF-01 financial regression
--   REG-07 to REG-10: EPF-02 water domain regression
--   REG-11 to REG-12: EPF-03 provider registry integrity
-- ============================================================================
