# 06 — Migration Roadmap, Implementation Order & Sprints

> Deliverables 10 (Migration Roadmap), 13 (Recommended implementation order), 14 (Sprint breakdown).

---

## 1. The migration seam

The frontend was built with an unusually clean boundary, and the entire roadmap exploits it.

Every hook consumes named async functions from a demo service. Every demo service returns a fully
typed object and signals failure with sentinel strings. `useFinancasData.ts` is representative:

```ts
import { fetchFinancialOverview } from '@/demo/financeService';
// ...
try   { const result = await fetchFinancialOverview(resId); setOverview(result); }
catch { if (err.message === 'OFFLINE') { … } else if (err.message === 'ITEM_ERROR') { … } }
```

Therefore migrating a module is **one import line**:

```diff
- import { fetchFinancialOverview, fetchInvoiceDetail, … } from '@/demo/financeService';
+ import { fetchFinancialOverview, fetchInvoiceDetail, … } from '@/services/financeService';
```

Provided `src/services/financeService.ts` exports functions with **identical names, identical
signatures, identical return types, and identical error sentinels**, no hook changes, no page
changes, no component changes, and no type changes are required.

This is the mechanism by which "never break the existing UX" is honoured — not by care, but by
construction.

### 1.1 The parity rule

> A module is migrated when its API service is a **drop-in replacement** for its demo service:
> same exports, same signatures, same types, same sentinels.
>
> If a real backend cannot satisfy the contract, the **backend** changes — never the frontend.
> A required frontend change is escalated as an architecture defect, not absorbed as a small edit.

### 1.2 Feature-flagged switchover

Each module switches behind a flag, so rollback is instant and does not require a deploy:

```ts
// src/services/index.ts — illustrative
export const financeService = FLAGS.liveFinance
  ? await import('./financeService')
  : await import('@/demo/financeService');
```

Demo services are **retained** through the entire program. They are the rollback path, the
offline demo mode, and the source of the assembler test vectors. They are deleted only at the very
end, in Sprint 9 — and only once every module has run live in production for a full billing cycle.

---

## 2. Implementation order

Sequenced by dependency and by risk, not by screen order.

```
Sprint 0  Security & Foundation      ← must land before ANY resident token exists
Sprint 1  Identity & Platform        ← everything authenticated depends on this
Sprint 2  Authentication             ← first live module
Sprint 3  Profile & Residences
Sprint 4  Finance (read-only)
Sprint 5  Consumption
Sprint 6  Communication
Sprint 7  Support
Sprint 8  Home  (last: it aggregates all of the above)
Sprint 9  Hardening, cutover, demo retirement
```

### Two ordering decisions worth stating explicitly

**Home is last, not first.** It is the first screen a resident sees, which makes it tempting to
migrate first. But `HomeOverview` composes outputs from finance, consumption, communication, and
support. Migrating it early would mean building four sets of business rules twice — once inside
`resident-home`, then again in each domain function — which is the "duplicate business logic"
prohibition, arrived at by scheduling rather than by intent.

**Finance precedes consumption**, despite consumption being conceptually upstream of billing. The
finance module is almost entirely **read-only against tables that already exist and already hold
real settled data**. It is the earliest point at which the program can prove the whole stack
end-to-end — Edge Function, assembler, hook, certified screen — against production data, with
essentially no write risk. Consumption requires a new rules engine and new baseline tables.

**Finance Readiness Gate.** Sprint 4 is the first major end-to-end proof only if the following are
verified in staging first:

- at least one valid association tariff configuration;
- at least one resident linked to a profile and residence;
- at least one residence;
- at least one active meter;
- at least two valid readings;
- consumption calculation, invoice generation, line-item generation, and a payable document or
  simulated payment artifact;
- presentation output compatible with the Resident App;
- tenant isolation;
- deterministic test data.

If the gate fails, choose a different early integration proof (resident profile, residence context,
notices, or support request listing) and return to Finance once the billing engine has completed a
verified end-to-end run.

### 2.1 Finance Readiness Gate

Sprint 4 is scheduled as the first major end-to-end proof, but it must not begin until this gate is
green in the staging environment:

