-- ============================================================================
-- EPF-03R — Webhook Security and Financial Correctness Tests
-- ============================================================================
-- Validates:
--   • Trusted endpoint identity resolution
--   • Mandatory signature/replay enforcement
--   • Duplicate event idempotency
--   • Tenant-scoped replay nonce
--   • Atomic financial mutation (event, transaction, ledger, audit)
--   • No mutation on invalid signature
--
-- Run after: supabase db reset

BEGIN;

SET LOCAL ROLE postgres;

DO $$
DECLARE
  v_tenant_id          uuid := 'f1111111-1111-1111-1111-111111111111';
  v_property_id        uuid := 'f2222222-2222-2222-2222-222222222222';
  v_profile_id         uuid := 'f3333333-3333-3333-3333-333333333333';
  v_user_id            uuid := 'f4444444-4444-4444-4444-444444444444';
  v_billing_account_id uuid := 'f5555555-5555-5555-5555-555555555555';
  v_billing_cycle_id   uuid := 'f6666666-6666-6666-6666-666666666666';
  v_invoice_id         uuid := 'f7777777-7777-7777-7777-777777777777';
  v_config_id          uuid := 'f8888888-8888-8888-8888-888888888888';
  v_webhook_id         uuid;
  v_endpoint_id          uuid;
  v_webhook_secret_id  uuid;
  v_intent_id          uuid;
  v_result             jsonb;
  v_count              integer;
  v_balance            numeric(15,2);
  v_invoice_status     text;
  v_payload            jsonb;
  v_signature          text;
  v_payload_hash       text;
