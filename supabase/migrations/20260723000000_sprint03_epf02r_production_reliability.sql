-- Sprint 3 EPF-02R — Production Reliability Patch
-- Resolves certification findings M-01 (transaction safety), idempotency, and concurrency.
--
-- Adds:
--   1. process_water_billing() — atomic PostgreSQL function replacing 4 sequential writes
--   2. Advisory lock on billing_cycle_id to prevent concurrent execution
--   3. Document-number-based idempotency to prevent duplicate invoices
--
-- No schema changes. No new tables, enums, or columns. No EPF-01 modifications.

-- ============================================================================
-- FUNCTION: process_water_billing
-- ============================================================================
-- Atomic billing execution. All 4 write operations (invoice, invoice_items,
-- ledger_entries, financial_audit_log) succeed or fail together inside a
-- single transaction boundary enforced by the PL/pgSQL function body.
--
-- Idempotency: checks for existing invoice by document_number before inserting.
-- Returns { status: "duplicate", invoice_id } if already processed.
--
-- Concurrency: acquires a transaction-level advisory lock keyed on
-- billing_cycle_id. Only one execution per cycle can proceed at a time.
-- Lock is automatically released on commit or rollback.

CREATE OR REPLACE FUNCTION resident.process_water_billing(
  p_tenant_id         uuid,
  p_billing_account_id uuid,
  p_billing_cycle_id  uuid,
  p_document_number   text,
  p_amount            numeric(15,2),
  p_due_date          date,
  p_reference_period  text,
  p_meter_id          uuid,
  p_meter_number      text,
  p_consumption       numeric(12,3),
  p_tariff_result     jsonb DEFAULT NULL,
  p_actor_profile_id  uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invoice_id          uuid;
  v_existing_invoice_id uuid;
  v_previous_balance    numeric(15,2);
  v_lock_key            bigint;
  v_description         text;
  v_band_descriptions   text;
  v_unit_price          numeric(15,4);
  v_description_parts   text[];
  v_band                jsonb;
BEGIN
  -- ==========================================================================
  -- CONCURRENCY: advisory lock on billing cycle
  -- ==========================================================================
  -- Key derived from billing_cycle_id ensures only one concurrent execution
  -- per cycle. pg_advisory_xact_lock is transaction-scoped — released on
  -- commit or rollback, no explicit unlock needed.
  v_lock_key := abs(hashtext('water_billing:' || p_billing_cycle_id::text)) % 2147483647;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- ==========================================================================
  -- IDEMPOTENCY: check for existing invoice
  -- ==========================================================================
  SELECT id INTO v_existing_invoice_id
  FROM resident.invoices
  WHERE tenant_id = p_tenant_id
    AND document_number = p_document_number
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing_invoice_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'invoice_id', v_existing_invoice_id,
      'document_number', p_document_number,
      'message', 'Invoice already exists for this cycle and meter'
    );
  END IF;

  -- ==========================================================================
  -- CALCULATIONS
  -- ==========================================================================
  -- Build description from tariff bands
  v_description_parts := ARRAY[]::text[];
  v_description := 'Consumo de Água — Hidrômetro ' || p_meter_number
    || ' — ' || p_consumption || ' m³';

  IF p_tariff_result IS NOT NULL AND p_tariff_result ? 'bands' THEN
    FOR v_band IN SELECT * FROM jsonb_array_elements(p_tariff_result->'bands')
    LOOP
      v_description_parts := array_append(v_description_parts,
        (v_band->>'consumption') || ' m³ × R$ ' || (v_band->>'unit_price')
        || '/m³ = R$ ' || (v_band->>'charge'));
    END LOOP;
    IF array_length(v_description_parts, 1) > 0 THEN
      v_description := v_description || ' (' || array_to_string(v_description_parts, '; ') || ')';
    END IF;
  END IF;

  -- Unit price: average price per m³
  IF p_consumption > 0 THEN
    v_unit_price := ROUND((p_amount / p_consumption)::numeric, 4);
  ELSE
    v_unit_price := p_amount;
  END IF;

  -- ==========================================================================
  -- ATOMIC WRITES (all or nothing)
  -- ==========================================================================

  -- 1. Invoice
  INSERT INTO resident.invoices (
    tenant_id, billing_account_id, billing_cycle_id,
    document_number, amount, due_date, status, issued_at, metadata
  ) VALUES (
    p_tenant_id, p_billing_account_id, p_billing_cycle_id,
    p_document_number, p_amount, p_due_date, 'issued', now(),
    jsonb_build_object(
      'source', 'water_billing',
      'meter_id', p_meter_id,
      'meter_number', p_meter_number,
      'consumption', p_consumption,
      'cycle_reference', p_reference_period
    )
  )
  RETURNING id INTO v_invoice_id;

  -- 2. Invoice item
  INSERT INTO resident.invoice_items (
    tenant_id, invoice_id, description,
    category, quantity, unit_price, amount, sort_order, metadata
  ) VALUES (
    p_tenant_id, v_invoice_id, v_description, 'water',
    p_consumption, v_unit_price, p_amount, 1,
    jsonb_build_object(
      'meter_id', p_meter_id,
      'meter_number', p_meter_number,
      'tariff_result', p_tariff_result,
      'source', 'process_water_billing'
    )
  );

  -- 3. Ledger entry
  SELECT COALESCE(MAX(balance), 0) INTO v_previous_balance
  FROM resident.ledger_entries
  WHERE tenant_id = p_tenant_id;

  INSERT INTO resident.ledger_entries (
    tenant_id, entry_date, description,
    debit_amount, credit_amount, balance,
    entity_type, entity_id, reference_document, metadata
  ) VALUES (
    p_tenant_id, now(),
    'Fatura de água — ' || p_document_number || ' — ' || p_meter_number
      || ' — ' || p_reference_period,
    p_amount, 0, v_previous_balance + p_amount,
    'water_billing', v_invoice_id, p_document_number,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'billing_cycle_id', p_billing_cycle_id,
      'meter_id', p_meter_id,
      'meter_number', p_meter_number,
      'consumption', p_consumption
    )
  );

  -- 4. Financial audit
  PERFORM resident.log_financial_audit(
    p_tenant_id,
    'invoice_created',
    'water_billing',
    v_invoice_id::text,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'document_number', p_document_number,
      'amount', p_amount,
      'meter_id', p_meter_id,
      'meter_number', p_meter_number,
      'consumption', p_consumption,
      'tariff_result', p_tariff_result
    ),
    jsonb_build_object(
      'source', 'process_water_billing',
      'billing_cycle_id', p_billing_cycle_id,
      'reference_period', p_reference_period
    )
  );

  -- ==========================================================================
  -- RETURN
  -- ==========================================================================
  RETURN jsonb_build_object(
    'status', 'created',
    'invoice_id', v_invoice_id,
    'document_number', p_document_number,
    'amount', p_amount,
    'meter_id', p_meter_id,
    'meter_number', p_meter_number,
    'consumption', p_consumption
  );
END;
$$;

COMMENT ON FUNCTION resident.process_water_billing(
  uuid, uuid, uuid, text, numeric, date, text, uuid, text, numeric, jsonb, uuid
) IS 'Atomic water billing execution. Acquires advisory lock on billing_cycle_id for concurrency safety. Checks document_number for idempotency. All writes (invoice, items, ledger, audit) succeed or rollback together.';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION resident.process_water_billing(
  uuid, uuid, uuid, text, numeric, date, text, uuid, text, numeric, jsonb, uuid
) TO authenticated;
