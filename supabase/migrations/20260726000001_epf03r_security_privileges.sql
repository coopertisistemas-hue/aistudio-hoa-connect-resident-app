-- EPF-03R Remediation — Migration 01
-- Security Definer Privilege Hardening, Webhook Identity and Replay Uniqueness
--
-- This migration is additive and does not modify any certified EPF-01, EPF-02 or
-- original EPF-03 migration file.
--
-- Changes:
--   • Explicit EXECUTE revokes from PUBLIC, anon and authenticated on every
--     EPF-03 SECURITY DEFINER function created before this remediation.
--   • Re-grants only the minimum required role per function.
--   • Adds a public webhook endpoint identifier to resident.payment_webhooks.
--   • Replaces the global replay-nonce unique index with a tenant-scoped one.
--   • Adds a tenant-scoped unique index on provider event identity.
--   • Introduces a helper to resolve and validate a webhook endpoint registration.

-- ============================================================================
-- 1. WEBHOOK ENDPOINT IDENTITY
-- ============================================================================

-- Public endpoint identifier used for routing webhooks to the correct trusted
-- registration. It is NOT a secret and does not authorize financial mutation by
-- itself; the provider signature and replay checks are still mandatory.
ALTER TABLE resident.payment_webhooks
  ADD COLUMN IF NOT EXISTS endpoint_id uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_webhooks_endpoint_id
  ON resident.payment_webhooks (endpoint_id);

-- ============================================================================
-- 2. REPLAY AND EVENT IDEMPOTENCY UNIQUENESS
-- ============================================================================

-- Drop the global (provider, replay_nonce) uniqueness that allowed cross-tenant
-- nonce collisions.
DROP INDEX IF EXISTS resident.idx_payment_provider_event_signatures_unique;

-- Tenant-scoped replay nonce uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_provider_event_signatures_tenant_nonce
  ON resident.payment_provider_event_signatures (tenant_id, provider, replay_nonce)
  WHERE replay_nonce IS NOT NULL;

-- Tenant-scoped provider event identity. Duplicate event ids for the same tenant
-- and provider must return an idempotent 'duplicate' result.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_provider_events_tenant_event
  ON resident.payment_provider_events (tenant_id, provider, event_id);

-- ============================================================================
-- 3. WEBHOOK ENDPOINT RESOLUTION
-- ============================================================================

-- resolve_webhook_endpoint: validates a public webhook endpoint identifier and
-- returns the trusted server-side registration. The caller (a service-role Edge
-- Function) must still verify the provider signature, timestamp and nonce.
CREATE OR REPLACE FUNCTION resident.resolve_webhook_endpoint(
  p_endpoint_id uuid
)
RETURNS TABLE (
  tenant_id uuid,
  provider_id text,
  provider_config_id uuid,
  environment resident.payment_provider_environment,
  is_active boolean,
  config_is_active boolean,
  webhook_secret_id uuid,
  event_types text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    pw.tenant_id,
    tppc.provider_id,
    tppc.id AS provider_config_id,
    tppc.environment,
    pw.is_active,
    tppc.is_active AS config_is_active,
    pw.secret_id AS webhook_secret_id,
    pw.event_types
  FROM resident.payment_webhooks pw
  JOIN resident.tenant_payment_provider_configs tppc
    ON tppc.id = pw.provider_config_id
  WHERE pw.endpoint_id = p_endpoint_id
    AND pw.tenant_id = tppc.tenant_id;
$$;

-- ============================================================================
-- 4. PRIVILEGE REVOCATION AND MINIMUM GRANTS
-- ============================================================================

-- Rule: every privileged function must have explicit revokes and explicit grants,
-- regardless of owner or environment. Trigger functions do not receive direct
-- client grants.

-- ---------------------------------------------------------------------------
-- Vault access wrappers — service-role only
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION resident.create_vault_secret(text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.update_vault_secret(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.get_vault_secret(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION resident.create_vault_secret(text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.update_vault_secret(uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION resident.get_vault_secret(uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Financial mutation RPCs — service-role only
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION resident.create_payment_intent(
  uuid, uuid, text, resident.payment_method_type, uuid, text, numeric,
  text, text, text, text, text, timestamptz, text, jsonb, text, uuid
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION resident.process_payment_webhook(
  uuid, text, text, text, jsonb, text, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION resident.log_payment_audit(
  uuid, resident.financial_event_type, text, text, jsonb, jsonb, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION resident.create_payment_intent(
  uuid, uuid, text, resident.payment_method_type, uuid, text, numeric,
  text, text, text, text, text, timestamptz, text, jsonb, text, uuid
) TO service_role;

GRANT EXECUTE ON FUNCTION resident.process_payment_webhook(
  uuid, text, text, text, jsonb, text, text, timestamptz, uuid
) TO service_role;

GRANT EXECUTE ON FUNCTION resident.log_payment_audit(
  uuid, resident.financial_event_type, text, text, jsonb, jsonb, uuid
) TO service_role;

-- ---------------------------------------------------------------------------
-- Read-only helpers — authenticated (RLS enforces row-level access)
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

-- Also grant the same helpers to service_role for Edge Function convenience.
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

-- ---------------------------------------------------------------------------
-- New helper from this migration — service-role only
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION resident.resolve_webhook_endpoint(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION resident.resolve_webhook_endpoint(uuid)
  TO service_role;

-- ============================================================================
-- 5. SCHEMA AND TABLE ACCESS
-- ============================================================================

-- Keep existing table-level grants from EPF-03; they are already restrictive.
-- Ensure service_role has schema usage.
GRANT USAGE ON SCHEMA resident TO service_role;
GRANT USAGE ON SCHEMA vault TO service_role;

-- ============================================================================
-- 6. MIGRATION-TIME PRIVILEGE ASSERTIONS
-- ============================================================================

DO $$
DECLARE
  v_role text;
BEGIN
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
    IF has_function_privilege(v_role, 'resident.process_payment_webhook(uuid, text, text, text, jsonb, text, text, timestamptz, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.process_payment_webhook', v_role;
    END IF;
    IF has_function_privilege(v_role, 'resident.log_payment_audit(uuid, resident.financial_event_type, text, text, jsonb, jsonb, uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: % can execute resident.log_payment_audit', v_role;
    END IF;
  END LOOP;

  IF NOT has_function_privilege('service_role', 'resident.create_vault_secret(text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.create_vault_secret';
  END IF;
  IF NOT has_function_privilege('service_role', 'resident.process_payment_webhook(uuid, text, text, text, jsonb, text, text, timestamptz, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: service_role cannot execute resident.process_payment_webhook';
  END IF;

  IF NOT has_function_privilege('authenticated', 'resident.has_provider_capability(text, resident.payment_provider_capability)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: authenticated cannot execute resident.has_provider_capability';
  END IF;
  IF NOT has_function_privilege('authenticated', 'resident.get_invoice_balance(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIVILEGE ASSERTION FAIL: authenticated cannot execute resident.get_invoice_balance';
  END IF;
END $$;

COMMENT ON FUNCTION resident.resolve_webhook_endpoint(uuid) IS
  'Resolves a public webhook endpoint identifier to the trusted tenant/provider/provider_config registration. Service-role only.';