BEGIN
  -- Cleanup
  DELETE FROM resident.payment_provider_event_signatures WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_provider_events WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_webhooks WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.tenant_payment_provider_configs WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_transactions WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_intents WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_refunds WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.financial_audit_log WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.ledger_entries WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.invoice_items WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.invoices WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.billing_cycles WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.billing_accounts WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.residence_members WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.properties WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.tenant_members WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.profiles WHERE id = v_profile_id;
  DELETE FROM auth.identities WHERE user_id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
  DELETE FROM resident.tenants WHERE id = v_tenant_id;
  DELETE FROM vault.secrets WHERE name LIKE 'epf03r-webhook-%';

  -- Setup
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'epf03r-wh@test.local', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', 'epf03r-wh@test.local'), 'email', v_user_id::text, now(), now(), now());

  INSERT INTO resident.tenants (id, legal_name, display_name, slug, status)
  VALUES (v_tenant_id, 'EPF-03R Webhook Test', 'EPF-03R WH', 'epf03r-wh', 'active');

  INSERT INTO resident.profiles (id, user_id, full_name, preferred_name, status, locale, timezone)
  VALUES (v_profile_id, v_user_id, 'EPF-03R Webhook Operator', 'Operator', 'active', 'pt-BR', 'America/Sao_Paulo');

  INSERT INTO resident.tenant_members (id, tenant_id, profile_id, role, status)
  VALUES (gen_random_uuid(), v_tenant_id, v_profile_id, 'association_operator', 'active');

  INSERT INTO resident.properties (id, tenant_id, label, nickname, address_line1, city, state, unit_identifier, status)
  VALUES (v_property_id, v_tenant_id, 'Apto 101', 'Apto 101', 'Rua Test', 'Curitiba', 'PR', '101', 'active');

  INSERT INTO resident.billing_accounts (id, tenant_id, property_id, status)
  VALUES (v_billing_account_id, v_tenant_id, v_property_id, 'active');

  INSERT INTO resident.billing_cycles (id, tenant_id, billing_account_id, cycle_start, cycle_end, due_date, reference_period, status)
  VALUES (v_billing_cycle_id, v_tenant_id, v_billing_account_id, CURRENT_DATE - 30, CURRENT_DATE - 1, CURRENT_DATE + 5, '2026/07', 'open');

  INSERT INTO resident.invoices (id, tenant_id, billing_account_id, billing_cycle_id, document_number, amount, due_date, status)
  VALUES (v_invoice_id, v_tenant_id, v_billing_account_id, v_billing_cycle_id, 'DOC-WH-001', 100.00, CURRENT_DATE + 5, 'open');

  INSERT INTO resident.tenant_payment_provider_configs (
    id, tenant_id, provider_id, environment, method_type, is_active, is_default
  ) VALUES (v_config_id, v_tenant_id, 'mock', 'sandbox', 'pix', true, true);

  INSERT INTO resident.payment_intents (
    id, tenant_id, invoice_id, amount, status, provider, method_type,
    provider_payment_intent_id, reconciliation_id, idempotency_key, provider_config_id
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_invoice_id, 100.00, 'pending', 'mock', 'pix',
    'mock-pix-wh-001', 'rec-wh-001', 'idemp-wh-001', v_config_id
  )
  RETURNING id INTO v_intent_id;

  -- Create webhook registration and secret.
  v_webhook_secret_id := vault.create_secret('wh-secret-mock-001', 'epf03r-webhook-mock-001', 'Webhook secret');

  INSERT INTO resident.payment_webhooks (
    tenant_id, provider_config_id, endpoint_url, secret_id, event_types, is_active
  ) VALUES (
    v_tenant_id, v_config_id, 'https://mock.hoa-connect.local/webhook', v_webhook_secret_id,
    ARRAY['payment.confirmed'], true
  )
  RETURNING id, endpoint_id INTO v_webhook_id, v_endpoint_id;

  -- Compute HMAC-SHA256 signature for a valid payload.
  v_payload := jsonb_build_object(
    'reconciliation_id', 'rec-wh-001',
    'status', 'confirmed',
    'amount', 100.00
  );
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'::text), 'hex'::text);
  v_signature := encode(extensions.hmac(v_payload_hash::bytea, 'wh-secret-mock-001'::bytea, 'sha256'::text), 'hex'::text);

  -- =======================================================================
  -- WH-01: Valid webhook creates event, transaction, ledger, audit
  -- =======================================================================
  SET LOCAL ROLE service_role;
  v_result := resident.process_payment_webhook(
    v_endpoint_id,
    'mock',
    'evt-wh-001',
    'payment.confirmed',
    v_payload,
    'valid',
    'accepted',
    v_signature,
    'nonce-wh-001',
    now()::timestamptz,
    v_profile_id
  );

  IF (v_result->>'status') <> 'accepted' THEN
    RAISE EXCEPTION 'WH-01 FAIL: expected accepted, got %', v_result;
  END IF;

  SELECT COUNT(*) INTO v_count FROM resident.payment_provider_events
  WHERE tenant_id = v_tenant_id AND event_id = 'evt-wh-001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'WH-01 FAIL: expected 1 provider event, got %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM resident.payment_provider_event_signatures
  WHERE tenant_id = v_tenant_id AND event_id = 'evt-wh-001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'WH-01 FAIL: expected 1 signature record, got %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM resident.payment_transactions
  WHERE tenant_id = v_tenant_id AND reconciliation_id = 'rec-wh-001' AND status = 'confirmed';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'WH-01 FAIL: expected 1 confirmed transaction, got %', v_count;
  END IF;

  v_balance := resident.get_invoice_balance(v_invoice_id);
  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'WH-01 FAIL: expected invoice balance 0, got %', v_balance;
  END IF;

  SELECT status INTO v_invoice_status FROM resident.invoices WHERE id = v_invoice_id;
  IF v_invoice_status <> 'paid' THEN
    RAISE EXCEPTION 'WH-01 FAIL: expected invoice paid, got %', v_invoice_status;
  END IF;

  SELECT COUNT(*) INTO v_count FROM resident.financial_audit_log
  WHERE tenant_id = v_tenant_id AND action = 'webhook_received';
  IF v_count < 1 THEN
    RAISE EXCEPTION 'WH-01 FAIL: expected webhook audit record, got %', v_count;
  END IF;

  RAISE NOTICE 'WH-01 PASS: valid webhook creates event, transaction, ledger, audit';

  -- =======================================================================
  -- WH-02: Duplicate event returns duplicate
  -- =======================================================================
  v_result := resident.process_payment_webhook(
    v_endpoint_id, 'mock', 'evt-wh-001', 'payment.confirmed', '{}'::jsonb,
    'valid', 'accepted', v_signature, 'nonce-wh-002', now()::timestamptz, v_profile_id
  );
  IF (v_result->>'status') <> 'duplicate' THEN
    RAISE EXCEPTION 'WH-02 FAIL: expected duplicate, got %', v_result;
  END IF;
  RAISE NOTICE 'WH-02 PASS: duplicate event returns duplicate';

  -- =======================================================================
  -- WH-03: Invalid signature rejected
  -- =======================================================================
  v_result := resident.process_payment_webhook(
    v_endpoint_id, 'mock', 'evt-wh-003', 'payment.confirmed', v_payload,
    'invalid', 'accepted', 'bad-signature', 'nonce-wh-003', now()::timestamptz, v_profile_id
  );
  IF (v_result->>'status') <> 'signature_rejected' THEN
    RAISE EXCEPTION 'WH-03 FAIL: expected signature_rejected, got %', v_result;
  END IF;

  SELECT COUNT(*) INTO v_count FROM resident.payment_provider_events
  WHERE tenant_id = v_tenant_id AND event_id = 'evt-wh-003';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'WH-03 FAIL: provider event created for invalid signature';
  END IF;

  SELECT COUNT(*) INTO v_count FROM resident.payment_transactions
  WHERE tenant_id = v_tenant_id AND reconciliation_id = 'rec-wh-001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'WH-03 FAIL: unexpected transaction mutation for invalid signature';
  END IF;
  RAISE NOTICE 'WH-03 PASS: invalid signature rejected, no financial mutation';

  -- =======================================================================
  -- WH-04: Missing nonce rejected
  -- =======================================================================
  v_result := resident.process_payment_webhook(
    v_endpoint_id, 'mock', 'evt-wh-004', 'payment.confirmed', v_payload,
    'valid', 'accepted', v_signature, null, now()::timestamptz, v_profile_id
  );
  IF (v_result->>'status') <> 'replay_rejected' THEN
    RAISE EXCEPTION 'WH-04 FAIL: expected replay_rejected for missing nonce, got %', v_result;
  END IF;
  RAISE NOTICE 'WH-04 PASS: missing nonce rejected';

  -- =======================================================================
  -- WH-05: Expired timestamp rejected
  -- =======================================================================
  v_result := resident.process_payment_webhook(
    v_endpoint_id, 'mock', 'evt-wh-005', 'payment.confirmed', v_payload,
    'valid', 'accepted', v_signature, 'nonce-wh-005', (now() - interval '10 minutes')::timestamptz, v_profile_id
  );
  IF (v_result->>'status') <> 'expired' THEN
    RAISE EXCEPTION 'WH-05 FAIL: expected expired, got %', v_result;
  END IF;
  RAISE NOTICE 'WH-05 PASS: expired timestamp rejected';

  -- =======================================================================
  -- WH-06: Duplicate nonce rejected
  -- =======================================================================
  v_result := resident.process_payment_webhook(
    v_endpoint_id, 'mock', 'evt-wh-006', 'payment.confirmed', v_payload,
    'valid', 'accepted', v_signature, 'nonce-wh-001', now()::timestamptz, v_profile_id
  );
  IF (v_result->>'status') <> 'replay_rejected' THEN
    RAISE EXCEPTION 'WH-06 FAIL: expected replay_rejected for duplicate nonce, got %', v_result;
  END IF;
  RAISE NOTICE 'WH-06 PASS: duplicate nonce rejected';

  -- =======================================================================
  -- WH-07: Tenant-scoped nonce — tenant A nonce does not block tenant B
  -- =======================================================================
  DECLARE
    v_tenant_b uuid := 'f9999999-9999-9999-9999-999999999999';
    v_config_b uuid := 'faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    v_endpoint_b uuid;
    v_secret_b uuid;
  BEGIN
    -- Tenant setup requires postgres role; the webhook call uses service_role.
    SET LOCAL ROLE postgres;

    INSERT INTO resident.tenants (id, legal_name, display_name, slug, status)
    VALUES (v_tenant_b, 'EPF-03R Webhook Tenant B', 'EPF-03R WH-B', 'epf03r-wh-b', 'active');

    INSERT INTO resident.tenant_payment_provider_configs (
      id, tenant_id, provider_id, environment, method_type, is_active, is_default
    ) VALUES (v_config_b, v_tenant_b, 'mock', 'sandbox', 'pix', true, true);

    v_secret_b := vault.create_secret('wh-secret-b', 'epf03r-webhook-mock-b', 'Webhook secret B');

    INSERT INTO resident.payment_webhooks (
      tenant_id, provider_config_id, endpoint_url, secret_id, event_types, is_active
    ) VALUES (v_tenant_b, v_config_b, 'https://mock-b.hoa-connect.local/webhook', v_secret_b, ARRAY['payment.confirmed'], true)
    RETURNING endpoint_id INTO v_endpoint_b;

    SET LOCAL ROLE service_role;

    v_result := resident.process_payment_webhook(
      v_endpoint_b, 'mock', 'evt-wh-b-001', 'payment.confirmed', v_payload,
      'valid', 'accepted', 'irrelevant', 'nonce-wh-001', now()::timestamptz, null
    );
    IF (v_result->>'status') <> 'accepted' THEN
      RAISE EXCEPTION 'WH-07 FAIL: tenant B nonce blocked by tenant A nonce: %', v_result;
    END IF;
    RAISE NOTICE 'WH-07 PASS: tenant-scoped nonce allows same nonce across tenants';
  END;

  RAISE NOTICE 'EPF-03R WEBHOOK TESTS COMPLETE';
END $$;

ROLLBACK;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tests:
--   WH-01: valid webhook end-to-end
--   WH-02: duplicate event returns duplicate
--   WH-03: invalid signature rejected, no financial mutation
--   WH-04: missing nonce rejected
--   WH-05: expired timestamp rejected
--   WH-06: duplicate nonce rejected
--   WH-07: tenant-scoped nonce isolation
-- ============================================================================
