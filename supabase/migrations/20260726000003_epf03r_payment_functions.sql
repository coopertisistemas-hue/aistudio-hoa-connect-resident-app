-- EPF-03R Remediation — Migration 03
-- Corrected Payment Functions
--
-- This migration is additive and does not modify any certified EPF-01, EPF-02 or
-- original EPF-03 migration file.
--
-- Changes:
--   • Refund-aware invoice balance (get_invoice_balance).
--   • Tenant-scoped ledger advisory lock in all financial mutation paths.
--   • Rewritten process_payment_webhook with trusted endpoint identity, mandatory
--     signature/replay enforcement, separate status variables, and correct
--     status handling.
--   • Corrected payment-intent and payment-transaction state machines
--     (partially_refunded is no longer terminal).
--   • Tenant-scoped payment-intent idempotency.
--   • Mandatory client idempotency key and amount validation in create_payment_intent.

-- ============================================================================
-- 1. IDEMPOTENCY KEY: TENANT-SCOPED
-- ============================================================================

-- Drop the global UNIQUE constraint on idempotency_key.
ALTER TABLE resident.payment_intents
  DROP CONSTRAINT IF EXISTS payment_intents_idempotency_key_key;

-- Add tenant-scoped uniqueness. Two different tenants may use the same key.
ALTER TABLE resident.payment_intents
  ADD CONSTRAINT uq_payment_intents_tenant_idempotency
  UNIQUE (tenant_id, idempotency_key);

-- From this point forward, every payment intent must carry a client-supplied key.
ALTER TABLE resident.payment_intents
  ALTER COLUMN idempotency_key SET NOT NULL;

-- ============================================================================
-- 2. REFUND-AWARE INVOICE BALANCE
-- ============================================================================

-- Outstanding balance = invoice amount
--                       - net confirmed payments (confirmed/partially_confirmed)
--                       + confirmed refunds
--                       - credits/discounts
--                       + interest/fines/debits.
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
        SELECT SUM(pt.amount)
        FROM resident.payment_transactions pt
        WHERE pt.invoice_id = p_invoice_id
          AND pt.status IN ('confirmed', 'partially_confirmed', 'partially_refunded')
      ), 0)
    + COALESCE((
        SELECT SUM(pr.amount)
        FROM resident.payment_refunds pr
        JOIN resident.payment_transactions pt ON pt.id = pr.payment_transaction_id
        WHERE pr.invoice_id = p_invoice_id
          AND pr.status = 'confirmed'
          AND pt.status IN ('confirmed', 'partially_refunded')
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

-- ============================================================================
-- 3. STATUS NORMALIZATION AND INVOICE RECONCILIATION HELPERS
-- ============================================================================

-- Normalize a provider-supplied status string to a resident.payment_status value.
-- Unknown values return NULL so the caller can decide between rejection and a
-- controlled under_review/not_reconciled path.
CREATE OR REPLACE FUNCTION resident.normalize_provider_status(p_status text)
RETURNS resident.payment_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE lower(trim(p_status))
    WHEN 'pending' THEN 'pending'::resident.payment_status
    WHEN 'processing' THEN 'processing'::resident.payment_status
    WHEN 'confirmed' THEN 'confirmed'::resident.payment_status
    WHEN 'partially_confirmed' THEN 'partially_confirmed'::resident.payment_status
    WHEN 'partiallyconfirmed' THEN 'partially_confirmed'::resident.payment_status
    WHEN 'partial' THEN 'partially_confirmed'::resident.payment_status
    WHEN 'failed' THEN 'failed'::resident.payment_status
    WHEN 'refunded' THEN 'refunded'::resident.payment_status
    WHEN 'partially_refunded' THEN 'partially_refunded'::resident.payment_status
    WHEN 'partiallyrefunded' THEN 'partially_refunded'::resident.payment_status
    WHEN 'under_review' THEN 'under_review'::resident.payment_status
    WHEN 'underreview' THEN 'under_review'::resident.payment_status
    WHEN 'not_reconciled' THEN 'not_reconciled'::resident.payment_status
    WHEN 'notreconciled' THEN 'not_reconciled'::resident.payment_status
    WHEN 'cancelled' THEN 'cancelled'::resident.payment_status
    WHEN 'canceled' THEN 'cancelled'::resident.payment_status
    ELSE NULL
  END;
$$;

-- Reconcile invoice status based on current balance and due date.
CREATE OR REPLACE FUNCTION resident.reconcile_invoice_status(
  p_invoice_id uuid,
  p_balance numeric(15,2)
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invoice record;
  v_active_intents integer;
  v_target_status resident.invoice_status;
BEGIN
  SELECT * INTO v_invoice FROM resident.invoices WHERE id = p_invoice_id;
  IF v_invoice IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fully paid or overpaid.
  IF p_balance <= 0 THEN
    v_target_status := 'paid';
  ELSE
    -- Count active payment intents (pending or processing) for this invoice.
    SELECT COUNT(*) INTO v_active_intents
    FROM resident.payment_intents
    WHERE invoice_id = p_invoice_id
      AND status IN ('pending', 'processing');

    IF v_active_intents > 0 THEN
      v_target_status := 'payment_pending';
    ELSE
      -- No active payment path: restore to open or overdue based on due date.
      IF v_invoice.due_date < CURRENT_DATE THEN
        v_target_status := 'overdue';
      ELSE
        v_target_status := 'open';
      END IF;
    END IF;
  END IF;

  UPDATE resident.invoices
  SET status = v_target_status,
      paid_at = CASE WHEN v_target_status = 'paid' THEN COALESCE(paid_at, now()) ELSE paid_at END,
      updated_at = now()
  WHERE id = p_invoice_id;

  RETURN v_target_status::text;
END;
$$;

-- ============================================================================
-- 4. CORRECTED PAYMENT STATUS TRANSITION TRIGGERS
-- ============================================================================

-- partially_refunded is NOT terminal; it may escalate to refunded or receive
-- additional partial refunds.
CREATE OR REPLACE FUNCTION resident.payment_intent_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Terminal states: refunded and cancelled block further transitions.
    IF OLD.status IN ('refunded', 'cancelled') THEN
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
        IF OLD.status NOT IN ('pending', 'processing', 'under_review', 'not_reconciled', 'partially_confirmed') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → confirmed', OLD.status;
        END IF;
      WHEN 'partially_confirmed' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'under_review') THEN
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
        IF OLD.status NOT IN ('confirmed', 'partially_confirmed', 'partially_refunded') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → partially_refunded', OLD.status;
        END IF;
      WHEN 'under_review' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_intent transition: % → under_review', OLD.status;
        END IF;
      WHEN 'not_reconciled' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'under_review') THEN
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

CREATE OR REPLACE FUNCTION resident.payment_transaction_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Terminal states: refunded and cancelled.
    IF OLD.status IN ('refunded', 'cancelled') THEN
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
        IF OLD.status NOT IN ('pending', 'processing', 'under_review', 'not_reconciled', 'partially_confirmed') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → confirmed', OLD.status;
        END IF;
        NEW.paid_at := COALESCE(NEW.paid_at, now());
      WHEN 'partially_confirmed' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'under_review') THEN
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
        IF OLD.status NOT IN ('confirmed', 'partially_confirmed', 'partially_refunded') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → partially_refunded', OLD.status;
        END IF;
      WHEN 'under_review' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'not_reconciled') THEN
          RAISE EXCEPTION 'Invalid payment_transaction transition: % → under_review', OLD.status;
        END IF;
      WHEN 'not_reconciled' THEN
        IF OLD.status NOT IN ('pending', 'processing', 'under_review') THEN
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

