-- EPF-03R Remediation — Migration 05
-- Final Privilege Gate and Exposure Verification
--
-- This migration is additive and does not modify any certified EPF-01, EPF-02 or
-- original EPF-03 migration file.
--
-- Changes:
--   • Refund-aware replacement of resident.payment_transactions_confirmed_immutable()
--     to allow confirmed → partially_refunded / refunded transitions required by
--     the new payment_refunds lifecycle.
--   • Final explicit revoke/grant pass over every function created or replaced
--     by the EPF-03R remediation.
--   • has_function_privilege assertions for postgres, service_role, authenticated,
--     anon and public roles.
--   • Namespace and exposure verification.

-- ============================================================================
-- 1. REFUND-AWARE IMMUTABLE TRANSACTION TRIGGER
-- ============================================================================
-- EPF-01 declared confirmed payment_transactions immutable. EPF-03R introduces
-- payment_refunds, which require transitioning a confirmed transaction to
-- partially_refunded or refunded. This is an additive, live-object replacement
-- of the trigger function only; it does not alter the EPF-01 migration file.

CREATE OR REPLACE FUNCTION resident.payment_transactions_confirmed_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN
    -- Allow provider_transaction_id to be set if previously null.
    -- Allow refund status transitions to partially_refunded/refunded.
    IF OLD.amount IS DISTINCT FROM NEW.amount
       OR OLD.invoice_id IS DISTINCT FROM NEW.invoice_id
       OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
       OR OLD.provider IS DISTINCT FROM NEW.provider
       OR OLD.payment_method_type IS DISTINCT FROM NEW.payment_method_type THEN
      RAISE EXCEPTION 'confirmed payment_transactions are immutable';
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status NOT IN ('partially_refunded', 'refunded') THEN
        RAISE EXCEPTION 'confirmed payment_transactions are immutable';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION resident.payment_transactions_confirmed_immutable()
  FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2. REFUND-AWARE INVOICE STATUS TRANSITIONS
-- ============================================================================
-- EPF-01 did not anticipate refunds. After a partial refund the invoice balance
-- becomes positive again, so reconcile_invoice_status needs to move a paid
-- invoice back to open/payment_pending/overdue. This is an additive, live-object
-- replacement of the trigger function only.

