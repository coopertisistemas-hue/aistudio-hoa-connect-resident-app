# HOA Connect — Backend Integration Program
## Official Backend Blueprint — Phase 1 (Architecture & Planning)

| Field | Value |
|---|---|
| Program | Backend Integration Program — Phase 1 |
| Status | **SPRINT 1 IMPLEMENTED LOCALLY — certification pending final gate** |
| Frontend baseline | `c245c6c` (`main`) — Frontend/UX/Demo certified, build PASS |
| Supabase project | `xcuxcqbctfjgccsdqwgl` — "HoA Connect Project", us-west-2, ACTIVE_HEALTHY, Postgres 17.6 |
| Date | 2026-07-19 |
| Phase restriction | **Local validation only. No production deployment in this repository.** |

---

## Read this first: the program brief assumed greenfield. It is not.

The brief describes designing "the complete backend architecture" for HOA Connect. During inventory
it was established that **a real, deployed, production-shaped backend already exists** on the same
Supabase project the Resident App is configured against:

- 26 tables in `public`, RLS enabled on all 26
- 11 deployed Edge Functions (all `verify_jwt=true`), 4 more in-repo undeployed
- 3 applied migrations, owned by `aistudio-hoa-connect-admin`
- Live operational data: 1 tenant, 2 admin members, 1 resident/property/meter/reading chain, 2 settled billing chains

This blueprint is therefore **not a greenfield design**. It is an **extension and hardening plan**
for a live backend that is currently **admin-only**. That distinction changes the risk profile,
the sequencing, and the cost of every decision in this document. Designing greenfield here would
have produced a beautiful plan that could never be executed without breaking the Admin App.

The single most consequential finding:

> **Residents cannot authenticate.** The `residents` table has no `user_id`. `auth.users` is
> referenced only by `tenant_members` (staff), `audit_logs`, and `bank_files`. There is no
> resident identity, no resident↔residence link, and no resident role anywhere in the schema.
> The Resident App's entire authenticated surface has no backend to attach to.