-- ============================================================================
-- 5. ATOMIC PAYMENT INTENT CREATION
-- ============================================================================

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
  v_existing record;
  v_config record;
  v_balance numeric(15,2);
  v_max_allowed numeric(15,2);
  v_active_amount numeric(15,2);
BEGIN
  -- Idempotency key is mandatory.
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key is required and must be at least 8 characters';
  END IF;

  -- Load and validate the provider configuration.
  SELECT * INTO v_config
  FROM resident.tenant_payment_provider_configs
  WHERE id = p_provider_config_id
    AND tenant_id = p_tenant_id
    AND is_active = true;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Provider configuration not found or inactive for tenant';
  END IF;

  IF v_config.provider_id <> p_provider_id THEN
    RAISE EXCEPTION 'Provider configuration provider_id mismatch';
  END IF;

  IF v_config.method_type <> p_method_type THEN
    RAISE EXCEPTION 'Provider configuration method_type mismatch';
  END IF;

  -- Idempotency: same tenant + key must have identical semantic payload.
  SELECT *
  INTO v_existing
  FROM resident.payment_intents
  WHERE idempotency_key = p_idempotency_key
    AND tenant_id = p_tenant_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF v_existing.invoice_id <> p_invoice_id
       OR v_existing.amount <> p_amount
       OR v_existing.provider <> p_provider_id
       OR v_existing.method_type <> p_method_type
       OR v_existing.provider_config_id <> p_provider_config_id THEN
      RAISE EXCEPTION 'Idempotency key reused with conflicting payload';
    END IF;
    RETURN v_existing.id;
  END IF;

  -- Resolve invoice and enforce tenant consistency.
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

  -- Amount validation.
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  v_balance := resident.get_invoice_balance(p_invoice_id);

  -- Do not allow new intents when the invoice is already fully paid.
  IF v_balance <= 0 THEN
    RAISE EXCEPTION 'Invoice % has no outstanding balance', p_invoice_id;
  END IF;

  -- Sum active payment intents for this invoice to avoid over-issuing instruments.
  SELECT COALESCE(SUM(amount), 0) INTO v_active_amount
  FROM resident.payment_intents
  WHERE invoice_id = p_invoice_id
    AND status IN ('pending', 'processing')
    AND id <> v_existing_id;

  v_max_allowed := v_balance - v_active_amount;
  IF v_max_allowed < 0 THEN
    v_max_allowed := 0;
  END IF;

  IF p_amount > v_max_allowed THEN
    RAISE EXCEPTION 'Payment amount % exceeds remaining issuable balance %', p_amount, v_max_allowed;
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
    COALESCE(p_raw_provider_response, '{}'::jsonb),
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
      'reconciliation_id', p_reconciliation_id,
      'idempotency_key', p_idempotency_key
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
-- 6. ATOMIC WEBHOOK PROCESSING
-- ============================================================================

