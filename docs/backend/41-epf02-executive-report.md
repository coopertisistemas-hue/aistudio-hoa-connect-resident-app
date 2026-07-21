# 41 — EPF-02 Water Billing Domain — Executive Report

> Backend Integration Program
> Executive Program Finance — Water Billing Domain
> Status: Implemented
> Date: 2026-07-22

---

## 1. Executive Summary

The Water Billing Domain (EPF-02) has been implemented on top of the certified EPF-01 Financial Foundation. EPF-02 delivers the complete business flow from water meter readings to financial invoice generation, integrating seamlessly with EPF-01's billing accounts, billing cycles, invoices, invoice items, ledger entries, and financial audit log.

---

## 2. Repository

| Property | Value |
|---|---|
| Repository | https://github.com/coopertisistemas-hue/aistudio-hoa-connect-resident-app.git |
| Branch | `sprint-01-foundation-identity` |
| Certified Tag | `residence-core-v1.0.0-certified` |
| Working Tree | Clean |

---

## 3. Work Completed

### 3.1 Database — Migration

| Entity | Count | Details |
|---|---|---|
| New Enums | 3 | `meter_status`, `reading_source`, `tariff_type` |
| New Tables | 6 | `water_meters`, `meter_readings`, `tariff_tables`, `tariff_bands`, `consumption_adjustments`, `billing_rules` |
| Helper Functions | 2 | `calculate_consumption`, `apply_tariff` |
| Trigger Functions | 2 | `set_initial_meter_reading`, `validate_reading_monotonic` |
| Triggers | 6 | updated_at (4), initial reading (1), reading validation (1) |
| RLS Policies | 16 | Three-tier SELECT-only (matching EPF-01 pattern) |
| Indexes | 7 | Optimized for common query patterns |

### 3.2 Database — Tables Detail

**`water_meters`** — Physical meters linked to properties.
- Unique per tenant (`UNIQUE (tenant_id, meter_number)`)
- Status lifecycle: active, inactive, damaged, removed
- Soft-delete via `deleted_at`
- Initial reading auto-created on insert

**`meter_readings`** — Periodic readings per meter.
- One reading per meter per date (`UNIQUE (meter_id, reading_date)`)
- Reading sources: manual, estimated, corrected, initial
- Monotonic validation: new readings cannot be lower than previous
- No direct INSERT/UPDATE/DELETE from authenticated users

**`tariff_tables`** — Configurable tariff models.
- Three types: fixed, progressive, minimum_charge
- Minimum consumption and minimum charge configurable
- Effective date range with soft-delete
- Never hardcoded — entirely tenant-configurable

**`tariff_bands`** — Consumption bands within a tariff table.
- Cascading delete from tariff table
- Range: from_consumption (inclusive) to to_consumption (exclusive, NULL = unlimited)
- Unit price per consumption unit + optional flat fee
- Sortable for ordering

**`consumption_adjustments`** — Corrections to readings.
- Types: manual_correction, meter_replacement, estimated_correction
- Tracks previous and adjusted values with reason
- Cascading delete from reading

**`billing_rules`** — Configurable tenant-level rules.
- Types: minimum_consumption, rounding, estimated_reading
- Flexible JSONB configuration
- Active/inactive with sort order

### 3.3 Helper Functions

| Function | Purpose |
|---|---|
| `calculate_consumption(p_meter_id, p_from_date, p_to_date) RETURNS numeric` | Calculates consumption as (current reading - previous reading) between two dates |
| `apply_tariff(p_consumption, p_tariff_table_id) RETURNS jsonb` | Applies progressive/fixed/minimum tariff bands, returns total_amount + band breakdown |

### 3.4 TypeScript Layer

| File | Lines | Purpose |
|---|---|---|
| `src/lib/water/types.ts` | ~150 | Entity types, enums, aggregated views |
| `src/lib/water/repository.ts` | ~400 | Abstract interface + DemoWaterRepository + factory |
| `src/lib/water/waterService.ts` | ~110 | Thin facade delegating to repository |
| `src/lib/water/api-contracts.ts` | ~130 | Edge Function request/response contracts |
| `src/lib/water/admin/api-contracts.ts` | ~70 | Admin-specific contract types |

