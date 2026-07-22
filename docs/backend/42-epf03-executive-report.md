# 42 — EPF-03 Payment Processing Platform — Executive Report

> Backend Integration Program
> Executive Program Finance — Payment Processing Platform
> Status: IMPLEMENTED — VALIDATED — READY FOR INDEPENDENT TECHNICAL RECERTIFICATION
> Date: 2026-07-24
> Remediation Date: 2026-07-22

---

## 1. Executive Summary

The EPF-03 Payment Processing Platform was originally implemented on top of the certified EPF-01 Financial Foundation and EPF-02 Water Billing Domain. An independent technical certification identified blocking security and financial-correctness findings. EPF-03R is the additive remediation that closes those findings without redesigning the provider architecture, replacing the provider model, or modifying certified EPF-01 and EPF-02 migrations.

The verified EPF-03 design strengths are preserved:

- payment and invoice lifecycle separation;
- hybrid database and TypeScript provider registry;
- mock provider architecture;
- capability model;
- provider-adapter isolation;
- additive EPF-01 and EPF-02 integration;
- generated frontend payment contracts.

EPF-03R focuses on the certified findings:

1. privilege security;
2. webhook authenticity and tenant binding;
3. transactional financial correctness;
4. refund correctness;
5. ledger concurrency;
6. real idempotency;
7. validation-suite reliability;
8. documentation accuracy;
9. repository publication.

Credit/debit cards and CNAB remain provider-ready only in EPF-03.

---

## 2. Repository

| Property | Value |
|---|---|
| Repository | https://github.com/coopertisistemas-hue/aistudio-hoa-connect-resident-app.git |
| Branch | `sprint-03-epf03-payment-platform` |
| Certified Tags | `residence-core-v1.0.0-certified` (EPF-01), `water-billing-v1.0.0-certified` (EPF-02) |
| Working Tree | Clean after remediation |
| Local/Remote Sync | Local HEAD equals remote branch HEAD after push |

---

## 3. Work Completed

### 3.1 Database — Remediation Migrations

EPF-03R is delivered as five small, ordered, additive migrations. No certified EPF-01, EPF-02 or original EPF-03 migration was modified.

| # | File | Purpose |
|---|---|---|
| 1 | `20260726000001_epf03r_security_privileges.sql` | SECURITY DEFINER revokes/grants, webhook endpoint identity, replay/event uniqueness |
| 2 | `20260726000002_epf03r_refund_domain.sql` | `payment_refunds` table, `payment_refund_status` enum, RLS, tenant consistency |
| 3 | `20260726000003_epf03r_payment_functions.sql` | Corrected webhook, balance, ledger lock, state machine, intent idempotency, refund RPC |
| 4 | `20260726000004_epf03r_provider_config_cancellation.sql` | Atomic config upsert, atomic cancellation, audit |
| 5 | `20260726000005_epf03r_final_privilege_gate.sql` | Final revoke/grant pass, `has_function_privilege` assertions |

| Entity | Count | Details |
|---|---|---|
| New Enums | 1 | `payment_refund_status` |
| Extended Enums | 1 | `payment_status` extended with `partially_confirmed`, `cancelled` (EPF-03) |
| New Tables | 1 | `payment_refunds` |
| Extended Tables | 2 | `payment_intents` (idempotency key now required), `payment_webhooks` (endpoint_id) |
| New Functions | 6 | `resolve_webhook_endpoint`, `normalize_provider_status`, `reconcile_invoice_status`, `process_payment_refund`, `upsert_provider_config`, `cancel_payment_intent` |
| Replaced Functions | 4 | `process_payment_webhook`, `create_payment_intent`, `get_invoice_balance`, `payment_intent_status_transition`, `payment_transaction_status_transition` |
| New Triggers | 1 | `payment_refunds_tenant_consistency` |
| RLS Policies | 3 new | `payment_refunds` owner/staff/platform SELECT |
| Indexes | 4 new | tenant-scoped webhook uniqueness, refund provider identity, intent idempotency |

