-- EPF-03 Payment Processing Platform
-- Sprint 3 — Payment Provider Abstraction and Orchestration
--
-- Implements on top of the certified EPF-01 Financial Foundation and EPF-02 Water Billing Domain:
--   • Provider registry and capability model
--   • Tenant-scoped provider configuration with Vault-backed credentials
--   • Payment orchestration functions (status transitions, partial payments)
--   • Atomic webhook processing (signature validation, idempotency, replay protection)
--   • PIX and Boleto abstractions (via mock provider for certification)
--   • Credit Card and Debit Card remain provider-ready only
--   • CNAB remains a declared capability only
--
-- Security posture:
--   • All writes through service-role Edge Functions
--   • Credentials and webhook secrets stored in Supabase Vault, never in application tables
--   • RLS SELECT-only for authenticated users
--   • Payment state transitions validated by triggers
--   • Ledger entries immutable, financial audit immutable
--
-- This migration is additive and does not modify any certified EPF-01 or EPF-02 migration.

-- ============================================================================
-- 0. PERMISSIONS
-- ============================================================================

-- Extend has_tenant_permission to grant payment permissions to association staff.
CREATE OR REPLACE FUNCTION resident.has_tenant_permission(target_tenant_id uuid, target_permission resident.tenant_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM resident.tenant_members AS tm
    WHERE tm.tenant_id = target_tenant_id
      AND tm.profile_id = resident.current_profile_id()
      AND tm.status = 'active'
      AND (
        (target_permission = 'tenant_members:read' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_finance', 'association_viewer')) OR
        (target_permission = 'tenant_members:write' AND tm.role = 'association_admin') OR
        (target_permission = 'residences:read' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_finance', 'association_viewer')) OR
        (target_permission = 'residences:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'profiles:read_association' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_finance', 'association_viewer')) OR
        (target_permission = 'profiles:update_association' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'profile_contacts:read_association' AND tm.role IN ('association_admin', 'association_operator', 'association_support')) OR
        (target_permission = 'profile_contacts:verify' AND tm.role IN ('association_admin', 'association_operator', 'association_support')) OR
        (target_permission = 'tenant_context:admin' AND tm.role = 'association_admin') OR
        (target_permission = 'residents:read' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_finance', 'association_viewer')) OR
        (target_permission = 'residents:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'residence_payers:read' AND tm.role IN ('association_admin', 'association_operator', 'association_finance', 'association_viewer')) OR
        (target_permission = 'residence_payers:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'household:read' AND tm.role IN ('association_admin', 'association_operator', 'association_support', 'association_viewer')) OR
        (target_permission = 'household:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'invitations:read' AND tm.role IN ('association_admin', 'association_operator', 'association_viewer')) OR
        (target_permission = 'invitations:write' AND tm.role IN ('association_admin', 'association_operator')) OR
        (target_permission = 'association_details:read' AND tm.role IN ('association_admin', 'association_operator', 'association_finance', 'association_support', 'association_viewer', 'association_collector')) OR
        (target_permission = 'association_details:write' AND tm.role = 'association_admin') OR
        (target_permission = 'audit:read_association' AND tm.role IN ('association_admin', 'association_finance')) OR
        (target_permission = 'residences:read_routes' AND tm.role IN ('association_admin', 'association_operator', 'association_collector')) OR
        (target_permission = 'payments:read' AND tm.role IN ('association_admin', 'association_operator', 'association_finance', 'association_collector', 'association_viewer')) OR
        (target_permission = 'payments:write' AND tm.role IN ('association_admin', 'association_operator', 'association_finance', 'association_collector'))
      )
  );
$$;

-- ============================================================================
-- 1. PROVIDER REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.payment_providers (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_providers_active ON resident.payment_providers(is_active);

CREATE TABLE IF NOT EXISTS resident.payment_provider_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL REFERENCES resident.payment_providers(id) ON DELETE CASCADE,
  capability resident.payment_provider_capability NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_payment_provider_capabilities_provider ON resident.payment_provider_capabilities(provider_id);
CREATE INDEX IF NOT EXISTS idx_payment_provider_capabilities_active ON resident.payment_provider_capabilities(is_active);

-- ============================================================================
-- 3. TENANT-SCOPED PROVIDER CONFIGURATION
-- ============================================================================

-- Stores non-sensitive configuration and Vault secret identifiers only.
-- Credentials and webhook secrets live in vault.secrets and are referenced
-- by secret_id columns.
CREATE TABLE IF NOT EXISTS resident.tenant_payment_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  provider_id text NOT NULL REFERENCES resident.payment_providers(id) ON DELETE RESTRICT,
  environment resident.payment_provider_environment NOT NULL DEFAULT 'sandbox',
  method_type resident.payment_method_type NOT NULL DEFAULT 'other',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  -- Non-sensitive configuration
  agreement_number text,
  wallet text,
  portfolio text,
  bank_account jsonb,
  pix_keys jsonb,
  -- Vault secret references (never store plaintext credentials)
  credentials_secret_id uuid,
  webhook_secret_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_profile_id uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_tenant_provider_config_method CHECK (
    method_type IN ('pix', 'boleto', 'credit_card', 'debit_card', 'bank_transfer')
  )
);

CREATE INDEX idx_tenant_provider_configs_tenant ON resident.tenant_payment_provider_configs(tenant_id);
CREATE INDEX idx_tenant_provider_configs_provider ON resident.tenant_payment_provider_configs(provider_id);
CREATE INDEX idx_tenant_provider_configs_active ON resident.tenant_payment_provider_configs(is_active);

-- One active default configuration per tenant / payment method / environment.
CREATE UNIQUE INDEX idx_tenant_provider_config_default_per_method_env
  ON resident.tenant_payment_provider_configs (tenant_id, method_type, environment)
  WHERE is_active = true AND is_default = true;

-- ============================================================================
-- 4. WEBHOOK REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.payment_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  provider_config_id uuid NOT NULL REFERENCES resident.tenant_payment_provider_configs(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  secret_id uuid, -- Vault secret reference
  event_types text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_webhooks_tenant ON resident.payment_webhooks(tenant_id);
CREATE INDEX idx_payment_webhooks_config ON resident.payment_webhooks(provider_config_id);

-- ============================================================================
-- 5. WEBHOOK SIGNATURE / REPLAY PROTECTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS resident.payment_provider_event_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  event_id text NOT NULL,
  signature_header text,
  payload_hash text,
  replay_nonce text,
  replay_timestamp timestamptz,
  signature_status resident.webhook_signature_status NOT NULL DEFAULT 'not_applicable',
  replay_status resident.webhook_replay_status NOT NULL DEFAULT 'not_applicable',
  validated_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_payment_provider_event_signatures_unique
  ON resident.payment_provider_event_signatures (provider, replay_nonce)
  WHERE replay_nonce IS NOT NULL;

CREATE INDEX idx_payment_provider_event_signatures_event
  ON resident.payment_provider_event_signatures (provider, event_id);

-- ============================================================================
-- 6. EXTEND CERTIFIED EPF-01 PAYMENT TABLES
-- ============================================================================

ALTER TABLE resident.payment_intents
  ADD COLUMN IF NOT EXISTS provider_config_id uuid REFERENCES resident.tenant_payment_provider_configs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS method_type resident.payment_method_type DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS reconciliation_id text,
  ADD COLUMN IF NOT EXISTS raw_provider_response jsonb;

ALTER TABLE resident.payment_transactions
  ADD COLUMN IF NOT EXISTS provider_config_id uuid REFERENCES resident.tenant_payment_provider_configs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settlement_date timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_id text,
  ADD COLUMN IF NOT EXISTS raw_provider_response jsonb;

CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_config ON resident.payment_intents(provider_config_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_reconciliation ON resident.payment_intents(reconciliation_id) WHERE reconciliation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_config ON resident.payment_transactions(provider_config_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reconciliation ON resident.payment_transactions(reconciliation_id) WHERE reconciliation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_settlement ON resident.payment_transactions(settlement_date) WHERE settlement_date IS NOT NULL;

-- ============================================================================
-- 7. SEED PROVIDER REGISTRY AND CAPABILITIES
-- ============================================================================

-- Provider-ready stubs (no real API integration in EPF-03)
INSERT INTO resident.payment_providers (id, display_name, is_active, metadata) VALUES
  ('mock', 'Mock Provider (Certification)', true, '{"description": "Production-quality mock provider for certification and local testing"}'),
  ('stripe', 'Stripe', true, '{"description": "Provider-ready only in EPF-03"}'),
  ('asaas', 'Asaas', true, '{"description": "Provider-ready only in EPF-03"}'),
  ('efi', 'Efí', true, '{"description": "Provider-ready only in EPF-03"}'),
  ('sicoob', 'Sicoob', true, '{"description": "Provider-ready only in EPF-03"}'),
  ('sicredi', 'Sicredi', true, '{"description": "Provider-ready only in EPF-03"}'),
  ('bb', 'Banco do Brasil', true, '{"description": "Provider-ready only in EPF-03"}'),
  ('caixa', 'Caixa Econômica Federal', true, '{"description": "Provider-ready only in EPF-03"}'),
  ('cnab', 'CNAB File Integration', true, '{"description": "CNAB capability declared only; no layouts implemented"}')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Mock provider capabilities (full certification support)
INSERT INTO resident.payment_provider_capabilities (provider_id, capability, is_active) VALUES
  ('mock', 'pix_generation', true),
  ('mock', 'dynamic_qrcode', true),
  ('mock', 'static_qrcode', false),
  ('mock', 'boleto_generation', true),
  ('mock', 'webhooks', true),
  ('mock', 'refund', true),
  ('mock', 'cancellation', true),
  ('mock', 'payment_status_lookup', true),
  ('mock', 'settlement_lookup', true),
  ('mock', 'cnab_support', false)
ON CONFLICT (provider_id, capability) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();

-- Stripe capabilities (provider-ready)
INSERT INTO resident.payment_provider_capabilities (provider_id, capability, is_active) VALUES
  ('stripe', 'pix_generation', false),
  ('stripe', 'webhooks', true),
  ('stripe', 'refund', true),
  ('stripe', 'cancellation', true),
  ('stripe', 'payment_status_lookup', true)
ON CONFLICT (provider_id, capability) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();

-- Asaas capabilities (provider-ready)
INSERT INTO resident.payment_provider_capabilities (provider_id, capability, is_active) VALUES
  ('asaas', 'pix_generation', true),
  ('asaas', 'boleto_generation', true),
  ('asaas', 'webhooks', true),
  ('asaas', 'refund', true),
  ('asaas', 'cancellation', true),
  ('asaas', 'payment_status_lookup', true)
ON CONFLICT (provider_id, capability) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();

-- Efí capabilities (provider-ready)
INSERT INTO resident.payment_provider_capabilities (provider_id, capability, is_active) VALUES
  ('efi', 'pix_generation', true),
  ('efi', 'dynamic_qrcode', true),
  ('efi', 'static_qrcode', true),
  ('efi', 'boleto_generation', true),
  ('efi', 'webhooks', true),
  ('efi', 'refund', true),
  ('efi', 'cancellation', true),
  ('efi', 'payment_status_lookup', true),
  ('efi', 'settlement_lookup', true)
ON CONFLICT (provider_id, capability) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();

-- Sicoob capabilities (provider-ready)
INSERT INTO resident.payment_provider_capabilities (provider_id, capability, is_active) VALUES
  ('sicoob', 'pix_generation', true),
  ('sicoob', 'dynamic_qrcode', true),
  ('sicoob', 'boleto_generation', true),
  ('sicoob', 'webhooks', true),
  ('sicoob', 'refund', true),
  ('sicoob', 'cancellation', true),
  ('sicoob', 'payment_status_lookup', true),
  ('sicoob', 'settlement_lookup', true),
  ('sicoob', 'cnab_support', true)
ON CONFLICT (provider_id, capability) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();

-- Sicredi capabilities (provider-ready)
INSERT INTO resident.payment_provider_capabilities (provider_id, capability, is_active) VALUES
  ('sicredi', 'pix_generation', true),
  ('sicredi', 'dynamic_qrcode', true),
  ('sicredi', 'boleto_generation', true),
  ('sicredi', 'webhooks', true),
  ('sicredi', 'refund', true),
  ('sicredi', 'cancellation', true),
  ('sicredi', 'payment_status_lookup', true),
  ('sicredi', 'settlement_lookup', true),
  ('sicredi', 'cnab_support', true)
ON CONFLICT (provider_id, capability) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();

-- Banco do Brasil capabilities (provider-ready)
INSERT INTO resident.payment_provider_capabilities (provider_id, capability, is_active) VALUES
  ('bb', 'pix_generation', true),
  ('bb', 'dynamic_qrcode', true),
  ('bb', 'boleto_generation', true),
  ('bb', 'webhooks', true),
  ('bb', 'refund', true),
  ('bb', 'cancellation', true),
  ('bb', 'payment_status_lookup', true),
  ('bb', 'settlement_lookup', true),
  ('bb', 'cnab_support', true)
ON CONFLICT (provider_id, capability) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();

-- Caixa capabilities (provider-ready)
INSERT INTO resident.payment_provider_capabilities (provider_id, capability, is_active) VALUES
  ('caixa', 'pix_generation', true),
  ('caixa', 'dynamic_qrcode', true),
  ('caixa', 'boleto_generation', true),
  ('caixa', 'webhooks', true),
  ('caixa', 'refund', true),
  ('caixa', 'cancellation', true),
  ('caixa', 'payment_status_lookup', true),
  ('caixa', 'settlement_lookup', true),
  ('caixa', 'cnab_support', true)
ON CONFLICT (provider_id, capability) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();

-- CNAB capability declared only
INSERT INTO resident.payment_provider_capabilities (provider_id, capability, is_active) VALUES
  ('cnab', 'cnab_support', true),
  ('cnab', 'boleto_generation', true),
  ('cnab', 'settlement_lookup', true)
ON CONFLICT (provider_id, capability) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now();

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- has_provider_capability: runtime capability discovery
CREATE OR REPLACE FUNCTION resident.has_provider_capability(
  p_provider_id text,
  p_capability resident.payment_provider_capability
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM resident.payment_provider_capabilities
    WHERE provider_id = p_provider_id
      AND capability = p_capability
      AND is_active = true
  );
$$;

-- get_provider_capabilities: returns all capabilities for a provider
CREATE OR REPLACE FUNCTION resident.get_provider_capabilities(p_provider_id text)
RETURNS TABLE (capability resident.payment_provider_capability)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT capability
  FROM resident.payment_provider_capabilities
  WHERE provider_id = p_provider_id
    AND is_active = true;
$$;

-- get_default_provider_config: returns the active default provider config for a tenant/method/environment
CREATE OR REPLACE FUNCTION resident.get_default_provider_config(
  p_tenant_id uuid,
  p_method_type resident.payment_method_type,
  p_environment resident.payment_provider_environment DEFAULT 'sandbox'
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id
  FROM resident.tenant_payment_provider_configs
  WHERE tenant_id = p_tenant_id
    AND method_type = p_method_type
    AND environment = p_environment
    AND is_active = true
    AND is_default = true
  LIMIT 1;
$$;

-- get_invoice_balance: calculates remaining balance from confirmed payment transactions
-- and adjustments. Returns amount still owed (0 or negative = overpaid).
CREATE OR REPLACE FUNCTION resident.get_invoice_balance(p_invoice_id uuid)
RETURNS numeric(15,2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    i.amount
    - COALESCE((
        SELECT SUM(amount)
        FROM resident.payment_transactions
        WHERE invoice_id = p_invoice_id
          AND status IN ('confirmed', 'partially_confirmed')
      ), 0)
    - COALESCE((
        SELECT SUM(amount)
        FROM resident.financial_adjustments
        WHERE invoice_id = p_invoice_id
          AND category IN ('credit', 'discount')
      ), 0)
    + COALESCE((
        SELECT SUM(amount)
        FROM resident.financial_adjustments
        WHERE invoice_id = p_invoice_id
          AND category IN ('interest', 'fine', 'debit')
      ), 0),
    0
  )
  FROM resident.invoices i
  WHERE i.id = p_invoice_id;
$$;

-- log_payment_audit: convenience wrapper around log_financial_audit for payment events
CREATE OR REPLACE FUNCTION resident.log_payment_audit(
  p_tenant_id uuid,
  p_action resident.financial_event_type,
  p_entity_type text,
  p_entity_id text,
  p_changes jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
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
    COALESCE(p_actor_profile_id, resident.current_profile_id()),
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

-- ============================================================================
-- 9. VAULT ACCESS WRAPPERS (for Edge Functions)
-- ============================================================================

-- create_vault_secret: stores a secret in Supabase Vault and returns the id.
CREATE OR REPLACE FUNCTION resident.create_vault_secret(
  p_secret text,
  p_name text,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN vault.create_secret(p_secret, p_name, p_description);
END;
$$;

-- update_vault_secret: replaces an existing Vault secret value.
CREATE OR REPLACE FUNCTION resident.update_vault_secret(
  p_secret_id uuid,
  p_secret text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM vault.update_secret(p_secret_id, p_secret);
END;
$$;

-- get_vault_secret: returns decrypted secret value by id.
CREATE OR REPLACE FUNCTION resident.get_vault_secret(p_secret_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id
  LIMIT 1;
$$;

-- ============================================================================
-- 10. PAYMENT STATUS TRANSITION TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION resident.payment_intent_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Terminal states
    IF OLD.status IN ('refunded', 'partially_refunded', 'cancelled') THEN
      RAISE EXCEPTION 'Cannot transition payment_intent from terminal status %', OLD.status;
    END IF;

    CASE NEW.status
      WHEN 'pending' THEN
        IF OLD.status NOT IN ('failed', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → pending', OLD.status;
        END IF;
      WHEN 'processing' THEN
        IF OLD.status NOT IN ('pending', 'under_review', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → processing', OLD.status;
        END IF;
      WHEN 'confirmed' THEN
        IF OLD.status NOT IN ('processing', 'under_review', 'not_reconciled', 'partially_confirmed') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → confirmed', OLD.status;
        END IF;
      WHEN 'partially_confirmed' THEN
        IF OLD.status NOT IN ('processing', 'under_review') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → partially_confirmed', OLD.status;
        END IF;
      WHEN 'failed' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'under_review', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → failed', OLD.status;
        END IF;
      WHEN 'refunded' THEN
        IF OLD.status NOT IN ('confirmed', 'partially_confirmed', 'partially_refunded') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → refunded', OLD.status;
        END IF;
      WHEN 'partially_refunded' THEN
        IF OLD.status NOT IN ('confirmed', 'partially_confirmed', 'refunded') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → partially_refunded', OLD.status;
        END IF;
      WHEN 'under_review' THEN
        IF OLD.status NOT IN ('processing', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → under_review', OLD.status;
        END IF;
      WHEN 'not_reconciled' THEN
        IF OLD.status NOT IN ('processing', 'under_review') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → not_reconciled', OLD.status;
        END IF;
      WHEN 'cancelled' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'under_review', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → cancelled', OLD.status;
        END IF;
      ELSE
        RAISE EXCEPTION 'Unknown payment_intent status: %', NEW.status;
    END CASE;

    NEW.last_attempt_at := COALESCE(NEW.last_attempt_at, now());
    NEW.attempt_count := COALESCE(NEW.attempt_count, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_intent_status_transition') THEN
    CREATE TRIGGER trg_payment_intent_status_transition
      BEFORE UPDATE ON resident.payment_intents
      FOR EACH ROW EXECUTE FUNCTION resident.payment_intent_status_transition();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION resident.payment_transaction_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Terminal states
    IF OLD.status IN ('refunded', 'partially_refunded', 'cancelled') THEN
      RAISE EXCEPTION 'Cannot transition payment_transaction from terminal status %', OLD.status;
    END IF;

    CASE NEW.status
      WHEN 'pending' THEN
        IF OLD.status NOT IN ('failed', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → pending', OLD.status;
        END IF;
      WHEN 'processing' THEN
        IF OLD.status NOT IN ('pending', 'under_review', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → processing', OLD.status;
        END IF;
      WHEN 'confirmed' THEN
        IF OLD.status NOT IN ('processing', 'under_review', 'not_reconciled', 'partially_confirmed') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → confirmed', OLD.status;
        END IF;
        NEW.paid_at := COALESCE(NEW.paid_at, now());
      WHEN 'partially_confirmed' THEN
        IF OLD.status NOT IN ('processing', 'under_review') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → partially_confirmed', OLD.status;
        END IF;
        NEW.paid_at := COALESCE(NEW.paid_at, now());
      WHEN 'failed' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'under_review', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → failed', OLD.status;
        END IF;
      WHEN 'refunded' THEN
        IF OLD.status NOT IN ('confirmed', 'partially_confirmed', 'partially_refunded') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → refunded', OLD.status;
        END IF;
      WHEN 'partially_refunded' THEN
        IF OLD.status NOT IN ('confirmed', 'partially_confirmed', 'refunded') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → partially_refunded', OLD.status;
        END IF;
      WHEN 'under_review' THEN
        IF OLD.status NOT IN ('processing', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → under_review', OLD.status;
        END IF;
      WHEN 'not_reconciled' THEN
        IF OLD.status NOT IN ('processing', 'under_review') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → not_reconciled', OLD.status;
        END IF;
      WHEN 'cancelled' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'under_review', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → cancelled', OLD.status;
        END IF;
      ELSE
        RAISE EXCEPTION 'Unknown payment_transaction status: %', NEW.status;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_transaction_status_transition') THEN
    CREATE TRIGGER trg_payment_transaction_status_transition
      BEFORE UPDATE ON resident.payment_transactions
      FOR EACH ROW EXECUTE FUNCTION resident.payment_transaction_status_transition();
  END IF;
END $$;

-- ============================================================================
-- 10. ATOMIC WEBHOOK PROCESSING
-- ============================================================================

-- process_payment_webhook: atomic webhook ingestion.
--
-- Validates signature and replay nonce, records the event, updates the payment
-- transaction, reconciles the invoice, writes ledger entries and audit log —
-- all inside a single transaction boundary.
--
-- Returns a JSON result describing the outcome.
CREATE OR REPLACE FUNCTION resident.process_payment_webhook(
  p_tenant_id uuid,
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_signature_header text DEFAULT NULL,
  p_replay_nonce text DEFAULT NULL,
  p_replay_timestamp timestamptz DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event_exists boolean;
  v_signature_status resident.webhook_signature_status := 'not_applicable';
  v_replay_status resident.webhook_replay_status := 'not_applicable';
  v_webhook_secret text;
  v_payload_hash text;
  v_expected_signature text;
  v_signature_record_id uuid;
  v_event_record_id uuid;
  v_result jsonb;
  v_invoice_id uuid;
  v_payment_intent_id uuid;
  v_transaction_id uuid;
  v_transaction_amount numeric(15,2);
  v_transaction_status resident.payment_status;
  v_balance numeric(15,2);
  v_previous_balance numeric(15,2);
  v_new_balance numeric(15,2);
  v_ledger_id uuid;
  v_audit_id uuid;
  v_reconciliation_id text;
BEGIN
  -- ==========================================================================
  -- IDEMPOTENCY: advisory lock on event_id
  -- ==========================================================================
  PERFORM pg_advisory_xact_lock(
    hashtext('resident.process_payment_webhook'),
    hashtext(p_provider || ':' || p_event_id)
  );

  -- ==========================================================================
  -- DUPLICATE EVENT DETECTION
  -- ==========================================================================
  SELECT EXISTS (
    SELECT 1 FROM resident.payment_provider_events
    WHERE tenant_id = p_tenant_id
      AND provider = p_provider
      AND event_id = p_event_id
  ) INTO v_event_exists;

  IF v_event_exists THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'provider', p_provider,
      'event_id', p_event_id,
      'message', 'Event already processed'
    );
  END IF;

  -- ==========================================================================
  -- SIGNATURE VALIDATION
  -- ==========================================================================
  IF p_signature_header IS NOT NULL AND p_signature_header <> '' THEN
    SELECT ds.decrypted_secret INTO v_webhook_secret
    FROM resident.payment_webhooks pw
    JOIN vault.decrypted_secrets ds ON ds.id = pw.secret_id
    WHERE pw.tenant_id = p_tenant_id
      AND pw.is_active = true
      AND pw.provider_config_id IN (
        SELECT id FROM resident.tenant_payment_provider_configs
        WHERE tenant_id = p_tenant_id AND provider_id = p_provider AND is_active = true
      )
    LIMIT 1;

    IF v_webhook_secret IS NOT NULL THEN
      v_payload_hash := encode(digest(p_payload::text, 'sha256'), 'hex');
      v_expected_signature := encode(
        hmac(v_payload_hash::bytea, v_webhook_secret::bytea, 'sha256'),
        'hex'
      );

      IF v_expected_signature = lower(p_signature_header) THEN
        v_signature_status := 'valid';
      ELSE
        v_signature_status := 'invalid';
      END IF;
    ELSE
      v_signature_status := 'missing';
    END IF;
  END IF;

  -- ==========================================================================
  -- REPLAY PROTECTION
  -- ==========================================================================
  IF p_replay_nonce IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM resident.payment_provider_event_signatures
      WHERE provider = p_provider
        AND replay_nonce = p_replay_nonce
    ) INTO v_event_exists;

    IF v_event_exists THEN
      RETURN jsonb_build_object(
        'status', 'replay_rejected',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Replay nonce already used'
      );
    ELSIF p_replay_timestamp IS NOT NULL
          AND p_replay_timestamp < (now() - interval '5 minutes') THEN
      RETURN jsonb_build_object(
        'status', 'replay_rejected',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Replay timestamp expired'
      );
    ELSE
      v_replay_status := 'accepted';
    END IF;
  END IF;

  -- ==========================================================================
  -- RECORD EVENT AND SIGNATURE
  -- ==========================================================================
  INSERT INTO resident.payment_provider_events (
    tenant_id, provider, event_type, event_id, payload,
    processed_at, metadata
  ) VALUES (
    p_tenant_id, p_provider, p_event_type, p_event_id, p_payload,
    now(),
    jsonb_build_object(
      'signature_status', v_signature_status,
      'replay_status', v_replay_status,
      'source', 'process_payment_webhook'
    )
  )
  RETURNING id INTO v_event_record_id;

  INSERT INTO resident.payment_provider_event_signatures (
    tenant_id, provider, event_id, signature_header, payload_hash,
    replay_nonce, replay_timestamp, signature_status, replay_status,
    validated_at
  ) VALUES (
    p_tenant_id, p_provider, p_event_id, p_signature_header,
    v_payload_hash, p_replay_nonce, p_replay_timestamp,
    v_signature_status, v_replay_status, now()
  )
  RETURNING id INTO v_signature_record_id;

  -- ==========================================================================
  -- EXTRACT PAYMENT CONTEXT FROM PAYLOAD
  -- ==========================================================================
  v_reconciliation_id := p_payload->>'reconciliation_id';
  v_transaction_status := COALESCE((p_payload->>'status')::resident.payment_status, 'confirmed');
  v_transaction_amount := COALESCE((p_payload->>'amount')::numeric, 0);

  IF v_reconciliation_id IS NOT NULL THEN
    SELECT id, invoice_id, status INTO v_payment_intent_id, v_invoice_id, v_transaction_status
    FROM resident.payment_intents
    WHERE tenant_id = p_tenant_id
      AND reconciliation_id = v_reconciliation_id
    LIMIT 1;

    IF v_payment_intent_id IS NULL THEN
      SELECT id, invoice_id, status, amount INTO v_transaction_id, v_invoice_id, v_transaction_status, v_transaction_amount
      FROM resident.payment_transactions
      WHERE tenant_id = p_tenant_id
        AND reconciliation_id = v_reconciliation_id
      LIMIT 1;
    END IF;
  END IF;

  -- ==========================================================================
  -- UPDATE PAYMENT INTENT / TRANSACTION
  -- ==========================================================================
  IF v_payment_intent_id IS NOT NULL THEN
    UPDATE resident.payment_intents
    SET status = v_transaction_status,
        updated_at = now()
    WHERE id = v_payment_intent_id;

    IF v_transaction_status IN ('confirmed', 'partially_confirmed') THEN
      INSERT INTO resident.payment_transactions (
        tenant_id, invoice_id, payment_intent_id, amount, status,
        provider, provider_config_id, payment_method_type, paid_at,
        reconciliation_id, raw_provider_response
      )
      SELECT
        p_tenant_id,
        v_invoice_id,
        v_payment_intent_id,
        v_transaction_amount,
        v_transaction_status,
        p_provider,
        pi.provider_config_id,
        pi.method_type,
        now(),
        v_reconciliation_id,
        p_payload
      FROM resident.payment_intents pi
      WHERE pi.id = v_payment_intent_id
      RETURNING id INTO v_transaction_id;
    END IF;
  ELSIF v_transaction_id IS NOT NULL THEN
    UPDATE resident.payment_transactions
    SET status = v_transaction_status,
        paid_at = CASE WHEN v_transaction_status IN ('confirmed', 'partially_confirmed') THEN COALESCE(paid_at, now()) ELSE paid_at END,
        updated_at = now()
    WHERE id = v_transaction_id;
  END IF;

  -- ==========================================================================
  -- INVOICE RECONCILIATION
  -- ==========================================================================
  IF v_invoice_id IS NOT NULL THEN
    v_balance := resident.get_invoice_balance(v_invoice_id);

    IF v_balance <= 0 THEN
      -- Fully paid or overpaid
      UPDATE resident.invoices
      SET status = 'paid',
          paid_at = COALESCE(paid_at, now()),
          updated_at = now()
      WHERE id = v_invoice_id
        AND status IN ('open', 'payment_pending', 'overdue');
    ELSIF v_balance > 0 AND v_transaction_status IN ('confirmed', 'partially_confirmed') THEN
      -- Partial payment: keep invoice as payment_pending or open
      UPDATE resident.invoices
      SET status = 'payment_pending',
          updated_at = now()
      WHERE id = v_invoice_id
        AND status IN ('open', 'overdue');
    END IF;

    -- ==========================================================================
    -- LEDGER ENTRY
    -- ==========================================================================
    IF v_transaction_status IN ('confirmed', 'partially_confirmed') AND v_transaction_amount > 0 THEN
      SELECT COALESCE(balance, 0) INTO v_previous_balance
      FROM resident.ledger_entries
      WHERE tenant_id = p_tenant_id
      ORDER BY entry_date DESC, created_at DESC, id DESC
      LIMIT 1;

      v_new_balance := v_previous_balance - v_transaction_amount;

      INSERT INTO resident.ledger_entries (
        tenant_id, entry_date, description,
        debit_amount, credit_amount, balance,
        entity_type, entity_id, reference_document, metadata
      ) VALUES (
        p_tenant_id,
        now(),
        'Pagamento recebido — ' || p_provider || ' — evento ' || p_event_id,
        0,
        v_transaction_amount,
        v_new_balance,
        'payment_transaction',
        v_transaction_id::text,
        v_reconciliation_id,
        jsonb_build_object(
          'invoice_id', v_invoice_id,
          'payment_intent_id', v_payment_intent_id,
          'transaction_id', v_transaction_id,
          'provider', p_provider,
          'event_id', p_event_id,
          'previous_balance', v_previous_balance,
          'new_balance', v_new_balance
        )
      )
      RETURNING id INTO v_ledger_id;
    END IF;
  END IF;

  -- ==========================================================================
  -- AUDIT LOG
  -- ==========================================================================
  v_audit_id := resident.log_payment_audit(
    p_tenant_id,
    'webhook_received',
    'payment_provider_event',
    v_event_record_id::text,
    jsonb_build_object(
      'provider', p_provider,
      'event_id', p_event_id,
      'event_type', p_event_type,
      'signature_status', v_signature_status,
      'replay_status', v_replay_status,
      'invoice_id', v_invoice_id,
      'payment_intent_id', v_payment_intent_id,
      'transaction_id', v_transaction_id,
      'transaction_status', v_transaction_status,
      'transaction_amount', v_transaction_amount,
      'ledger_id', v_ledger_id,
      'balance_after', v_balance
    ),
    jsonb_build_object(
      'source', 'process_payment_webhook',
      'signature_record_id', v_signature_record_id,
      'event_record_id', v_event_record_id
    ),
    p_actor_profile_id
  );

  RETURN jsonb_build_object(
    'status', 'processed',
    'provider', p_provider,
    'event_id', p_event_id,
    'event_record_id', v_event_record_id,
    'signature_status', v_signature_status,
    'replay_status', v_replay_status,
    'invoice_id', v_invoice_id,
    'payment_intent_id', v_payment_intent_id,
    'transaction_id', v_transaction_id,
    'transaction_status', v_transaction_status,
    'balance', v_balance,
    'ledger_id', v_ledger_id,
    'audit_id', v_audit_id
  );
END;
$$;

-- ============================================================================
-- 11. PAYMENT INTENT CREATION ORCHESTRATION
-- ============================================================================

-- create_payment_intent: orchestrates the creation of a payment intent.
-- The provider adapter is responsible for generating PIX / Boleto payloads.
-- This function records the intent, transitions the invoice when appropriate,
-- and writes audit/ledger entries.
CREATE OR REPLACE FUNCTION resident.create_payment_intent(
  p_tenant_id uuid,
  p_invoice_id uuid,
  p_provider_id text,
  p_method_type resident.payment_method_type,
  p_provider_config_id uuid,
  p_provider_payment_intent_id text,
  p_amount numeric(15,2),
  p_provider_pix_code text DEFAULT NULL,
  p_provider_pix_qr_base64 text DEFAULT NULL,
  p_provider_boleto_url text DEFAULT NULL,
  p_provider_boleto_barcode text DEFAULT NULL,
  p_provider_boleto_digitable_line text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_reconciliation_id text DEFAULT NULL,
  p_raw_provider_response jsonb DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invoice record;
  v_intent_id uuid;
  v_audit_id uuid;
  v_existing_id uuid;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM resident.payment_intents
    WHERE idempotency_key = p_idempotency_key
      AND tenant_id = p_tenant_id
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  SELECT * INTO v_invoice
  FROM resident.invoices
  WHERE id = p_invoice_id
    AND tenant_id = p_tenant_id
    AND deleted_at IS NULL;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;

  IF v_invoice.status NOT IN ('open', 'overdue', 'payment_pending') THEN
    RAISE EXCEPTION 'Invoice % cannot receive payment intents in status %', p_invoice_id, v_invoice.status;
  END IF;

  INSERT INTO resident.payment_intents (
    tenant_id,
    invoice_id,
    amount,
    status,
    provider,
    method_type,
    provider_payment_intent_id,
    provider_pix_code,
    provider_pix_qr_base64,
    provider_boleto_url,
    provider_boleto_barcode,
    provider_boleto_digitable_line,
    expires_at,
    reconciliation_id,
    raw_provider_response,
    idempotency_key,
    provider_config_id,
    metadata
  ) VALUES (
    p_tenant_id,
    p_invoice_id,
    p_amount,
    'pending',
    p_provider_id,
    p_method_type,
    p_provider_payment_intent_id,
    p_provider_pix_code,
    p_provider_pix_qr_base64,
    p_provider_boleto_url,
    p_provider_boleto_barcode,
    p_provider_boleto_digitable_line,
    p_expires_at,
    p_reconciliation_id,
    p_raw_provider_response,
    p_idempotency_key,
    p_provider_config_id,
    jsonb_build_object(
      'actor_profile_id', p_actor_profile_id,
      'source', 'create_payment_intent'
    )
  )
  RETURNING id INTO v_intent_id;

  UPDATE resident.invoices
  SET status = 'payment_pending',
      updated_at = now()
  WHERE id = p_invoice_id
    AND status IN ('open', 'overdue');

  v_audit_id := resident.log_payment_audit(
    p_tenant_id,
    'payment_started',
    'payment_intent',
    v_intent_id::text,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'provider', p_provider_id,
      'method_type', p_method_type,
      'amount', p_amount,
      'reconciliation_id', p_reconciliation_id
    ),
    jsonb_build_object(
      'source', 'create_payment_intent',
      'provider_config_id', p_provider_config_id,
      'actor_profile_id', p_actor_profile_id
    ),
    p_actor_profile_id
  );

  RETURN v_intent_id;
END;
$$;

-- ============================================================================
-- 12. TRIGGER: protect provider config immutable fields
-- ============================================================================

CREATE OR REPLACE FUNCTION resident.tenant_provider_config_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'tenant_payment_provider_configs.tenant_id is immutable';
    END IF;
    IF OLD.provider_id IS DISTINCT FROM NEW.provider_id THEN
      RAISE EXCEPTION 'tenant_payment_provider_configs.provider_id is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenant_provider_config_immutable') THEN
    CREATE TRIGGER trg_tenant_provider_config_immutable
      BEFORE UPDATE ON resident.tenant_payment_provider_configs
      FOR EACH ROW EXECUTE FUNCTION resident.tenant_provider_config_immutable_fields();
  END IF;
END $$;

-- ============================================================================
-- 13. updated_at TRIGGERS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_providers_updated_at') THEN
    CREATE TRIGGER trg_payment_providers_updated_at
      BEFORE UPDATE ON resident.payment_providers
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_provider_capabilities_updated_at') THEN
    CREATE TRIGGER trg_payment_provider_capabilities_updated_at
      BEFORE UPDATE ON resident.payment_provider_capabilities
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tenant_provider_configs_updated_at') THEN
    CREATE TRIGGER trg_tenant_provider_configs_updated_at
      BEFORE UPDATE ON resident.tenant_payment_provider_configs
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payment_webhooks_updated_at') THEN
    CREATE TRIGGER trg_payment_webhooks_updated_at
      BEFORE UPDATE ON resident.payment_webhooks
      FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();
  END IF;
END $$;

-- ============================================================================
-- 14. current_tenant_id helper
-- ============================================================================

-- Returns the active tenant id for the current authenticated profile.
-- Used in RLS policies below. Mirrors the logic from current_tenant_context.
CREATE OR REPLACE FUNCTION resident.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tm.tenant_id
  FROM resident.tenant_members tm
  WHERE tm.profile_id = resident.current_profile_id()
    AND tm.status = 'active'
  ORDER BY tm.created_at ASC
  LIMIT 1;
$$;

-- ============================================================================
-- 15. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE resident.payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_providers FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_provider_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_provider_capabilities FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.tenant_payment_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.tenant_payment_provider_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_webhooks FORCE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_provider_event_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.payment_provider_event_signatures FORCE ROW LEVEL SECURITY;

-- payment_providers: globally readable by authenticated users
DROP POLICY IF EXISTS payment_providers_select_policy ON resident.payment_providers;
CREATE POLICY payment_providers_select_policy ON resident.payment_providers
  FOR SELECT TO authenticated
  USING (is_active = true);

-- payment_provider_capabilities: globally readable by authenticated users
DROP POLICY IF EXISTS payment_provider_capabilities_select_policy ON resident.payment_provider_capabilities;
CREATE POLICY payment_provider_capabilities_select_policy ON resident.payment_provider_capabilities
  FOR SELECT TO authenticated
  USING (is_active = true);

-- tenant_payment_provider_configs: tenant-scoped; staff with payments:read or platform admin
DROP POLICY IF EXISTS tenant_provider_configs_select_policy ON resident.tenant_payment_provider_configs;
CREATE POLICY tenant_provider_configs_select_policy ON resident.tenant_payment_provider_configs
  FOR SELECT TO authenticated
  USING (
    tenant_id = resident.current_tenant_id()
    AND (
      resident.has_tenant_permission(tenant_id, 'payments:read')
      OR resident.is_platform_admin()
    )
  );

-- payment_webhooks: tenant-scoped staff
DROP POLICY IF EXISTS payment_webhooks_select_policy ON resident.payment_webhooks;
CREATE POLICY payment_webhooks_select_policy ON resident.payment_webhooks
  FOR SELECT TO authenticated
  USING (
    tenant_id = resident.current_tenant_id()
    AND (
      resident.has_tenant_permission(tenant_id, 'payments:read')
      OR resident.is_platform_admin()
    )
  );

-- payment_provider_event_signatures: tenant-scoped staff
DROP POLICY IF EXISTS payment_provider_event_signatures_select_policy ON resident.payment_provider_event_signatures;
CREATE POLICY payment_provider_event_signatures_select_policy ON resident.payment_provider_event_signatures
  FOR SELECT TO authenticated
  USING (
    tenant_id = resident.current_tenant_id()
    AND (
      resident.has_tenant_permission(tenant_id, 'audit:read_association')
      OR resident.is_platform_admin()
    )
  );

-- ============================================================================
-- 16. GRANTS
-- ============================================================================

-- Revoke direct access from new EPF-03 tables
REVOKE ALL ON TABLE resident.payment_providers FROM anon, authenticated;
REVOKE ALL ON TABLE resident.payment_provider_capabilities FROM anon, authenticated;
REVOKE ALL ON TABLE resident.tenant_payment_provider_configs FROM anon, authenticated;
REVOKE ALL ON TABLE resident.payment_webhooks FROM anon, authenticated;
REVOKE ALL ON TABLE resident.payment_provider_event_signatures FROM anon, authenticated;

-- SELECT grants for authenticated (RLS enforces row-level access)
GRANT SELECT ON resident.payment_providers TO authenticated;
GRANT SELECT ON resident.payment_provider_capabilities TO authenticated;
GRANT SELECT ON resident.tenant_payment_provider_configs TO authenticated;
GRANT SELECT ON resident.payment_webhooks TO authenticated;
GRANT SELECT ON resident.payment_provider_event_signatures TO authenticated;

-- EXECUTE grants for helper functions
GRANT EXECUTE ON FUNCTION resident.has_provider_capability(text, resident.payment_provider_capability) TO authenticated;
GRANT EXECUTE ON FUNCTION resident.get_provider_capabilities(text) TO authenticated;
GRANT EXECUTE ON FUNCTION resident.get_default_provider_config(uuid, resident.payment_method_type, resident.payment_provider_environment) TO authenticated;
GRANT EXECUTE ON FUNCTION resident.get_invoice_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION resident.current_tenant_id() TO authenticated;

-- Service-role access for mutations
GRANT USAGE ON SCHEMA resident TO service_role;
GRANT ALL ON TABLE resident.payment_providers TO service_role;
GRANT ALL ON TABLE resident.payment_provider_capabilities TO service_role;
GRANT ALL ON TABLE resident.tenant_payment_provider_configs TO service_role;
GRANT ALL ON TABLE resident.payment_webhooks TO service_role;
GRANT ALL ON TABLE resident.payment_provider_event_signatures TO service_role;
GRANT ALL ON TABLE resident.payment_intents TO service_role;
GRANT ALL ON TABLE resident.payment_transactions TO service_role;
GRANT ALL ON TABLE resident.invoices TO service_role;
GRANT ALL ON TABLE resident.ledger_entries TO service_role;
GRANT ALL ON TABLE resident.financial_audit_log TO service_role;
GRANT ALL ON TABLE resident.payment_provider_events TO service_role;
GRANT ALL ON TABLE resident.payment_receipts TO service_role;

GRANT EXECUTE ON FUNCTION resident.process_payment_webhook(uuid, text, text, text, jsonb, text, text, timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION resident.create_payment_intent(uuid, uuid, text, resident.payment_method_type, uuid, text, numeric, text, text, text, text, text, timestamptz, text, jsonb, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION resident.log_payment_audit(uuid, resident.financial_event_type, text, text, jsonb, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION resident.create_vault_secret(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION resident.update_vault_secret(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION resident.get_vault_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION resident.has_provider_capability(text, resident.payment_provider_capability) TO service_role;
GRANT EXECUTE ON FUNCTION resident.get_provider_capabilities(text) TO service_role;
GRANT EXECUTE ON FUNCTION resident.get_default_provider_config(uuid, resident.payment_method_type, resident.payment_provider_environment) TO service_role;
GRANT EXECUTE ON FUNCTION resident.get_invoice_balance(uuid) TO service_role;

-- Vault access for service_role
GRANT USAGE ON SCHEMA vault TO service_role;
GRANT SELECT ON vault.decrypted_secrets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON vault.secrets TO service_role;

-- ============================================================================
-- 17. COMMENTS
-- ============================================================================

COMMENT ON TABLE resident.payment_providers IS 'Registry of supported payment providers. Provider metadata lives here; executable behavior lives in Edge Function adapter code.';
COMMENT ON TABLE resident.payment_provider_capabilities IS 'Capability matrix per provider. Used for runtime capability discovery. Only declared capabilities may be used by the orchestration layer.';
COMMENT ON TABLE resident.tenant_payment_provider_configs IS 'Tenant-scoped provider configuration. Stores non-sensitive data and Vault secret identifiers. Credentials and webhook secrets are stored in Supabase Vault and never appear in this table.';
COMMENT ON TABLE resident.payment_webhooks IS 'Webhook registry per tenant and provider configuration.';
COMMENT ON TABLE resident.payment_provider_event_signatures IS 'Signature validation, replay nonce, and payload hash log for every received webhook. Append-only.';
COMMENT ON FUNCTION resident.process_payment_webhook(uuid, text, text, text, jsonb, text, text, timestamptz, uuid) IS 'Atomic webhook ingestion. Validates signature and replay nonce, records event, updates payment transaction, reconciles invoice, writes ledger entry and audit log inside a single transaction.';
COMMENT ON FUNCTION resident.create_payment_intent(uuid, uuid, text, resident.payment_method_type, uuid, text, numeric, text, text, text, text, text, timestamptz, text, jsonb, text, uuid) IS 'Payment intent orchestration. Records the intent, transitions invoice to payment_pending when appropriate, writes audit log.';
