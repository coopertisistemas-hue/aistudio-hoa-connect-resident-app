-- ============================================================================
-- EPF-03 Payment Processing Platform — Legacy Validation Suite
-- ============================================================================
--
-- This file has been superseded by the EPF-03R remediation validation suite.
--
-- The EPF-03R suite is split into focused, independently reviewable files:
--
--   validation/epf03r_privilege_tests.sql
--   validation/epf03r_tenant_isolation_tests.sql
--   validation/epf03r_webhook_tests.sql
--   validation/epf03r_refund_tests.sql
--   validation/epf03r_state_machine_tests.sql
--   validation/epf03r_regression_tests.sql
--
-- Run all EPF-03R tests with:
--
--   bash validation/run_epf03r_tests.sh
--
-- or via npm:
--
--   npm run supabase:test:epf03
--
-- This legacy file is retained as a pointer and does not execute any tests.
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'EPF-03 validation has moved to validation/run_epf03r_tests.sh';
END $$;