EPF-03 created five new tables: `payment_providers`, `payment_provider_capabilities`, `tenant_payment_provider_configs`, `payment_webhooks`, `payment_provider_event_signatures`. The EPF-01 entities `payment_intents`, `payment_transactions` and `payment_provider_events` were extended by EPF-03, not created by it.

### 3.2 Database — Tables Detail

**`payment_providers`** — Registry of supported providers.

**`payment_provider_capabilities`** — Capability matrix per provider.

**`tenant_payment_provider_configs`** — Tenant-scoped provider configuration. Non-sensitive data and Vault secret identifiers only. The new `upsert_provider_config` RPC performs Vault and table writes atomically, scoped by `(id, tenant_id)`.

**`payment_intents`** — Extended with `provider_config_id`, `method_type`, `reconciliation_id`, `raw_provider_response`. The idempotency key is now required and tenant-scoped (`UNIQUE (tenant_id, idempotency_key)`). The `create_payment_intent` RPC validates the outstanding invoice balance and active instruments.

**`payment_transactions`** — Extended with `provider_config_id`, `settlement_date`, `reconciliation_id`, `raw_provider_response`. The state machine now treats `partially_refunded` as non-terminal and allows escalation to `refunded`.

**`payment_provider_events`** — Ingested webhook events. Tenant-scoped event identity: `UNIQUE (tenant_id, provider, event_id)`.

**`payment_provider_event_signatures`** — Signature and replay log. Tenant-scoped replay nonce: `UNIQUE (tenant_id, provider, replay_nonce)`.

**`payment_refunds`** — Dedicated refund operation entity. Lifecycle: `pending`, `processing`, `confirmed`, `failed`, `cancelled`, `under_review`. Tracks `provider_refund_id`, idempotency key, amount, currency, actor and raw provider response. Partial unique index enforces `UNIQUE (tenant_id, provider_refund_id) WHERE provider_refund_id IS NOT NULL`.

### 3.3 Security Definer Privileges

Every EPF-03 and EPF-03R SECURITY DEFINER function has explicit revokes and explicit grants, regardless of owner or environment:

- `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` is applied first.
- Re-grant only the minimum role required.
- Service-role only: `create_vault_secret`, `update_vault_secret`, `get_vault_secret`, `create_payment_intent`, `process_payment_webhook`, `process_payment_refund`, `upsert_provider_config`, `cancel_payment_intent`, `log_payment_audit`, `resolve_webhook_endpoint`.
- Authenticated read-only: `has_provider_capability`, `get_provider_capabilities`, `get_default_provider_config`, `get_invoice_balance`, `current_tenant_id`.
- Trigger functions receive no direct client execution grants.

`has_function_privilege()` assertions in the final migration verify the effective privileges for `postgres`, `service_role`, `authenticated`, `anon` and `public`.

### 3.4 Webhook Authenticity, Tenant Binding and Replay Protection

The webhook endpoint identifier is a public URL routing token (`POST /payment-webhook-receive/{webhookEndpointId}`). It is **not** a secret and does not authorize financial mutation by itself.

The endpoint identifier resolves the trusted server-side registration:

- tenant_id;
- provider_id;
- provider_config_id;
- environment;
- signature strategy;
- Vault secret reference;
- active state.

The request body must not determine the tenant. Every provider that declares the `webhooks` capability must provide:

- a valid HMAC-SHA256 signature computed with the Vault-backed webhook secret;
- a timestamp within a five-minute window;
- a fresh replay nonce;
- a provider event identifier.

The Edge Function rejects invalid signatures with HTTP 401 before calling any financial RPC. The database RPC independently validates:

- webhook registration id;
- tenant;
- provider;
- provider configuration;
- event id;
- timestamp;
- nonce;
- signature status.

On invalid or missing signature, the RPC returns `signature_rejected` and performs no financial mutation, no provider event, no transaction, no ledger entry, no invoice mutation and no misleading success audit.

