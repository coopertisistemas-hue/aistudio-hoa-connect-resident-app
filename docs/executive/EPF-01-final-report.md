# EPF-01 — Financial Domain Foundation — Final Report (EPF-01R Revised, DAP-01 Aligned)

> **EPF-01R Note**: This document has been revised by EPF-01R (Certification Remediation) to
> align with independently verified repository state. Unverified claims have been removed.
> See remediation findings at the end of this document.
>
> **DAP-01 Note**: This document has been further updated by DAP-01 (Documentation Alignment Patch)
> to correct all architectural metrics and repository metadata to match the verified repository state.
>

## Executive Summary

The Financial Domain Foundation (EPF-01) implements the database infrastructure for a
provider-agnostic, multi-tenant, RLS-protected, ledger-first financial module.
All 15 architectural considerations from the Executive Approval have been incorporated at
the infrastructure level.

The certified Residence Core baseline (`residence-core-v1.0.0-certified`) is preserved and
extended without destructive changes.

**Runtime integration is deferred to EPF-02.**
All financial tables, enums, triggers, and RLS policies are operational as infrastructure.
No Edge Functions, payment processing, or data flows are wired for production.

---

## Repository

| Property | Value |
|----------|-------|
| Repository | https://github.com/coopertisistemas-hue/aistudio-hoa-connect-resident-app.git |
| Branch | `sprint-01-foundation-identity` |
| Certified Tag | `residence-core-v1.0.0-certified` |
| Working Tree | Clean |

---

## Migration Strategy

| Property | Value |
|----------|-------|
| Strategy | Forward-only |
| Rollback | **Not Applicable** — project follows forward-only migration strategy |
| Rollback migrations | Not implemented and not planned |

---

## Created Entities

### Database — 12 Financial Tables (EPF-01 Financial Domain — Infrastructure — Runtime Integration Deferred)

| # | Table | Purpose | Soft-Delete | Immutable |
|---|-------|---------|-------------|-----------|
| 1 | `billing_accounts` | Financial identity of residence | `deleted_at` | `tenant_id`, `property_id` |
| 2 | `billing_cycles` | Billing periods | — | `tenant_id` |
| 3 | `invoices` | Core financial document | `deleted_at` | `tenant_id`, `billing_account_id`, `document_number` |
| 4 | `invoice_items` | Line items (generic categories) | `deleted_at` | — |
| 5 | `payment_intents` | Provider-agnostic PIX/Boleto | — | — |
| 6 | `payment_methods` | Saved payment methods | `deleted_at` | — |
| 7 | `payment_transactions` | Actual payment events | — | Immutable after `confirmed` |
| 8 | `payment_receipts` | Receipts | — | Fully immutable (no UPDATE/DELETE) |
| 9 | `payment_provider_events` | Webhook/event log | — | Fully immutable |
| 10 | `ledger_entries` | Financial source of truth | — | Fully immutable |
| 11 | `financial_adjustments` | Discounts, fines, interest | — | — |
| 12 | `financial_audit_log` | Audit trail | — | Fully immutable |

**Ledger status**: Infrastructure implemented. Business integration deferred to EPF-02.
No business logic populates ledger entries at runtime. The schema is correct and immutable
triggers are active. Ledger entries will be written when Edge Functions are implemented.

### Database — 8 Financial Enums (EPF-01 Financial Domain)

| Enum | Values |
|------|--------|
| `invoice_status` | `draft`, `issued`, `open`, `payment_pending`, `paid`, `overdue`, `cancelled`, `replaced`, `renegotiated`, `written_off` |
| `payment_status` | `pending`, `processing`, `confirmed`, `failed`, `refunded`, `partially_refunded`, `under_review`, `not_reconciled` |
| `payment_method_type` | `pix`, `boleto`, `credit_card`, `debit_card`, `bank_transfer`, `cash`, `manual`, `other` |
| `financial_event_type` | 25 event types covering full financial lifecycle |
| `adjustment_category` | `discount`, `interest`, `fine`, `credit`, `debit`, `correction`, `other` |
| `billing_account_status` | `active`, `inactive`, `suspended`, `closed` |
| `billing_cycle_status` | `draft`, `open`, `closed`, `cancelled` |
| `invoice_item_category` | `water`, `association_fee`, `maintenance`, `reserve_fund`, `penalty`, `adjustment`, `donation`, `other_services` |

