# ADR-11 — Certified Frontend Error-Compatibility Contract

## Status

**Accepted — validated on July 19, 2026.**

Blocks Sprint 2 (Authentication / transport layer) and the finance service replacement in Sprint 4.

---

## Context

The certified Resident App frontend was built against demo services that return fully typed objects and signal failure with sentinel strings (`OFFLINE`, `ITEM_ERROR`, `DOCUMENT_ERROR`). The backend integration program must replace those demo services with real API services without changing hooks, pages, components, or types (ADR-02 and ADR-03).

The original blueprint assumed a clean, uniform three-sentinel taxonomy. Independent review of the certified hooks showed that the frontend does not handle the three sentinels uniformly.

---

## Problem

Preserve certified frontend behavior during backend transport replacement. Specifically:

- `useFinancasData` treats `OFFLINE` and `ITEM_ERROR` for the overview, but detail/document functions catch all errors and return `null`.
- `DOCUMENT_ERROR` is thrown by `fetchBoletoInfo` and `fetchPixInfo` but is **not** handled as a distinct sentinel by the hook.
- Several flows (invoice detail, payment detail, receipt) convert errors to `null`, rendering a document-unavailable or detail-unavailable state rather than the global offline banner.
- Profile, notification, and support hooks also swallow many errors to `null` or display raw messages.

If the backend contract changes these semantics — for example, by throwing `DOCUMENT_ERROR` where the hook expects `null` — the certified UX will regress.

---

## Considered options

### Option A — Preserve certified behavior exactly

The backend contract matches whatever the certified hooks currently do, even where inconsistent. Document the actual compatibility matrix. Defer redesign to a future product remediation phase.

### Option B — Redesign error handling now

Standardize on a strict three-sentinel taxonomy and update hooks to match.

- Rejected: violates ADR-02 (frozen frontend contract) and would require retesting certified screens.

### Option C — Return presentation-shaped errors from Edge Functions

Have Edge Functions return localized error labels and UI states.

- Rejected: violates ADR-03 (Presentation Assembly Layer); would move Portuguese UI copy into the backend.

---

## Decision

Select **Option A — Preserve certified behavior exactly**.

The backend transport layer maps HTTP/domain conditions to the same outcomes the demo services produced. The hook layer is treated as frozen.

### Error categories

| Category | Meaning | Backend mapping | Frontend outcome |
|---|---|---|---|
| Transport failure | Network unavailable, timeout, `navigator.onLine === false` | Throw `OFFLINE` | `OfflineBanner` |
| Domain absence | Resource not found or unavailable | Return `null` | Document/detail unavailable state |
| Document unavailable | Boleto, PIX, or receipt cannot be generated/presented | Return canonical DTO with `documentAvailable: false` (or `available: false`) | Assembler derives existing unavailable state |
| Generic item error | A specific item in a list cannot be loaded | Throw `ITEM_ERROR` | Inline item error |
| Swallowed-to-null compatibility | Flows where the certified hook catches all errors and returns `null` | Return `null` on any error | No sentinel fired |

### Finance compatibility matrix

| Frontend flow | Demo behavior | Target API error contract | Hook interpretation | Rendered UI state |
|---|---|---|---|---|
| `fetchFinancialOverview` | Throws `OFFLINE` or `ITEM_ERROR` | Network → `OFFLINE`; partial failure → `ITEM_ERROR` | `OFFLINE` → banner; `ITEM_ERROR` → list error | Overview error / offline banner |
| `fetchInvoiceDetail` | Returns `null` if not found; throws `OFFLINE` | 404/absence → `null`; network → `OFFLINE` | Catch-all returns `null` | Invoice unavailable state |
| `fetchBoletoInfo` | Throws `DOCUMENT_ERROR`; also `OFFLINE` | 503/generation failure → DTO `{ documentAvailable: false }`; network → `OFFLINE` | Catch-all returns `null` | Boleto unavailable state |
| `fetchPixInfo` | Throws `DOCUMENT_ERROR`; also `OFFLINE` | Same as boleto | Catch-all returns `null` | PIX unavailable state |
| `fetchPaymentHistory` | Throws `OFFLINE` | Network → `OFFLINE`; otherwise list | Returns `[]` on error | Empty payments list |
| `fetchPaymentDetail` | Returns `null` if not found | 404/absence → `null` | Catch-all returns `null` | Payment unavailable state |
| `fetchReceiptData` | Returns `null` if not found | 404/absence → `null` | Catch-all returns `null` | Receipt unavailable state |