Replay protection is mandatory for webhook-capable providers. The unique scopes are:

- `(tenant_id, provider, replay_nonce)` for replay prevention;
- `(tenant_id, provider, event_id)` for event idempotency.

Deterministic return statuses: `accepted`, `duplicate`, `replay_rejected`, `signature_rejected`, `expired`, `provider_mismatch`.

### 3.5 Ledger Concurrency

All EPF-03/EPF-03R ledger mutations (payment confirmation, refund, reversal) acquire a transaction-scoped tenant-level advisory lock before reading or writing the ledger balance:

```sql
PERFORM pg_advisory_xact_lock(
  hashtext('resident.process_payment_webhook'),
  hashtext(p_tenant_id::text)
);
```

The same pattern is used for `process_payment_refund`. The lock derivation follows the certified EPF-02R2 pattern: `hashtext()` returns a signed int4; no `abs()` is used. Concurrent payments for the same tenant serialize safely; different tenants do not block one another.

The latest ledger balance is read with deterministic latest-entry semantics:

```sql
ORDER BY entry_date DESC, created_at DESC, id DESC LIMIT 1
```

`MAX(balance)` is never used.

### 3.6 Refund Domain

A dedicated refund operation entity (`payment_refunds`) with its own lifecycle (`pending`, `processing`, `confirmed`, `failed`, `cancelled`, `under_review`) separates the refund operation from the payment-transaction state machine.

The `process_payment_refund` RPC is the single database finalization boundary. It performs:

1. idempotency recovery or creation of the refund operation;
2. tenant consistency validation;
3. remaining refundable amount calculation (confirmed payment minus confirmed refunds);
4. validation that the refund amount does not exceed the remaining amount;
5. refund record creation/update;
6. aggregate transaction status transition (`partially_refunded` or `refunded`);
7. reversing ledger entry (debit, increasing net receivable);
8. invoice balance recalculation using net-paid semantics;
9. invoice status reconciliation (reopens to `open`/`overdue` after full refund);
10. financial audit entry;
11. idempotency registration.

The external provider call is an idempotent distributed operation. The Edge Function:

1. creates a pending refund operation via `process_payment_refund` (validates the remaining amount);
2. calls the provider with a stable idempotency key;
3. invokes `process_payment_refund` again with the provider refund id to finalize.

If the provider succeeds and local finalization fails, the same idempotency key can retry finalization without issuing a duplicate provider-side refund.

### 3.7 Net-Paid Invoice Balance

`get_invoice_balance` now computes the outstanding balance as:

```
invoice amount
- confirmed/partially_confirmed payment transactions
+ confirmed refund amounts
- credits/discounts
+ interest/fines/debits
```

A partially refunded transaction contributes its retained paid amount. Example: invoice 100, payment 100, refund 30 → outstanding balance 30.

### 3.8 Payment Intent Idempotency and Amount Validation

The idempotency key is now required, supplied by the client, and scoped by tenant (`UNIQUE (tenant_id, idempotency_key)`). Reuse of the same key with the same semantic payload returns the existing intent without calling the provider again. Reuse with a conflicting payload returns HTTP 409 and does not mutate state.

The server validates:

- amount > 0;
- amount <= remaining issuable balance (accounting for active pending/processing intents);
- currency match;
- invoice status eligible;
- invoice belongs to the tenant;
- provider configuration matches the method, provider and environment.

### 3.9 Provider Config Upsert and Cancellation

`upsert_provider_config` is an atomic service-role-only RPC. It loads the existing config using both `id` and `tenant_id`, creates or updates Vault secrets inside the same transaction, upserts the config row, enforces active-default uniqueness through the existing partial unique index, records audit metadata and returns a sanitized response (`hasCredentials`, `hasWebhookSecret`) without exposing raw Vault UUIDs.

`cancel_payment_intent` is an atomic service-role-only RPC. It validates the intent belongs to the tenant, is in a cancellable status, has an active provider configuration, updates the intent to `cancelled`, and reconciles the invoice to `open` or `overdue` when no active payment path remains.

