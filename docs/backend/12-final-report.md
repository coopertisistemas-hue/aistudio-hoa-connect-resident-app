# 12 — D2 Readiness Final Report

> Backend Integration Program — Architecture Remediation Wave  
> Independent Review Incorporation, Blueprint Reconciliation and D2 Readiness

---

## 1. Final verdict

**Superseded on July 19, 2026 by [16-realtime-authorization-diagnostic-report.md](16-realtime-authorization-diagnostic-report.md).**

The later July 19, 2026 diagnostic wave changed the program decision after tracing the remaining `support_messages` failure to the local validation harness:

```text
D2 PASS — SPRINT 1 AUTHORIZED
```

See [14-realtime-remediation-report.md](14-realtime-remediation-report.md) and [15-realtime-option-b-validation-report.md](15-realtime-option-b-validation-report.md) for the historical failed waves, and [16-realtime-authorization-diagnostic-report.md](16-realtime-authorization-diagnostic-report.md) for the final passing diagnostic evidence.

This report remains the close-out artifact for the **architecture remediation wave only**.
The later D2 validation wave, Wave B Option B rerun, and the final diagnostic wave executed the runtime conditions and produced:

```text
D2 PASS — SPRINT 1 AUTHORIZED
```

---

## 2. Review artifact

Created: `docs/backend/08-architecture-review.md`

The governed record contains:

- review context and evidence inspected;
- independently verified claims;
- findings F1 through F6 with severity, affected documents, and required remediation;
- final disposition and remediation status;
- D2 impact assessment.

---

## 3. Finding disposition

| Finding | Previous state | Correction | Affected documents | Final status |
|---|---|---|---|---|
| **F1** | ADR-07 conflicted with Realtime `postgres_changes` | Selected **Option A — narrow `SELECT` grants** on `notifications` and `support_messages`; all other grants revoked; RLS remains load-bearing; ADR-09 created | 01, 04, 05, 07, 09 | Resolved in architecture; runtime validation pending |
| **F2** | `profiles` RLS used undefined generic tenant predicate | Three explicit policy groups: self access, authorized association access via `residence_members` chain, platform admin; ADR-10 created | 01, 02, 04, 06, 07, 10 | Resolved in architecture; runtime validation pending |
| **F3** | Error taxonomy claimed uniform three-sentinel handling | Compatibility matrix documented; certified hook behavior preserved; `DOCUMENT_ERROR` is not a hook-level sentinel; ADR-11 created | 01, 03, 06, 07, 11 | Resolved in architecture |
| **F4** | `profile_contacts` referenced but unspecified | Complete entity specification added: columns, constraints, indexes, verification-state model, RLS policies, API ownership, Sprint 1.1 placement, testing requirements | 02, 03, 04, 06, 08 | Resolved in architecture |
| **F5** | "60 operations" claim did not reconcile | Canonical inventory produced: **60 exported functions**, **52 production-relevant operations**; classification by service; success criterion corrected | 01, 03, 07, 08 | Resolved in architecture |
| **F6** | `.env` tracked, no `.gitignore`, treated as future hygiene | Current-state risk registered; repository-hardening tasks added; `.gitignore` and `.env.example` created; anon key correctly classified as public-by-design | 06, 07, repo root | Resolved in architecture |

---

## 4. ADR decisions

| ADR | Title | Selected option | Validation condition | Rollback / revision trigger |
|---|---|---|---|---|
| [ADR-09](09-adr-realtime-privilege-model.md) | Realtime privilege model | **Option A — Narrow table grants** | Validate in branch/disposable Supabase project before Sprint 6: subscriptions receive only authorized rows; revoking the two `SELECT` grants causes silence | Data leakage across profiles; future broadcast requirements |
| [ADR-10](10-adr-platform-profile-authorization.md) | Platform-level profile authorization | **Three policy groups** on `profiles` | Full RLS negative-test suite green before Sprint 1 | Performance issues at scale; product changes to co-resident PII visibility |
| [ADR-11](11-adr-frontend-error-compatibility.md) | Certified frontend error-compatibility contract | **Preserve certified behavior exactly** | Assembler test vectors against demo fixtures green before Sprint 4 | Product-approved frontend error-handling redesign |

---

## 5. Entity and RLS completeness

- **`profiles` policy definition:** explicit self, authorized association, and platform-admin access; protected-field enforcement; CPF/birth-date exposure controls. See Doc 04 §3.3.1 and ADR-10.
- **`profile_contacts` specification:** complete entity catalog in Doc 02; verification state model `unverified | pending | verified | invalid | outdated`; RLS matrix row in Doc 04 §3.3.2.
- **RLS matrix completeness:** all proposed tables appear, including `profiles` and `profile_contacts`. Test suite expanded from 7 to 11 negative-test classes.
- **Remaining exceptions:** only the two narrow `SELECT` grants on `notifications` and `support_messages` for Realtime (ADR-09). No broad table access introduced.

