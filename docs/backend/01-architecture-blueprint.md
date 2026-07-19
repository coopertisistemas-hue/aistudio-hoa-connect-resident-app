# 01 — Backend Architecture Blueprint

> Deliverable 1. Layering rules, architectural decisions (ADRs), and the contracts that bind
> the certified frontend to the Supabase backend.

**July 19, 2026 implementation update:** the local Sprint 1 baseline now implements the platform-identity path described here with `profiles`, `profile_contacts`, `tenants`, `properties`, `tenant_members`, `residence_members`, audit primitives, and the first identity Edge Functions under `supabase/functions/`. The repository still preserves the D2-certified Realtime model and does not open direct screen-to-table access.

---

## 1. Layering

### 1.1 Target architecture

```
Screen  →  Hook  →  API Service  →  Edge Function  →  Postgres / Storage / Realtime
```

| Layer | Owns | Must never |
|---|---|---|
| **Screen** | Rendering, local UI state | Fetch, format money, know about Supabase |
| **Hook** | Load/refresh lifecycle, `loading`/`error`/`isOffline` flags, residence context | Contain business rules or HTTP knowledge |
| **API Service** | Transport (URL, JWT, retry), and **presentation assembly** (ADR-03) | Contain business rules; query tables |
| **Edge Function** | **All business rules**, authorization, validation, tenant scoping, audit | Return localized labels or UI route paths |
| **Postgres** | Storage, integrity, RLS as defense-in-depth | Be reachable directly by a client |

### 1.2 The four prohibitions, and how each is *enforced* rather than merely stated

The program brief lists four prohibitions. A principle that depends on developer discipline
will eventually be violated. Each is therefore bound to a mechanism:

| Prohibition | Enforcement mechanism |
|---|---|
| Screens must not connect directly to Supabase | ESLint rule banning `@supabase/supabase-js` imports outside `src/lib/` and `src/services/` (Sprint 0) |
| No table queries inside components | Same rule + `.from(` ban outside `src/services/` |
| Do not bypass Edge Functions | **`REVOKE` all grants on `public` from `anon`/`authenticated`** — PostgREST stops working entirely (ADR-07) |
| Do not duplicate business logic | Business rules live only where the service role lives — inside Edge Functions. The client physically cannot compute what it cannot read. |

The third row is the important one. Every other Connect product relies on convention here; the
audit found that convention is the *only* thing currently protecting the financial tables.

---

## 2. Architectural Decision Records

Each ADR states the decision, the forces, the alternatives rejected, and the consequences —
including the costs, which are real.

---

### ADR-01 — Resident identity is separate from staff identity

**Status:** Proposed — requires decision D1
**Blocks:** everything authenticated

#### Context

`tenant_members` maps `auth.users → tenants` with roles `admin | manager | operator | viewer`.
That is a **staff** RBAC model. `residents` is a tenant-scoped person record (name, document,
email, phone) with **no `user_id`** — a billing party, not a login.

The Resident App requires, from `types.ts`:

- `ResidentProfile` — identity, CPF, birth date, preferred name, pronouns, photo
- `ResidentRole` — `holder | financial_responsible | authorized_resident | dependent | representative | temporary_guest`
- `LinkedResidenceItem[]` — **one person, many residences**, each with its own role and status
- `ResidenceInvitation` — invited to a residence by another resident or by the association
- `LinkedResident[]` — **one residence, many people**

That is an unambiguous many-to-many between people and residences, carrying a role and a lifecycle
status on the edge.

#### Decision

Introduce a **platform-level identity** distinct from both staff membership and the tenant-scoped
billing party:

```
auth.users
    │ 1:1
    ▼
profiles                    ← platform identity: name, preferred_name, pronouns, CPF, photo
    │ M:N via residence_members (role + status + is_primary)
    ▼
properties  (residences)    ← existing table, unchanged
    │
    ▼
residents                   ← existing table: the tenant-scoped BILLING PARTY, unchanged
```