| # | Check |
|---|------|
| 1 | At least one valid association tariff configuration exists in `tariff_plans`/`tariff_ranges`. |
| 2 | At least one resident is linked to a profile and a residence. |
| 3 | At least one residence exists. |
| 4 | At least one active meter exists. |
| 5 | At least two valid readings exist. |
| 6 | Consumption calculation runs and produces a value. |
| 7 | Invoice generation runs and produces a `billing_titles` row. |
| 8 | Line-item generation runs and sums to the title amount. |
| 9 | A payable document or simulated payment artifact exists. |
| 10 | Presentation output is compatible with the Resident App assembler. |
| 11 | Tenant isolation is verified. |
| 12 | Deterministic test data is in place. |

**Owner:** Engineering lead + association billing representative.  
**Fallback proofs if gate fails:** resident profile (`/perfil`), residence context (`/minha-residencia`), notices (`/avisos`), support request listing (`/atendimento`).

---

## 3. Sprint breakdown

Sprint length: **2 weeks**. Every sprint ends at the QA gates in §4.

---

### Sprint 0 — Security & Foundation *(blocking; no resident tokens may exist before this closes)*

**Goal:** make the live backend safe to attach a resident population to.

| # | Task | Owner | Deliverable |
|---|---|---|---|
| 0.1 | Decisions D1–D4 resolved and recorded | Architecture | Signed ADRs |
| 0.2 | **Revoke PostgREST grants** from `anon`/`authenticated` (ADR-07) | Database | Migration + Admin smoke test |
| 0.3 | Harden `is_tenant_member()` with `SET search_path = ''` | Database | Migration |
| 0.4 | Fix `tenant_members` zero-member self-join policy (MEDIUM-03) | RLS | Migration |
| 0.5 | `disable_signup = true`; production `site_url`; redirect allow-list; SMTP; captcha | Infra | Auth config |
| 0.6 | CORS allow-list replaces `*` across the fleet (LOW-01) | Edge | `_shared/cors.ts` |
| 0.7 | Staging/branch Supabase project + seed | Infra | **No development against production** |
| 0.8 | RLS test harness in CI | QA | Tests 1–11, Doc 04 §3.6 |
| 0.9 | Repository hardening: create `.gitignore`, create `.env.example` with browser-safe variables only, inspect Git history for secrets, ESLint rule banning Supabase imports outside `src/lib`+`src/services` | Frontend | F6 risk closed; accident prevention |

**Exit criteria:** `anon` and a member JWT can both be proven — by test — to read *nothing* via
PostgREST. Admin App fully functional. Green CI.

> Sprint 0 delivers no user-visible feature and is the single most important sprint in the program.
> It is not optional and it is not compressible. Issuing resident tokens against today's
> configuration would expose every association's financial ledger to every resident.

---

### Sprint 1 — Identity & Platform Primitives

**Goal:** residents can exist; cross-cutting infrastructure is in place.

| # | Task | Deliverable |
|---|---|---|
| 1.1 | Migration: `profiles`, `residence_members`, `residence_invitations`, `profile_contacts` | Schema + RLS + indexes |
| 1.2 | Migration: `protocols`, `idempotency_keys`, `profile_preferences`, `profile_devices` | Schema + RLS |
| 1.3 | Extend `tenant_members.role` CHECK with `collector` | Migration (unblocks Collector program) |
| 1.4 | `_shared/scope.ts`, `idempotency.ts`, `protocol.ts`, `validation.ts` (zod) | Middleware |
| 1.5 | Extend `meter_readings`: `collector_id`, server-derived `previous_reading_value`, `idempotency_key` UNIQUE, `client_reading_id`, `status`, `origin`, `photo_path` | Migration (closes HIGH-02) |
| 1.6 | Storage buckets + policies (all 7) | Storage |
| 1.7 | `resident-uploads` function | Signed upload/download |
| 1.8 | Backfill: link existing residents → profiles (data plan; **execution gated on D4**) | Runbook |
| 1.9 | **Contract freeze**: zod DTO schemas, error registry, assembler test vectors | Doc 03 §6 |