---

## 6. Error compatibility

- **Corrected taxonomy:** five categories — transport failure, domain absence, document unavailable, generic item error, swallowed-to-null compatibility.
- **Finance compatibility behavior:** `fetchBoleto`, `fetchPix`, `fetchInvoice`, `fetchPayment`, `fetchReceipt` all swallow errors to `null` in the certified hooks. The backend contract must return `null` or an absence-shaped DTO, not throw `DOCUMENT_ERROR`.
- **API-to-UI mapping:** documented in Doc 01 §3.2 compatibility matrix and ADR-11.

---

## 7. Operation inventory

| Category | Count |
|---|---|
| Total exported demo-service functions | **60** |
| Production-relevant operations | **52** |
| Local UI utility | 1 (`fetchDeviceAppInfo`) |
| Static catalogs | 5 (`fetchPrivacySections`, `fetchPrivacyDataCategories`, `fetchAboutInfo`, `fetchFAQ`, `getSupportCategoryOptions`) |
| Demo-only reset | 1 (`resetNotificationState`) |
| Session operation | 1 (`performSignOut`) |
| Retired / no backend | 0 |

**Corrected success criterion:**

> Every one of the **52 production-relevant demo-service operations** is served by a live Edge Function.

---

## 8. Risk register

| Risk | State |
|---|---|
| Committed `.env` | Current-state risk; `.gitignore` and `.env.example` created; Git history to be inspected |
| Absent `.gitignore` | Resolved — created |
| Signup exposure | Tracked in R-13; `disable_signup = true` required in Sprint 0.5 |
| Anon-key classification | Correctly classified as public-by-design; not a credential breach in isolation |
| Hardening tasks | Sprint 0.9 updated: create `.gitignore`, `.env.example`, inspect history, prohibit service-role keys in frontend repos |

New risks added:

- **R-21** — Repository exposure posture (F6).
- **R-22** — Finance readiness gap; mitigated by Finance Readiness Gate.

---

## 9. Sprint sequencing

- **Finance Readiness Gate** added as Doc 06 §2.1.
- **Gate checklist:** tariff config, resident, residence, active meter, two readings, consumption calculation, invoice generation, line-item generation, payable document, assembler compatibility, tenant isolation, deterministic test data.
- **Selected early integration proof:** Finance remains the planned first end-to-end proof (Sprint 4), gated.
- **Fallback proofs if gate fails:** resident profile, residence context, notices, support request listing.
- **Roadmap changes:** Sprint 4 header now notes the gate; Sprint 0.9 expanded; RLS test reference updated to Doc 04 §3.6.

---

## 10. Files

### Created

- `docs/backend/08-architecture-review.md`
- `docs/backend/09-adr-realtime-privilege-model.md`
- `docs/backend/10-adr-platform-profile-authorization.md`
- `docs/backend/11-adr-frontend-error-compatibility.md`
- `docs/backend/12-final-report.md` (this file)
- `.gitignore`
- `.env.example`

### Modified

- `docs/backend/README.md`
- `docs/backend/01-architecture-blueprint.md`
- `docs/backend/02-domain-model-erd.md`
- `docs/backend/03-api-and-edge-functions.md`
- `docs/backend/04-auth-and-authorization.md`
- `docs/backend/05-storage-realtime-offline.md`
- `docs/backend/06-migration-roadmap.md`
- `docs/backend/07-risk-and-readiness.md`

### Removed

- None.

---

## 11. D2 decision

| Item | Evidence |
|---|---|
| F1 selected architecture | ADR-09; Doc 01 ADR-07 amendment; Doc 05 §2.2.1 |
| F2 explicit profile RLS | ADR-10; Doc 04 §3.3.1 and §3.3.2 |
| F3 frontend-compatible error matrix | ADR-11; Doc 01 §3.2 |
| F4 complete entity/RLS spec | Doc 02 §3.1 (`profile_contacts`); Doc 04 RLS matrix |
| F5 reconciled inventory | Doc 03 §4; Doc 07 success criterion |
| F6 current-state risk with hardening | Doc 07 R-21; Doc 06 Sprint 0.9; `.gitignore`; `.env.example` |
| Finance sequencing readiness gate | Doc 06 §2.1; Doc 07 R-22 |
| No contradictions across documents | Consistency audit performed |
| Architecture cross-references resolve | All ADR and section links verified |

**Historical decision at the end of the remediation wave:** `PASS WITH CONDITIONS`

**Superseding runtime validation result on July 19, 2026:** see [13-d2-validation-report.md](13-d2-validation-report.md).

**Support-messages Wave B evidence on July 19, 2026:** see [15-realtime-option-b-validation-report.md](15-realtime-option-b-validation-report.md).

---

*Report produced: 2026-07-18; superseded by validation report on 2026-07-19*  
*Phase 1 restriction remains in effect: no migrations, no deployed code, no production changes.*