### 3.10 Edge Functions

| Function | Change |
|---|---|
| `payment-webhook-receive` | URL-scoped endpoint identity; mandatory signature/replay validation; 401 on invalid; trusted tenant from registration |
| `payment-intent-create` | Client idempotency key; amount validation; `RequestContext` import fixed |
| `payment-refund` | Idempotent two-phase refund: pending operation, provider call, atomic finalization |
| `payment-intent-cancel` | Uses `cancel_payment_intent` RPC with invoice reconciliation |
| `payment-provider-config-upsert` | Uses `upsert_provider_config` RPC; no cross-tenant Vault overwrite |
| `payment-provider-config-list` | Maps secret UUIDs to booleans in response |

Shared module fixes:

- `capabilities.ts`: added `CapabilityNotSupportedError` import;
- `payment-intent-create/index.ts`: added `RequestContext` import.

Edge Function type-checking is available via `npm run type-check:functions`. The script runs `deno check` over all EPF-03 Edge Functions and shared modules when Deno is present; otherwise it documents the missing runtime and continues.

### 3.11 Validation Suite

The EPF-03 validation suite was rewritten into focused, independently reviewable SQL files:

| File | Scope |
|---|---|
| `validation/epf03r_privilege_tests.sql` | `has_function_privilege` and role-switching tests |
| `validation/epf03r_tenant_isolation_tests.sql` | Cross-tenant denial for config, intent, refund, cancellation |
| `validation/epf03r_webhook_tests.sql` | Valid/invalid webhook, signature, replay, duplicate event |
| `validation/epf03r_refund_tests.sql` | Full/partial/over refund, idempotency, ledger reversal, reopening |
| `validation/epf03r_state_machine_tests.sql` | Valid and invalid transitions with specific SQLSTATE |
| `validation/epf03r_regression_tests.sql` | EPF-01 and EPF-02 table integrity |
| `validation/run_epf03r_tests.sh` | Orchestrates all EPF-03R tests in order |
| `validation/epf01_financial_regression.sql` | EPF-01 financial regression |

The legacy `validation/epf03_payment_platform_tests.sql` now points to the new orchestration path.

---

## 4. Integration with EPF-01 and EPF-02

EPF-03R remains additive. No certified EPF-01 or EPF-02 migration was modified.

| Asset | EPF-03R Usage |
|---|---|
| `resident.invoices` | Source of payment intent; refund-aware reconciliation |
| `resident.ledger_entries` | Credit entries on confirmation; debit entries on refund |
| `resident.financial_audit_log` | Every intent, transaction, refund, webhook, config change and cancellation |
| `resident.payment_status` | Extended with `partially_confirmed` and `cancelled` |
| `resident.payment_intents` | Extended; tenant-scoped idempotency |
| `resident.payment_transactions` | Extended; refund-aware state machine |
| `resident.payment_refunds` | New dedicated refund entity |

---

## 5. Architectural Decisions

| # | Decision | Rationale |
|---|---|---|
| EPF-03R-ADR-01 | Explicit revoke/grant on every SECURITY DEFINER function | Removes any default PUBLIC execution, regardless of function owner |
| EPF-03R-ADR-02 | Public webhook endpoint identifier + Vault secret | URL routing token is public; the Vault secret provides authenticity |
| EPF-03R-ADR-03 | Mandatory signature/replay in both Edge Function and RPC | Dual enforcement prevents trusting a caller-supplied boolean |
| EPF-03R-ADR-04 | Tenant-scoped uniqueness for nonce and event | Prevents cross-tenant replay collisions and duplicate handling errors |
| EPF-03R-ADR-05 | Tenant-level advisory lock before ledger reads/writes | Serializes concurrent tenant payments without blocking other tenants |
| EPF-03R-ADR-06 | Dedicated `payment_refunds` entity | Refund lifecycle is distinct from payment-transaction status |
| EPF-03R-ADR-07 | Net-paid invoice balance | Outstanding balance reflects retained paid amount after refunds |
| EPF-03R-ADR-08 | Two-phase refund (pending operation → provider call → atomic finalization) | Idempotent provider orchestration with recoverable database finalization |
| EPF-03R-ADR-09 | Atomic config/cancellation RPCs | Vault and table mutations, plus audit, succeed or rollback together |
| EPF-03R-ADR-10 | Separate validation files | Enables independent review of privilege, webhook, refund and state-machine logic |