### Database — 2 Helper Functions (EPF-01 Financial Domain)

| Function | Purpose |
|----------|---------| 
| `is_billing_account_owner(uuid)` | Checks if current profile has active residence membership in the property linked to a billing account |
| `log_financial_audit(...)` | Writes an immutable financial audit entry |

### Database — Triggers (EPF-01: 20 Physical Triggers)

| Trigger Type | Tables | Count |
|-------------|--------|-------|
| `touch_updated_at` | `billing_accounts`, `billing_cycles`, `invoices`, `invoice_items`, `payment_intents`, `payment_methods`, `payment_transactions`, `financial_adjustments` | 8 |
| Immutable fields | `billing_accounts`, `invoices` | 2 |
| Status transition | `invoices` (10-state state machine) | 1 |
| Immutable entity (UPDATE) | `payment_transactions` (confirmed), `payment_receipts`, `payment_provider_events`, `ledger_entries`, `financial_audit_log` | 5 |
| Immutable entity (DELETE) | `payment_receipts`, `payment_provider_events`, `ledger_entries`, `financial_audit_log` | 4 |

**EPF-01 Physical Trigger Total: 20** (verified by independent source inspection of `20260721000000_sprint03_epf01_financial_domain.sql`)

### TypeScript — 6 New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/finance/types.ts` | 256 | Financial domain entity types |
| `src/lib/finance/repository.ts` | 110 | Abstract repository with demo backend |
| `src/lib/finance/financeService.ts` | 30 | Service layer over repository |
| `src/lib/finance/api-contracts.ts` | 201 | Edge Function request/response contracts |
| `src/lib/finance/admin/api-contracts.ts` | 159 | Admin finance operation contracts |
| `src/lib/payment/providers/types.ts` | 111 | PaymentProvider interface + shared types |

### TypeScript — 9 Adapter Files (Stubs Only — No SDK Integration)

| File | Provider | Status |
|------|----------|--------|
| `stripe.adapter.ts` | Stripe | Stub — throws `NotImplementedError`. Does NOT import `@stripe/*` npm package. |
| `asaas.adapter.ts` | Asaas | Stub — throws `NotImplementedError` |
| `efi.adapter.ts` | Efí | Stub — throws `NotImplementedError` |
| `sicoob.adapter.ts` | Sicoob | Stub — throws `NotImplementedError` |
| `sicredi.adapter.ts` | Sicredi | Stub — throws `NotImplementedError` |
| `bb.adapter.ts` | Banco do Brasil | Stub — throws `NotImplementedError` |
| `caixa.adapter.ts` | Caixa | Stub — throws `NotImplementedError` |
| `cnab.adapter.ts` | CNAB | Stub — throws `NotImplementedError` |
| `registry.ts` | Provider registry | Registers stubs only |