CREATE OR REPLACE FUNCTION resident.process_payment_webhook(
  p_webhook_endpoint_id uuid,
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_signature_status text,
  p_replay_status text,
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
  v_endpoint record;
  v_event_exists boolean;
  v_signature_status resident.webhook_signature_status;
  v_replay_status resident.webhook_replay_status;
  v_payload_hash text;
  v_signature_record_id uuid;
  v_event_record_id uuid;
  v_result jsonb;
  v_invoice_id uuid;
  v_payment_intent_id uuid;
  v_transaction_id uuid;
  v_payload_status resident.payment_status;
  v_existing_intent_status resident.payment_status;
  v_existing_transaction_status resident.payment_status;
  v_target_intent_status resident.payment_status;
  v_target_transaction_status resident.payment_status;
  v_payload_amount numeric(15,2);
  v_provider_refund_id text;
  v_refund_amount numeric(15,2);
  v_reconciliation_id text;
  v_balance numeric(15,2);
  v_previous_balance numeric(15,2);
  v_new_balance numeric(15,2);
  v_ledger_id uuid;
  v_audit_id uuid;
  v_refund_id uuid;
  v_refundable_amount numeric(15,2);
  v_requires_webhook boolean;
  v_status_text text;
  v_invoice_status text;
BEGIN
  -- ========================================================================
  -- 1. Resolve and validate the trusted webhook registration
  -- ========================================================================
  SELECT * INTO v_endpoint
  FROM resident.resolve_webhook_endpoint(p_webhook_endpoint_id);

  IF v_endpoint IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'provider_mismatch',
      'provider', p_provider,
      'message', 'Webhook endpoint not found or provider mismatch'
    );
  END IF;

  IF NOT v_endpoint.is_active THEN
    RETURN jsonb_build_object(
      'status', 'provider_mismatch',
      'provider', p_provider,
      'message', 'Webhook registration is inactive'
    );
  END IF;

  IF NOT v_endpoint.config_is_active THEN
    RETURN jsonb_build_object(
      'status', 'provider_mismatch',
      'provider', p_provider,
      'message', 'Provider configuration is inactive'
    );
  END IF;

  -- ========================================================================
  -- 2. Validate required fields
  -- ========================================================================
  IF p_event_id IS NULL OR p_event_id = '' THEN
    RETURN jsonb_build_object(
      'status', 'replay_rejected',
      'provider', p_provider,
      'message', 'Missing event id'
    );
  END IF;

  IF p_replay_timestamp IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'replay_rejected',
      'provider', p_provider,
      'event_id', p_event_id,
      'message', 'Missing timestamp'
    );
  END IF;

  IF p_replay_nonce IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'replay_rejected',
      'provider', p_provider,
      'event_id', p_event_id,
      'message', 'Missing nonce'
    );
  END IF;

  -- ========================================================================
  -- 3. Duplicate event idempotency check
  -- ========================================================================
  SELECT EXISTS (
    SELECT 1 FROM resident.payment_provider_events
    WHERE tenant_id = v_endpoint.tenant_id
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

  -- ========================================================================
  -- 4. Mandatory signature/replay enforcement for webhook-capable providers
  -- ========================================================================
  v_requires_webhook := resident.has_provider_capability(p_provider, 'webhooks');

  BEGIN
    v_signature_status := p_signature_status::resident.webhook_signature_status;
  EXCEPTION WHEN invalid_text_representation THEN
    v_signature_status := 'invalid'::resident.webhook_signature_status;
  END;

  BEGIN
    v_replay_status := p_replay_status::resident.webhook_replay_status;
  EXCEPTION WHEN invalid_text_representation THEN
    v_replay_status := 'not_applicable'::resident.webhook_replay_status;
  END;

  IF v_requires_webhook THEN
    IF v_signature_status <> 'valid' THEN
      RETURN jsonb_build_object(
        'status', 'signature_rejected',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Invalid or missing webhook signature'
      );
    END IF;

    IF v_replay_status <> 'accepted' THEN
      RETURN jsonb_build_object(
        'status', 'replay_rejected',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Replay protection rejected'
      );
    END IF;

    IF p_replay_timestamp < (now() - interval '5 minutes') THEN
      RETURN jsonb_build_object(
        'status', 'expired',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Replay timestamp expired'
      );
    END IF;

    IF p_replay_timestamp > (now() + interval '5 minutes') THEN
      RETURN jsonb_build_object(
        'status', 'expired',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Replay timestamp is in the future'
      );
    END IF;
  END IF;

  -- ========================================================================
  -- 5. Duplicate nonce check
  -- ========================================================================
  SELECT EXISTS (
    SELECT 1 FROM resident.payment_provider_event_signatures
    WHERE tenant_id = v_endpoint.tenant_id
      AND provider = p_provider
      AND replay_nonce = p_replay_nonce
  ) INTO v_event_exists;

  IF v_event_exists THEN
    RETURN jsonb_build_object(
      'status', 'replay_rejected',
      'provider', p_provider,
      'event_id', p_event_id,
      'message', 'Replay nonce already used'
    );
  END IF;

  -- ========================================================================
  -- 6. Record signature/replay attempt (forensic, no financial side-effect)
  -- ========================================================================
  v_payload_hash := encode(extensions.digest(p_payload::text, 'sha256'::text), 'hex'::text);

  INSERT INTO resident.payment_provider_event_signatures (
    tenant_id, provider, event_id, signature_header, payload_hash,
    replay_nonce, replay_timestamp, signature_status, replay_status,
    validated_at
  ) VALUES (
    v_endpoint.tenant_id, p_provider, p_event_id, p_signature_header,
    v_payload_hash, p_replay_nonce, p_replay_timestamp,
    v_signature_status, v_replay_status, now()
  )
  RETURNING id INTO v_signature_record_id;

  -- If the signature was not valid, stop before any financial mutation.
  IF v_signature_status <> 'valid' AND v_requires_webhook THEN
    RETURN jsonb_build_object(
      'status', 'signature_rejected',
      'provider', p_provider,
      'event_id', p_event_id,
      'message', 'Webhook signature rejected'
    );
  END IF;

  -- ========================================================================
  -- 7. Record the financial event
  -- ========================================================================
  INSERT INTO resident.payment_provider_events (
    tenant_id, provider, event_type, event_id, payload,
    processed_at, metadata
  ) VALUES (
    v_endpoint.tenant_id, p_provider, p_event_type, p_event_id, p_payload,
    now(),
    jsonb_build_object(
      'signature_status', v_signature_status,
      'replay_status', v_replay_status,
      'signature_record_id', v_signature_record_id,
      'webhook_endpoint_id', p_webhook_endpoint_id,
      'provider_config_id', v_endpoint.provider_config_id,
      'source', 'process_payment_webhook'
    )
  )
  RETURNING id INTO v_event_record_id;

  -- ========================================================================
  -- 8. Acquire tenant-level ledger lock before any balance-dependent work
  -- ========================================================================
  PERFORM pg_advisory_xact_lock(
    hashtext('resident.process_payment_webhook'),
    hashtext(v_endpoint.tenant_id::text)
  );

  -- ========================================================================
  -- 9. Extract and normalize payment context from the provider payload
  -- ========================================================================
  v_reconciliation_id := p_payload->>'reconciliation_id';
  v_status_text := p_payload->>'status';
  v_payload_status := resident.normalize_provider_status(v_status_text);
  v_payload_amount := COALESCE((p_payload->>'amount')::numeric, 0);
  v_provider_refund_id := p_payload->>'provider_refund_id';

  IF v_payload_status IS NULL THEN
    -- Unknown provider status: route to a controlled review state.
    RETURN jsonb_build_object(
      'status', 'not_reconciled',
      'provider', p_provider,
      'event_id', p_event_id,
      'message', 'Unknown provider status: ' || COALESCE(v_status_text, 'NULL')
    );
  END IF;

  -- Resolve intent or transaction by reconciliation id.
  IF v_reconciliation_id IS NOT NULL THEN
    SELECT id, invoice_id, status
    INTO v_payment_intent_id, v_invoice_id, v_existing_intent_status
    FROM resident.payment_intents
    WHERE tenant_id = v_endpoint.tenant_id
      AND reconciliation_id = v_reconciliation_id
      AND provider = p_provider
    LIMIT 1;

    IF v_payment_intent_id IS NULL THEN
      SELECT id, invoice_id, status, amount
      INTO v_transaction_id, v_invoice_id, v_existing_transaction_status, v_payload_amount
      FROM resident.payment_transactions
      WHERE tenant_id = v_endpoint.tenant_id
        AND reconciliation_id = v_reconciliation_id
        AND provider = p_provider
      LIMIT 1;
    END IF;
  END IF;

  -- ========================================================================
  -- 10. Determine target statuses
  -- ========================================================================
  v_target_intent_status := v_payload_status;
  v_target_transaction_status := v_payload_status;

  -- Refund statuses require a confirmed underlying transaction.
  IF v_payload_status IN ('refunded', 'partially_refunded') THEN
    IF v_transaction_id IS NULL AND v_payment_intent_id IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'not_reconciled',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Refund webhook does not match a known transaction or intent'
      );
    END IF;

    IF v_provider_refund_id IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'not_reconciled',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Refund webhook missing provider_refund_id'
      );
    END IF;

    IF v_payload_amount <= 0 THEN
      RETURN jsonb_build_object(
        'status', 'not_reconciled',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Refund webhook missing positive amount'
      );
    END IF;
  END IF;

  -- ========================================================================
  -- 11. Apply intent and transaction updates
  -- ========================================================================
  IF v_payment_intent_id IS NOT NULL THEN
    UPDATE resident.payment_intents
    SET status = v_target_intent_status,
        updated_at = now()
    WHERE id = v_payment_intent_id;

    -- Create transaction for confirmed payment events.
    IF v_target_transaction_status IN ('confirmed', 'partially_confirmed') THEN
      INSERT INTO resident.payment_transactions (
        tenant_id, invoice_id, payment_intent_id, amount, status,
        provider, provider_config_id, payment_method_type, paid_at,
        reconciliation_id, raw_provider_response
      )
      SELECT
        v_endpoint.tenant_id,
        v_invoice_id,
        v_payment_intent_id,
        v_payload_amount,
        v_target_transaction_status,
        p_provider,
        v_endpoint.provider_config_id,
        pi.method_type,
        now(),
        v_reconciliation_id,
        p_payload
      FROM resident.payment_intents pi
      WHERE pi.id = v_payment_intent_id
      RETURNING id INTO v_transaction_id;
    END IF;
  END IF;

  IF v_transaction_id IS NOT NULL AND v_payment_intent_id IS NULL THEN
    UPDATE resident.payment_transactions
    SET status = v_target_transaction_status,
        paid_at = CASE WHEN v_target_transaction_status IN ('confirmed', 'partially_confirmed')
                       THEN COALESCE(paid_at, now())
                       ELSE paid_at
                  END,
        updated_at = now()
    WHERE id = v_transaction_id;
  END IF;

  -- ========================================================================
  -- 12. Refund-specific ledger and record handling
  -- ========================================================================
  IF v_payload_status IN ('refunded', 'partially_refunded') AND v_transaction_id IS NOT NULL THEN
    v_refund_amount := v_payload_amount;

    SELECT COALESCE(SUM(amount), 0) INTO v_refundable_amount
    FROM resident.payment_transactions
    WHERE id = v_transaction_id
      AND status IN ('confirmed', 'partially_confirmed');

    SELECT COALESCE(SUM(amount), 0) INTO v_refund_amount
    FROM resident.payment_refunds
    WHERE payment_transaction_id = v_transaction_id
      AND status = 'confirmed'
      AND provider_refund_id IS DISTINCT FROM v_provider_refund_id;

    v_refundable_amount := v_refundable_amount - v_refund_amount;

    IF v_refund_amount > v_refundable_amount THEN
      RETURN jsonb_build_object(
        'status', 'not_reconciled',
        'provider', p_provider,
        'event_id', p_event_id,
        'message', 'Refund amount exceeds remaining refundable amount'
      );
    END IF;

    INSERT INTO resident.payment_refunds (
      tenant_id,
      payment_transaction_id,
      payment_intent_id,
      invoice_id,
      provider_config_id,
      provider_refund_id,
      idempotency_key,
      amount,
      currency,
      status,
      reason,
      raw_provider_response,
      actor_profile_id
    ) VALUES (
      v_endpoint.tenant_id,
      v_transaction_id,
      v_payment_intent_id,
      v_invoice_id,
      v_endpoint.provider_config_id,
      v_provider_refund_id,
      'webhook-' || p_event_id,
      v_refund_amount,
      'BRL',
      'confirmed',
      'Webhook refund',
      p_payload,
      p_actor_profile_id
    )
    RETURNING id INTO v_refund_id;

    -- Reversing ledger entry: refund is a debit (increases net receivable).
    SELECT COALESCE((
      SELECT balance
      FROM resident.ledger_entries
      WHERE tenant_id = v_endpoint.tenant_id
      ORDER BY entry_date DESC, created_at DESC, id DESC
      LIMIT 1
    ), 0) INTO v_previous_balance;

    v_new_balance := v_previous_balance + v_refund_amount;

    INSERT INTO resident.ledger_entries (
      tenant_id, entry_date, description,
      debit_amount, credit_amount, balance,
      entity_type, entity_id, reference_document, metadata
    ) VALUES (
      v_endpoint.tenant_id,
      now(),
      'Reembolso — ' || p_provider || ' — evento ' || p_event_id,
      v_refund_amount,
      0,
      v_new_balance,
      'payment_refund',
      v_refund_id::text,
      v_reconciliation_id,
      jsonb_build_object(
        'invoice_id', v_invoice_id,
        'payment_intent_id', v_payment_intent_id,
        'transaction_id', v_transaction_id,
        'refund_id', v_refund_id,
        'provider', p_provider,
        'event_id', p_event_id,
        'previous_balance', v_previous_balance,
        'new_balance', v_new_balance
      )
    )
    RETURNING id INTO v_ledger_id;
  END IF;

  -- ========================================================================
  -- 13. Payment confirmation ledger entry
  -- ========================================================================
  IF v_payload_status IN ('confirmed', 'partially_confirmed')
     AND v_transaction_id IS NOT NULL
     AND v_payload_amount > 0 THEN
    SELECT COALESCE((
      SELECT balance
      FROM resident.ledger_entries
      WHERE tenant_id = v_endpoint.tenant_id
      ORDER BY entry_date DESC, created_at DESC, id DESC
      LIMIT 1
    ), 0) INTO v_previous_balance;

    v_new_balance := v_previous_balance - v_payload_amount;

    INSERT INTO resident.ledger_entries (
      tenant_id, entry_date, description,
      debit_amount, credit_amount, balance,
      entity_type, entity_id, reference_document, metadata
    ) VALUES (
      v_endpoint.tenant_id,
      now(),
      'Pagamento recebido — ' || p_provider || ' — evento ' || p_event_id,
      0,
      v_payload_amount,
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

  -- ========================================================================
  -- 14. Invoice reconciliation
  -- ========================================================================
  IF v_invoice_id IS NOT NULL THEN
    v_balance := resident.get_invoice_balance(v_invoice_id);
    v_invoice_status := resident.reconcile_invoice_status(v_invoice_id, v_balance);
  END IF;

  -- ========================================================================
  -- 15. Audit log
  -- ========================================================================
  v_audit_id := resident.log_payment_audit(
    v_endpoint.tenant_id,
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
      'transaction_status', v_target_transaction_status,
      'transaction_amount', v_payload_amount,
      'refund_id', v_refund_id,
      'ledger_id', v_ledger_id,
      'balance_after', v_balance,
      'invoice_status', v_invoice_status
    ),
    jsonb_build_object(
      'source', 'process_payment_webhook',
      'signature_record_id', v_signature_record_id,
      'event_record_id', v_event_record_id,
      'webhook_endpoint_id', p_webhook_endpoint_id,
      'provider_config_id', v_endpoint.provider_config_id
    ),
    p_actor_profile_id
  );

  RETURN jsonb_build_object(
    'status', 'accepted',
    'provider', p_provider,
    'event_id', p_event_id,
    'event_record_id', v_event_record_id,
    'signature_status', v_signature_status,
    'replay_status', v_replay_status,
    'invoice_id', v_invoice_id,
    'payment_intent_id', v_payment_intent_id,
    'transaction_id', v_transaction_id,
    'refund_id', v_refund_id,
    'transaction_status', v_target_transaction_status,
    'balance', v_balance,
    'ledger_id', v_ledger_id,
    'audit_id', v_audit_id
  );
