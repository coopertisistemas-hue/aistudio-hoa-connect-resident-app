-- EPF-03R Remediation — Migration 04
-- Provider Config Upsert and Payment Intent Cancellation
--
-- This migration is additive and does not modify any certified EPF-01, EPF-02 or
-- original EPF-03 migration file.
--
-- Changes:
--   • Atomic transactional RPC for provider-config upsert.
--   • Atomic RPC for payment-intent cancellation with invoice reconciliation.
--   • Both operations scoped by (tenant_id, id) and write financial audit.

-- ============================================================================
-- 1. ATOMIC PROVIDER CONFIG UPSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION resident.upsert_provider_config(
  p_tenant_id uuid,
  p_config_id uuid,
  p_provider_id text,
  p_environment resident.payment_provider_environment,
  p_method_type resident.payment_method_type,
  p_is_active boolean,
  p_is_default boolean,
  p_agreement_number text,
  p_wallet text,
  p_portfolio text,
  p_bank_account jsonb,
  p_pix_keys jsonb,
  p_credentials text,
  p_webhook_secret text,
  p_metadata jsonb,
  p_actor_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing record;
  v_provider record;
  v_credentials_secret_id uuid;
  v_webhook_secret_id uuid;
  v_config_id uuid;
  v_audit_id uuid;
  v_result jsonb;
  v_operation text;
  v_changes jsonb;
BEGIN
  -- Validate tenant and provider.
  SELECT * INTO v_provider
  FROM resident.payment_providers
  WHERE id = p_provider_id;

  IF v_provider IS NULL THEN
    RAISE EXCEPTION 'Provider % not found in registry', p_provider_id;
  END IF;

  IF v_provider.is_active = false THEN
    RAISE EXCEPTION 'Provider % is inactive', p_provider_id;
  END IF;

  -- When updating, load existing config using both id and tenant_id.
  IF p_config_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM resident.tenant_payment_provider_configs
    WHERE id = p_config_id
      AND tenant_id = p_tenant_id;

    IF v_existing IS NULL THEN
      RAISE EXCEPTION 'Provider configuration not found for tenant';
    END IF;

    IF v_existing.provider_id <> p_provider_id THEN
      RAISE EXCEPTION 'Provider configuration provider_id mismatch';
    END IF;

    v_credentials_secret_id := v_existing.credentials_secret_id;
    v_webhook_secret_id := v_existing.webhook_secret_id;
    v_operation := 'updated';
  ELSE
    v_operation := 'created';
  END IF;

  -- Create or update Vault secrets. Vault functions are called within the same
  -- transaction; if the config upsert fails, the Vault writes roll back too.
  IF p_credentials IS NOT NULL THEN
    IF v_credentials_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(v_credentials_secret_id, p_credentials);
    ELSE
      v_credentials_secret_id := vault.create_secret(
        p_credentials,
        'provider-config-' || p_provider_id || '-' || p_tenant_id || '-credentials',
        'Credentials for ' || p_provider_id || ' config'
      );
    END IF;
  END IF;

  IF p_webhook_secret IS NOT NULL THEN
    IF v_webhook_secret_id IS NOT NULL THEN
      PERFORM vault.update_secret(v_webhook_secret_id, p_webhook_secret);
    ELSE
      v_webhook_secret_id := vault.create_secret(
        p_webhook_secret,
        'provider-config-' || p_provider_id || '-' || p_tenant_id || '-webhook',
        'Webhook secret for ' || p_provider_id || ' config'
      );
    END IF;
  END IF;

  -- Upsert the configuration row.
  IF p_config_id IS NOT NULL THEN
    UPDATE resident.tenant_payment_provider_configs
    SET
      environment = p_environment,
      method_type = p_method_type,
      is_active = p_is_active,
      is_default = p_is_default,
      agreement_number = p_agreement_number,
      wallet = p_wallet,
      portfolio = p_portfolio,
      bank_account = COALESCE(p_bank_account, '{}'::jsonb),
      pix_keys = COALESCE(p_pix_keys, '{}'::jsonb),
      credentials_secret_id = v_credentials_secret_id,
      webhook_secret_id = v_webhook_secret_id,
      metadata = COALESCE(p_metadata, '{}'::jsonb),
      updated_at = now(),
      updated_by_profile_id = p_actor_profile_id
    WHERE id = p_config_id
      AND tenant_id = p_tenant_id
    RETURNING id INTO v_config_id;

    v_changes := jsonb_build_object(
      'environment', p_environment,
      'method_type', p_method_type,
      'is_active', p_is_active,
      'is_default', p_is_default,
      'agreement_number', p_agreement_number,
      'wallet', p_wallet,
      'portfolio', p_portfolio,
      'credentials_secret_id', (v_credentials_secret_id IS NOT NULL),
      'webhook_secret_id', (v_webhook_secret_id IS NOT NULL)
    );
  ELSE
    INSERT INTO resident.tenant_payment_provider_configs (
      tenant_id, provider_id, environment, method_type, is_active, is_default,
      agreement_number, wallet, portfolio, bank_account, pix_keys,
      credentials_secret_id, webhook_secret_id, metadata,
      updated_by_profile_id
    ) VALUES (
      p_tenant_id, p_provider_id, p_environment, p_method_type, p_is_active,
      p_is_default, p_agreement_number, p_wallet, p_portfolio,
      COALESCE(p_bank_account, '{}'::jsonb),
      COALESCE(p_pix_keys, '{}'::jsonb),
      v_credentials_secret_id,
      v_webhook_secret_id,
      COALESCE(p_metadata, '{}'::jsonb),
      p_actor_profile_id
    )
    RETURNING id INTO v_config_id;

    v_changes := jsonb_build_object(
      'tenant_id', p_tenant_id,
      'provider_id', p_provider_id,
      'environment', p_environment,
      'method_type', p_method_type,
      'is_active', p_is_active,
      'is_default', p_is_default,
      'credentials_secret_id', (v_credentials_secret_id IS NOT NULL),
      'webhook_secret_id', (v_webhook_secret_id IS NOT NULL)
    );
  END IF;

  -- Audit the change.
  v_audit_id := resident.log_payment_audit(
    p_tenant_id,
    'provider_config_changed',
    'tenant_payment_provider_configs',
    v_config_id::text,
    v_changes,
    jsonb_build_object(
      'source', 'upsert_provider_config',
      'operation', v_operation,
      'actor_profile_id', p_actor_profile_id
    ),
    p_actor_profile_id
  );

  -- Return sanitized configuration. Never expose raw Vault secret UUIDs.
  RETURN jsonb_build_object(
    'id', v_config_id,
    'tenant_id', p_tenant_id,
    'provider_id', p_provider_id,
    'environment', p_environment,
    'method_type', p_method_type,
    'is_active', p_is_active,
    'is_default', p_is_default,
    'agreement_number', p_agreement_number,
    'wallet', p_wallet,
    'portfolio', p_portfolio,
    'bank_account', COALESCE(p_bank_account, '{}'::jsonb),
    'pix_keys', COALESCE(p_pix_keys, '{}'::jsonb),
    'has_credentials', (v_credentials_secret_id IS NOT NULL),
    'has_webhook_secret', (v_webhook_secret_id IS NOT NULL),
    'operation', v_operation,
    'audit_id', v_audit_id
  );
END;
$$;

-- ============================================================================
-- 2. ATOMIC PAYMENT INTENT CANCELLATION
-- ============================================================================

CREATE OR REPLACE FUNCTION resident.cancel_payment_intent(
  p_tenant_id uuid,
  p_payment_intent_id uuid,
  p_provider_response jsonb,
  p_actor_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent record;
  v_invoice_id uuid;
  v_active_intents integer;
  v_balance numeric(15,2);
  v_invoice_status text;
  v_audit_id uuid;
BEGIN
  SELECT * INTO v_intent
  FROM resident.payment_intents
  WHERE id = p_payment_intent_id
    AND tenant_id = p_tenant_id;

  IF v_intent IS NULL THEN
    RAISE EXCEPTION 'Payment intent not found for tenant';
  END IF;

  IF v_intent.status NOT IN ('pending', 'processing', 'under_review', 'not_reconciled') THEN
    RAISE EXCEPTION 'Payment intent cannot be cancelled in status %', v_intent.status;
  END IF;

  -- Verify provider configuration is active.
  PERFORM 1
  FROM resident.tenant_payment_provider_configs
  WHERE id = v_intent.provider_config_id
    AND tenant_id = p_tenant_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider configuration not active for cancellation';
  END IF;

  v_invoice_id := v_intent.invoice_id;

  UPDATE resident.payment_intents
  SET status = 'cancelled',
      updated_at = now(),
      raw_provider_response = COALESCE(raw_provider_response, '{}'::jsonb) || COALESCE(p_provider_response, '{}'::jsonb)
  WHERE id = p_payment_intent_id
    AND tenant_id = p_tenant_id;

  -- If no other active payment intent remains, reconcile the invoice from
  -- payment_pending back to open/overdue based on balance and due date.
  SELECT COUNT(*) INTO v_active_intents
  FROM resident.payment_intents
  WHERE invoice_id = v_invoice_id
    AND tenant_id = p_tenant_id
    AND status IN ('pending', 'processing')
    AND id <> p_payment_intent_id;

  IF v_active_intents = 0 THEN
    v_balance := resident.get_invoice_balance(v_invoice_id);
    v_invoice_status := resident.reconcile_invoice_status(v_invoice_id, v_balance);
  END IF;

  v_audit_id := resident.log_payment_audit(
    p_tenant_id,
    'payment_cancelled',
    'payment_intent',
    p_payment_intent_id::text,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'previous_status', v_intent.status,
      'new_status', 'cancelled',
      'invoice_status', v_invoice_status
    ),
    jsonb_build_object(
      'source', 'cancel_payment_intent',
      'provider_response', COALESCE(p_provider_response, '{}'::jsonb),
      'actor_profile_id', p_actor_profile_id
    ),
    p_actor_profile_id
  );

  RETURN jsonb_build_object(
    'status', 'cancelled',
    'payment_intent_id', p_payment_intent_id,
    'invoice_id', v_invoice_id,
    'invoice_status', v_invoice_status,
    'audit_id', v_audit_id
  );
END;
$$;

-- ============================================================================
-- 3. PRIVILEGES
-- ============================================================================

REVOKE EXECUTE ON FUNCTION resident.upsert_provider_config(
  uuid, uuid, text, resident.payment_provider_environment,
  resident.payment_method_type, boolean, boolean, text, text, text,
  jsonb, jsonb, text, text, jsonb, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION resident.upsert_provider_config(
  uuid, uuid, text, resident.payment_provider_environment,
  resident.payment_method_type, boolean, boolean, text, text, text,
  jsonb, jsonb, text, text, jsonb, uuid
) TO service_role;

REVOKE EXECUTE ON FUNCTION resident.cancel_payment_intent(
  uuid, uuid, jsonb, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION resident.cancel_payment_intent(
  uuid, uuid, jsonb, uuid
) TO service_role;

COMMENT ON FUNCTION resident.upsert_provider_config(
  uuid, uuid, text, resident.payment_provider_environment,
  resident.payment_method_type, boolean, boolean, text, text, text,
  jsonb, jsonb, text, text, jsonb, uuid
) IS 'Atomic provider configuration upsert. Creates/updates Vault secrets and the config row in one transaction. Scoped by tenant_id. Returns sanitized config without secret UUIDs. Service-role only.';

COMMENT ON FUNCTION resident.cancel_payment_intent(uuid, uuid, jsonb, uuid) IS
  'Atomic payment-intent cancellation. Requires active provider configuration. Reconciles invoice when no active payment path remains. Service-role only.';