### Rules for the replacement service layer

1. **Do not introduce new sentinels.** The replacement services must emit only the same error shapes the demo services emitted.
2. **Where a hook swallows errors, the service must not throw.** Return `null`, `[]`, or a domain-absence DTO shape that the hook already treats as absent.
3. **`DOCUMENT_ERROR` is not a hook-level sentinel.** The backend must not throw `DOCUMENT_ERROR` from boleto/PIX/receipt endpoints. Document generation failure is represented canonically (e.g., `documentAvailable: false`) and derived by the assembler.
4. **Network failures throw `OFFLINE`.** This is the one sentinel that must fire consistently for transport failures.
5. **`ITEM_ERROR` is used only where the certified hook already uses it.** For finance, that is the overview list partial failure.
6. Inconsistencies are recorded as **future product remediation**, not silently fixed during transport replacement.

---

## Consequences

- **Cost:** the backend contract must reproduce some frontend quirks, including swallowed errors. This is intentional — the migration seam is compatibility, not idealization.
- **Benefit:** zero hook, page, or component changes during backend migration; certified UX preserved exactly.
- **Risk:** future developers may see the swallowed-error pattern and "fix" it. Mitigation: this ADR and the compatibility matrix are the governing record; any change requires a product-approved frontend change.
- **Testability:** assembler test vectors can assert that a backend DTO assembles to the same object a demo fixture produced, including the absence shapes.

---

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Option B — redesign error handling now | Violates ADR-02 (frozen frontend contract); would require re-certifying screens. |
| Option C — presentation errors from Edge Functions | Violates ADR-03 (Presentation Assembly Layer); moves UI copy into the backend. |
| Throw `DOCUMENT_ERROR` from backend and handle it in hooks | The certified hooks do not handle it; this would regress boleto/PIX screens. |

---

## Validation requirement

Before Sprint 4 (Finance) opens:

1. Execute assembler test vectors for finance against existing demo fixtures.
2. Confirm that the replacement `financeService.ts` produces structurally identical results for every `FinanceScenarioKey`.
3. Confirm that the boleto, PIX, and receipt functions return `null` (or equivalent absence shape) when the backend represents document-unavailable, rather than throwing `DOCUMENT_ERROR`.
4. Confirm network failure throws `OFFLINE` in exactly the same call sites as the demo service.

---

## Rollback or revision conditions

- If a future product decision standardizes error handling, this ADR is revised and the frontend contract change is tracked as a separate, approved UX change.
- If the assembler test vectors reveal a mismatch, the backend contract changes — never the hook.

---

## Validation Outcome — July 19, 2026

Executable validation ran with:

- [validation/adr11_finance_compatibility.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr11_finance_compatibility.mjs)
- source hooks and fixtures in [src/hooks/useFinancasData.ts](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/src/hooks/useFinancasData.ts), [src/demo/financeService.ts](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/src/demo/financeService.ts), and [src/fixtures/financialScenarios.ts](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/src/fixtures/financialScenarios.ts)

Result summary:

- Total vectors: 11
- Passed: 11
- Failed: 0

Key preserved behaviors:

- Offline overview requests still map to the offline banner.
- Offline detail/document requests still collapse to `null` and render unavailable states rather than a global banner.
- `DOCUMENT_ERROR` is still swallowed to `null` by the certified hook path and is **not** a universal hook sentinel.
- `ITEM_ERROR` remains non-uniform: the certified finance detail path collapses it to `null` rather than surfacing list state.
- Missing invoice, payment, and receipt resources all preserve unavailable-state rendering.

Current ADR-11 verdict:

```text
VALIDATED — COMPATIBILITY PRESERVED
```