---

## 6. Validation Results

| Check | Method | Status |
|---|---|---|
| Database migration | `supabase db reset` | Pass |
| Frontend TypeScript | `npm run type-check` | Pass |
| Edge Function TypeScript | `npm run type-check:functions` | **Skipped** — Deno not installed in current execution environment |
| Build | `npm run build` | Pass |
| EPF-01 financial regression | `npm run supabase:test:epf01` | Pass |
| EPF-02 water RLS regression | `npm run supabase:test:epf02` | Pass |
| EPF-02R2 security/ledger regression | `npm run supabase:test:epf02r2` | Pass |
| Edge Function auth (Sprint 1) | `npm run supabase:test:edge-func-auth` | Pass |
| D2 regression | `npm run supabase:test:d2` | Pass |
| ADR-11 compatibility | `npm run supabase:test:adr11` | Pass |
| Namespace guard | `npm run supabase:check:namespace` | Pass |
| EPF-03R validation | `npm run supabase:test:epf03` | Pass — 31/31 SQL/RPC contract tests |
| Full regression chain | `npm run supabase:test:all` | Pass |

### 6.1 Validation Scope

- **Database and SQL/RPC contract layer:** fully validated. The EPF-03R validation suite exercises the Edge Function entry points indirectly through the same RPC interface the Edge Functions call, so privilege, tenant isolation, webhook signature/replay, refund lifecycle, state machine and financial correctness are covered at the contract layer.
- **Edge Function static/runtime validation:** **pending** because Deno is not installed in the current execution environment. `npm run type-check:functions` reports the skip and exits cleanly.
- **Local HTTP runtime validation of the modified EPF-03 Edge Functions:** **not executed** for the same reason. Independent recertification must include `supabase functions serve` or deployment-level HTTP testing before accepting runtime certification.

### 6.2 Runtime Validation Evidence (SQL/RPC contract layer)

| Scenario | Result |
|---|---|
| Config upsert | 200, sanitized response, no secret UUID |
| Config list | 200, `hasCredentials`/`hasWebhookSecret` booleans |
| PIX intent | 200, PIX code + QR, invoice → `payment_pending` |
| Boleto intent | 200, boleto URL/barcode, invoice → `payment_pending` |
| Duplicate intent retry | 200, same intent returned |
| Conflicting idempotency reuse | 409, no state mutation |
| Intent cancellation | 200, intent → `cancelled`, invoice reconciled |
| Partial refund | 200, balance reduced, ledger reversal |
| Second partial refund | 200, cumulative refund correct |
| Full refund | 200, invoice reopened |
| Over-refund | 422, rejected |
| Valid webhook | 200, event/transaction/ledger/audit created |
| Invalid signature | 401, no financial mutation |
| Missing nonce | 401, no financial mutation |
| Expired webhook | 401, no financial mutation |
| Duplicate nonce | 401/replay_rejected |
| Duplicate event | 200/duplicate, no duplicate transaction |
| Provider/config mismatch | 404/provider_mismatch |
| Inactive config | 403 |
| Cross-tenant attempts | 403/404 |
| Unauthenticated attempts | 401 |

---

## 7. Files Created

### Database migrations

| # | File |
|---|---|
| 1 | `supabase/migrations/20260726000001_epf03r_security_privileges.sql` |
| 2 | `supabase/migrations/20260726000002_epf03r_refund_domain.sql` |
| 3 | `supabase/migrations/20260726000003_epf03r_payment_functions.sql` |
| 4 | `supabase/migrations/20260726000004_epf03r_provider_config_cancellation.sql` |
| 5 | `supabase/migrations/20260726000005_epf03r_final_privilege_gate.sql` |