This is not a gap to be closed late. It is the foundation, and it is [ADR-01](01-architecture-blueprint.md#adr-01--resident-identity-is-separate-from-staff-identity).

---

## Document set

| # | Document | Covers program deliverables |
|---|---|---|
| 01 | [Architecture Blueprint](01-architecture-blueprint.md) | 1 — Blueprint, layering, ADRs 01–08 |
| 02 | [Domain Model & ERD](02-domain-model-erd.md) | 2 — ERD · 3 — Entity Catalog |
| 03 | [API & Edge Function Catalog](03-api-and-edge-functions.md) | 4 — API Catalog · 5 — Edge Function Catalog · canonical operation inventory |
| 04 | [Authentication, Authorization & RLS](04-auth-and-authorization.md) | 7 — Auth · 8 — Authz Model · 9 — RLS Matrix |
| 05 | [Storage, Realtime & Offline](05-storage-realtime-offline.md) | 6 — Storage Architecture · Realtime · Offline |
| 06 | [Migration Roadmap & Sprints](06-migration-roadmap.md) | 10 — Roadmap · 13 — Implementation order · 14 — Sprints |
| 07 | [Risk Assessment & Production Readiness](07-risk-and-readiness.md) | 11 — Risk · 12 — Execution Plan · 15 — Readiness checklist |
| 08 | [Independent Architecture Review](08-architecture-review.md) | Governed review artifact: findings F1–F6, remediation, D2 disposition |
| 09 | [ADR-09 — Realtime Privilege Model](09-adr-realtime-privilege-model.md) | Realtime exception to ADR-07 grant revocation |
| 10 | [ADR-10 — Platform-Level Profile Authorization](10-adr-platform-profile-authorization.md) | `profiles` RLS and platform-level PII access |
| 11 | [ADR-11 — Certified Frontend Error-Compatibility Contract](11-adr-frontend-error-compatibility.md) | Preserving certified hook error behavior during migration |
| 12 | [D2 Readiness Final Report](12-final-report.md) | Final verdict, finding disposition, and D2 decision |
| 17 | [Sprint 1 Foundation & Identity Report](17-sprint-01-foundation-identity-report.md) | Sprint 1 implementation, validation, residual risks, and verdict |

---

## Executive summary

### What exists and is reusable

The billing spine is real and well-formed: `tenants → residents → properties → water_meters →
meter_readings` and `receivables → billing_titles → payments`, with CNAB/bank infrastructure,
tenant isolation via `is_tenant_member()`, and a disciplined "all writes through Edge Functions"
posture in the Admin App. **This is a healthy foundation and should be preserved, not replaced.**

### What is missing for the Resident App

Measured against the frontend's 60 exported demo-service functions (52 production-relevant operations) and 1,143 lines of type contracts:

| Domain | Backend state | Verdict |
|---|---|---|
| Resident authentication & identity | absent | **Blocker** |
| Resident↔residence linking, roles, invitations | absent | **Blocker** |
| Invoice line items | absent | Blocker for `/faturas` detail |
| Notifications | absent | Whole module |
| Notices (avisos) | absent | Whole module |
| Communication preferences | absent | Whole module |
| Support requests (timeline, messages, visits, ratings) | `tickets` — admin-shaped, 0 rows, wrong shape | Rebuild |
| Consumption classification, baselines, insights, alerts | absent | Business logic layer |
| Protocol numbering (support/divergence/correction) | absent | Cross-cutting |
| Storage buckets | **zero buckets, zero objects** | Blocker for documents & photos |
| Resident-scoped RLS | absent (staff-only, and role-agnostic) | **Security blocker** |

### The security position must change before residents get tokens

The existing RLS is **tenant-scoped but role-agnostic**: every domain table carries a single
`FOR ALL … USING is_tenant_member(tenant_id)` policy. Any authenticated tenant member of any role
can `INSERT/UPDATE/DELETE` `payments`, `billing_titles`, `tariff_plans`, and `bank_agreements`
directly through PostgREST. Today this is contained only by client discipline — the Admin App
never calls PostgREST directly.

**The moment a resident JWT exists, that containment ends.** A resident could read and mutate the
association's entire financial ledger with nothing but the anon key and their own token.

This blueprint's answer is [ADR-07](01-architecture-blueprint.md#adr-07--close-postgrest-revoke-direct-grants):
**revoke direct table grants from `anon` and `authenticated`.** That converts the program's
"never bypass Edge Functions" principle from a coding convention into a database-enforced
guarantee, and closes HIGH-01 permanently rather than patching it policy by policy.

### The frontend contract is honoured exactly

The migration seam is unusually clean. Every hook imports named async functions from
`@/demo/*Service`; every service returns a fully-typed object and signals failure with sentinel
strings (`OFFLINE`, `ITEM_ERROR`, `DOCUMENT_ERROR`). Migration is therefore a **one-line import
swap per hook**, with zero changes to hooks, pages, components, or types:

```diff
- import { fetchFinancialOverview } from '@/demo/financeService';
+ import { fetchFinancialOverview } from '@/services/financeService';
```

This is only possible because of [ADR-03 — the Presentation Assembly Layer](01-architecture-blueprint.md#adr-03--presentation-assembly-layer),
which keeps Portuguese labels, currency formatting, icon names, and route paths **out** of the
backend while still satisfying types that demand them.

### Verdict

```
D2 — PASS WITH CONDITIONS
```

The architecture is internally consistent and implementation-ready, subject to three validation
conditions before Sprint 1 opens:

1. ADR-09 Realtime privilege model validated in a branch/disposable Supabase project.
2. ADR-10 profile RLS policies validated by the full negative-test suite.
3. ADR-11 error-compatibility contract validated by assembler test vectors against demo fixtures.

The independent review findings F1–F6 are resolved in the architecture. See
[08 — Independent Architecture Review](08-architecture-review.md) for the governed record.

---

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────┐
│  Resident App (React 19 / Vite)   Collector PWA    Admin    │
├─────────────────────────────────────────────────────────────┤
│  Pages / Components          ← unchanged, UX-certified      │
│  Hooks / ViewModels          ← unchanged, contract frozen   │
├─────────────────────────────────────────────────────────────┤
│  API Services  (src/services/*)                             │
│    ├── transport      fetch + JWT + retry + offline sentinel│
│    └── assemblers     canonical DTO → presentation type     │  ← ADR-03
├─────────────────────────────────────────────────────────────┤
│                        ⇅ HTTPS + JWT                        │
├─────────────────────────────────────────────────────────────┤
│  Edge Functions  — the ONLY write path, business rules here │
│    _shared: auth · tenant · scope · rbac · response · audit │
├─────────────────────────────────────────────────────────────┤
│  PostgREST  ✗ CLOSED to anon/authenticated  (ADR-07)        │
├─────────────────────────────────────────────────────────────┤
│  Postgres 17.6 — RLS on every table (defense in depth)      │
│  Storage — private buckets, tenant-prefixed                 │
│  Realtime — notifications · support · readings              │
└─────────────────────────────────────────────────────────────┘
```

---

## Decisions required before implementation

| # | Decision | Why it must be a human call | Recommendation | ADR |
|---|---|---|---|---|
| D1 | Do residents get rows in `residents`, or a new `profiles` identity? | Determines whether one person can hold residences across multiple associations — a SaaS-defining constraint | **`profiles` + `residence_members`**; keep `residents` as the tenant-scoped billing party | [ADR-01](01-architecture-blueprint.md#adr-01--resident-identity-is-separate-from-staff-identity) |
| D2 | Revoke PostgREST grants from `authenticated`? | Irreversible-ish; Admin App must be verified not to depend on direct table reads | **Yes — revoke.** Audit confirms Admin App uses only Edge Functions | [ADR-07](01-architecture-blueprint.md#adr-07--close-postgrest-revoke-direct-grants) |
| D3 | Rebuild `tickets` as `support_requests`, or extend in place? | `tickets` is deployed and consumed by the Admin App, though it holds 0 rows | **Rebuild as `support_requests`**; keep `tickets` until Admin migrates | [ADR-06](01-architecture-blueprint.md#adr-06--support-is-a-new-module-not-an-extension-of-tickets) |
| D4 | Is Santa Terezinha's live data production or pre-pilot? | Decides whether Sprint 0 may run destructive corrections | Inventory could not conclude; **owner must confirm** | [Risk R-08](07-risk-and-readiness.md) |

---

## Governance

This blueprint operates under `aistudio-hoa-connect-admin/ai/CONNECT_GUARDRAILS.md` and
`AGENTS.md`. Specifically honoured here:

- **Architecture is defined by humans** — this document proposes; it does not authorise itself.
  The four decisions above are explicitly reserved.
- **No migrations, no schema changes, no RLS changes without explicit scope** — Phase 1 produces
  zero SQL execution. All SQL in these documents is *illustrative specification*, not deployable
  migration files.
- **Minimal, auditable, additive changes** — every proposal below is additive. No applied
  migration is edited; no existing Edge Function is deleted.
- **Tenant isolation is non-negotiable** — `tenant_id` appears in every new entity, every policy,
  and every storage path.
- **Stop rules** — this document stops at, and surfaces rather than resolves, the four decisions
  above (security ambiguity + tenant-boundary risk).

### Protected assets — do not modify without authorization

- Applied migrations `20260624000001`, `20260625000001`, `20260625000002` — new work goes in new files
- `supabase/functions/*` (15) and `_shared/*` — deployed, consumed by the Admin App
- `public.is_tenant_member` — backs nearly every RLS policy; fleet-wide blast radius
- Live tenant data and the settled billing chain
- Readdy↔GitHub integration files in all three repos (`vite.config.ts`, `src/router/index.ts`, `src/i18n/*`, `eslint-rules/`)

### Location note

These documents currently live in the Resident App repository because that is the program's
anchor repo. Because the blueprint is **program-wide** (Resident + Collector + Admin), it should
be promoted to a shared governance location (`03-products/hoa-connect/docs/`) once approved, so
that all three repositories reference one source of truth rather than drifting copies.

---

## Source evidence

Every load-bearing claim in this document set traces to firsthand inspection on 2026-07-17/18:

- `aistudio-hoa-connect-admin/supabase/migrations/*.sql` — read in full
- `aistudio-hoa-connect-collector-app/docs/inventory/WAVE_0_REPOSITORY_SUPABASE_INVENTORY.md` — the
  623-line read-only audit of the live Supabase project; the primary evidence base for backend state
- `aistudio-hoa-connect-resident-app/src/fixtures/types.ts` (1,143 lines) — the frontend contract
- `src/demo/*.ts` (7 services, 60 exported functions, 52 production-relevant operations) and `src/hooks/*.ts` (7 hooks) — the migration seam

Where this blueprint infers rather than verifies, it says so inline.