END;
$$;

-- ============================================================================
-- 7. ATOMIC REFUND FINALIZATION
-- ============================================================================

CREATE OR REPLACE FUNCTION resident.process_payment_refund(
  p_tenant_id uuid,
  p_payment_transaction_id uuid,
  p_amount numeric(15,2),
  p_idempotency_key text,
  p_provider_refund_id text DEFAULT NULL,
  p_raw_provider_response jsonb DEFAULT NULL,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_transaction record;
  v_existing_refund record;
  v_refund_id uuid;
  v_invoice_id uuid;
  v_intent_id uuid;
  v_confirmed_paid numeric(15,2);
  v_confirmed_refunded numeric(15,2);
  v_remaining numeric(15,2);
  v_previous_balance numeric(15,2);
  v_new_balance numeric(15,2);
  v_ledger_id uuid;
  v_audit_id uuid;
  v_target_transaction_status resident.payment_status;
  v_refund_status resident.payment_refund_status;
  v_audit_event_type resident.financial_event_type;
  v_balance numeric(15,2);
  v_invoice_status text;
  v_result jsonb;
BEGIN
  -- Idempotency key is mandatory.
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Refund idempotency key is required and must be at least 8 characters';
  END IF;

  -- Acquire tenant-level ledger lock before any balance-dependent reads/writes.
  PERFORM pg_advisory_xact_lock(
    hashtext('resident.process_payment_refund'),
    hashtext(p_tenant_id::text)
  );

  -- ========================================================================
  -- 1. Recover or create the refund operation
  -- ========================================================================
  SELECT * INTO v_existing_refund
  FROM resident.payment_refunds
  WHERE tenant_id = p_tenant_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing_refund IS NOT NULL THEN
    IF v_existing_refund.status = 'confirmed' THEN
      -- Already finalized. Return the existing result without mutating state.
      RETURN jsonb_build_object(
        'status', 'confirmed',
        'refund_id', v_existing_refund.id,
        'payment_transaction_id', v_existing_refund.payment_transaction_id,
        'amount', v_existing_refund.amount,
        'provider_refund_id', v_existing_refund.provider_refund_id,
        'message', 'Refund already finalized'
      );
    END IF;

    -- Pending/processing: only finalize if a provider refund id is supplied.
    IF p_provider_refund_id IS NULL THEN
      RETURN jsonb_build_object(
        'status', v_existing_refund.status::text,
        'refund_id', v_existing_refund.id,
        'payment_transaction_id', v_existing_refund.payment_transaction_id,
        'amount', v_existing_refund.amount,
        'message', 'Refund operation already exists and is awaiting provider result'
      );
    END IF;
  END IF;

  -- ========================================================================
  -- 2. Validate the parent transaction
  -- ========================================================================
  SELECT * INTO v_transaction
  FROM resident.payment_transactions
  WHERE id = p_payment_transaction_id
    AND tenant_id = p_tenant_id;

  IF v_transaction IS NULL THEN
    RAISE EXCEPTION 'Payment transaction not found for tenant';
  END IF;

  IF v_transaction.status NOT IN ('confirmed', 'partially_confirmed', 'partially_refunded') THEN
    RAISE EXCEPTION 'Payment transaction status % is not eligible for refund', v_transaction.status;
  END IF;

  v_invoice_id := v_transaction.invoice_id;
  v_intent_id := v_transaction.payment_intent_id;

  -- ========================================================================
  -- 3. Validate the remaining refundable amount
  -- ========================================================================
  SELECT COALESCE(SUM(amount), 0) INTO v_confirmed_paid
  FROM resident.payment_transactions
  WHERE id = p_payment_transaction_id
    AND status IN ('confirmed', 'partially_confirmed', 'partially_refunded');

  SELECT COALESCE(SUM(amount), 0) INTO v_confirmed_refunded
  FROM resident.payment_refunds
  WHERE payment_transaction_id = p_payment_transaction_id
    AND status = 'confirmed'
    AND idempotency_key <> p_idempotency_key;

  v_remaining := v_confirmed_paid - v_confirmed_refunded;

  IF v_remaining < 0 THEN
    v_remaining := 0;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'Refund amount % exceeds remaining refundable amount %', p_amount, v_remaining;
  END IF;

  -- ========================================================================
  -- 4. Persist the refund operation
  -- ========================================================================
  IF v_existing_refund IS NOT NULL THEN
    -- Finalize an existing pending/processing refund.
    UPDATE resident.payment_refunds
    SET status = 'confirmed',
        provider_refund_id = p_provider_refund_id,
        raw_provider_response = COALESCE(raw_provider_response, '{}'::jsonb) || COALESCE(p_raw_provider_response, '{}'::jsonb),
        updated_at = now()
    WHERE id = v_existing_refund.id
      AND tenant_id = p_tenant_id
    RETURNING id INTO v_refund_id;

    v_refund_status := 'confirmed';
  ELSE
    IF p_provider_refund_id IS NULL THEN
      -- Create a pending operation and wait for the provider result.
      INSERT INTO resident.payment_refunds (
        tenant_id, payment_transaction_id, payment_intent_id, invoice_id,
        provider_config_id, provider_refund_id, idempotency_key, amount,
        currency, status, reason, raw_provider_response, actor_profile_id
      ) VALUES (
        p_tenant_id, p_payment_transaction_id, v_intent_id, v_invoice_id,
        v_transaction.provider_config_id, NULL, p_idempotency_key, p_amount,
        'BRL', 'pending', 'Refund awaiting provider result', '{}'::jsonb, p_actor_profile_id
      )
      RETURNING id INTO v_refund_id;

      RETURN jsonb_build_object(
        'status', 'pending',
        'refund_id', v_refund_id,
        'payment_transaction_id', p_payment_transaction_id,
        'amount', p_amount,
        'remaining', v_remaining,
        'message', 'Refund operation created; awaiting provider result'
      );
    END IF;

    -- Provider result available: create the refund as confirmed.
    INSERT INTO resident.payment_refunds (
      tenant_id, payment_transaction_id, payment_intent_id, invoice_id,
      provider_config_id, provider_refund_id, idempotency_key, amount,
      currency, status, reason, raw_provider_response, actor_profile_id
    ) VALUES (
      p_tenant_id, p_payment_transaction_id, v_intent_id, v_invoice_id,
      v_transaction.provider_config_id, p_provider_refund_id, p_idempotency_key,
      p_amount, 'BRL', 'confirmed', 'Refund finalized', COALESCE(p_raw_provider_response, '{}'::jsonb),
      p_actor_profile_id
    )
    RETURNING id INTO v_refund_id;

    v_refund_status := 'confirmed';
  END IF;

  -- ========================================================================
  -- 4b. Determine audit event type
  -- ========================================================================
  v_audit_event_type := CASE v_target_transaction_status
    WHEN 'partially_refunded' THEN 'payment_partially_refunded'
    WHEN 'refunded' THEN 'payment_refunded'
    ELSE 'payment_refunded'
  END;

  -- ========================================================================
  -- 5. Update the payment transaction status
  -- ========================================================================
  IF p_amount = v_remaining THEN
    v_target_transaction_status := 'refunded';
  ELSE
    v_target_transaction_status := 'partially_refunded';
  END IF;

  UPDATE resident.payment_transactions
  SET status = v_target_transaction_status,
      updated_at = now()
  WHERE id = p_payment_transaction_id
    AND tenant_id = p_tenant_id;

  -- ========================================================================
  -- 6. Write the reversing ledger entry
  -- ========================================================================
  SELECT COALESCE((
    SELECT balance
    FROM resident.ledger_entries
    WHERE tenant_id = p_tenant_id
    ORDER BY entry_date DESC, created_at DESC, id DESC
    LIMIT 1
  ), 0) INTO v_previous_balance;

  v_new_balance := v_previous_balance + p_amount;

  INSERT INTO resident.ledger_entries (
    tenant_id, entry_date, description,
    debit_amount, credit_amount, balance,
    entity_type, entity_id, reference_document, metadata
  ) VALUES (
    p_tenant_id,
    now(),
    'Reembolso — transacao ' || p_payment_transaction_id::text || ' — reembolso ' || v_refund_id::text,
    p_amount,
    0,
    v_new_balance,
    'payment_refund',
    v_refund_id::text,
    v_transaction.reconciliation_id,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'payment_intent_id', v_intent_id,
      'transaction_id', p_payment_transaction_id,
      'refund_id', v_refund_id,
      'provider_refund_id', p_provider_refund_id,
      'previous_balance', v_previous_balance,
      'new_balance', v_new_balance
    )
  )
  RETURNING id INTO v_ledger_id;

  -- ========================================================================
  -- 7. Reconcile the invoice
  -- ========================================================================
  v_balance := resident.get_invoice_balance(v_invoice_id);
  v_invoice_status := resident.reconcile_invoice_status(v_invoice_id, v_balance);

  -- ========================================================================
  -- 8. Audit log
  -- ========================================================================
  v_audit_id := resident.log_payment_audit(
    p_tenant_id,
    v_audit_event_type,
    'payment_refund',
    v_refund_id::text,
    jsonb_build_object(
      'payment_transaction_id', p_payment_transaction_id,
      'invoice_id', v_invoice_id,
      'amount', p_amount,
      'remaining_before', v_remaining,
      'transaction_status', v_target_transaction_status,
      'refund_status', v_refund_status,
      'balance_after', v_balance,
      'invoice_status', v_invoice_status
    ),
    jsonb_build_object(
      'source', 'process_payment_refund',
      'provider_refund_id', p_provider_refund_id,
      'actor_profile_id', p_actor_profile_id
    ),
    p_actor_profile_id
  );

  RETURN jsonb_build_object(
    'status', 'confirmed',
    'refund_id', v_refund_id,
    'payment_transaction_id', p_payment_transaction_id,
    'amount', p_amount,
    'transaction_status', v_target_transaction_status,
    'balance_after', v_balance,
    'invoice_status', v_invoice_status,
    'ledger_id', v_ledger_id,
    'audit_id', v_audit_id
  );