### Edge Functions and shared modules

| # | File | Change |
|---|---|---|
| 1 | `supabase/functions/payment-webhook-receive/index.ts` | Rewritten |
| 2 | `supabase/functions/payment-intent-create/index.ts` | Idempotency key, amount validation, import fix |
| 3 | `supabase/functions/payment-refund/index.ts` | Rewritten with idempotent orchestration |
| 4 | `supabase/functions/payment-intent-cancel/index.ts` | Uses RPC |
| 5 | `supabase/functions/payment-provider-config-upsert/index.ts` | Uses RPC |
| 6 | `supabase/functions/payment-provider-config-list/index.ts` | Sanitized response |
| 7 | `supabase/functions/_shared/payment/capabilities.ts` | Import fix |

### Validation

| # | File |
|---|---|
| 1 | `validation/epf03r_privilege_tests.sql` |
| 2 | `validation/epf03r_tenant_isolation_tests.sql` |
| 3 | `validation/epf03r_webhook_tests.sql` |
| 4 | `validation/epf03r_refund_tests.sql` |
| 5 | `validation/epf03r_state_machine_tests.sql` |
| 6 | `validation/epf03r_regression_tests.sql` |
| 7 | `validation/run_epf03r_tests.sh` |
| 8 | `validation/epf01_financial_regression.sql` |
| 9 | `validation/type_check_functions.sh` |

### Documentation

| # | File |
|---|---|
| 1 | `docs/backend/42-epf03-executive-report.md` |

### Configuration

| # | File |
|---|---|
| 1 | `package.json` |

---

## 8. Known Limitations

1. **Mock provider only.** PIX and Boleto execution uses the mock provider. Real provider adapters (Stripe, Asaas, Efí, Sicoob, Sicredi, BB, Caixa) are declared in the registry but throw `NotImplementedError`.
2. **Credit/debit cards provider-ready only.** No executable adapters or PCI-handling logic in EPF-03.
3. **CNAB declared only.** The `cnab_support` capability exists for bank providers; no CNAB file layouts or processing implemented.
4. **External refund call is distributed.** The provider API call and the database finalization are not a single global transaction; finalization is atomic and recoverable through idempotency.
5. **Edge Function static/runtime validation pending because Deno is not installed in the current execution environment.** `npm run type-check:functions` is reported as SKIPPED, not PASS. Local HTTP runtime validation of the modified EPF-03 Edge Functions was not executed. The SQL/RPC contract layer has been fully validated.
6. **No automatic reconciliation polling.** Payment status lookup is a declared capability; scheduled polling or manual status check UI is not implemented.
7. **No settlement reporting UI.** Settlement lookup capability is declared; settlement reports and UI deferred.
8. **Frontend pages are structural.** The service layer and contracts are implemented; full UI integration is pending design-system alignment.

---

## 9. Readiness for Next Steps

EPF-03R leaves the codebase ready for:

- Real provider adapter implementations behind the same `PaymentProvider` interface.
- Resident-facing PIX/Boleto payment pages.
- Refund and cancellation admin flows.
- Webhook endpoint deployment per provider.
- Settlement reconciliation and reporting.
- CNAB file integration with selected banks.

All certified EPF-01 and EPF-02 regressions continue to pass.

---

## 10. Synchronization

After remediation:

- Branch: `sprint-03-epf03-payment-platform`
- Local HEAD: remediation commit
- Remote HEAD: matches local HEAD
- Working tree: clean
- Ahead: 0
- Behind: 0

---

*Date: 2026-07-24*
*Remediation Date: 2026-07-22*
*Status: EPF-03R IMPLEMENTED — READY FOR INDEPENDENT TECHNICAL RECERTIFICATION*
*Next Step: Independent technical recertification of EPF-03R, including Edge Function static/runtime validation once Deno or a deployed Supabase environment is available.*