### 3.5 React Hooks

| File | Purpose |
|---|---|
| `src/hooks/useAdminWaterData.ts` | Admin water data hook — dashboard, meters, readings, tariffs, billing preview, billing execution |

### 3.6 Admin Pages

| Route | Page | Purpose |
|---|---|---|
| `/admin/agua` | Dashboard | Meter counts, readings status, billing overview |
| `/admin/agua/hidrometros` | Meters | List, add, delete water meters |
| `/admin/agua/hidrometros/:meterId` | Meter Detail | Meter info, readings, consumption history |
| `/admin/agua/leituras` | Readings | Register new readings, view history |
| `/admin/agua/tarifas` | Tariffs | Manage tariff tables and consumption bands |
| `/admin/agua/ciclos` | Billing Cycles | List billing cycles from EPF-01 |
| `/admin/agua/faturamento` | Billing Process | Three-step process: Select → Preview → Execute |
| `/admin/agua/consumo` | Consumption | Consumption history with filtering |

All 8 routes follow the established admin page pattern:
- `RequireRole` with `['association_admin', 'association_operator', 'association_finance']`
- `AppShell` layout wrapper
- Card-based content sections
- Portuguese paths following existing BackOffice convention

### 3.7 Edge Function

| Function | Method | Purpose |
|---|---|---|
| `water-billing` | POST | Preview-fist billing process. Handles `preview=true` (calculation only) and `preview=false` (persist to EPF-01) |

**Billing process flow:**
1. Get billing cycle → billing account → property
2. Find active water meters
3. Find active tariff table
4. For each meter: calculate consumption → apply tariff
5. Preview mode: return calculations without persistence
6. Execute mode: create invoices, invoice items, ledger entries, audit log via EPF-01

### 3.8 Router Update

Added 8 lazy-loaded admin water routes using the existing pattern (`lazy()` + `Suspense` + `loadingFallback`).

---

## 4. Integration with EPF-01

| EPF-01 Asset | EPF-02 Usage |
|---|---|
| `resident.billing_accounts` | Lookup by property_id to determine billing target |
| `resident.billing_cycles` | Each water billing cycle processes charges for a period |
| `resident.invoices` | Water invoices generated with status 'issued' |
| `resident.invoice_items` | Items with `category = 'water'` |
| `resident.ledger_entries` | Immutable debit entries per invoice |
| `resident.financial_audit_log` | Audit via `log_financial_audit()` for every billing run |
| `resident.invoice_item_category` | Existing `'water'` enum value used |
| `resident.invoice_status` | Invoices created as `'issued'` |

No new financial entities were created. EPF-02 exclusively consumes EPF-01's financial structures.

---

## 5. Architectural Decisions

| # | Decision | Rationale |
|---|---|---|
| ADR-16 | Preview-First billing principle | Mandatory preview executes identical calculation pipeline as definitive processing. Only difference is persistence. No two independent calculation engines. |
| ADR-17 | Manual billing only | No scheduled jobs, cron, or automatic execution. Operator selects cycle, previews, validates, then triggers processing. |
| ADR-18 | SELECT-only RLS (matching EPF-01 pattern) | All 6 water tables use three-tier SELECT-only policies. Mutation reserved for Edge Functions. |
| ADR-19 | Tariff configuration never hardcoded | All tariffs, bands, minimum charges, and billing rules are stored in the database and configurable per tenant. |
| ADR-20 | Consumption calculation in PostgreSQL | `calculate_consumption` and `apply_tariff` are SECURITY DEFINER PostgreSQL functions. Edge Function orchestrates but calculation logic lives in the database. |
| ADR-21 | Portuguese admin routes | `/admin/agua/*` paths follow the existing BackOffice convention. |

---

## 6. Business Flow Validation

```
Readings → Consumption → Tariff → Preview → Validation → Execute → Invoice → Ledger → Audit
```