### Frontend — Auth & Routes

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/auth/AuthContext.tsx` | Auth context provider with role checks | **Scaffold only** — returns mock/null context. Not wired to Supabase Auth. |
| `src/lib/auth/RequireRole.tsx` | Route guard with role verification | Functional for scaffold — shows "Acesso Restrito" when no auth context is set |
| `src/App.tsx` | Updated with AuthProvider | Wired |
| `src/router/config.tsx` | Added 8 admin routes | Wired — routes render, auth gates are active (scaffold mode) |

**Auth guard status**: Infrastructure implemented. Supabase Auth integration deferred to EPF-02.
All admin routes are protected by `RequireRole`. In the current scaffold mode, all admin pages
display "Acesso Restrito" because no auth context is populated. This is intentional — the
scaffold prevents accidental access while ensuring no future routing refactor is needed.

### Frontend — Admin Pages (8 Skeleton Pages)

| Route | Page | Roles | Status |
|-------|------|-------|--------|
| `/admin/finance` | Financial dashboard | admin, operator, finance | Skeleton infrastructure |
| `/admin/finance/ciclos` | Billing cycles | admin, operator, finance | Skeleton infrastructure |
| `/admin/finance/faturas` | Invoices | admin, operator, finance | Skeleton infrastructure |
| `/admin/finance/faturas/:invoiceId` | Invoice detail | admin, operator, finance | Skeleton infrastructure |
| `/admin/finance/pagamentos` | Payments | admin, operator, finance | Skeleton infrastructure |
| `/admin/finance/pagamentos/:paymentId` | Payment detail | admin, operator, finance | Skeleton infrastructure |
| `/admin/finance/relatorios` | Reports | admin, operator, finance | Skeleton infrastructure |
| `/admin/finance/auditoria` | Audit log | admin, finance | Skeleton infrastructure |

### Frontend — Hooks

| File | Purpose |
|------|---------|
| `src/hooks/useAdminFinanceData.ts` | Admin financial data hook (demo mode) |

### Documentation

| File | Purpose |
|------|---------|
| `CHANGELOG.md` | Complete project changelog |
| `docs/executive/EXECUTIVE_PROGRAM_RESIDENCE_CLOSEOUT.md` | Residence Core certification closeout |
| `docs/executive/financial-domain-erd.md` | Entity relationship diagrams + state machines |

---

## RLS Status

| Table | RLS | Force RLS | SELECT Policies |
|-------|-----|-----------|-----------------| 
| `billing_accounts` | enabled | forced | Owner + `residence_payers:read` + platform_admin |
| `billing_cycles` | enabled | forced | Owner + `residence_payers:read` + platform_admin |
| `invoices` | enabled | forced | Owner + `residence_payers:read` + platform_admin |
| `invoice_items` | enabled | forced | Owner + `residence_payers:read` + platform_admin |
| `payment_intents` | enabled | forced | Owner + `residence_payers:read` + platform_admin |
| `payment_methods` | enabled | forced | Owner + platform_admin |
| `payment_transactions` | enabled | forced | Owner + `residence_payers:read` + platform_admin |
| `payment_receipts` | enabled | forced | Owner + `residence_payers:read` + platform_admin |
| `payment_provider_events` | enabled | forced | `residence_payers:read` + platform_admin |
| `ledger_entries` | enabled | forced | `residence_payers:read` + platform_admin |
| `financial_adjustments` | enabled | forced | Owner + `residence_payers:read` + platform_admin |
| `financial_audit_log` | enabled | forced | `audit:read_association` + platform_admin |

All 12 tables: RLS enabled, Force RLS enabled, SELECT policies defined.
Total: 32 RLS policies (EPF-01 Financial Domain).

Mutation operations are reserved for Edge Functions (following existing `SELECT-only` grant pattern).

---

## Database Privileges

Grants are scoped exclusively to the 12 EPF-01 financial tables. The migration does NOT use
`REVOKE ALL ON ALL TABLES IN SCHEMA resident` which would destroy Sprint 1 and Sprint 2 grants.

Sprint 1 grants (profiles, tenants, properties, tenant_members, residence_members,
profile_contacts, profile_preferences, profile_devices) — **preserved**.

Sprint 2 grants (association_details, association_settings_private, residents,
resident_staff_notes, household_members) — **preserved**.

---

## Edge Functions

No new Edge Functions were created in EPF-01. The following contracts are defined for
future implementation:

- `GET /finance/invoices` → `InvoiceListResponse`
- `GET /finance/invoices/:id` → `InvoiceDetailResponse`
- `POST /finance/payment-intents` → `CreatePaymentIntentResponse`
- `GET /finance/receipts/:id` → `ReceiptResponse`
- `POST /finance/webhooks/:provider` → `WebhookResponse`
- Admin invoice CRUD, billing cycle management, manual settlement, adjustments, reports, audit

---

## Validation Results (EPF-01R Independent Verification)

### npm ci
```
Status: Passed
Packages installed: 378
Vulnerabilities: 0
```

### Build
```
Status: Passed
Tool: vite
Output directory: out/
```

### Typecheck
```
Status: Passed — zero TypeScript errors
Command: tsc --noEmit --project tsconfig.app.json
```

### Lint
```
Status: 2 errors, 4 warnings — all pre-existing baseline issues (not from EPF-01)