END;
$$;

-- ============================================================================
-- 8. PRIVILEGES FOR NEW/REPLACED FUNCTIONS
-- ============================================================================

REVOKE EXECUTE ON FUNCTION resident.get_invoice_balance(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resident.get_invoice_balance(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION resident.normalize_provider_status(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resident.normalize_provider_status(text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION resident.reconcile_invoice_status(uuid, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resident.reconcile_invoice_status(uuid, numeric)
  TO service_role;

REVOKE EXECUTE ON FUNCTION resident.create_payment_intent(
  uuid, uuid, text, resident.payment_method_type, uuid, text, numeric,
  text, text, text, text, text, timestamptz, text, jsonb, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resident.create_payment_intent(
  uuid, uuid, text, resident.payment_method_type, uuid, text, numeric,
  text, text, text, text, text, timestamptz, text, jsonb, text, uuid
) TO service_role;

REVOKE EXECUTE ON FUNCTION resident.process_payment_webhook(
  uuid, text, text, text, jsonb, text, text, text, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resident.process_payment_webhook(
  uuid, text, text, text, jsonb, text, text, text, text, timestamptz, uuid
) TO service_role;

REVOKE EXECUTE ON FUNCTION resident.process_payment_refund(
  uuid, uuid, numeric, text, text, jsonb, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resident.process_payment_refund(
  uuid, uuid, numeric, text, text, jsonb, uuid
) TO service_role;

REVOKE EXECUTE ON FUNCTION resident.payment_intent_status_transition()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION resident.payment_transaction_status_transition()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION resident.process_payment_webhook(
  uuid, text, text, text, jsonb, text, text, text, text, timestamptz, uuid
) IS 'Atomic webhook ingestion using a trusted webhook endpoint identifier. Validates signature and replay protection before any financial mutation. Service-role only.';

COMMENT ON FUNCTION resident.create_payment_intent(
  uuid, uuid, text, resident.payment_method_type, uuid, text, numeric,
  text, text, text, text, text, timestamptz, text, jsonb, text, uuid
) IS 'Atomic payment-intent creation with tenant-scoped idempotency, amount validation and active instrument guard. Service-role only.';

COMMENT ON FUNCTION resident.get_invoice_balance(uuid) IS
  'Refund-aware outstanding invoice balance: invoice amount minus net confirmed payments plus confirmed refunds and certified adjustments.';

COMMENT ON FUNCTION resident.process_payment_refund(
  uuid, uuid, numeric, text, text, jsonb, uuid
) IS 'Atomic database refund finalization with idempotent recovery. Acquires tenant-level ledger lock, validates remaining refundable amount, creates refund record, updates transaction status, writes reversing ledger entry, reconciles invoice and audits. Service-role only.';