- `profiles` — 1:1 with `auth.users`, **not** tenant-scoped. A person is a person.
- `residence_members` — the M:N edge. Carries `tenant_id`, `property_id`, `profile_id`, `role`,
  `status`, `is_primary`. **This table is the resident authorization primitive.**
- `residents` — untouched. Remains what billing points at. Linked to a profile via
  `residence_members.resident_id` when the person is also the billing party.

**Residents are never `tenant_members`.** Staff RBAC and resident ABAC stay separate systems.

#### Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Add `residents.user_id` | Forces 1 person = 1 resident row per tenant. Breaks multi-residence within a tenant, and breaks one person served by two associations — a SaaS-fatal constraint. Cheapest now, most expensive later. |
| Add `resident` to `tenant_members.role` | Overloads a staff table with a fundamentally different authorization axis. Every existing `is_tenant_member()` policy would silently begin granting residents tenant-wide read access to residents, properties, payments. **Actively dangerous** — it would grant every resident the visibility of an operator. |
| Reuse `operator` role for residents | Same defect, plus semantic collision with the Collector App's needs. |

#### Consequences

- **Cost:** a new identity table and join table; a bootstrap/linking flow; a first-access journey
  that must reconcile "I have a CPF on an invoice" with "I now have a login".
- **Benefit:** multi-tenant-correct. One login, many associations, many residences, distinct roles
  per residence — exactly what the certified UX already renders.
- The Collector App gains `collector` as a `tenant_members` role (staff), cleanly, without
  touching this axis.

---

### ADR-02 — The frontend type contract is frozen; the backend adapts

**Status:** Accepted (program mandate)

#### Context

The brief states the backend must adapt to the frontend. `src/fixtures/types.ts` is the contract.
It is 1,143 lines and is UX-certified.

#### Decision

`src/fixtures/types.ts` is **frozen for Phase 1**. No field is renamed, removed, or retyped.
The type file is relocated conceptually from "fixture types" to "domain contract" but its
*content* does not change during migration. Any pressure to change it is a design defect in the
backend proposal, not in the frontend.

#### Consequence

Where the backend's natural shape and the frontend's expected shape diverge, the divergence is
absorbed by the assembler layer (ADR-03) — never by editing the frontend.

---

### ADR-03 — Presentation Assembly Layer

**Status:** Proposed
**This is the decision that makes ADR-02 achievable without corrupting the backend.**

#### Context — the problem nobody has named yet

The frontend types are **presentation-shaped**, not domain-shaped. Examples drawn directly from
`types.ts`:

```ts
statusLabel: string;           // "Vencida"          — Portuguese UI copy
statusExplanation: string;     // a sentence of UX writing
formattedAmount: string;       // "R$ 187,45"        — locale formatting
categoryIcon: string;          // "ri-drop-line"     — an icon library token
comparisonLabel: string;       // "12% acima do mês anterior"
primaryAction: { label: string; path: string };   // "/faturas/inv-2026-07" — a ROUTE
destination: { type; path; label };               // client-side navigation
```

A naïve implementation has Edge Functions return these fields. That would mean the backend owns:
Portuguese UI copy, `pt-BR` currency formatting, Remix Icon class names, and **React Router
paths**. The consequences: i18n becomes a backend deploy; a frontend route rename becomes a
backend incident; the Collector and Admin apps receive Resident-App-shaped strings; and every
label change requires a function redeploy.

But the types demand these fields, and ADR-02 freezes the types.

#### Decision

Split the API Service layer in two:

```
src/services/
  transport/          fetch wrapper: base URL, Bearer JWT, timeout, retry,
                      maps network failures → OFFLINE; preserves certified demo error behavior
  assemblers/         canonical DTO  →  presentation type
  financeService.ts   public API — signature-identical to src/demo/financeService.ts
```

**Edge Functions return canonical DTOs only:**

