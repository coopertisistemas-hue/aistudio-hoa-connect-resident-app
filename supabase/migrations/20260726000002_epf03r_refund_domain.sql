-- EPF-03R Remediation — Migration 02
-- Refund Domain: dedicated refund entity, status enum, RLS and constraints
--
-- This migration is additive and does not modify any certified EPF-01, EPF-02 or
-- original EPF-03 migration file.
--
-- Changes:
--   • Creates a dedicated refund-status enum with refund-specific lifecycle values.
--   • Creates resident.payment_refunds with tenant-scoped integrity.
--   • Enforces positive amount, currency match and partial unique provider identity.
--   • Adds RLS policies and updated_at trigger.

-- ============================================================================
-- 1. REFUND STATUS ENUM
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_refund_status') THEN
    CREATE TYPE resident.payment_refund_status AS ENUM (
      'pending',
      'processing',
      'confirmed',
      'failed',
      'cancelled',
      'under_review'
    );
  END IF;
END $$;

COMMENT ON TYPE resident.payment_refund_status IS
  'Lifecycle of a refund operation. Distinct from resident.payment_status, which governs payment intents and transactions.';

-- ============================================================================
-- 2. REFUND RECORD TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  payment_transaction_id uuid NOT NULL REFERENCES resident.payment_transactions(id) ON DELETE RESTRICT,
  payment_intent_id uuid REFERENCES resident.payment_intents(id) ON DELETE SET NULL,
  invoice_id uuid NOT NULL REFERENCES resident.invoices(id) ON DELETE RESTRICT,
  provider_config_id uuid REFERENCES resident.tenant_payment_provider_configs(id) ON DELETE SET NULL,
  provider_refund_id text,
  idempotency_key text NOT NULL,
  amount numeric(15,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  status resident.payment_refund_status NOT NULL DEFAULT 'pending',
  reason text,
  raw_provider_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_profile_id uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Tenant-scoped idempotency.
  CONSTRAINT uq_payment_refunds_tenant_idempotency
    UNIQUE (tenant_id, idempotency_key),
  -- Refund amount must be positive.
  CONSTRAINT chk_payment_refunds_amount_positive
    CHECK (amount > 0),
  -- Currency must be a valid ISO-like code.
  CONSTRAINT chk_payment_refunds_currency
    CHECK (currency ~ '^[A-Z]{3}$')
);

-- Partial unique provider identity. PostgreSQL treats NULL as not equal, so a
-- partial index is required to enforce uniqueness only when the provider id is
-- present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_refunds_provider_refund_id
  ON resident.payment_refunds (tenant_id, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_refunds_tenant
  ON resident.payment_refunds (tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_transaction
  ON resident.payment_refunds (payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_invoice
  ON resident.payment_refunds (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_status
  ON resident.payment_refunds (status);

-- ============================================================================
-- 3. TENANT CONSISTENCY CHECKS
-- ============================================================================

-- Ensure the refund record belongs to the same tenant as its parent transaction.
CREATE OR REPLACE FUNCTION resident.payment_refunds_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tx_tenant uuid;
  v_invoice_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tx_tenant
  FROM resident.payment_transactions
  WHERE id = NEW.payment_transaction_id;

  IF v_tx_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Refund tenant_id does not match payment_transaction tenant_id';
  END IF;

  SELECT tenant_id INTO v_invoice_tenant
  FROM resident.invoices
  WHERE id = NEW.invoice_id;

  IF v_invoice_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Refund tenant_id does not match invoice tenant_id';
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_refunds_tenant_consistency') THEN
    CREATE TRIGGER trg_payment_refunds_tenant_consistency
      BEFORE INSERT OR UPDATE ON resident.payment_refunds
      FOR EACH ROW EXECUTE FUNCTION resident.payment_refunds_tenant_consistency();
  END IF;
END $$;

-- ============================================================================
-- 4. updated_at TRIGGER
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_refunds_updated_at') THEN
    CREATE TRIGGER trg_payment_refunds_updated_at
      BEFORE UPDATE ON resident.payment_refunds
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE resident.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_refunds FORCE ROW LEVEL SECURITY;

-- Owner can read refunds for invoices they own.
DROP POLICY IF EXISTS payment_refunds_select_owner_policy ON resident.payment_refunds;
CREATE POLICY payment_refunds_select_owner_policy ON resident.payment_refunds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resident.invoices AS inv
      WHERE inv.id = payment_refunds.invoice_id
        AND resident.is_billing_account_owner(inv.billing_account_id)
    )
  );

-- Association staff can read refunds for their tenant.
DROP POLICY IF EXISTS payment_refunds_select_staff_policy ON resident.payment_refunds;
CREATE POLICY payment_refunds_select_staff_policy ON resident.payment_refunds
  FOR SELECT TO authenticated
  USING (
    tenant_id = resident.current_tenant_id()
    AND (
      resident.has_tenant_permission(tenant_id, 'payments:read')
      OR resident.has_tenant_permission(tenant_id, 'audit:read_association')
    )
  );

-- Platform admin can read all refunds.
DROP POLICY IF EXISTS payment_refunds_select_platform_policy ON resident.payment_refunds;
CREATE POLICY payment_refunds_select_platform_policy ON resident.payment_refunds
  FOR SELECT TO authenticated
  USING (resident.is_platform_admin());

-- ============================================================================
-- 6. TABLE AND TRIGGER PRIVILEGES
-- ============================================================================

REVOKE ALL ON TABLE resident.payment_refunds FROM anon, authenticated;
GRANT SELECT ON resident.payment_refunds TO authenticated;
GRANT ALL ON TABLE resident.payment_refunds TO service_role;

-- Trigger functions do not receive direct client execution grants.
REVOKE EXECUTE ON FUNCTION resident.payment_refunds_tenant_consistency()
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE resident.payment_refunds IS
  'Dedicated refund operation entity. Tracks partial and full refunds, idempotency, provider identity and recovery state.';