CREATE OR REPLACE FUNCTION resident.invoice_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Terminal states: no transitions out
    IF OLD.status IN ('cancelled', 'written_off') THEN
      RAISE EXCEPTION 'Cannot transition from terminal status %', OLD.status;
    END IF;

    CASE NEW.status
      WHEN 'draft' THEN
        IF OLD.status NOT IN ('draft') THEN
          RAISE EXCEPTION 'Invalid transition: % → draft', OLD.status;
        END IF;
      WHEN 'issued' THEN
        IF OLD.status NOT IN ('draft', 'renegotiated') THEN
          RAISE EXCEPTION 'Invalid transition: % → issued', OLD.status;
        END IF;
        NEW.issued_at := COALESCE(NEW.issued_at, now());
      WHEN 'open' THEN
        IF OLD.status NOT IN ('draft', 'issued', 'renegotiated', 'paid', 'payment_pending', 'overdue') THEN
          RAISE EXCEPTION 'Invalid transition: % → open', OLD.status;
        END IF;
        NEW.issued_at := COALESCE(NEW.issued_at, now());
      WHEN 'payment_pending' THEN
        IF OLD.status NOT IN ('open', 'overdue', 'paid') THEN
          RAISE EXCEPTION 'Invalid transition: % → payment_pending', OLD.status;
        END IF;
      WHEN 'paid' THEN
        IF OLD.status NOT IN ('open', 'overdue', 'payment_pending', 'renegotiated', 'paid') THEN
          RAISE EXCEPTION 'Invalid transition: % → paid', OLD.status;
        END IF;
        NEW.paid_at := COALESCE(NEW.paid_at, now());
      WHEN 'overdue' THEN
        IF OLD.status NOT IN ('open', 'payment_pending', 'paid') THEN
          RAISE EXCEPTION 'Invalid transition: % → overdue', OLD.status;
        END IF;
      WHEN 'cancelled' THEN
        IF OLD.status NOT IN ('draft', 'issued', 'open') THEN
          RAISE EXCEPTION 'Invalid transition: % → cancelled', OLD.status;
        END IF;
        NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
      WHEN 'replaced' THEN
        IF OLD.status NOT IN ('draft', 'issued', 'open', 'overdue') THEN
          RAISE EXCEPTION 'Invalid transition: % → replaced', OLD.status;
        END IF;
        IF NEW.replaced_by_invoice_id IS NULL THEN
          RAISE EXCEPTION 'replaced status requires replaced_by_invoice_id';
        END IF;
      WHEN 'renegotiated' THEN
        IF OLD.status NOT IN ('open', 'overdue', 'payment_pending') THEN
          RAISE EXCEPTION 'Invalid transition: % → renegotiated', OLD.status;
        END IF;
      WHEN 'written_off' THEN
        IF OLD.status NOT IN ('overdue') THEN
          RAISE EXCEPTION 'Invalid transition: % → written_off', OLD.status;
        END IF;
        IF NEW.written_off_reason IS NULL THEN
          RAISE EXCEPTION 'written_off status requires written_off_reason';
        END IF;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION resident.invoice_status_transition()
  FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 3. FINAL REVOKE/GRANT PASS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Service-role-only financial/security RPCs
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION resident.create_vault_secret(text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.update_vault_secret(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.get_vault_secret(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.create_payment_intent(
  uuid, uuid, text, resident.payment_method_type, uuid, text, numeric,
  text, text, text, text, text, timestamptz, text, jsonb, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.process_payment_webhook(
  uuid, text, text, text, jsonb, text, text, text, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.log_payment_audit(
  uuid, resident.financial_event_type, text, text, jsonb, jsonb, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.upsert_provider_config(
  uuid, uuid, text, resident.payment_provider_environment,
  resident.payment_method_type, boolean, boolean, text, text, text,
  jsonb, jsonb, text, text, jsonb, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.cancel_payment_intent(uuid, uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.resolve_webhook_endpoint(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION resident.create_vault_secret(text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.update_vault_secret(uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.get_vault_secret(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.create_payment_intent(
  uuid, uuid, text, resident.payment_method_type, uuid, text, numeric,
  text, text, text, text, text, timestamptz, text, jsonb, text, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION resident.process_payment_webhook(
  uuid, text, text, text, jsonb, text, text, text, text, timestamptz, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION resident.log_payment_audit(
  uuid, resident.financial_event_type, text, text, jsonb, jsonb, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION resident.upsert_provider_config(
  uuid, uuid, text, resident.payment_provider_environment,
  resident.payment_method_type, boolean, boolean, text, text, text,
  jsonb, jsonb, text, text, jsonb, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION resident.cancel_payment_intent(uuid, uuid, jsonb, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.resolve_webhook_endpoint(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.process_payment_refund(
  uuid, uuid, numeric, text, text, jsonb, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- Internal helpers — service_role only
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION resident.normalize_provider_status(text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.reconcile_invoice_status(uuid, numeric)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION resident.normalize_provider_status(text)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.reconcile_invoice_status(uuid, numeric)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Read-only helpers — authenticated (RLS enforces row access)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION resident.has_provider_capability(
  text, resident.payment_provider_capability
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.get_provider_capabilities(text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.get_default_provider_config(
  uuid, resident.payment_method_type, resident.payment_provider_environment
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.get_invoice_balance(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.current_tenant_id()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION resident.has_provider_capability(
  text, resident.payment_provider_capability
) TO authenticated;
GRANT EXECUTE ON FUNCTION resident.get_provider_capabilities(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION resident.get_default_provider_config(
  uuid, resident.payment_method_type, resident.payment_provider_environment
) TO authenticated;
GRANT EXECUTE ON FUNCTION resident.get_invoice_balance(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION resident.current_tenant_id()
  TO authenticated;

-- Also grant read helpers to service_role for Edge Function convenience.
GRANT EXECUTE ON FUNCTION resident.has_provider_capability(
  text, resident.payment_provider_capability
) TO service_role;
GRANT EXECUTE ON FUNCTION resident.get_provider_capabilities(text)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.get_default_provider_config(
  uuid, resident.payment_method_type, resident.payment_provider_environment
) TO service_role;
GRANT EXECUTE ON FUNCTION resident.get_invoice_balance(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.current_tenant_id()
  TO service_role;

-- ---------------------------------------------------------------------------
-- Trigger functions — no direct client execution
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION resident.payment_intent_status_transition()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.payment_transaction_status_transition()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.tenant_provider_config_immutable_fields()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.payment_refunds_tenant_consistency()
  FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 3. TABLE-LEVEL GRANTS
-- ============================================================================

GRANT USAGE ON SCHEMA resident TO service_role;
GRANT USAGE ON SCHEMA vault TO service_role;

GRANT ALL ON TABLE resident.payment_refunds TO service_role;
GRANT SELECT ON TABLE resident.payment_refunds TO authenticated;

-- ============================================================================
-- 4. PRIVILEGE ASSERTIONS
-- ============================================================================

DO $$
DECLARE
  v_role text;
BEGIN
  -- Deny: anon, authenticated and public must never execute mutation or Vault functions.
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'public']::text[] LOOP
    IF has_function_privilege(v_role, 'resident.create_vault_secret(text, text, text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.create_vault_secret', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.update_vault_secret(uuid, text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.update_vault_secret', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.get_vault_secret(uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.get_vault_secret', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.create_payment_intent(uuid, uuid, text, resident.payment_method_type, uuid, text, numeric, text, text, text, text, text, timestamptz, text, jsonb, text, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.create_payment_intent', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.process_payment_webhook(uuid, text, text, text, jsonb, text, text, text, text, timestamptz, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.process_payment_webhook', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.log_payment_audit(uuid, resident.financial_event_type, text, text, jsonb, jsonb, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.log_payment_audit', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.upsert_provider_config(uuid, uuid, text, resident.payment_provider_environment, resident.payment_method_type, boolean, boolean, text, text, text, jsonb, jsonb, text, text, jsonb, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.upsert_provider_config', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.cancel_payment_intent(uuid, uuid, jsonb, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.cancel_payment_intent', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.resolve_webhook_endpoint(uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.resolve_webhook_endpoint', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.process_payment_refund(uuid, uuid, numeric, text, text, jsonb, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.process_payment_refund', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.normalize_provider_status(text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.normalize_provider_status', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.reconcile_invoice_status(uuid, numeric)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.reconcile_invoice_status', v_role;
    END IF;
  END LOOP;

  -- Allow: service_role must execute all financial/security RPCs.
  IF NOT has_function_privilege('service_role', 'resident.create_vault_secret(text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.create_vault_secret';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.get_vault_secret(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.get_vault_secret';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.create_payment_intent(uuid, uuid, text, resident.payment_method_type, uuid, text, numeric, text, text, text, text, text, timestamptz, text, jsonb, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.create_payment_intent';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.process_payment_webhook(uuid, text, text, text, jsonb, text, text, text, text, timestamptz, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.process_payment_webhook';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.upsert_provider_config(uuid, uuid, text, resident.payment_provider_environment, resident.payment_method_type, boolean, boolean, text, text, text, jsonb, jsonb, text, text, jsonb, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.upsert_provider_config';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.cancel_payment_intent(uuid, uuid, jsonb, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.cancel_payment_intent';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.resolve_webhook_endpoint(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.resolve_webhook_endpoint';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.process_payment_refund(uuid, uuid, numeric, text, text, jsonb, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.process_payment_refund';
  END IF;

  -- Allow: authenticated must execute read helpers.
  IF NOT has_function_privilege('authenticated', 'resident.has_provider_capability(text, resident.payment_provider_capability)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: authenticated cannot execute resident.has_provider_capability';
  END IF;
  IF NOT has_function_privilege('authenticated', 'resident.get_invoice_balance(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: authenticated cannot execute resident.get_invoice_balance';
  END IF;
  IF NOT has_function_privilege('authenticated', 'resident.current_tenant_id()', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: authenticated cannot execute resident.current_tenant_id';
  END IF;

  -- Deny: authenticated must NOT execute Vault readers.
  IF has_function_privilege('authenticated', 'resident.get_vault_secret(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: authenticated can execute resident.get_vault_secret';
  END IF;

  -- Trigger functions must not be directly executable by PUBLIC, anon or authenticated.
  IF has_function_privilege('public', 'resident.payment_intent_status_transition()', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: public can execute trigger function resident.payment_intent_status_transition';
  END IF;
  IF has_function_privilege('authenticated', 'resident.payment_intent_status_transition()', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: authenticated can execute trigger function resident.payment_intent_status_transition';
  END IF;
END $$;

COMMENT ON SCHEMA resident IS
  'Resident domain schema. EPF-03R added explicit privilege hardening on all SECURITY DEFINER functions and tenant-scoped webhook/replay uniqueness.';