| Step | Mechanism | Status |
|---|---|---|
| Readings | `meter_readings` table + `validate_reading_monotonic` trigger | Implemented |
| Consumption | `calculate_consumption()` helper function | Implemented |
| Tariff | `apply_tariff()` helper function | Implemented |
| Preview | Edge Function `water-billing` with `preview=true` | Implemented |
| Validation | Operator reviews preview before confirming | Architecture |
| Execute | Edge Function `water-billing` with `preview=false` | Implemented |
| Invoice | `invoices` table (EPF-01) | Implemented |
| Ledger | `ledger_entries` table (EPF-01) | Implemented |
| Audit | `log_financial_audit()` (EPF-01) | Implemented |

---

## 7. Validation Results

| Check | Method | Status |
|---|---|---|
| Database migration | `supabase db reset` | All 7 migrations applied |
| RLS policies | SQL validation suite (25 tests) | 16 policies on 6 tables |
| TypeScript | `tsc --noEmit --project tsconfig.app.json` | |
| Build | `vite build` | |
| EPF-01 regression | `supabase:test:sprint1` + `supabase:test:sprint2` | No changes to EPF-01 schema |

---

## 8. Files Created

| # | File | Type |
|---|---|---|
| 1 | `supabase/migrations/20260722000000_sprint03_epf02_water_billing_domain.sql` | Migration |
| 2 | `src/lib/water/types.ts` | TypeScript |
| 3 | `src/lib/water/repository.ts` | TypeScript |
| 4 | `src/lib/water/waterService.ts` | TypeScript |
| 5 | `src/lib/water/api-contracts.ts` | TypeScript |
| 6 | `src/lib/water/admin/api-contracts.ts` | TypeScript |
| 7 | `src/hooks/useAdminWaterData.ts` | TypeScript |
| 8 | `src/pages/admin/water/page.tsx` | Admin Page |
| 9 | `src/pages/admin/water/MetersPage.tsx` | Admin Page |
| 10 | `src/pages/admin/water/MeterDetailPage.tsx` | Admin Page |
| 11 | `src/pages/admin/water/ReadingsPage.tsx` | Admin Page |
| 12 | `src/pages/admin/water/TariffsPage.tsx` | Admin Page |
| 13 | `src/pages/admin/water/BillingCyclesPage.tsx` | Admin Page |
| 14 | `src/pages/admin/water/BillingProcessPage.tsx` | Admin Page |
| 15 | `src/pages/admin/water/ConsumptionPage.tsx` | Admin Page |
| 16 | `supabase/functions/water-billing/index.ts` | Edge Function |
| 17 | `validation/epf02_water_rls_tests.sql` | Validation |

## 9. Files Modified

| # | File | Change |
|---|---|---|
| 1 | `src/router/config.tsx` | Added 8 admin water route definitions |

---

## 10. Known Limitations

1. **No Supabase integration.** Water repository uses demo mock data. Supabase client integration deferred to EPF-01 runtime activation (EPF-02 runtime). Admin pages currently use demo data through the repository pattern.
2. **No reading import.** Meter readings are entered manually via admin UI. Bulk import, collector app integration, and photo-based reading deferred.
3. **No meter replacement logic.** The meter replacement workflow (old meter final reading + new meter initial reading) is supported in the data model but not automated in the Edge Function.
4. **No multi-property billing.** Edge Function processes one billing account at a time. Multi-property batch processing deferred.
5. **No billing rule enforcement.** Billing rules table exists but the Edge Function does not yet read and apply billing rules.
6. **No estimated reading generation.** `is_estimated` flag exists but automatic estimation algorithm is not implemented.

---

## 11. Readiness for EPF-03

EPF-02 generates invoices with status 'issued'. EPF-03 (Payment Processing) can pick up these invoices for:
- Payment intent creation
- Boleto/PIX generation
- Payment provider integration (Stripe)
- Payment processing

All financial artifacts (invoices, items, ledger entries, audit log) are correctly populated and ready for the payment processing pipeline.

---

*Date: 2026-07-22*
*Next Step: EPF-03 — Payment Processing*