```jsonc
{
  "id": "inv-2026-07",
  "status": "overdue",              // enum — stable, language-neutral
  "amountCents": 18745,             // integer minor units — never a float, never a string
  "currency": "BRL",
  "dueDate": "2026-07-10",          // ISO-8601
  "referenceMonth": "2026-07"
}
```

**Assemblers derive everything presentational**, client-side, synchronously, from i18n resources
and the existing route table:

```
status: "overdue"     → statusLabel: t('invoice.status.overdue')          → "Vencida"
                      → statusExplanation: t('invoice.explain.overdue')
amountCents: 18745    → formattedAmount: formatBRL(18745)                 → "R$ 187,45"
status + id           → primaryAction: { label: t('action.pay'), path: `/faturas/${id}` }
```

#### Rules

1. An Edge Function response must contain **no** natural-language string intended for display,
   **no** formatted number, **no** icon token, and **no** client route path.
2. Free-text authored by a human (a notice body, a support message, an association's address) is
   **content, not a label** — it is returned as-is. The test: *would this string change if the
   user switched language?* If yes, it is a label and belongs in i18n.
3. All money crosses the wire as integer minor units. `formattedAmount` is derived, never
   transmitted. This also eliminates a class of float-rounding defects in the billing path.
4. All dates cross the wire as ISO-8601. `"12 de julho"` is derived.
5. Assemblers are pure functions and are the natural unit test boundary for the migration —
   a fixture and a live DTO must assemble to structurally identical objects.

#### Consequences

- **Cost:** one extra layer, ~7 assembler modules. Real, and worth it.
- **Benefit:** the backend stays language-neutral and app-neutral, so Collector and Admin consume
  the same functions. i18n stays a frontend concern. Route changes never touch the backend.
  And the frontend contract is honoured to the byte.
- **Migration benefit:** because assemblers are pure, each module can be validated against its
  existing fixture *before* the backend exists — building confidence ahead of Sprint work.

---

### ADR-04 — Invoice is a projection of `billing_titles`, plus a new line-item table

**Status:** Proposed

#### Context

Frontend `InvoiceData` maps mostly onto the existing `receivables → billing_titles` chain
(`documentNumber`, `dueDate`, `amount`, `digitableLine`, `pix_copy_paste`, `pdf_url`,
`status`). Two things do not exist:

- `lineItems: InvoiceLineItem[]` with `type: water | maintenance | reserve | adjustment | discount | interest | fine | other`
- The `replaced` / `replacedById` / `replacesId` supersession chain the UX renders

#### Decision

- Do **not** create an `invoices` table. `billing_titles` *is* the invoice. Creating a parallel
  entity would fork the financial source of truth — an unacceptable risk on a live billing system.
- Add `billing_title_line_items` (tenant-scoped, FK to `billing_titles`, ordered, typed, minor units).
- Add `billing_titles.replaced_by_id` self-FK for supersession.
- `InvoiceData` is assembled from `billing_titles + line_items + receivables + properties + tenants`.

#### Consequence

The Admin App's billing behaviour is unaffected — both changes are additive. Line items must be
populated by the billing generation path before `/faturas` detail can leave demo mode; until then
the assembler degrades to a single synthetic line item derived from the title amount.

---

### ADR-05 — Communication (notifications, notices, preferences) is a new bounded module

**Status:** Proposed

#### Context

Nothing exists. `system_events` has an event vocabulary (`reading_missing`,
`abnormal_consumption`, `cut_risk`, `manual_payment_pending_review`) but **nothing generates
these events**, and it is an operational log, not a resident-facing inbox.

#### Decision

A new module, four tables: `notifications` (per-recipient inbox, read state, destination
descriptor), `notices` (association-authored broadcast with audience targeting),
`notice_reads` (per-profile read state on broadcast content), `communication_preferences`
(per-profile, per-category, per-channel, with a `mandatory` flag the UX already renders).

**`system_events` becomes the producer.** Domain events emitted by Edge Functions land in
`system_events`; a fan-out step materializes `notifications` rows for the affected profiles.
This keeps one event vocabulary for both operational monitoring and resident notification, rather
than two drifting ones.

**Notification `destination` is stored canonically** — `{ type, entityId }`, never a path.
The assembler derives `path` (ADR-03).

---

### ADR-06 — Support is a new module, not an extension of `tickets`

**Status:** Proposed — requires decision D3

#### Context

`tickets` + `ticket_comments` is admin-shaped: status/priority enums, a `resident_id` FK, and a
`metadata` jsonb informally carrying category, property_id, and due_date. Writes require
manager+. It holds **0 rows**.

`SupportRequest` requires: a protocol number, 10 categories, 12 statuses, a **timeline** of typed
events with actors, a **message thread** with unread state and reply-required flags, a **visit
proposal** with confirm/reschedule/cancel, a **rating**, typed attachments, and a server-computed
`eligibleActions[]`.

The gap is not a few columns. It is a different aggregate.

#### Decision

Build `support_requests`, `support_messages`, `support_timeline_events`, `support_attachments`,
`support_visits`, `support_ratings`. Leave `tickets` in place, untouched and still serving the
Admin App, until Admin migrates on its own schedule. **0 rows means this costs no data migration** —
the cheapest moment this decision will ever be available.

`eligibleActions` is **computed server-side** from status + role + visit state. It is
authorization, not decoration: if the server says an action is not eligible, the corresponding
endpoint must also reject it. The client must never derive this list — a client that computes its
own permissions has no permissions.

---

### ADR-07 — Close PostgREST: revoke direct grants

**Status:** Proposed — requires decision D2
**Severity:** resolves audit finding HIGH-01

#### Context

Verified: every domain table carries one policy, `FOR ALL … USING is_tenant_member(tenant_id)`,
roles `{public}`, no explicit `WITH CHECK`. Role is never evaluated. Supabase's default grants
give `anon`, `authenticated`, and `service_role` full DML on all 26 tables. RLS is the only
barrier and it is role-agnostic.

Therefore any authenticated tenant member — today an operator or viewer, **tomorrow a resident** —
can `INSERT/UPDATE/DELETE` `payments`, `billing_titles`, `tariff_plans`, `bank_agreements`,
`receivables`, and `meter_readings` directly via PostgREST with the anon key and their own JWT.

The Collector audit rated this HIGH-01 and noted it is mitigated *only by client discipline*.
Issuing resident tokens against this configuration would expose every association's financial
ledger to every resident.

#### Decision

```sql
-- Illustrative specification. NOT a migration. Requires decision D2.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- ADR-09 exception: SELECT only on Realtime-backed tables. RLS restricts rows.
GRANT SELECT ON public.notifications    TO authenticated;
GRANT SELECT ON public.support_messages TO authenticated;
```

**Why the two narrow `SELECT` grants are required.** Realtime evaluates PostgreSQL privileges before RLS. Without `SELECT` on `notifications` and `support_messages`, `postgres_changes` subscriptions would connect silently but deliver no events. These two grants are the only exception to the revocation; they are audited, minimal, and remain constrained by RLS. See [ADR-09](09-adr-realtime-privilege-model.md).

Edge Functions are unaffected — they hold `service_role`. RLS policies **remain and are still
hardened** (Doc 04): defense in depth, so that a service-role bug or a future grant does not
become a tenant breach.

#### Why this rather than role-aware policies on financial tables

Role-aware policies were the Collector audit's suggested remediation. They are strictly weaker:

- They require getting ~26 tables × 4 verbs right, and right again for every new table forever.
- They must encode *two* authorization axes (staff role, resident residence-scope) in SQL, where
  the resident axis needs joins through `residence_members` on every check — expensive and easy
  to get subtly wrong.
- They leave the "do not bypass Edge Functions" rule as convention.

Revoking grants makes the rule structural: bypassing Edge Functions stops being *discouraged* and
starts being *impossible*. One change, permanent, and it cannot rot.

#### Consequences and risk

- **Risk:** if any client depends on direct PostgREST access, it breaks immediately. The audit
  verified the Admin App uses only Edge Functions (`src/lib/api.ts`; every `.from(` hit in the
  admin frontend is `Array.from`). The Collector App has zero Supabase code. The Resident App has
  zero Supabase code. **No known consumer breaks.**
- **Mitigation:** stage in a branch/preview project first; keep a single-statement rollback ready;
  execute during a low-traffic window with Admin smoke tests immediately after.
- **Also required:** harden `is_tenant_member()` with `SET search_path = ''` (audit MEDIUM-02) and
  fix the `tenant_members` zero-member self-join bootstrap policy (MEDIUM-03).

---

### ADR-08 — Idempotency and protocol numbering are cross-cutting infrastructure

**Status:** Proposed

#### Context

The audit found **no idempotency anywhere** (MEDIUM-07): `payments-api` POST and `billing-api`
title generation use insert-plus-compensating-delete sagas that are non-transactional. Retries
duplicate payments and titles. Meanwhile the Resident App issues protocol numbers in four
different flows (support request, consumption divergence, unrecognized payment, profile
correction), and the Collector App will submit readings over deliberately unreliable connectivity.

#### Decision

1. **Idempotency:** every mutating Edge Function accepts an `Idempotency-Key` header. A central
   `idempotency_keys` table (tenant, key, endpoint, request hash, response snapshot, created_at)
   with a unique constraint makes replay return the original response rather than re-executing.
   Mandatory for: readings submission, payments, billing generation, support creation, all
   protocol-issuing flows.
2. **Protocols:** one `protocols` table issuing human-readable, tenant-scoped, monotonic
   identifiers with a type discriminator (`SUP` / `DIV` / `PAG` / `COR`), rather than four
   independent schemes. The UX displays these to residents as their reference to the association —
   they must be unique, stable, and never reused.

#### Consequence

Both are prerequisites for the Collector App's offline model (Doc 05) and for financial
correctness under retry. Building them once, centrally, in Sprint 1 is materially cheaper than
retrofitting them per module.

---

## 3. Cross-cutting standards

### 3.1 Response envelope

All new functions adopt the `_shared` "new-style" envelope already present in the admin repo
(currently used only by the 4 undeployed functions) — not the legacy `{error: "…"}` shape:

```jsonc
{ "success": true,  "data": { ... }, "meta": { "requestId": "…", "page": 1, "total": 42 } }
{ "success": false, "error": { "code": "INVOICE_NOT_FOUND", "message": "…", "details": {} } }
```

`error.code` is a stable machine token; `error.message` is diagnostic and **not shown to
residents** — the client maps `code` to localized copy (ADR-03). This also closes audit LOW-02,
where legacy functions rethrow raw PostgREST messages to clients.

### 3.2 Error taxonomy → frontend compatibility contract

The certified frontend does not handle errors uniformly. The backend contract must preserve the certified behavior; inconsistencies are recorded as future product remediation, not silently changed during transport replacement. See [ADR-11](11-adr-frontend-error-compatibility.md).

| Category | Meaning | Backend contract | Frontend outcome |
|---|---|---|---|
| Transport failure | Network unavailable, timeout, `navigator.onLine === false` | Throw `OFFLINE` | `OfflineBanner` |
| Domain absence | Resource not found or unavailable | Return `null` | Document/detail unavailable state |
| Document unavailable | Boleto, PIX, or receipt cannot be presented | Return canonical DTO with `documentAvailable: false` | Assembler derives existing unavailable state |
| Generic item error | A specific item in a list cannot be loaded | Throw `ITEM_ERROR` | Inline item error |
| Swallowed-to-null compatibility | Flows where the certified hook catches all errors and returns `null` | Return `null` on any error | No sentinel fired |

**Finance compatibility matrix (verified against `src/hooks/useFinancasData.ts`)**

| Frontend flow | Demo behavior | Target API contract | Hook interpretation |
|---|---|---|---|
| `fetchFinancialOverview` | Throws `OFFLINE` or `ITEM_ERROR` | Network → `OFFLINE`; partial list failure → `ITEM_ERROR` | `OFFLINE` → banner; `ITEM_ERROR` → list error |
| `fetchInvoiceDetail` | Returns `null` if not found; throws `OFFLINE` | 404/absence → `null`; network → `OFFLINE` | Catch-all returns `null` |
| `fetchBoletoInfo` | Throws `DOCUMENT_ERROR`; also `OFFLINE` | 503/generation failure → DTO `{ documentAvailable: false }`; network → `OFFLINE` | Catch-all returns `null` — `DOCUMENT_ERROR` is **not** a hook sentinel |
| `fetchPixInfo` | Throws `DOCUMENT_ERROR`; also `OFFLINE` | Same as boleto | Catch-all returns `null` |
| `fetchPaymentHistory` | Throws `OFFLINE` | Network → `OFFLINE`; otherwise list | Returns `[]` on error |
| `fetchPaymentDetail` | Returns `null` if not found | 404/absence → `null` | Catch-all returns `null` |
| `fetchReceiptData` | Returns `null` if not found | 404/absence → `null` | Catch-all returns `null` |

**Key rule:** `DOCUMENT_ERROR` is thrown by the demo finance service but is not handled by the certified hook. The backend must not introduce it as a hook-level sentinel. Document generation failures are represented canonically in the DTO and derived by the assembler (ADR-03).

### 3.3 Non-negotiables for every Edge Function

- `verify_jwt = true`, plus in-function `auth.getUser` re-verification (the current fleet already does this)
- Tenant resolved via `_shared/tenant.resolveTenant()` — supports multi-membership and `X-Tenant-Id`.
  **Never `.single()` without an `is_active` filter** (the current deployed pattern; breaks users
  with 0 or ≥2 memberships — audit §13.1)
- Resident scope resolved via `residence_members` before any residence-scoped read
- `zod` validation on every request body — currently absent fleet-wide
- CORS restricted to known origins — not `*` (audit LOW-01)
- Audit-log writes on every mutation via `_shared/audit.ts` (exists; currently called by one undeployed function)
- Structured logging with a request ID; never log PII, tokens, or `tenant_id` in production (guardrail)

### 3.4 Residence context

Every resident-scoped call carries a residence context. Hooks already own this
(`residenceId`, `setResidenceId`) and pages already render the switcher. The server **must
re-validate** on every request that the caller holds an active `residence_members` row for that
residence. Client-supplied residence IDs are untrusted input — this is precisely the class of
defect the audit found in `meter-readings-api`, where `water_meter_id` is taken from the body with
no tenant-ownership validation (HIGH-02).

---

## 4. What this blueprint deliberately does not do

- **Does not redesign the billing spine.** `receivables → billing_titles → payments` and the CNAB
  chain are left as they are. They work, they hold real settled data, and the Resident App only reads them.
- **Does not migrate the Admin App.** `tickets`, and the 11 deployed functions, keep serving Admin
  unchanged. Admin migrates on its own schedule.
- **Does not introduce a new backend runtime.** No Node service, no separate API gateway. Supabase
  Edge Functions only, as mandated.
- **Does not solve Collector offline sync in detail.** Doc 05 specifies the contract the Resident
  App needs and the primitives (idempotency, client IDs) the Collector App will build on; the
  Collector's own program owns the rest.
- **Does not write code.** Phase 1 restriction. All SQL and TypeScript herein is illustrative
  specification.

---

**Next:** [02 — Domain Model & ERD](02-domain-model-erd.md)
