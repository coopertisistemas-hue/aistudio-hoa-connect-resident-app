-- Sprint 3 EPF-02R2 — Final Security and Ledger Correctness Patch
-- Closes certification findings C-1 through C-5.
--
-- Fixes:
--   C-1  process_water_billing() privilege exposure
--   C-2  tenant-scoped ledger concurrency protection
--   C-3  latest ledger balance semantics
--   C-4  audit actor attribution
--   C-5  advisory lock integer-overflow edge case
--
-- No billing domain redesign. No new features. No schema changes.

-- ============================================================================
-- FUNCTION: process_water_billing
-- ============================================================================
-- Atomic water-billing execution. All writes (invoice, invoice_items,
-- ledger_entries, financial_audit_log) succeed or rollback together inside a
-- single transaction boundary enforced by the PL/pgSQL function body.
--
-- Execution path: service-role only. Direct invocation by anon, authenticated,
-- or PUBLIC is explicitly denied.
--
-- Concurrency: transaction-scoped tenant-level advisory lock. Concurrent
-- billing cycles for the same tenant serialize safely; ledger balances are
-- never calculated from the same prior state.
--
-- Idempotency: checks for existing invoice by document_number before inserting.
-- Returns { status: "duplicate", invoice_id } if already processed.
--
-- Atomicity: per meter. The Edge Function calls this function once per meter,
-- so a failure for one meter rolls back only that meter's writes. Other meters
-- in the same cycle may still succeed (partial success across meters).

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
  v_new_balance         numeric(15,2);
  v_description         text;
  v_band_descriptions   text;
  v_unit_price          numeric(15,4);
  v_description_parts   text[];
  v_band                jsonb;
  v_audit_id            uuid;
BEGIN
  -- ==========================================================================
  -- CONCURRENCY: transaction-scoped tenant-level advisory lock
  -- ==========================================================================
  -- Uses two signed 32-bit integer keys derived from a fixed namespace and the
  -- tenant id. hashtext() returns an int4; pg_advisory_xact_lock(int4, int4)
  -- accepts the full signed range, so no abs() and no INT_MIN overflow can
  -- occur. The lock is released automatically on commit or rollback.
  PERFORM pg_advisory_xact_lock(
    hashtext('resident.process_water_billing'),
    hashtext(p_tenant_id::text)
  );

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
  -- LATEST LEDGER BALANCE (not historical maximum)
  -- ==========================================================================
  -- Deterministic latest-entry ordering: entry_date DESC, then created_at DESC,
  -- then id DESC. This is consistent with EPF-01 ledger semantics where the
  -- ledger is append-only and the most recent entry carries the current balance.
  SELECT COALESCE(balance, 0) INTO v_previous_balance
  FROM resident.ledger_entries
  WHERE tenant_id = p_tenant_id
  ORDER BY entry_date DESC, created_at DESC, id DESC
  LIMIT 1;

  v_new_balance := v_previous_balance + p_amount;

  -- ==========================================================================
  -- ATOMIC WRITES (all or nothing for this meter)
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
  INSERT INTO resident.ledger_entries (
    tenant_id, entry_date, description,
    debit_amount, credit_amount, balance,
    entity_type, entity_id, reference_document, metadata
  ) VALUES (
    p_tenant_id, now(),
    'Fatura de água — ' || p_document_number || ' — ' || p_meter_number
      || ' — ' || p_reference_period,
    p_amount, 0, v_new_balance,
    'water_billing', v_invoice_id, p_document_number,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'billing_cycle_id', p_billing_cycle_id,
      'meter_id', p_meter_id,
      'meter_number', p_meter_number,
      'consumption', p_consumption,
      'previous_balance', v_previous_balance
    )
  );

  -- 4. Financial audit (direct insert — actor provided by Edge Function)
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
    p_actor_profile_id,
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
      'tariff_result', p_tariff_result,
      'previous_balance', v_previous_balance,
      'new_balance', v_new_balance
    ),
    jsonb_build_object(
      'source', 'process_water_billing',
      'billing_cycle_id', p_billing_cycle_id,
      'reference_period', p_reference_period,
      'actor_profile_id', p_actor_profile_id
    )
  )
  RETURNING id INTO v_audit_id;

  -- ==========================================================================
  -- RETURN
  -- ==========================================================================
  RETURN jsonb_build_object(
    'status', 'created',
    'invoice_id', v_invoice_id,
    'audit_id', v_audit_id,
    'document_number', p_document_number,
    'amount', p_amount,
    'meter_id', p_meter_id,
    'meter_number', p_meter_number,
    'consumption', p_consumption,
    'previous_balance', v_previous_balance,
    'new_balance', v_new_balance
  );
END;
$$;

COMMENT ON FUNCTION resident.process_water_billing(
  uuid, uuid, uuid, text, numeric, date, text, uuid, text, numeric, jsonb, uuid
) IS 'Atomic water-billing execution. SERVICE-ROLE ONLY. Acquires a transaction-scoped tenant-level advisory lock for concurrency safety. Uses the latest ledger balance (not MAX). Checks document_number for idempotency. All writes (invoice, items, ledger, audit) succeed or rollback together. Audit actor is supplied by the caller.';

-- ============================================================================
-- GRANTS: service-role-only execution
-- ============================================================================

REVOKE EXECUTE ON FUNCTION resident.process_water_billing(
  uuid, uuid, uuid, text, numeric, date, text, uuid, text, numeric, jsonb, uuid
) FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA resident TO service_role;

GRANT EXECUTE ON FUNCTION resident.process_water_billing(
  uuid, uuid, uuid, text, numeric, date, text, uuid, text, numeric, jsonb, uuid
) TO service_role;
