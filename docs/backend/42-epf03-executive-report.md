# 42 — EPF-03 Payment Processing Platform — Executive Report

> Backend Integration Program
> Executive Program Finance — Payment Processing Platform
> Status: Implemented
> Date: 2026-07-24

---

## 1. Executive Summary

The Payment Processing Platform (EPF-03) has been implemented on top of the certified EPF-01 Financial Foundation and EPF-02 Water Billing Domain. EPF-03 delivers a provider-agnostic payment orchestration layer with:

- A payment provider registry and capability model
- Vault-backed tenant provider configuration
- PIX and Boleto payment intent creation via a production-quality mock provider
- Atomic webhook processing with signature validation, idempotency, and replay protection
- Partial payment support with invoice balance derived from confirmed transactions
- A TypeScript adapter layer ready for real providers

Credit/debit cards and CNAB remain provider-ready only in EPF-03.

---

## 2. Repository

| Property | Value |
|---|---|
| Repository | https://github.com/coopertisistemas-hue/aistudio-hoa-connect-resident-app.git |
| Branch | `sprint-03-epf03-payment-platform` |
| Certified Tags | `residence-core-v1.0.0-certified` (EPF-01), `water-billing-v1.0.0-certified` (EPF-02) |
| Working Tree | Clean after implementation |

---

## 3. Work Completed

### 3.1 Database — Migration

| Entity | Count | Details |
|---|---|---|
| New Enums | 2 | `payment_provider_capability`, `payment_provider_environment` |
| Extended Enums | 1 | `payment_status` extended with `partially_confirmed`, `cancelled`; `tenant_permission` extended with `payments:read`, `payments:write` |
| New Types | 2 | `webhook_signature_status`, `webhook_replay_status` |
| New Tables | 8 | `payment_providers`, `payment_provider_capabilities`, `tenant_payment_provider_configs`, `payment_webhooks`, `payment_provider_event_signatures`, `payment_provider_events`, `payment_intents`, `payment_transactions` |
| New Functions | 10+ | `has_provider_capability`, `get_provider_capabilities`, `get_default_provider_config`, `create_payment_intent`, `process_payment_webhook`, `get_invoice_balance`, `create_vault_secret`, `update_vault_secret`, `get_vault_secret`, updated `has_tenant_permission` |
| New Triggers | 3 | `payment_intent_status_transition`, `payment_transaction_status_transition`, `invoice_status_reconciliation` |
| RLS Policies | 5 | SELECT-only on EPF-03 tables matching EPF-01/EPF-02 pattern |
| Indexes | 7+ | Optimized for tenant/provider/event lookups |

### 3.2 Database — Tables Detail

**`payment_providers`** — Registry of supported providers.
- Active flag and metadata only; executable behavior lives in Edge Function adapter code.
- Seeded with `mock`, `stripe`, `asaas`, `efi`, `sicoob`, `sicredi`, `bb`, `caixa`, `cnab`.

**`payment_provider_capabilities`** — Capability matrix per provider.
- Used for runtime capability discovery and enforcement.
- Only declared capabilities may be used by the orchestration layer.

**`tenant_payment_provider_configs`** — Tenant-scoped provider configuration.
- Stores non-sensitive data and Vault secret identifiers.
- One active default config per `(tenant, payment method, environment)`.
- Credentials and webhook secrets stored in Supabase Vault, never in this table.

**`payment_intents`** — Orchestration record for each payment attempt.
- Status lifecycle: `pending` → `processing`/`confirmed`/`failed`/`cancelled`.
- Tracks provider payment intent id, PIX code, QR base64, boleto URL, barcode, digitable line.
- Idempotency key prevents duplicate intents.

**`payment_transactions`** — Confirmed, settled payment events.
- Status lifecycle: `pending` → `confirmed`/`partially_confirmed`/`failed`/`cancelled`/`refunded`/`partially_refunded`.
- Ledger entries and invoice reconciliation are driven from confirmed transactions.

**`payment_provider_events`** — Ingested webhook events.
- Append-only; references payment transaction when applicable.

**`payment_provider_event_signatures`** — Signature validation, replay nonce, and payload hash log.
- Append-only; supports idempotency and forensic replay analysis.

