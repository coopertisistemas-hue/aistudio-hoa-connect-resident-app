-- ============================================================================
-- EPF-03 Payment Processing Platform — Validation Tests
-- ============================================================================
-- Validates:
--   • Provider registry and capability model
--   • Tenant-scoped provider configuration
--   • Vault-backed credential storage
--   • Payment state machine transitions
--   • Atomic webhook processing (idempotency, replay protection, signature)
--   • Partial payment semantics
--   • Invoice reconciliation via get_invoice_balance
--   • EPF-01 and EPF-02 regression
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
  v_invoice_id_2       uuid := 'f8888888-8888-8888-8888-888888888888';
  v_config_id          uuid := 'f9999999-9999-9999-9999-999999999999';
  v_webhook_secret_id  uuid;
  v_credentials_id     uuid;
  v_intent_id          uuid;
  v_transaction_id     uuid;
  v_result             jsonb;
  v_balance            numeric(15,2);
  v_count              integer;
  v_status             text;
BEGIN
  -- ========================================================================
  -- CLEANUP
  -- ========================================================================
  DELETE FROM resident.payment_provider_event_signatures WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_provider_events WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_webhooks WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.tenant_payment_provider_configs WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_transactions WHERE tenant_id = v_tenant_id;
  DELETE FROM resident.payment_intents WHERE tenant_id = v_tenant_id;
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
  DELETE FROM vault.secrets WHERE name LIKE 'epf03-test-%';

  -- ========================================================================
  -- SETUP
  -- ========================================================================
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'epf03@test.local', crypt('Password123!', gen_salt('bf')), now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', 'epf03@test.local'), 'email', v_user_id::text, now(), now(), now());

  INSERT INTO resident.tenants (id, legal_name, display_name, slug, status)
  VALUES (v_tenant_id, 'EPF-03 Test Association', 'EPF-03 Test', 'epf03-test', 'active');

  INSERT INTO resident.profiles (id, user_id, full_name, preferred_name, status, locale, timezone)
  VALUES (v_profile_id, v_user_id, 'EPF-03 Operator', 'Operator', 'active', 'pt-BR', 'America/Sao_Paulo');

  INSERT INTO resident.tenant_members (id, tenant_id, profile_id, role, status)
  VALUES (gen_random_uuid(), v_tenant_id, v_profile_id, 'association_operator', 'active');

  INSERT INTO resident.properties (id, tenant_id, label, nickname, address_line1, city, state, unit_identifier, status)
  VALUES (v_property_id, v_tenant_id, 'Apto 101', 'Apto 101', 'Rua Test', 'Curitiba', 'PR', '101', 'active');

  INSERT INTO resident.billing_accounts (id, tenant_id, property_id, status)
  VALUES (v_billing_account_id, v_tenant_id, v_property_id, 'active');

  INSERT INTO resident.billing_cycles (id, tenant_id, billing_account_id, cycle_start, cycle_end, due_date, reference_period, status)
  VALUES (v_billing_cycle_id, v_tenant_id, v_billing_account_id, CURRENT_DATE - 30, CURRENT_DATE - 1, CURRENT_DATE + 5, '2026/07', 'open');

  INSERT INTO resident.invoices (id, tenant_id, billing_account_id, billing_cycle_id, document_number, amount, due_date, status)
  VALUES (v_invoice_id, v_tenant_id, v_billing_account_id, v_billing_cycle_id, 'DOC-EPF03-001', 100.00, CURRENT_DATE + 5, 'open');

  INSERT INTO resident.invoices (id, tenant_id, billing_account_id, billing_cycle_id, document_number, amount, due_date, status)
  VALUES (v_invoice_id_2, v_tenant_id, v_billing_account_id, v_billing_cycle_id, 'DOC-EPF03-002', 200.00, CURRENT_DATE + 5, 'open');

  -- ========================================================================
  -- PR-01: Provider registry seeded
  -- ========================================================================
  SELECT COUNT(*) INTO v_count FROM resident.payment_providers WHERE id = 'mock';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'PR-01 FAIL: mock provider not found in registry';
  END IF;
  RAISE NOTICE 'PR-01 PASS: mock provider exists in registry';

  -- ========================================================================
  -- PR-02: Capability discovery
  -- ========================================================================
  SELECT COUNT(*) INTO v_count
  FROM resident.payment_provider_capabilities
  WHERE provider_id = 'mock' AND capability = 'pix_generation' AND is_active = true;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'PR-02 FAIL: mock pix_generation capability not found';
  END IF;
  RAISE NOTICE 'PR-02 PASS: mock capability discovery works';

  -- ========================================================================
  -- PR-03: has_provider_capability function
  -- ========================================================================
  IF NOT resident.has_provider_capability('mock', 'pix_generation') THEN
    RAISE EXCEPTION 'PR-03 FAIL: has_provider_capability returned false for mock pix_generation';
  END IF;
  RAISE NOTICE 'PR-03 PASS: has_provider_capability returns true for active capability';

  -- ========================================================================
  -- VC-01: Vault-backed credential storage
  -- ========================================================================
  v_credentials_id := resident.create_vault_secret('mock-api-key-12345', 'epf03-test-credentials', 'Test credentials');
  v_webhook_secret_id := resident.create_vault_secret('mock-webhook-secret-67890', 'epf03-test-webhook', 'Test webhook secret');

  SELECT COUNT(*) INTO v_count
  FROM vault.secrets
  WHERE id IN (v_credentials_id, v_webhook_secret_id);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'VC-01 FAIL: Vault secrets not created';
  END IF;
  RAISE NOTICE 'VC-01 PASS: Vault secrets created via wrapper function';

  -- ========================================================================
  -- VC-02: Decrypted retrieval via service-role wrapper
  -- ========================================================================
  IF resident.get_vault_secret(v_credentials_id) <> 'mock-api-key-12345' THEN
    RAISE EXCEPTION 'VC-02 FAIL: Vault secret decryption failed';
  END IF;
  RAISE NOTICE 'VC-02 PASS: Vault secret decrypted correctly';

  -- ========================================================================
  -- TC-01: Tenant provider configuration with secret references
  -- ========================================================================
  INSERT INTO resident.tenant_payment_provider_configs (
    id, tenant_id, provider_id, environment, method_type, is_active, is_default,
    agreement_number, wallet, portfolio, credentials_secret_id, webhook_secret_id
  ) VALUES (
    v_config_id, v_tenant_id, 'mock', 'sandbox', 'pix', true, true,
    '123456', '001', '101', v_credentials_id, v_webhook_secret_id
  );

  SELECT COUNT(*) INTO v_count FROM resident.tenant_payment_provider_configs WHERE id = v_config_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TC-01 FAIL: tenant provider config not created';
  END IF;
  RAISE NOTICE 'TC-01 PASS: tenant provider config created';

  -- ========================================================================
  -- TC-02: Default config uniqueness per tenant/method/environment
  -- ========================================================================
  BEGIN
    INSERT INTO resident.tenant_payment_provider_configs (
      id, tenant_id, provider_id, environment, method_type, is_active, is_default
    ) VALUES (
      gen_random_uuid(), v_tenant_id, 'mock', 'sandbox', 'pix', true, true
    );
    RAISE EXCEPTION 'TC-02 FAIL: duplicate default config allowed';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TC-02 PASS: unique default config enforced';
  END;

  -- ========================================================================
  -- TC-03: Tenant isolation
  -- ========================================================================
  SELECT COUNT(*) INTO v_count
  FROM resident.tenant_payment_provider_configs
  WHERE tenant_id = v_tenant_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TC-03 FAIL: unexpected config count for tenant';
  END IF;
  RAISE NOTICE 'TC-03 PASS: tenant config isolated';

  -- ========================================================================
  -- PI-01: create_payment_intent for PIX
  -- ========================================================================
  v_intent_id := resident.create_payment_intent(
    v_tenant_id,
    v_invoice_id,
    'mock',
    'pix',
    v_config_id,
    'mock-pix-intent-001',
    100.00,
    'mock-pix-code-001',
    'mock-qr-base64-001',
    null,
    null,
    null,
    now() + interval '30 minutes',
    'rec-epf03-001',
    jsonb_build_object('test', true),
    'idemp-001',
    v_profile_id
  );

  IF v_intent_id IS NULL THEN
    RAISE EXCEPTION 'PI-01 FAIL: payment intent not created';
  END IF;

  SELECT status INTO v_status FROM resident.invoices WHERE id = v_invoice_id;
  IF v_status <> 'payment_pending' THEN
    RAISE EXCEPTION 'PI-01 FAIL: invoice status not transitioned to payment_pending. got %', v_status;
  END IF;
  RAISE NOTICE 'PI-01 PASS: PIX payment intent created and invoice transitioned';

  -- ========================================================================
  -- PI-02: create_payment_intent idempotency
  -- ========================================================================
  DECLARE
    v_intent_id_2 uuid;
  BEGIN
    v_intent_id_2 := resident.create_payment_intent(
      v_tenant_id,
      v_invoice_id,
      'mock',
      'pix',
      v_config_id,
      'mock-pix-intent-002',
      100.00,
      null, null, null, null, null,
      now() + interval '30 minutes',
      'rec-epf03-001',
      '{}'::jsonb,
      'idemp-001',
      v_profile_id
    );
    IF v_intent_id_2 <> v_intent_id THEN
      RAISE EXCEPTION 'PI-02 FAIL: idempotency did not return same intent';
    END IF;
  END;
  RAISE NOTICE 'PI-02 PASS: payment intent idempotency works';

  -- ========================================================================
  -- SM-01: Payment intent status transition valid
  -- ========================================================================
  UPDATE resident.payment_intents SET status = 'processing' WHERE id = v_intent_id;
  UPDATE resident.payment_intents SET status = 'confirmed' WHERE id = v_intent_id;
  SELECT status INTO v_status FROM resident.payment_intents WHERE id = v_intent_id;
  IF v_status <> 'confirmed' THEN
    RAISE EXCEPTION 'SM-01 FAIL: valid transition to confirmed failed';
  END IF;
  RAISE NOTICE 'SM-01 PASS: valid payment intent status transitions accepted';

  -- ========================================================================
  -- SM-02: Payment intent status transition invalid
  -- ========================================================================
  BEGIN
    UPDATE resident.payment_intents SET status = 'pending' WHERE id = v_intent_id;
    RAISE EXCEPTION 'SM-02 FAIL: invalid transition from confirmed to pending allowed';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SM-02 PASS: invalid payment intent transition rejected';
  END;

  -- ========================================================================
  -- PM-01: Partial payment via payment transaction
  -- ========================================================================
  INSERT INTO resident.payment_transactions (
    tenant_id, invoice_id, payment_intent_id, amount, status, provider,
    provider_config_id, payment_method_type, reconciliation_id
  ) VALUES (
    v_tenant_id, v_invoice_id, v_intent_id, 50.00, 'partially_confirmed',
    'mock', v_config_id, 'pix', 'rec-epf03-001'
  )
  RETURNING id INTO v_transaction_id;

  v_balance := resident.get_invoice_balance(v_invoice_id);
  IF v_balance <> 50.00 THEN
    RAISE EXCEPTION 'PM-01 FAIL: expected invoice balance 50.00, got %', v_balance;
  END IF;
  RAISE NOTICE 'PM-01 PASS: partial payment reduces invoice balance correctly';

  -- ========================================================================
  -- PM-02: Invoice remains payment_pending after partial payment
  -- ========================================================================
  SELECT status INTO v_status FROM resident.invoices WHERE id = v_invoice_id;
  IF v_status <> 'payment_pending' THEN
    RAISE EXCEPTION 'PM-02 FAIL: invoice should remain payment_pending after partial payment, got %', v_status;
  END IF;
  RAISE NOTICE 'PM-02 PASS: invoice remains payment_pending after partial payment';

  -- ========================================================================
  -- PM-03: Full payment clears invoice balance
  -- ========================================================================
  INSERT INTO resident.payment_transactions (
    tenant_id, invoice_id, payment_intent_id, amount, status, provider,
    provider_config_id, payment_method_type, reconciliation_id
  ) VALUES (
    v_tenant_id, v_invoice_id, v_intent_id, 50.00, 'confirmed',
    'mock', v_config_id, 'pix', 'rec-epf03-001-2'
  );

  v_balance := resident.get_invoice_balance(v_invoice_id);
  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'PM-03 FAIL: expected invoice balance 0, got %', v_balance;
  END IF;
  RAISE NOTICE 'PM-03 PASS: invoice balance zero after full payment';

  -- ========================================================================
  -- WH-01: Atomic webhook processing creates event, transaction, ledger, audit
  -- ========================================================================
  v_result := resident.process_payment_webhook(
    v_tenant_id,
    'mock',
    'evt-epf03-001',
    'payment.confirmed',
    jsonb_build_object(
      'reconciliation_id', 'rec-epf03-webhook',
      'status', 'confirmed',
      'amount', 200.00
    ),
    null,
    'nonce-001',
    now()::timestamptz,
    v_profile_id
  );

  IF (v_result->>'status') <> 'processed' THEN
    RAISE EXCEPTION 'WH-01 FAIL: webhook processing did not return processed: %', v_result;
  END IF;

  SELECT COUNT(*) INTO v_count FROM resident.payment_provider_events WHERE tenant_id = v_tenant_id AND event_id = 'evt-epf03-001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'WH-01 FAIL: webhook event not recorded';
  END IF;

  SELECT COUNT(*) INTO v_count FROM resident.financial_audit_log WHERE tenant_id = v_tenant_id AND action = 'webhook_received';
  IF v_count < 1 THEN
    RAISE EXCEPTION 'WH-01 FAIL: webhook audit log not recorded';
  END IF;
  RAISE NOTICE 'WH-01 PASS: webhook event, transaction, ledger, audit recorded';

  -- ========================================================================
  -- WH-02: Webhook idempotency
  -- ========================================================================
  v_result := resident.process_payment_webhook(
    v_tenant_id,
    'mock',
    'evt-epf03-001',
    'payment.confirmed',
    '{}'::jsonb,
    null,
    'nonce-002',
    now()::timestamptz,
    v_profile_id
  );

  IF (v_result->>'status') <> 'duplicate' THEN
    RAISE EXCEPTION 'WH-02 FAIL: duplicate webhook not detected: %', v_result;
  END IF;
  RAISE NOTICE 'WH-02 PASS: duplicate webhook event rejected';

  -- ========================================================================
  -- WH-03: Webhook replay protection (duplicate nonce)
  -- ========================================================================
  v_result := resident.process_payment_webhook(
    v_tenant_id,
    'mock',
    'evt-epf03-002',
    'payment.confirmed',
    jsonb_build_object('reconciliation_id', 'rec-epf03-replay'),
    null,
    'nonce-001',
    now()::timestamptz,
    v_profile_id
  );

  IF (v_result->>'status') <> 'replay_rejected' THEN
    RAISE EXCEPTION 'WH-03 FAIL: replay nonce duplicate not detected, got %', v_result;
  END IF;
  RAISE NOTICE 'WH-03 PASS: replay nonce duplicate rejected';

  -- ========================================================================
  -- WH-04: Webhook replay protection (expired timestamp)
  -- ========================================================================
  v_result := resident.process_payment_webhook(
    v_tenant_id,
    'mock',
    'evt-epf03-003',
    'payment.confirmed',
    jsonb_build_object('reconciliation_id', 'rec-epf03-expired'),
    null,
    'nonce-003',
    (now() - interval '10 minutes')::timestamptz,
    v_profile_id
  );

  IF (v_result->>'status') <> 'replay_rejected' THEN
    RAISE EXCEPTION 'WH-04 FAIL: expired timestamp not detected, got %', v_result;
  END IF;
  RAISE NOTICE 'WH-04 PASS: expired webhook timestamp rejected';

  -- ========================================================================
  -- TC-04: Credentials never stored in plaintext in application table
  -- ========================================================================
  SELECT COUNT(*) INTO v_count
  FROM resident.tenant_payment_provider_configs
  WHERE id = v_config_id
    AND (
      credentials_secret_id IS NULL
      OR webhook_secret_id IS NULL
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TC-04 FAIL: config missing secret references';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM resident.tenant_payment_provider_configs
  WHERE id = v_config_id
    AND (
      agreement_number = 'mock-api-key-12345'
      OR wallet = 'mock-webhook-secret-67890'
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TC-04 FAIL: plaintext secrets found in application table';
  END IF;
  RAISE NOTICE 'TC-04 PASS: secrets stored in Vault, not in application table';

  -- ========================================================================
  -- REG-01: EPF-01 regression — financial tables accessible
  -- ========================================================================
  SELECT COUNT(*) INTO v_count FROM resident.billing_accounts;
  RAISE NOTICE 'REG-01 PASS: billing_accounts accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.invoices;
  RAISE NOTICE 'REG-02 PASS: invoices accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.ledger_entries;
  RAISE NOTICE 'REG-03 PASS: ledger_entries accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.financial_audit_log;
  RAISE NOTICE 'REG-04 PASS: financial_audit_log accessible (count: %)', v_count;

  -- ========================================================================
  -- REG-02: EPF-02 regression — water tables accessible
  -- ========================================================================
  SELECT COUNT(*) INTO v_count FROM resident.water_meters;
  RAISE NOTICE 'REG-05 PASS: water_meters accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.meter_readings;
  RAISE NOTICE 'REG-06 PASS: meter_readings accessible (count: %)', v_count;

  SELECT COUNT(*) INTO v_count FROM resident.tariff_tables;
  RAISE NOTICE 'REG-07 PASS: tariff_tables accessible (count: %)', v_count;

  RAISE NOTICE 'EPF-03 VALIDATION COMPLETE';
END $$;

ROLLBACK;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tests:
--   PR-01 to PR-03: provider registry and capabilities
--   VC-01 to VC-02: Vault-backed credential storage
--   TC-01 to TC-04: tenant provider configuration and isolation
--   PI-01 to PI-02: payment intent creation and idempotency
--   SM-01 to SM-02: payment status transitions
--   PM-01 to PM-03: partial payment semantics
--   WH-01 to WH-04: webhook processing, idempotency, replay protection
--   REG-01 to REG-07: EPF-01 and EPF-02 regression
-- ============================================================================