**July 19, 2026 status:** partially completed in the local validation branch. The implemented scope covers the Supabase baseline, foundation schema, helper functions, RLS, audit model, identity Edge Function scaffold, generated database types, and SQL regression coverage. Storage buckets, invitation lifecycle, full contract replacement of demo services, and hosted deployment remain out of scope for this branch.

**Exit criteria:** a test resident can be created, linked to a residence, and authorized — with no
UI yet. Idempotency and protocol issuance demonstrably work under concurrent load.

---

### Sprint 2 — Authentication *(first live module)*

| # | Task |
|---|---|
| 2.1 | `resident-auth`: login (CPF/email resolution), logout |
| 2.2 | First access: verify → confirm → activate (atomic), fully threat-modelled per Doc 04 §1.3 |
| 2.3 | Password recovery: request → confirm |
| 2.4 | `src/lib/supabase.ts` + `src/services/transport/` (JWT, retry, sentinel mapping) |
| 2.5 | Auth context/provider + route guards |
| 2.6 | Rate limiting + captcha on login and first access |
| 2.7 | Migrate `/login`, `/first-access`, `/password-recovery`, `/access-success` behind flag |

**Exit criteria:** a real resident authenticates against the real backend and reaches `/inicio`
(still on demo data). Certified entry-screen UX unchanged — verified screen by screen against the
baseline.

**Risk note:** this sprint carries the program's highest security risk. Budget for an independent
security review of the first-access flow *within* the sprint, not after it.

---

### Sprint 3 — Profile & Residences

| # | Task |
|---|---|
| 3.1 | `resident-profile` (ops 8–20, 25) |
| 3.2 | `resident-residences` (ops 26–32) |
| 3.3 | Assemblers: `profileAssembler`, `residenceAssembler` |
| 3.4 | `src/services/profileService.ts`, `residenceService.ts` — drop-in parity |
| 3.5 | Protected-vs-editable field enforcement **server-side** |
| 3.6 | Correction requests → `COR-` protocol |
| 3.7 | Invitation accept/decline; residence switching |
| 3.8 | Migrate `/perfil/*` and `/minha-residencia` behind flag |

**Exit criteria:** all 21 profile scenarios and the multi-residence switcher behave identically to
the certified demo. `profileScenarios.ts` (828 lines) is the acceptance checklist.

---

### Sprint 4 — Finance *(read-only; gated by §2.1 Finance Readiness Gate)*

**Prerequisite:** the Finance Readiness Gate in §2.1 must be green before this sprint begins.

| # | Task |
|---|---|
| 4.1 | Migration: `billing_title_line_items`, `billing_titles.replaced_by_id`, `UNIQUE(receivable_id)` |
| 4.2 | `resident-finance` (ops 38–45) |
| 4.3 | Complete and deploy `documents-api` POST (boleto/receipt generation → `billing-documents` bucket) |
| 4.4 | `AccountStatus` + `PrimaryStatus` precedence rules, server-side |
| 4.5 | `financeAssembler` — minor units → `formattedAmount`, enums → labels |
| 4.6 | `payment_disputes` + `PAG-` protocol |
| 4.7 | Migrate `/faturas/*`, `/pagamentos/*` behind flag |

**Exit criteria:** all 15 `FinanceScenarioKey` states render correctly against live data.
Money is verified to the cent against `billing_titles`. `financialScenarios.ts` (646 lines) is
the acceptance checklist.

---

### Sprint 5 — Consumption

| # | Task |
|---|---|
| 5.1 | Migration: `consumption_baselines`, `reading_divergences` |
| 5.2 | Classification engine (6 classifications, `usualRange`, insights, alerts) — server-side |
| 5.3 | Baseline recomputation triggered on accepted readings |
| 5.4 | `resident-consumption` (ops 34–37) |
| 5.5 | Divergence flow → `DIV-` protocol → support request |
| 5.6 | Migrate `/consumo/*` behind flag |

**Exit criteria:** all 11 `ConsumptionScenarioKey` states reproduce. `consumptionScenarios.ts`
(915 lines) is the acceptance checklist.

---

### Sprint 6 — Communication