### 3.3 Helper Functions

| Function | Purpose |
|---|---|
| `has_provider_capability(provider_id, capability)` | Returns whether a provider currently declares a capability |
| `get_provider_capabilities(provider_id)` | Returns all active capabilities for a provider |
| `get_default_provider_config(tenant_id, method_type, environment)` | Returns the active default provider config for a tenant/method/env |
| `create_payment_intent(...)` | Records intent, transitions invoice to `payment_pending`, writes audit log |
| `process_payment_webhook(...)` | Atomic webhook ingestion: validate, record event, update transaction, reconcile invoice, ledger, audit |
| `get_invoice_balance(invoice_id)` | Derives outstanding balance from confirmed/partially confirmed transactions and adjustments |
| `create_vault_secret(name, description, secret)` | Wrapper around `vault.create_secret()` for service role |
| `update_vault_secret(secret_id, secret)` | Wrapper around `vault.update_secret()` |
| `get_vault_secret(secret_id)` | Reads decrypted Vault secret for service role |

### 3.4 Edge Functions

| Function | Method | Purpose |
|---|---|---|
| `payment-provider-config-upsert` | POST/PUT | Create or update tenant provider configuration; credentials/webhook secrets stored in Vault |
| `payment-provider-config-list` | POST/GET | List provider registry, capabilities, and tenant configurations without exposing secrets |
| `payment-intent-create` | POST | Create a payment intent for an invoice using the configured provider (PIX/Boleto) |
| `payment-intent-cancel` | POST | Cancel a pending payment intent through the provider |
| `payment-refund` | POST | Process full or partial refund for a confirmed transaction |
| `payment-webhook-receive` | POST | Receive provider webhooks, validate signature/replay, process event atomically |

### 3.5 Shared Payment Layer

| File | Purpose |
|---|---|
| `supabase/functions/_shared/payment/types.ts` | Payment domain types and provider contract |
| `supabase/functions/_shared/payment/capabilities.ts` | Capability mapping and enforcement |
| `supabase/functions/_shared/payment/crypto.ts` | Supabase client factory and Vault helpers |
| `supabase/functions/_shared/payment/mock-provider.ts` | Production-quality mock provider for PIX/Boleto |
| `supabase/functions/_shared/payment/stub-provider.ts` | Stub for provider-ready-only adapters |
| `supabase/functions/_shared/payment/registry.ts` | Hybrid registry/factory mapping provider IDs to executable adapters |

### 3.6 TypeScript Frontend Layer

| File | Purpose |
|---|---|
| `src/lib/payment/providers/types.ts` | Frontend provider type definitions |
| `src/lib/payment/providers/mock.adapter.ts` | Mock adapter matching Edge Function mock provider |
| `src/lib/payment/providers/registry.ts` | Frontend provider registry |
| `src/lib/payment/api-contracts.ts` | Edge Function request/response contracts |
| `src/lib/payment/service.ts` | Payment service facade |
| `src/lib/finance/types.ts` | Extended financial types for payment records |
| `src/lib/supabase/client.ts` | Supabase client helpers for payment functions |
| `src/lib/supabase/database.types.ts` | Regenerated database types |

---

## 4. Integration with EPF-01 and EPF-02

| Asset | EPF-03 Usage |
|---|---|
| `resident.invoices` | Source of payment intent; status transitions to/from `payment_pending` |
| `resident.billing_accounts` | Invoice billing context preserved |
| `resident.ledger_entries` | Credit entries written on confirmed payments |
| `resident.financial_audit_log` | Every payment intent, transaction, refund, and webhook writes an audit record |
| `resident.payment_status` | Extended with `partially_confirmed` and `cancelled` |
| `resident.tenant_permission` | Extended with `payments:read` and `payments:write` |
| `resident.has_tenant_permission()` | Updated to grant payment permissions to association staff |
| EPF-02 water invoices | Ready for payment via standard invoice pipeline |

No certified EPF-01 or EPF-02 migrations were modified. EPF-03 is purely additive.

---

## 5. Architectural Decisions