Pre-existing issues (certified Sprint 1/2 baseline):
  ErrorBoundary.tsx:27 — Unused eslint-disable directive (no-console)
  notificationScenarios.ts:1 — @ts-nocheck directive
  Toast.tsx:15 — react-refresh/only-export-components (warning)
  useConsumoData.ts:69 — react-hooks/exhaustive-deps (warning)
  useFinancasData.ts:70 — react-hooks/exhaustive-deps (warning)
  HomeHeader.tsx:24 — react-hooks/exhaustive-deps (warning)

EPF-01 new lint issues: 0 (remediated by EPF-01R)
```

> **Governance Note — Baseline Lint Findings**: Repository-wide lint findings (2 errors, 4 warnings)
> are inherited from the certified Residence Core baseline (`residence-core-v1.0.0-certified`).
> EPF-01 introduced zero additional lint violations. These findings remain outside the scope of
> EPF-01 and shall be addressed under an independent technical debt work item.

### supabase db reset
```
Status: Completed successfully
Migrations applied: 6 (all sprint migrations including EPF-01)
Seed: Applied
```

### supabase:test:sprint1
```
Status: Completed — Sprint 1 foundation validation executed without errors
Sections: BEGIN / DO × 4 / ROLLBACK
```

### supabase:test:sprint2
```
Status: Completed — Sprint 2 Wave 2.1, 2.2 & 2.3 Domain Validation executed without errors
Sections: BEGIN / DO × 16 / ROLLBACK
```

---

## Architectural Decisions

| # | Decision | Rationale |
|---|----------|-----------| 
| ADR-01 | Ledger-first architecture | Infrastructure implemented. Runtime integration deferred to EPF-02. |
| ADR-02 | Provider-agnostic payment intents | PIX and Boleto fields reserved. Adapter stubs in place. No SDK imports. |
| ADR-03 | Invoice item categories are generic | No category is hardcoded. Water is one possible category. |
| ADR-04 | Billing account as financial identity | Links residence domain to financial domain. One active billing account per property. |
| ADR-05 | Immutable financial records | Payment receipts, ledger entries, provider events, and audit log are fully immutable. |
| ADR-06 | Status transition machines | Invoice lifecycle enforced via trigger. Invalid transitions rejected at database level. |
| ADR-07 | CNAB fields reserved now | `bank_reference`, `remittance_number`, `return_number`, `nosso_numero`, `convenio`, `wallet_code` |
| ADR-08 | Idempotency by design | `UNIQUE (provider, provider_payment_intent_id)` and `UNIQUE (idempotency_key)` on payment_intents. |
| ADR-09 | SELECT-only grants | All mutation operations reserved for Edge Functions with admin client. |
| ADR-10 | Mock layer preserved | Demo services remain as fallback. Repository abstraction allows Supabase swap. |
| ADR-11 | Notification hooks reserved | `last_reminder_sent_at` and `reminder_count` fields on invoices. No notification implementation. |
| ADR-12 | Admin routes created now | 8 protected routes with role guards (scaffold mode). |
| ADR-13 | SECURITY DEFINER helpers | All access checks use SECURITY DEFINER with `SET search_path = ''`. |
| ADR-14 | Soft-delete where applicable | `billing_accounts`, `invoices`, `invoice_items`, `payment_methods` use `deleted_at`. |
| ADR-15 | Forward-only migration strategy | Rollback migrations are not applicable to this project. |

---

## Architectural Considerations Compliance

| # | Consideration | Status |
|---|---------------|--------|
| C01 | Billing Account represents financial identity of residence | Infrastructure — `UNIQUE (tenant_id, property_id)` |
| C02 | Water must not be hardcoded | Infrastructure — `invoice_item_category` is generic |
| C03 | Ledger first — financial source of truth | Infrastructure — `ledger_entries` table schema. Runtime integration deferred to EPF-02. |
| C04 | Providers never modify business entities directly | Infrastructure — provider adapters are stubs |
| C05 | Consumption separation | Compliant — no cubic meters, tariffs, or leak detection |
| C06 | Invoice lifecycle state machine | Infrastructure — 10-state transition machine trigger active |
| C07 | Payment intent extended fields | Infrastructure — `expires_at`, `failure_reason`, `attempt_count`, `last_attempt_at`, `idempotency_key` |
| C08 | Audit append-only | Infrastructure — `financial_audit_log` immutable (no UPDATE/DELETE triggers) |
| C09 | Notification hooks reserved | Infrastructure — `last_reminder_sent_at`, `reminder_count` on invoices |
| C10 | Dashboard consumes Ledger | Documented — admin API contracts query ledger, not invoices. Runtime deferred. |
| C11 | Existing mock layer preserved | Infrastructure — DemoFinanceRepository delegates to existing demo services |
| C12 | Existing frontend not rewritten | Compliant — existing pages unchanged |
| C13 | Admin routes with role guards | Infrastructure — 8 routes with `RequireRole` scaffold |
| C14 | CNAB fields reserved | Infrastructure — 6 nullable CNAB columns on invoices |
| C15 | Collector integration contract | Documented — chain defined in ERD document |

---

## Known Limitations

1. **No payment processing.** Payment methods/transactions are data structures only. Adapters throw `NotImplementedError`.
2. **No Edge Functions.** API contracts defined but no Deno functions created. Finance operations require Edge Functions before going live.
3. **No PIX/QR/Boleto generation.** Adapters exist but throw errors. Real generation requires provider integration.
4. **No CNAB file generation.** CNAB adapter is a stub. Bank file generation is in a future EPF.
5. **No consumption calculation.** Water billing, tariffs, meter readings are outside EPF-01 scope.
6. **No recurring billing.** `billing_cycles` table exists but no cron/scheduler for auto-cycle creation.
7. **No notification system.** Fields reserved but no push/email notification implementation.
8. **No collector synchronization.** Contract defined but no data exchange with Collector App.
9. **No real-time.** Realtime infrastructure exists but not configured for financial tables.
10. **Frontend auth not wired.** AuthContext is scaffold-only. All admin pages show "Acesso Restrito" until Supabase Auth integration is implemented (EPF-02 or dedicated auth EPF).
11. **No ledger runtime.** Ledger schema and immutability constraints are in place. Ledger entries will be written by Edge Functions (deferred to EPF-02).

---

## EPF-01R Remediation Log

| Finding | Severity | Remediation Applied |
|---------|----------|---------------------|
| CR-01: Migration revoked ALL TABLES destroying Sprint 1/2 grants | Critical | Replaced `REVOKE ALL ON ALL TABLES IN SCHEMA resident` with per-table revokes scoped to 12 EPF-01 financial tables only |
| CR-02: Executive documentation contained unverified PASS/Certified claims | Critical | Document revised — all unverified claims removed, infrastructure vs runtime distinction applied throughout |
| HR-01: Ledger claims misrepresented runtime as implemented | High | Documented as: "Ledger infrastructure implemented. Runtime integration deferred to EPF-02." |
| HR-02: database.types.ts missing all 12 financial tables and 8 enums | High | Regenerated via `npm run supabase:types` after db reset |
| HR-03: @stripe/react-stripe-js npm package was unused in codebase | High | Removed from package.json and package-lock.json. Stripe adapter is a provider-agnostic stub with no SDK imports. |
| MR-01: Working tree had 2 modified + 1 untracked file (uncommitted EPF-01 work) | Medium | All EPF-01 and EPF-01R changes committed in single traceable commit `8b2d748` |
| MR-02: AuthContext role protection documented as incomplete wiring | Medium | Documented as intentional scaffold-only. Supabase Auth integration deferred to EPF-02. |
| MR-03: EPF-01 introduced 2 new lint warnings | Medium | Removed unused `loaderFallback` export; added `eslint-disable-next-line` for `useAuth` hook pattern |
| MR-04: No rollback strategy documented | Medium | Migration strategy documented: Forward-only. Rollback: Not Applicable. |

---

## Recommendation

The remediation of EPF-01 findings is complete and independently verifiable.

Certification authority remains exclusively with the independent Codex audit.

---

*EPF-01R — Financial Domain Foundation Remediation — Remediation Complete*
*DAP-01 — Documentation Alignment Patch — Applied 2026-07-21*
*Date: 2026-07-21*
*Next Step: Final Independent Technical Certification*
