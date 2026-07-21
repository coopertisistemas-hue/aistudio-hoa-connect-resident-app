-- EPF-01 Financial Domain Foundation
-- Sprint 3 — Financial MVP for Associação de Moradores de Santa Terezinha
--
-- Implements the complete Financial Domain as a provider-agnostic foundation:
-- 12 tables, 5 enums, RLS, triggers, ledger-first architecture.
--
-- CONSUMPTION, STRIPE, PIX GENERATION, BANK SLIP GENERATION, CNAB FILES,
-- and PAYMENT PROCESSING are OUT OF SCOPE for this phase.
--
-- Considerations incorporated from Executive Approval:
--  C01 — Billing Account represents financial identity of residence
--  C02 — Invoice items are generic categories, water not hardcoded
--  C03 — Ledger is the financial source of truth
--  C04 — Providers never modify business entities directly
--  C06 — Invoice lifecycle: Draft→Issued→Open→PaymentPending→Paid→Overdue→Cancelled→Replaced→Renegotiated→WrittenOff
--  C07 — Payment Intent extended: expires_at, failure_reason, attempt_count, last_attempt_at, idempotency_key
--  C08 — Audit append-only, immutable
--  C09 — Notification hooks reserved (not implemented)
--  C10 — Dashboard consumes Ledger, not invoice aggregates
--  C14 — CNAB fields reserved: bank_reference, remittance_number, return_number, nosso_numero, convenio, wallet_code