| # | Decision | Rationale |
|---|---|---|
| EPF-03-ADR-01 | Keep `payment_status` separate from invoice lifecycle | Only genuine payment concepts (`partially_confirmed`, `cancelled`) were added to `payment_status`. Invoice statuses remain unchanged. |
| EPF-03-ADR-02 | Supabase Vault for credentials | Credentials and webhook secrets are never stored in application tables. Resident wrapper functions expose Vault operations to service role only. |
| EPF-03-ADR-03 | Mock provider for certification | A production-quality mock provider implements PIX and Boleto for local/certification testing without external dependencies. |
| EPF-03-ADR-04 | Hybrid registry/factory | Provider metadata lives in DB; executable adapters live in TypeScript registry. Keeps behavior version-controlled while allowing runtime capability discovery. |
| EPF-03-ADR-05 | One default config per tenant/method/environment | Enforced by partial unique index; prevents ambiguous provider selection. |
| EPF-03-ADR-06 | Atomic webhook processing | `process_payment_webhook` performs signature validation, replay check, event recording, transaction update, invoice reconciliation, ledger write, and audit log in one transaction. |
| EPF-03-ADR-07 | Partial payments supported | Invoice balance is derived from confirmed transactions; partial payment leaves invoice in `payment_pending` until fully settled. |
| EPF-03-ADR-08 | Credit/debit cards provider-ready only | No executable adapters for cards in EPF-03; providers declared as capabilities. |
| EPF-03-ADR-09 | CNAB declared only | CNAB is listed as a capability for compatible providers; no layouts implemented. |
| EPF-03-ADR-10 | Payment-specific permissions | New `payments:read` and `payments:write` permissions are granted to admin/operator/finance/collector/viewer (read) and admin/operator/finance/collector (write). |

---

## 6. Business Flow Validation

```
Invoice → Payment Intent → Provider (PIX/Boleto) → Webhook → Transaction → Ledger → Invoice Reconciliation → Audit
```

| Step | Mechanism | Status |
|---|---|---|
| Invoice eligible | `status IN ('open', 'overdue')` | Implemented |
| Payment intent | `create_payment_intent()` + `payment-intent-create` Edge Function | Implemented |
| Provider generation | Mock provider creates PIX code/QR or Boleto URL/barcode | Implemented |
| Webhook ingestion | `payment-webhook-receive` → `process_payment_webhook()` | Implemented |
| Signature validation | HMAC-SHA256 comparison against Vault webhook secret | Implemented |
| Replay protection | Nonce/timestamp window check before record creation | Implemented |
| Idempotency | Duplicate `event_id` returns `duplicate` | Implemented |
| Transaction confirmation | `payment_transactions` status transition to `confirmed` | Implemented |
| Partial payment | `partially_confirmed` status and balance derivation | Implemented |
| Ledger entry | `ledger_entries` credit written on confirmation | Implemented |
| Invoice reconciliation | `invoice_status_reconciliation` trigger | Implemented |
| Refund | `payment-refund` Edge Function + provider refund | Implemented |
| Audit | `financial_audit_log` record per operation | Implemented |

---

## 7. Validation Results

| Check | Method | Status |
|---|---|---|
| Database migration | `supabase db reset` | All migrations applied cleanly |
| TypeScript | `npm run type-check` | Pass |
| Build | `npm run build` | Pass |
| EPF-01 regression | `npm run supabase:test:sprint1` | Pass |
| EPF-02 regression | `npm run supabase:test:sprint2` | Pass |
| D2 regression | `npm run supabase:test:d2` | Pass |
| ADR-11 compatibility | `npm run supabase:test:adr11` | 11/11 pass |
| Namespace guard | `npm run supabase:check:namespace` | Pass |
| Edge Function auth | `npm run supabase:test:edge-func-auth` | 35/35 pass |
| EPF-03 validation | `npm run supabase:test:epf03` | 26/26 pass |
| Full suite | `npm run supabase:test:all` | Pass |

### 7.1 Edge Function Runtime Validation

| Function | Scenario | Result |
|---|---|---|
| `payment-provider-config-upsert` | Operator creates mock PIX sandbox config | 200, Vault secrets created, no plaintext in response |
| `payment-provider-config-list` | Operator lists providers, capabilities, configs | 200, full registry returned |
| `payment-intent-create` | PIX intent for open invoice | 200, PIX code + QR returned, invoice → `payment_pending` |
| `payment-intent-cancel` | Cancel pending intent | 200, status → `cancelled` |
| `payment-webhook-receive` | Mock provider webhook with reconciliation id | 200, event recorded, signature/replay validated |