| # | Task |
|---|---|
| 6.1 | Migration: `notifications`, `notices`, `notice_targets`, `notice_reads`, `communication_preferences` |
| 6.2 | `system_events` → notification fan-out |
| 6.3 | `resident-communication` (ops 46–56) |
| 6.4 | Realtime channel: `resident:{profile_id}:notifications` |
| 6.5 | Mandatory-preference enforcement, server-side |
| 6.6 | Migrate `/notificacoes/*`, `/avisos/*` behind flag |

**Exit criteria:** all 18 `NotificationScenarioKey` states reproduce; unread badge is accurate
within one second; full function with Realtime disabled.

---

### Sprint 7 — Support

| # | Task |
|---|---|
| 7.1 | Migration: `support_requests` + 5 child tables |
| 7.2 | `resident-support` (ops 57–67) |
| 7.3 | `eligibleActions` computation + **matching server-side enforcement on every action endpoint** |
| 7.4 | Realtime channel: `resident:{profile_id}:support` |
| 7.5 | Attachments via `resident-uploads` |
| 7.6 | Visit confirm/reschedule; ratings; reopen window |
| 7.7 | Migrate `/atendimento/*` behind flag |

**Exit criteria:** all 21 `SupportScenarioKey` states reproduce. Every action rejected when
ineligible, verified by fabricated requests — not merely by hidden buttons.
`supportScenarios.ts` (703 lines) is the acceptance checklist.

---

### Sprint 8 — Home

| # | Task |
|---|---|
| 8.1 | `resident-home` — parallel fan-out with **per-section degradation** |
| 8.2 | `PrimaryStatus` precedence (6 states), server-side |
| 8.3 | Recent activity aggregation |
| 8.4 | Performance: p95 < 200 ms |
| 8.5 | Migrate `/inicio` behind flag |

**Exit criteria:** home renders correctly with any one section failing. Cold-start p95 within
target. `scenarios.ts` + `demoStates.ts` are the acceptance checklist.

---

### Sprint 9 — Hardening & Cutover

| # | Task |
|---|---|
| 9.1 | Independent security review (external to the implementation team) |
| 9.2 | Load test at 100× current data volume |
| 9.3 | Audit-log coverage verified on every mutation |
| 9.4 | LGPD: data export + erasure paths, **including storage objects** |
| 9.5 | Runbooks, alerting, dashboards, on-call |
| 9.6 | Remove feature flags; **retire `src/demo/*` and `src/fixtures/*Scenarios.ts`** |
| 9.7 | Production readiness checklist (Doc 07 §4) signed off |

**Exit criteria:** every checklist item green. Demo services deleted only after every module has
run live for a full billing cycle.

---

## 4. Per-sprint QA gates

Every sprint, without exception:

| Gate | Command / Check |
|---|---|
| Type check | `npm run type-check` — zero errors |
| Lint | `npm run lint` — zero warnings (`--max-warnings 0`) |
| Build | `npm run build` — PASS |
| RLS suite | All 7 negative-test classes green |
| Contract parity | Assembler output structurally identical to the demo fixture |
| **UX regression** | Migrated screens compared against the `c245c6c` baseline, state by state |
| Security | No new `anon`/`authenticated` grants; no PII in logs; no secrets committed |
| Rollback | Feature flag flips cleanly back to demo, verified |

The UX regression gate is the one that enforces the program's first principle. Each module's
scenario fixture file is a pre-written, exhaustive acceptance checklist — 4,900 lines of certified
expected behaviour across the six modules. This is an unusual asset and the roadmap is built to
use it.

---

## 5. Retiring the demo layer

| Stage | State |
|---|---|
| Sprints 0–1 | Demo serves 100% of traffic |
| Sprints 2–8 | Per-module flags; demo remains the rollback path |
| Sprint 9 | Flags removed after a full billing cycle live |
| Post-program | `src/demo/*` and `*Scenarios.ts` deleted; `src/fixtures/types.ts` **retained** as the domain contract |

`types.ts` outlives the demo layer. It is the contract, not a fixture — and it should be moved to
`src/domain/types.ts` at the end of the program to say so.

---

**Next:** [07 — Risk Assessment & Production Readiness](07-risk-and-readiness.md)