-- ============================================================================
-- 1. New Enums
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE resident.invoice_status AS ENUM (
      'draft',
      'issued',
      'open',
      'payment_pending',
      'paid',
      'overdue',
      'cancelled',
      'replaced',
      'renegotiated',
      'written_off'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE resident.payment_status AS ENUM (
      'pending',
      'processing',
      'confirmed',
      'failed',
      'refunded',
      'partially_refunded',
      'under_review',
      'not_reconciled'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
    CREATE TYPE resident.payment_method_type AS ENUM (
      'pix',
      'boleto',
      'credit_card',
      'debit_card',
      'bank_transfer',
      'cash',
      'manual',
      'other'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_event_type') THEN
    CREATE TYPE resident.financial_event_type AS ENUM (
      'invoice_created',
      'invoice_issued',
      'invoice_sent',
      'invoice_cancelled',
      'invoice_replaced',
      'invoice_renegotiated',
      'invoice_written_off',
      'reminder_sent',
      'payment_started',
      'payment_processing',
      'payment_confirmed',
      'payment_failed',
      'payment_refunded',
      'payment_partially_refunded',
      'webhook_received',
      'adjustment_applied',
      'discount_applied',
      'interest_applied',
      'fine_applied',
      'credit_applied',
      'receipt_generated',
      'status_updated',
      'manual_settlement',
      'billing_cycle_opened',
      'billing_cycle_closed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adjustment_category') THEN
    CREATE TYPE resident.adjustment_category AS ENUM (
      'discount',
      'interest',
      'fine',
      'credit',
      'debit',
      'correction',
      'other'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_account_status') THEN
    CREATE TYPE resident.billing_account_status AS ENUM (
      'active',
      'inactive',
      'suspended',
      'closed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_cycle_status') THEN
    CREATE TYPE resident.billing_cycle_status AS ENUM (
      'draft',
      'open',
      'closed',
      'cancelled'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_item_category') THEN
    CREATE TYPE resident.invoice_item_category AS ENUM (
      'water',
      'association_fee',
      'maintenance',
      'reserve_fund',
      'penalty',
      'adjustment',
      'donation',
      'other_services'
    );
  END IF;
END $$;

--
-- ============================================================================
-- 2-13. Financial Domain Tables
-- ============================================================================

-- 2. Billing Accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES resident.properties(id) ON DELETE RESTRICT,
  status resident.billing_account_status NOT NULL DEFAULT 'active',
  external_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, property_id)
);

CREATE INDEX idx_billing_accounts_tenant_status ON resident.billing_accounts(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_billing_accounts_property ON resident.billing_accounts(property_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. Billing Cycles
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  billing_account_id uuid NOT NULL REFERENCES resident.billing_accounts(id) ON DELETE RESTRICT,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  due_date date NOT NULL,
  reference_period text NOT NULL,
  status resident.billing_cycle_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_profile_id uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_billing_cycle_dates CHECK (cycle_end >= cycle_start)
);

CREATE INDEX idx_billing_cycles_account_status ON resident.billing_cycles(billing_account_id, status);
CREATE INDEX idx_billing_cycles_due_date ON resident.billing_cycles(due_date) WHERE status = 'open';
CREATE INDEX idx_billing_cycles_tenant_period ON resident.billing_cycles(tenant_id, reference_period);

-- ============================================================================
-- 2. Invoices
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  billing_account_id uuid NOT NULL REFERENCES resident.billing_accounts(id) ON DELETE RESTRICT,
  billing_cycle_id uuid REFERENCES resident.billing_cycles(id) ON DELETE SET NULL,
  document_number text NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  issued_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  status resident.invoice_status NOT NULL DEFAULT 'draft',
  replaced_by_invoice_id uuid REFERENCES resident.invoices(id) ON DELETE SET NULL,
  renegotiation_reference text,
  written_off_reason text,
  -- CNAB reserved fields (Consideration 14)
  bank_reference text,
  remittance_number text,
  return_number text,
  nosso_numero text,
  convenio text,
  wallet_code text,
  -- Notification hooks reserved (Consideration 09)
  last_reminder_sent_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_profile_id uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  UNIQUE (tenant_id, document_number)
);

CREATE INDEX idx_invoices_account_status ON resident.invoices(billing_account_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due_date ON resident.invoices(due_date) WHERE status IN ('open', 'overdue', 'payment_pending') AND deleted_at IS NULL;
CREATE INDEX idx_invoices_tenant_status ON resident.invoices(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_cycle ON resident.invoices(billing_cycle_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_bank_reference ON resident.invoices(bank_reference) WHERE bank_reference IS NOT NULL;

-- ============================================================================
-- 2. Invoice Items
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES resident.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  category resident.invoice_item_category NOT NULL DEFAULT 'other_services',
  quantity numeric(15,4) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_invoice_items_invoice ON resident.invoice_items(invoice_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 2. Payment Intents
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES resident.invoices(id) ON DELETE RESTRICT,
  amount numeric(15,2) NOT NULL,
  status resident.payment_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL,
  provider_payment_intent_id text,
  provider_checkout_url text,
  -- PIX data
  provider_pix_code text,
  provider_pix_qr_base64 text,
  -- Boleto data
  provider_boleto_url text,
  provider_boleto_barcode text,
  provider_boleto_digitable_line text,
  -- Lifecycle (Consideration 07)
  expires_at timestamptz,
  failure_reason text,
  attempt_count integer NOT NULL DEFAULT 1,
  last_attempt_at timestamptz,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_profile_id uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  UNIQUE (provider, provider_payment_intent_id),
  UNIQUE (idempotency_key)
);

CREATE INDEX idx_payment_intents_invoice ON resident.payment_intents(invoice_id);
CREATE INDEX idx_payment_intents_status ON resident.payment_intents(status);
CREATE INDEX idx_payment_intents_expires ON resident.payment_intents(expires_at) WHERE status = 'pending';

-- ============================================================================
-- 2. Payment Methods
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  billing_account_id uuid NOT NULL REFERENCES resident.billing_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_payment_method_id text,
  method_type resident.payment_method_type NOT NULL DEFAULT 'other',
  display_name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_payment_methods_account ON resident.payment_methods(billing_account_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_payment_methods_default_per_account ON resident.payment_methods(billing_account_id) WHERE is_default = true AND is_active = true AND deleted_at IS NULL;

-- ============================================================================
-- 2. Payment Transactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES resident.invoices(id) ON DELETE RESTRICT,
  payment_intent_id uuid REFERENCES resident.payment_intents(id) ON DELETE SET NULL,
  amount numeric(15,2) NOT NULL,
  status resident.payment_status NOT NULL DEFAULT 'pending',
  provider text NOT NULL,
  provider_transaction_id text,
  payment_method_type resident.payment_method_type NOT NULL DEFAULT 'other',
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_profile_id uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  UNIQUE (provider, provider_transaction_id)
);

CREATE INDEX idx_payment_transactions_invoice ON resident.payment_transactions(invoice_id);
CREATE INDEX idx_payment_transactions_status ON resident.payment_transactions(status);
CREATE INDEX idx_payment_transactions_tenant ON resident.payment_transactions(tenant_id);

-- ============================================================================
-- 2. Payment Receipts
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  payment_transaction_id uuid NOT NULL REFERENCES resident.payment_transactions(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES resident.invoices(id) ON DELETE RESTRICT,
  receipt_number text NOT NULL UNIQUE,
  amount_paid numeric(15,2) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  pdf_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_receipts_transaction ON resident.payment_receipts(payment_transaction_id);
CREATE INDEX idx_payment_receipts_invoice ON resident.payment_receipts(invoice_id);

-- ============================================================================
-- 2. Payment Provider Events (Webhooks + Async Callbacks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.payment_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  event_type text NOT NULL,
  event_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_payment_provider_events_unique ON resident.payment_provider_events(provider, event_id);
CREATE INDEX idx_payment_provider_events_pending ON resident.payment_provider_events(created_at) WHERE processed_at IS NULL;

-- ============================================================================
-- 2. Ledger Entries (Financial Source of Truth — Consideration 03)
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  entry_date timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  debit_amount numeric(15,2) NOT NULL DEFAULT 0,
  credit_amount numeric(15,2) NOT NULL DEFAULT 0,
  balance numeric(15,2) NOT NULL DEFAULT 0,
  entity_type text,
  entity_id text,
  reference_document text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_entries_tenant_date ON resident.ledger_entries(tenant_id, entry_date);
CREATE INDEX idx_ledger_entries_entity ON resident.ledger_entries(entity_type, entity_id) WHERE entity_type IS NOT NULL;

-- ============================================================================
-- 2. Financial Adjustments
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.financial_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES resident.invoices(id) ON DELETE CASCADE,
  category resident.adjustment_category NOT NULL,
  description text NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  percentage numeric(5,2),
  applied_by_profile_id uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_adjustments_invoice ON resident.financial_adjustments(invoice_id);

-- ============================================================================
-- 2. Financial Audit Log (Append-Only — Consideration 08)
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  actor_profile_id uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  action resident.financial_event_type NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_audit_tenant_created ON resident.financial_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_financial_audit_entity ON resident.financial_audit_log(entity_type, entity_id);

-- ============================================================================

-- ============================================================================
-- 14. Helper Functions
-- ============================================================================


-- is_billing_account_owner: Checks if current profile owns the billing account
-- through active residence membership in the linked property.
CREATE OR REPLACE FUNCTION resident.is_billing_account_owner(target_billing_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM resident.billing_accounts AS ba
    JOIN resident.residence_members AS rm
      ON rm.property_id = ba.property_id
    WHERE ba.id = target_billing_account_id
      AND rm.profile_id = resident.current_profile_id()
      AND rm.status = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION resident.is_billing_account_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION resident.is_billing_account_owner(uuid) TO authenticated;

COMMENT ON FUNCTION resident.is_billing_account_owner(uuid) IS 'SECURITY DEFINER. Checks if the current profile has active residence membership in the property linked to the billing account.';

-- log_financial_audit: Writes an immutable financial audit entry.
-- Returns the audit event id.
CREATE OR REPLACE FUNCTION resident.log_financial_audit(
  p_tenant_id uuid,
  p_action resident.financial_event_type,
  p_entity_type text,
  p_entity_id text,
  p_changes jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
  v_audit_id uuid;
BEGIN
  v_profile_id := resident.current_profile_id();

  INSERT INTO resident.financial_audit_log (
    tenant_id,
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    changes,
    metadata
  ) VALUES (
    p_tenant_id,
    v_profile_id,
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_changes, '{}'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION resident.log_financial_audit(uuid, resident.financial_event_type, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION resident.log_financial_audit(uuid, resident.financial_event_type, text, text, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION resident.log_financial_audit(uuid, resident.financial_event_type, text, text, jsonb, jsonb) IS 'SECURITY DEFINER. Writes an immutable financial audit entry. All financial state changes must be audited through this function.';

-- 15. Triggers — touch_updated_at
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_billing_accounts_updated_at') THEN
    CREATE TRIGGER trg_billing_accounts_updated_at
      BEFORE UPDATE ON resident.billing_accounts
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_billing_cycles_updated_at') THEN
    CREATE TRIGGER trg_billing_cycles_updated_at
      BEFORE UPDATE ON resident.billing_cycles
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoices_updated_at') THEN
    CREATE TRIGGER trg_invoices_updated_at
      BEFORE UPDATE ON resident.invoices
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoice_items_updated_at') THEN
    CREATE TRIGGER trg_invoice_items_updated_at
      BEFORE UPDATE ON resident.invoice_items
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_intents_updated_at') THEN
    CREATE TRIGGER trg_payment_intents_updated_at
      BEFORE UPDATE ON resident.payment_intents
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_methods_updated_at') THEN
    CREATE TRIGGER trg_payment_methods_updated_at
      BEFORE UPDATE ON resident.payment_methods
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_transactions_updated_at') THEN
    CREATE TRIGGER trg_payment_transactions_updated_at
      BEFORE UPDATE ON resident.payment_transactions
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_financial_adjustments_updated_at') THEN
    CREATE TRIGGER trg_financial_adjustments_updated_at
      BEFORE UPDATE ON resident.financial_adjustments
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 16. Triggers — Immutable Fields Protection
-- ============================================================================

-- Billing accounts: tenant_id and property_id immutable
CREATE OR REPLACE FUNCTION resident.billing_accounts_protected_fields_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'billing_accounts.tenant_id is immutable';
    END IF;
    IF OLD.property_id IS DISTINCT FROM NEW.property_id THEN
      RAISE EXCEPTION 'billing_accounts.property_id is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_billing_accounts_protected_fields') THEN
    CREATE TRIGGER trg_billing_accounts_protected_fields
      BEFORE UPDATE ON resident.billing_accounts
      FOR EACH ROW EXECUTE FUNCTION resident.billing_accounts_protected_fields_immutable();
  END IF;
END $$;

-- Invoices: tenant_id, billing_account_id, document_number immutable
CREATE OR REPLACE FUNCTION resident.invoices_protected_fields_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'invoices.tenant_id is immutable';
    END IF;
    IF OLD.billing_account_id IS DISTINCT FROM NEW.billing_account_id THEN
      RAISE EXCEPTION 'invoices.billing_account_id is immutable';
    END IF;
    IF OLD.document_number IS DISTINCT FROM NEW.document_number THEN
      RAISE EXCEPTION 'invoices.document_number is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoices_protected_fields') THEN
    CREATE TRIGGER trg_invoices_protected_fields
      BEFORE UPDATE ON resident.invoices
      FOR EACH ROW EXECUTE FUNCTION resident.invoices_protected_fields_immutable();
  END IF;
END $$;

-- ============================================================================
-- 17. Triggers — Invoice Status Transition Machine (Consideration 06)
-- ============================================================================

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
        IF OLD.status NOT IN ('draft', 'issued', 'renegotiated') THEN
          RAISE EXCEPTION 'Invalid transition: % → open', OLD.status;
        END IF;
        NEW.issued_at := COALESCE(NEW.issued_at, now());
      WHEN 'payment_pending' THEN
        IF OLD.status NOT IN ('open', 'overdue') THEN
          RAISE EXCEPTION 'Invalid transition: % → payment_pending', OLD.status;
        END IF;
      WHEN 'paid' THEN
        IF OLD.status NOT IN ('open', 'overdue', 'payment_pending', 'renegotiated') THEN
          RAISE EXCEPTION 'Invalid transition: % → paid', OLD.status;
        END IF;
        NEW.paid_at := COALESCE(NEW.paid_at, now());
      WHEN 'overdue' THEN
        IF OLD.status NOT IN ('open', 'payment_pending') THEN
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoice_status_transition') THEN
    CREATE TRIGGER trg_invoice_status_transition
      BEFORE UPDATE ON resident.invoices
      FOR EACH ROW EXECUTE FUNCTION resident.invoice_status_transition();
  END IF;
END $$;

-- ============================================================================
-- 18. Triggers — Append-Only and Immutable Tables
-- ============================================================================

-- Payment transactions immutable after confirmed
CREATE OR REPLACE FUNCTION resident.payment_transactions_confirmed_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' THEN
    -- Allow only provider_transaction_id to be set if previously null
    IF OLD.amount IS DISTINCT FROM NEW.amount
       OR OLD.invoice_id IS DISTINCT FROM NEW.invoice_id
       OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
       OR OLD.provider IS DISTINCT FROM NEW.provider
       OR OLD.payment_method_type IS DISTINCT FROM NEW.payment_method_type
       OR OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'confirmed payment_transactions are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_transactions_confirmed_immutable') THEN
    CREATE TRIGGER trg_payment_transactions_confirmed_immutable
      BEFORE UPDATE ON resident.payment_transactions
      FOR EACH ROW EXECUTE FUNCTION resident.payment_transactions_confirmed_immutable();
  END IF;
END $$;

-- Payment receipts immutable
CREATE OR REPLACE FUNCTION resident.payment_receipts_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'payment_receipts are immutable — UPDATE and DELETE are prohibited';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_receipts_immutable_update') THEN
    CREATE TRIGGER trg_payment_receipts_immutable_update
      BEFORE UPDATE ON resident.payment_receipts
      FOR EACH ROW EXECUTE FUNCTION resident.payment_receipts_immutable();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_receipts_immutable_delete') THEN
    CREATE TRIGGER trg_payment_receipts_immutable_delete
      BEFORE DELETE ON resident.payment_receipts
      FOR EACH ROW EXECUTE FUNCTION resident.payment_receipts_immutable();
  END IF;
END $$;

-- Payment provider events immutable
CREATE OR REPLACE FUNCTION resident.payment_provider_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'payment_provider_events are immutable — UPDATE and DELETE are prohibited';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_provider_events_immutable_update') THEN
    CREATE TRIGGER trg_payment_provider_events_immutable_update
      BEFORE UPDATE ON resident.payment_provider_events
      FOR EACH ROW EXECUTE FUNCTION resident.payment_provider_events_immutable();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_provider_events_immutable_delete') THEN
    CREATE TRIGGER trg_payment_provider_events_immutable_delete
      BEFORE DELETE ON resident.payment_provider_events
      FOR EACH ROW EXECUTE FUNCTION resident.payment_provider_events_immutable();
  END IF;
END $$;

-- Ledger entries immutable
CREATE OR REPLACE FUNCTION resident.ledger_entries_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries are immutable — UPDATE and DELETE are prohibited';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_entries_immutable_update') THEN
    CREATE TRIGGER trg_ledger_entries_immutable_update
      BEFORE UPDATE ON resident.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION resident.ledger_entries_immutable();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ledger_entries_immutable_delete') THEN
    CREATE TRIGGER trg_ledger_entries_immutable_delete
      BEFORE DELETE ON resident.ledger_entries
      FOR EACH ROW EXECUTE FUNCTION resident.ledger_entries_immutable();
  END IF;
END $$;

-- Financial audit log immutable
CREATE OR REPLACE FUNCTION resident.financial_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'financial_audit_log is immutable — UPDATE and DELETE are prohibited';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_financial_audit_log_immutable_update') THEN
    CREATE TRIGGER trg_financial_audit_log_immutable_update
      BEFORE UPDATE ON resident.financial_audit_log
      FOR EACH ROW EXECUTE FUNCTION resident.financial_audit_log_immutable();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_financial_audit_log_immutable_delete') THEN
    CREATE TRIGGER trg_financial_audit_log_immutable_delete
      BEFORE DELETE ON resident.financial_audit_log
      FOR EACH ROW EXECUTE FUNCTION resident.financial_audit_log_immutable();
  END IF;
END $$;

-- ============================================================================
-- 19. RLS — Enable
-- ============================================================================

ALTER TABLE resident.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.billing_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.billing_cycles FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.invoice_items FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_intents FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_methods FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_provider_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_provider_events FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.ledger_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.financial_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.financial_adjustments FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.financial_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.financial_audit_log FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 20. RLS Policies — billing_accounts
-- ============================================================================

DROP POLICY IF EXISTS billing_accounts_select_owner_policy ON resident.billing_accounts;
CREATE POLICY billing_accounts_select_owner_policy ON resident.billing_accounts
  FOR SELECT
  USING (
    resident.is_billing_account_owner(id)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS billing_accounts_select_payers_policy ON resident.billing_accounts;
CREATE POLICY billing_accounts_select_payers_policy ON resident.billing_accounts
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS billing_accounts_select_platform_policy ON resident.billing_accounts;
CREATE POLICY billing_accounts_select_platform_policy ON resident.billing_accounts
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 21. RLS Policies — billing_cycles
-- ============================================================================

DROP POLICY IF EXISTS billing_cycles_select_owner_policy ON resident.billing_cycles;
CREATE POLICY billing_cycles_select_owner_policy ON resident.billing_cycles
  FOR SELECT
  USING (
    resident.is_billing_account_owner(billing_account_id)
  );

DROP POLICY IF EXISTS billing_cycles_select_payers_policy ON resident.billing_cycles;
CREATE POLICY billing_cycles_select_payers_policy ON resident.billing_cycles
  FOR SELECT
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS billing_cycles_select_platform_policy ON resident.billing_cycles;
CREATE POLICY billing_cycles_select_platform_policy ON resident.billing_cycles
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 22. RLS Policies — invoices
-- ============================================================================

DROP POLICY IF EXISTS invoices_select_owner_policy ON resident.invoices;
CREATE POLICY invoices_select_owner_policy ON resident.invoices
  FOR SELECT
  USING (
    resident.is_billing_account_owner(billing_account_id)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS invoices_select_payers_policy ON resident.invoices;
CREATE POLICY invoices_select_payers_policy ON resident.invoices
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS invoices_select_platform_policy ON resident.invoices;
CREATE POLICY invoices_select_platform_policy ON resident.invoices
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 23. RLS Policies — invoice_items
-- ============================================================================

DROP POLICY IF EXISTS invoice_items_select_owner_policy ON resident.invoice_items;
CREATE POLICY invoice_items_select_owner_policy ON resident.invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM resident.invoices AS inv
      WHERE inv.id = invoice_items.invoice_id
        AND resident.is_billing_account_owner(inv.billing_account_id)
    )
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS invoice_items_select_payers_policy ON resident.invoice_items;
CREATE POLICY invoice_items_select_payers_policy ON resident.invoice_items
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS invoice_items_select_platform_policy ON resident.invoice_items;
CREATE POLICY invoice_items_select_platform_policy ON resident.invoice_items
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 24. RLS Policies — payment_intents
-- ============================================================================

DROP POLICY IF EXISTS payment_intents_select_owner_policy ON resident.payment_intents;
CREATE POLICY payment_intents_select_owner_policy ON resident.payment_intents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM resident.invoices AS inv
      WHERE inv.id = payment_intents.invoice_id
        AND resident.is_billing_account_owner(inv.billing_account_id)
    )
  );

DROP POLICY IF EXISTS payment_intents_select_payers_policy ON resident.payment_intents;
CREATE POLICY payment_intents_select_payers_policy ON resident.payment_intents
  FOR SELECT
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS payment_intents_select_platform_policy ON resident.payment_intents;
CREATE POLICY payment_intents_select_platform_policy ON resident.payment_intents
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 25. RLS Policies — payment_methods
-- ============================================================================

DROP POLICY IF EXISTS payment_methods_select_owner_policy ON resident.payment_methods;
CREATE POLICY payment_methods_select_owner_policy ON resident.payment_methods
  FOR SELECT
  USING (
    resident.is_billing_account_owner(billing_account_id)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS payment_methods_select_platform_policy ON resident.payment_methods;
CREATE POLICY payment_methods_select_platform_policy ON resident.payment_methods
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 26. RLS Policies — payment_transactions
-- ============================================================================

DROP POLICY IF EXISTS payment_transactions_select_owner_policy ON resident.payment_transactions;
CREATE POLICY payment_transactions_select_owner_policy ON resident.payment_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM resident.invoices AS inv
      WHERE inv.id = payment_transactions.invoice_id
        AND resident.is_billing_account_owner(inv.billing_account_id)
    )
  );

DROP POLICY IF EXISTS payment_transactions_select_payers_policy ON resident.payment_transactions;
CREATE POLICY payment_transactions_select_payers_policy ON resident.payment_transactions
  FOR SELECT
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS payment_transactions_select_platform_policy ON resident.payment_transactions;
CREATE POLICY payment_transactions_select_platform_policy ON resident.payment_transactions
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 27. RLS Policies — payment_receipts
-- ============================================================================

DROP POLICY IF EXISTS payment_receipts_select_owner_policy ON resident.payment_receipts;
CREATE POLICY payment_receipts_select_owner_policy ON resident.payment_receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM resident.invoices AS inv
      WHERE inv.id = payment_receipts.invoice_id
        AND resident.is_billing_account_owner(inv.billing_account_id)
    )
  );

DROP POLICY IF EXISTS payment_receipts_select_payers_policy ON resident.payment_receipts;
CREATE POLICY payment_receipts_select_payers_policy ON resident.payment_receipts
  FOR SELECT
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS payment_receipts_select_platform_policy ON resident.payment_receipts;
CREATE POLICY payment_receipts_select_platform_policy ON resident.payment_receipts
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 28. RLS Policies — payment_provider_events
-- ============================================================================

DROP POLICY IF EXISTS payment_provider_events_select_payers_policy ON resident.payment_provider_events;
CREATE POLICY payment_provider_events_select_payers_policy ON resident.payment_provider_events
  FOR SELECT
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS payment_provider_events_select_platform_policy ON resident.payment_provider_events;
CREATE POLICY payment_provider_events_select_platform_policy ON resident.payment_provider_events
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 29. RLS Policies — ledger_entries
-- ============================================================================

DROP POLICY IF EXISTS ledger_entries_select_payers_policy ON resident.ledger_entries;
CREATE POLICY ledger_entries_select_payers_policy ON resident.ledger_entries
  FOR SELECT
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS ledger_entries_select_platform_policy ON resident.ledger_entries;
CREATE POLICY ledger_entries_select_platform_policy ON resident.ledger_entries
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 30. RLS Policies — financial_adjustments
-- ============================================================================

DROP POLICY IF EXISTS financial_adjustments_select_owner_policy ON resident.financial_adjustments;
CREATE POLICY financial_adjustments_select_owner_policy ON resident.financial_adjustments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM resident.invoices AS inv
      WHERE inv.id = financial_adjustments.invoice_id
        AND resident.is_billing_account_owner(inv.billing_account_id)
    )
  );

DROP POLICY IF EXISTS financial_adjustments_select_payers_policy ON resident.financial_adjustments;
CREATE POLICY financial_adjustments_select_payers_policy ON resident.financial_adjustments
  FOR SELECT
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS financial_adjustments_select_platform_policy ON resident.financial_adjustments;
CREATE POLICY financial_adjustments_select_platform_policy ON resident.financial_adjustments
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 31. RLS Policies — financial_audit_log
-- ============================================================================

DROP POLICY IF EXISTS financial_audit_log_select_admin_policy ON resident.financial_audit_log;
CREATE POLICY financial_audit_log_select_admin_policy ON resident.financial_audit_log
  FOR SELECT
  USING (
    resident.has_tenant_permission(tenant_id, 'audit:read_association'::resident.tenant_permission)
  );

DROP POLICY IF EXISTS financial_audit_log_select_platform_policy ON resident.financial_audit_log;
CREATE POLICY financial_audit_log_select_platform_policy ON resident.financial_audit_log
  FOR SELECT
  USING (resident.is_platform_admin());

-- ============================================================================
-- 32. Grants — EPF-01 financial tables only
-- ============================================================================
--
-- IMPORTANT: Do NOT use REVOKE ALL ON ALL TABLES IN SCHEMA resident here.
-- That statement would destroy the certified Sprint 1 and Sprint 2 grants.
--
-- Strategy: Revoke only from the 12 tables introduced by this migration,
-- then apply explicit SELECT grants. Sprint 1 and Sprint 2 grants are
-- preserved because they are applied by earlier migrations.

-- Revoke from EPF-01 financial tables only (never from certified baseline tables)
REVOKE ALL ON TABLE resident.billing_accounts FROM anon, authenticated;
REVOKE ALL ON TABLE resident.billing_cycles FROM anon, authenticated;
REVOKE ALL ON TABLE resident.invoices FROM anon, authenticated;
REVOKE ALL ON TABLE resident.invoice_items FROM anon, authenticated;
REVOKE ALL ON TABLE resident.payment_intents FROM anon, authenticated;
REVOKE ALL ON TABLE resident.payment_methods FROM anon, authenticated;
REVOKE ALL ON TABLE resident.payment_transactions FROM anon, authenticated;
REVOKE ALL ON TABLE resident.payment_receipts FROM anon, authenticated;
REVOKE ALL ON TABLE resident.payment_provider_events FROM anon, authenticated;
REVOKE ALL ON TABLE resident.ledger_entries FROM anon, authenticated;
REVOKE ALL ON TABLE resident.financial_adjustments FROM anon, authenticated;
REVOKE ALL ON TABLE resident.financial_audit_log FROM anon, authenticated;

-- Core financial tables: SELECT only (RLS policies enforce row-level access)
GRANT SELECT ON resident.billing_accounts TO authenticated;
GRANT SELECT ON resident.billing_cycles TO authenticated;
GRANT SELECT ON resident.invoices TO authenticated;
GRANT SELECT ON resident.invoice_items TO authenticated;
GRANT SELECT ON resident.payment_intents TO authenticated;
GRANT SELECT ON resident.payment_methods TO authenticated;
GRANT SELECT ON resident.payment_transactions TO authenticated;
GRANT SELECT ON resident.payment_receipts TO authenticated;
GRANT SELECT ON resident.payment_provider_events TO authenticated;
GRANT SELECT ON resident.ledger_entries TO authenticated;
GRANT SELECT ON resident.financial_adjustments TO authenticated;
GRANT SELECT ON resident.financial_audit_log TO authenticated;

-- Helper functions
GRANT EXECUTE ON FUNCTION resident.is_billing_account_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION resident.log_financial_audit(uuid, resident.financial_event_type, text, text, jsonb, jsonb) TO authenticated;

-- ============================================================================
-- 33. Comments
-- ============================================================================

COMMENT ON TABLE resident.billing_accounts IS 'Financial identity of a residence within a tenant. One active billing account per property. Links residence domain to financial domain.';
COMMENT ON TABLE resident.billing_cycles IS 'Billing periods that group invoices. Supports monthly, bimonthly, or custom cycles.';
COMMENT ON TABLE resident.invoices IS 'Core invoice entity. Supports complete lifecycle: Draft→Issued→Open→PaymentPending→Paid→Overdue→Cancelled→Replaced→Renegotiated→WrittenOff. Contains CNAB-reserved fields for future bank integration.';
COMMENT ON TABLE resident.invoice_items IS 'Line items on an invoice. Category is generic (water, association_fee, maintenance, reserve_fund, penalty, adjustment, donation, other_services). No category is hardcoded as mandatory.';
COMMENT ON TABLE resident.payment_intents IS 'Provider-agnostic payment intent abstraction. Supports PIX (code, QR base64) and Boleto (URL, barcode, digitable line). Extended with expiry, retry, and idempotency fields.';
COMMENT ON TABLE resident.payment_methods IS 'Saved payment methods per billing account. Provider-agnostic with display metadata.';
COMMENT ON TABLE resident.payment_transactions IS 'Actual payment events. Immutable after confirmed status. Linked to invoice and payment intent.';
COMMENT ON TABLE resident.payment_receipts IS 'Payment receipts. Immutable — no UPDATE or DELETE permitted.';
COMMENT ON TABLE resident.payment_provider_events IS 'Webhook and async callback log from payment providers. Idempotency enforced by unique (provider, event_id). Immutable.';
COMMENT ON TABLE resident.ledger_entries IS 'Financial source of truth. Double-entry ledger. Every financial event generates immutable ledger entries. Dashboards consume ledger, not invoice aggregates.';
COMMENT ON TABLE resident.financial_adjustments IS 'Discounts, interest, fines, credits, debits, corrections applied to invoices.';
COMMENT ON TABLE resident.financial_audit_log IS 'Append-only audit trail. Every financial state change is recorded as an immutable event. No UPDATE or DELETE permitted.';