---

## 8. Files Created

| # | File | Type |
|---|---|---|
| 1 | `supabase/migrations/20260725000000_sprint03_epf03_payment_platform_enums.sql` | Migration |
| 2 | `supabase/migrations/20260726000000_sprint03_epf03_payment_platform.sql` | Migration |
| 3 | `supabase/functions/_shared/payment/types.ts` | Edge Function shared code |
| 4 | `supabase/functions/_shared/payment/capabilities.ts` | Edge Function shared code |
| 5 | `supabase/functions/_shared/payment/crypto.ts` | Edge Function shared code |
| 6 | `supabase/functions/_shared/payment/mock-provider.ts` | Edge Function shared code |
| 7 | `supabase/functions/_shared/payment/stub-provider.ts` | Edge Function shared code |
| 8 | `supabase/functions/_shared/payment/registry.ts` | Edge Function shared code |
| 9 | `supabase/functions/payment-intent-create/index.ts` | Edge Function |
| 10 | `supabase/functions/payment-intent-cancel/index.ts` | Edge Function |
| 11 | `supabase/functions/payment-refund/index.ts` | Edge Function |
| 12 | `supabase/functions/payment-webhook-receive/index.ts` | Edge Function |
| 13 | `supabase/functions/payment-provider-config-upsert/index.ts` | Edge Function |
| 14 | `supabase/functions/payment-provider-config-list/index.ts` | Edge Function |
| 15 | `src/lib/payment/providers/types.ts` | TypeScript |
| 16 | `src/lib/payment/providers/mock.adapter.ts` | TypeScript |
| 17 | `src/lib/payment/providers/registry.ts` | TypeScript |
| 18 | `src/lib/payment/api-contracts.ts` | TypeScript |
| 19 | `src/lib/payment/service.ts` | TypeScript |
| 20 | `src/lib/supabase/client.ts` | TypeScript |
| 21 | `validation/epf03_payment_platform_tests.sql` | Validation suite |

## 9. Files Modified

| # | File | Change |
|---|---|---|
| 1 | `src/lib/finance/types.ts` | Added payment-related types |
| 2 | `src/lib/supabase/database.types.ts` | Regenerated types |
| 3 | `package.json` | Added `supabase:test:epf03` and included it in `supabase:test:all` |
| 4 | `validation/evidence/sprint01_edge_function_authorization.json` | Updated evidence from edge function auth test run |

---

## 10. Known Limitations

1. **Mock provider only.** PIX and Boleto execution uses the mock provider. Real provider adapters (Stripe, Asaas, Efí, Sicoob, Sicredi, BB, Caixa) are declared in the registry but throw `NotImplementedError`.
2. **Credit/debit cards provider-ready only.** No executable adapters or PCI-handling logic in EPF-03.
3. **CNAB declared only.** The `cnab_support` capability exists for bank providers; no CNAB file layouts or processing implemented.
4. **Webhook signature optional for mock.** The mock provider validates signature if provided, but the certification flow does not require it. Real providers will enforce signature validation.
5. **No automatic reconciliation polling.** Payment status lookup is a declared capability; scheduled polling or manual status check UI is not implemented.
6. **No settlement reporting UI.** Settlement lookup capability is declared; settlement reports and UI deferred.
7. **Frontend pages are structural.** The service layer and contracts are implemented; full UI integration is pending design-system alignment.

---

## 11. Readiness for Next Steps

EPF-03 leaves the codebase ready for:

- Real provider adapter implementations behind the same `PaymentProvider` interface.
- Resident-facing PIX/Boleto payment pages.
- Refund and cancellation admin flows.
- Webhook endpoint deployment per provider.
- Settlement reconciliation and reporting.
- CNAB file integration with selected banks.

All certified EPF-01 and EPF-02 regressions continue to pass.

---

*Date: 2026-07-24*
*Next Step: EPF-03 final certification sign-off; then real provider adapter integration or resident payment UI.*
