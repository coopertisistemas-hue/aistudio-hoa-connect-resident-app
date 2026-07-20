# 27 — Sprint 2 Executive Planning Report

**Sprint:** Sprint 2 — Resident, Residence and Association Domain
**Status:** PLANNING ONLY — implementation not authorized
**Date:** 2026-07-20
**Author:** Sprint 2 planning executor (Kimi Code CLI)

---

## 1. Executive objective

Translate the certified Sprint 1 identity and tenant foundation into the first usable
resident-domain capability of HOA Connect: association staff can register and manage
residents, residences and their relationships; residents retain the self-service identity
capabilities certified in Sprint 1. Sprint 2 delivers the domain, authorization, Edge
Function contracts, audit evidence and validation suite required before any billing,
metering or ticket module is started.

This document, together with documents 28–31, is the complete and auditable Sprint 2
execution plan. **No product code, migration, Edge Function or test was created or
modified by this planning execution.**

## 2. Certified baseline

| Item | Value |
|---|---|
| Repository | `aistudio-hoa-connect-resident-app` |
| Certified branch | `sprint-01-foundation-identity` |
| Certified commit | `a58a1ed98b0e5299678a41be833729895b31f101` |
| Certified tag | `hoa-connect-sprint-01-foundation-certified-v1.0.0` (points at the certified commit — verified) |
| Official status | `SPRINT 1 PASS — FOUNDATION CERTIFIED` (docs/backend/26-sprint-01-foundation-certification.md) |
| State | IMPLEMENTED / AUDITED / CERTIFIED / TAGGED / PUSHED / FROZEN |

The baseline is immutable. Every Sprint 2 design element in this package **extends** the
baseline; nothing alters or weakens the 16 certified gates listed in
`26-sprint-01-foundation-certification.md` (§"Gates").

### 2.1 What the baseline actually contains (verified against implementation)

Source of truth: `supabase/migrations/20260719170000_sprint01_foundation_identity.sql`
(only migration in the repository), `supabase/functions/`, `supabase/tests/`,
`validation/`, reports 17–26.

- **Tables (10):** `tenants`, `properties`, `profiles`, `profile_contacts`,
  `platform_role_assignments`, `tenant_members`, `residence_members`,
  `profile_preferences`, `profile_devices`, `audit_events`.
- **Key enums:** `platform_role`, `profile_status`, `tenant_status`, `property_status`,
  `tenant_role` (`association_admin`, `association_operator`, `association_finance`,
  `association_support`, `association_viewer`), `tenant_membership_status`
  (`active`, `pending`, `revoked`), `residence_role` (`owner`, `tenant`, `resident`,
  `dependent`, `authorized_contact`), `residence_membership_status`
  (`active`, `pending`, `revoked`), `tenant_permission` (9 values),
  `contact_type`, `verification_state`.
- **Authorization helpers (SECURITY DEFINER, STABLE, `SET search_path = ''`):**
  `current_profile_id()`, `has_platform_role()`, `is_platform_admin()`,
  `is_active_tenant_member(uuid)`, `has_tenant_role(uuid, tenant_role)`,
  `has_tenant_permission(uuid, tenant_permission)`, `is_active_residence_member(uuid)`,
  `can_access_residence(uuid)`, `can_manage_profile(uuid, uuid)`,
  `current_tenant_context()`, `log_audit_event(...)`.
- **Immutability triggers:** `audit_events_immutable`, `profiles_protected_fields_immutable`
  (blocks `user_id`/`full_name` changes), `profile_contacts_protected_fields_immutable`.
- **RLS:** enabled + forced on all 10 tables; `authenticated` holds no write grant on
  `tenants`, `properties`, `tenant_members`, `residence_members`,
  `platform_role_assignments`, `audit_events`.
- **Edge Functions (10):** `auth-bootstrap`, `auth-context`, `resident-auth`,
  `tenant-context-list`, `tenant-context-select`, `profile-get`, `profile-update`,
  `profile-contacts-list`, `profile-contact-upsert`, `profile-contact-delete`, plus
  `_shared/` (`auth.ts`, `http.ts`, `context.ts`, `validation.ts`). All authorization is
  JWT (GoTrue) + RLS-context RPCs; the service-role `adminClient` exists in
  `_shared/auth.ts` but is **unused** (audit finding C-02, carried forward).
- **Canonical validation command:** `npm run supabase:test:all` =
  `supabase:test:sprint1` → `supabase:test:edge-func-auth` → `supabase:test:d2` →
  `supabase:test:sprint1` (order-independence proof, no reset).
- **Performance evidence baseline:** 51 tenants / 502 properties / 3,257 profiles /
  3,004 residence_members / 8,872 contacts / 10,008 audit events.

### 2.2 Certified guarantees Sprint 2 must not weaken

1. All 16 gates of report 26 remain green after Sprint 2 (regression suite runs
   Sprint 1 gates unchanged).
2. RLS-first: no operational record depends on frontend filtering for isolation.
3. `authenticated` never receives direct write access to tenant-owned structural tables.
4. `audit_events` stays append-only and immutable; `log_audit_event()` remains the only
   write path.
5. `profiles.user_id` / `profiles.full_name` immutability and contact verification-state
   protection remain trigger-enforced.
6. Platform administration stays in `platform_role_assignments`, never a tenant role.
7. Resident authorization derives from `residence_members`, never from `tenant_members`.
8. Edge Functions never use the service role as proof of authorization.
9. No hardcoded tenant/role/property/residence IDs, pricing, bank data or workflow
   assumptions in product code.

## 3. Problem statement

Sprint 1 certified **who a user is** (profile, contacts, platform/tenant/residence
memberships) but not **what an association can do with residents and residences**:

- There is no association-facing resident record: `profiles` is platform identity;
  association-scoped data (registration code, resident lifecycle status, approval state)
  has no home.
- There is no write path for association staff: `tenants`, `properties`,
  `tenant_members`, `residence_members` are SELECT-only for `authenticated`; no Edge
  Function manages them. An association admin cannot register a residence, link a
  resident, or end an occupancy.
- Household members without platform accounts (dependents, minors) cannot be
  represented: `profiles.user_id` is `NOT NULL REFERENCES auth.users`.
- There is no responsible-payer concept, which billing (Sprint 3+) requires as its
  anchor.
- `tenants` carries only identity fields; association legal/registration data,
  operational settings and per-association module enablement have no home.
- History is not a first-class concept: `residence_members` has
  `UNIQUE (property_id, profile_id)`, which makes a second occupancy period of the same
  profile in the same property inexpressible.
- There is no onboarding path: `auth-bootstrap` already returns a 404 "bootstrap
  administrativo" state anticipating a first-access flow that does not exist.

Sprint 2 closes exactly these gaps and nothing more.

## 4. Scope

In scope for Sprint 2 **planning and (after authorization) implementation**:

- Association domain extension (`association_details`, settings, module enablement).
- Tenant-scoped resident record (association-specific data and lifecycle).
- Residence management on top of the existing `properties` table (no new residence
  table; see decision D-02).
- Household membership: platform users via `residence_members` (extended for history),
  non-platform persons via a new `household_members` table.
- Responsible-payer relationship with period history (`residence_payers`).
- Occupancy/responsibility history preservation (periods + end reasons + audit).
- Resident onboarding via invitation (`residence_invitations` — already sketched in
  `02-domain-model-erd.md`, never built).
- Authorization model and RLS for all new tables; authorization matrix covering all
  actors listed in document 29.
- Edge Function contracts for the operations above (document 30).
- Audit events for every material domain change.
- SQL/RLS, Edge Function, performance and regression validation (document 31).
- Sprint 1 carry-forwards CF-01 … CF-05 (§11).

Out of scope (explicitly not implemented in Sprint 2):

- Water readings, meter entities/routes, billing calculation, invoices, boletos, CNAB,
  payment reconciliation, bank integrations.
- Ticket Kanban, collector mobile workflows, resident payment UI.
- Notifications / support_messages production transport (ADR-09 remains a D2-validated
  design; no production tables exist — see report 25 §7.6).
- Production deployment, hosted cutover, merge to main.
- LGPD erasure workflows beyond the certified DELETE-denial posture (platform-admin
  erasure remains future work, per ADR-10).
- Any change to the Sprint 1 schema objects except the explicitly planned, additive
  changes listed in document 28 §12 (enum value additions and one constraint evolution,
  each gated by a decision in §13).

## 5. Domain boundaries

| Domain | Owner of record | Boundary rule |
|---|---|---|
| Platform identity | `profiles`, `profile_contacts` (Sprint 1, frozen semantics) | One profile per `auth.users`. Identity fields never duplicated into tenant tables. |
| Association | `tenants` + new `association_details` | One tenant per association. All association-owned records carry `tenant_id` and enforce it in RLS. |
| Resident | new `residents` (tenant-scoped) + `profiles` | "Resident" = association-scoped projection of a profile. A profile may hold resident records in multiple associations. |
| Residence | `properties` (existing) | The residence/unit *is* `properties`. `UNIQUE (tenant_id, unit_identifier)` stays the canonical unit key. |
| Household | `residence_members` (users) + new `household_members` (non-users) | Users with login live only in `residence_members`; persons without login live only in `household_members`. Never both. |
| Responsibility | new `residence_payers` | Financial responsibility is a distinct relationship with its own period history; it is not a flag on occupancy. |
| Audit | `audit_events` (existing) | All Sprint 2 mutations log through `log_audit_event()`. No new audit sink. |

Boundary invariants:

- A `residents` row never grants platform or tenant administration; staff authority
  comes only from `tenant_members`.
- A `household_members` row never produces authentication or authorization.
- `residence_payers.profile_id` must reference a profile with an active `residents`
  record in the same tenant (enforcement strategy in document 28 §6).
- Cross-tenant references are structurally impossible: every new child table carries
  `tenant_id` and FK-chains through tenant-owned parents, following the Sprint 1
  pattern (`residence_members` denormalized `tenant_id`).

## 6. Dependencies

- Sprint 1 certified schema, helpers, RLS and Edge Function shared layer
  (`_shared/auth.ts`, `http.ts`, `context.ts`, `validation.ts`) — reused, not modified.
- Supabase CLI v2.107.0 local stack (as certified); `npm@10.9.8`, `package-lock.json`
  only (condition 2 of report 18).
- `npm run supabase:test:all` must remain green at every wave exit.
- GoTrue password-grant test harness (`supabase/tests/sprint01_edge_function_auth.test.mjs`
  pattern) is the template for Sprint 2 Edge Function tests.
- Billing/metering dependency (documented only): the future meter entity will anchor to
  `properties.id`; the future billing party will anchor to `residence_payers`. Sprint 2
  must not create meter or invoice tables, but must not choose keys that would force a
  redesign (see document 28 §11).

## 7. Assumptions

1. The initial customer context (Associação de Moradores de Santa Terezinha) introduces
   no hardcoding; it informs fixture realism only.
2. An association admin is a trusted operator inside their tenant; tenant isolation is
   the security boundary, not intra-tenant least privilege beyond the defined roles.
3. Dependents/minors without login are managed by a responsible profile; they never
   authenticate in Sprint 2.
4. A residence has at most one active responsible payer in Sprint 2 (shared payment is a
   future-module concern; the model must not forbid it structurally — see D-04).
5. Deceased/blocked/former are association-scoped resident states, not platform profile
   states (`profile_status` keeps its certified 4 values).
6. Invitation tokens are single-use, expiring, and hashed at rest.
7. Sprint 2 runs entirely on the local Supabase stack; no production environment exists.

## 8. Risk register

Classification: CRITICAL / HIGH / MEDIUM / LOW / OBSERVATION.

| ID | Risk | Class | Mitigation (planned) |
|---|---|---|---|
| R-01 | Duplicate/overlapping concepts between `profiles`, `tenant_members`, `residence_members`, new `residents` and `household_members` | CRITICAL | Document 28 §2 defines one canonical home per concept and a prohibited-duplication invariant; grep-verified in validation (document 31 §8). |
| R-02 | Tenant context ambiguity (user with multiple tenants/residences acts in wrong context) | HIGH | All mutations take explicit `tenant_id`/entity IDs validated server-side against `current_tenant_context()`; Edge Functions reject forged context (Sprint 1 pattern, EF-AUTH-05/06). |
| R-03 | Owner vs occupant ambiguity (`residence_role.owner` misread as current occupant) | HIGH | Role semantics fixed in document 28 §4; occupancy is derived from active memberships with period validity, not from the owner role. |
| R-04 | Payer vs resident ambiguity (payer assumed to live in the unit) | HIGH | `residence_payers` is an independent relationship; document 28 §6 states payer≠occupant invariant and tests cover off-site owner payer. |
| R-05 | Historical data overwrite on move-out/re-move-in | HIGH | Period model with end dates + partial-unique active row (D-05); `end_reason` enum; audit events on every transition; history tests (document 31 §3). |
| R-06 | RLS recursion (new policies joining back into policy-protected tables) | HIGH | Reuse certified SECURITY DEFINER helpers; new helpers follow the same STABLE/`search_path=''` pattern; recursion reviewed per table in document 29 §6; SQL gates assert policy plans. |
| R-07 | SECURITY DEFINER misuse (new helpers escalating beyond intent) | HIGH | Helpers must be `STABLE`, `SET search_path = ''`, minimal SELECTs; independent audit re-runs the report-20 threat hunt including definer review. |
| R-08 | Platform-admin overreach into tenant operational data | MEDIUM | Platform admin read access only where Sprint 1 already grants it; no new platform write path into tenant domain tables; audit events on any platform read of sensitive lists (see document 29 §4). |
| R-09 | Service-role masking RLS in Edge Functions | HIGH | All new functions use the RLS-enforced `authClient`; service role permitted only for invitation token lookup by hash (document 30 §3) with no row leakage; the unused `adminClient` (C-02) must not gain usage silently — any use is a diff-flagged audit point. |
| R-10 | Lifecycle status drift (resident/membership/payer statuses contradicting each other) | MEDIUM | Status model + prohibited-state matrix in document 28 §8; transition Edge Functions centralize legal transitions; SQL lifecycle gates. |
| R-11 | Orphan residence relationships (memberships/payers pointing at inactive properties or revoked residents) | MEDIUM | FK + CHECK + transition rules; SQL gate asserts no active relationship on `under_review`/`inactive` property without explicit operator action. |
| R-12 | Duplicate active responsibility (two active payers, two primaries) | HIGH | Partial unique indexes (one active payer per property; at most one active primary household anchor) asserted by SQL gates. |
| R-13 | Cross-tenant property association (linking a resident of tenant A to a property of tenant B) | CRITICAL | All writes resolve tenant from the target entity server-side; composite checks; forged-tenant/cross-tenant EF tests (document 31 §4). |
| R-14 | Future meter linkage constraints (Sprint 2 key choices blocking meter/billing) | MEDIUM | Document 28 §11 records forward constraints (meter anchors to `properties.id`; billing party anchors to `residence_payers`); no keys on `unit_identifier` strings. |
| R-15 | Performance at realistic association scale (membership lists, context RPC, payer lookups) | MEDIUM | Performance suite extension with defined fixtures (document 31 §5): ≥100 tenants, ≥2,000 properties, ≥10,000 residents, ≥25,000 membership rows incl. history; EXPLAIN (ANALYZE, BUFFERS) gates on every new hot path. |
| R-16 | Documentation/implementation drift (reports claiming what code doesn't do) | MEDIUM | CF-05 process rule retained: every identifier and cross-reference in Sprint 2 reports must be grep-verified; final certification re-verifies doc↔code claims. |
| R-17 | Invitation flow abuse (token guessing, replay, enumeration) | HIGH | Token stored as hash, single-use, expiring; accept endpoint rate-limited and constant-shaped errors; enumeration-resistance test (document 31 §4). |
| R-18 | Enum additions breaking certified type usage (`tenant_role` + collector) | LOW | `ALTER TYPE … ADD VALUE` is additive and non-breaking; Sprint 1 regression suite must pass unchanged. |
| R-19 | `residence_members` UNIQUE constraint evolution weakening uniqueness guarantees | HIGH | Replacement partial unique (`WHERE status = 'active'`) preserves the certified guarantee for all active rows; transition covered by migration test asserting zero duplicate active pairs. |

Blocking risks for Sprint 2 start: none open — all CRITICAL/HIGH items have planned
mitigations inside the wave design. R-01, R-13, R-19 gate Wave 2.7 certification.

## 9. Recommended execution sequence (waves)

Wave numbering follows the mandated decomposition; the repository evidence supports it
unchanged, with Wave 2.3 split into 2.3a (schema) and 2.3b (relationship logic) inside
one wave to keep migrations reviewable.

### Wave 2.0 — Baseline verification and carry-forward integration

- **Objective:** prove the certified baseline is intact and integrate CF-01 (and any
  approved CF-02/03/04 hardening) before domain work begins.
- **Files expected to change:** `package.json` (add ADR-11 to the canonical suite —
  CF-01); optionally `validation/d2_setup.sql` role names (CF-04) and a `d2_` ownership
  guard comment/script (CF-03) **only if approved**; `docs/backend/` new report.
- **Dependencies:** none.
- **Tests:** full `npm run supabase:test:all` + `node validation/adr11_finance_compatibility.mjs`
  via the new canonical command; typecheck; build.
- **Entry criteria:** working tree clean at certified commit.
- **Exit criteria:** canonical suite including ADR-11 passes; baseline diff audit shows
  only CF-scoped changes.
- **Rollback:** revert `package.json`/validation edits; baseline untouched otherwise.
- **Audit evidence:** command transcripts + git diff stored under `validation/evidence/`.

### Wave 2.1 — Association domain extension

- **Objective:** `association_details` table, enum extension (`tenant_role` +
  `association_collector` — see D-06/D-07), RLS, indexes.
- **Files expected to change:** one new migration; `supabase/tests/sprint02_*.sql`.
- **Dependencies:** Wave 2.0.
- **Tests:** SPR2-RLS association read/write gates; enum regression.
- **Entry criteria:** 2.0 exit green. **Exit criteria:** migration applies cleanly on the
  certified baseline; Sprint 1 suite green.
- **Rollback:** new migration is additive; rollback = `supabase db reset` to baseline
  locally (no production exists).
- **Audit evidence:** migration diff + gate output.

### Wave 2.2 — Resident domain

- **Objective:** `residents` table (tenant-scoped resident record), lifecycle enums,
  RLS, helper functions, invitation table if D-11 approved.
- **Files expected to change:** one new migration; SQL tests.
- **Dependencies:** Wave 2.1 (collector/permission vocabulary), document 28 approval.
- **Tests:** resident lifecycle gates, cross-tenant denial, protected-field gates.
- **Entry/exit/rollback/evidence:** as Wave 2.1 pattern.

### Wave 2.3 — Residence and household relationships

- **Objective:** `household_members`, `residence_payers`, `residence_members` history
  evolution (D-05), occupancy semantics, all constraints/indexes.
- **Files expected to change:** one new migration (may alter `residence_members`
  constraint — additive partial unique, per D-05); SQL tests.
- **Dependencies:** Wave 2.2 (residents must exist for payer FK validation).
- **Tests:** history preservation, duplicate-active-responsibility denial, orphan
  denial, cross-tenant linkage denial.
- **Rollback:** locally reset; constraint change captured in its own migration for
  reviewability.

### Wave 2.4 — Authorization and RLS

- **Objective:** complete policy set for all new tables, new `tenant_permission` values,
  helper functions, per document 29.
- **Files expected to change:** one migration (policies/helpers only); SQL RLS suite.
- **Dependencies:** Waves 2.1–2.3 schema.
- **Tests:** full authorization matrix gates (document 31 §3) including revoked and
  disabled actors, recursion checks.
- **Exit criteria:** every matrix cell in document 29 §5 has a passing automated gate.

### Wave 2.5 — Edge Function contracts

- **Objective:** implement the functions approved in document 30 (estimated 12–16
  endpoints in 6 categories).
- **Files expected to change:** `supabase/functions/` new directories only; no changes
  to Sprint 1 functions; `supabase/tests/sprint02_edge_function_*.mjs`.
- **Dependencies:** Wave 2.4.
- **Tests:** EF2-AUTH gate suite mirroring the Sprint 1 GoTrue harness; audit-event
  assertions per mutation.
- **Rollback:** delete new function directories; baseline functions untouched.

### Wave 2.6 — Validation and performance evidence

- **Objective:** performance seed + EXPLAIN gates at defined scale; full regression;
  evidence capture.
- **Files expected to change:** `supabase/tests/sprint02_performance_*.sql`;
  `validation/evidence/` artifacts.
- **Dependencies:** Wave 2.5.
- **Tests:** PERF2-* gates; `supabase:test:all` extended with Sprint 2 suites.
- **Exit criteria:** all gates green; evidence committed.

### Wave 2.7 — Independent audit and certification

- **Objective:** dual independent audit + governance certification, replicating the
  certified Sprint 1 governance chain (report 22 §chain, report 26 phases).
- **Files expected to change:** `docs/backend/` audit and certification reports only.
- **Dependencies:** Wave 2.6.
- **Entry criteria:** all technical gates green; working tree clean; no CRITICAL/HIGH
  findings open.
- **Exit criteria:** both auditors issue pure `AUDIT PASS`; certifier issues
  `SPRINT 2 PASS — RESIDENT DOMAIN CERTIFIED`; tag created **only on explicit executive
  authorization**.
- **Rollback:** certification withheld; findings routed to remediation waves.

## 10. Certification strategy

Sprint 2 reuses the certified Sprint 1 governance model without modification:

1. **Executor** implements waves 2.0–2.6 with per-wave evidence.
2. **Primary technical auditor** (independent of executor) executes the full gate suite
   and produces a findings report.
3. **Independent read-only auditor** audits implementation + evidence + documentation
   claims (grep-verified, per CF-05).
4. **Governance certifier** reconciles; the strict dual-PASS gate of report 21/26
   applies: certification requires exact `AUDIT PASS` from both auditors, all technical
   gates green, zero CRITICAL/HIGH findings, and Sprint 1 regression fully green.

Sprint 2 adds one gate: **baseline immutability proof** — a structural diff
(tables/policies/functions of the Sprint 1 migration) before/after Sprint 2,
demonstrating only the explicitly approved additive changes (D-05, D-07) are present.

## 11. Carry-forward integration (CF-01 … CF-05)

The execution brief's CF numbering differs from report 26 §8 for CF-02/CF-04. Per CF-05
(no invented identifiers), the mapping is stated explicitly:

| Brief ID | Item | Report 26 reference | Disposition in Sprint 2 |
|---|---|---|---|
| CF-01 | ADR-11 canonical integration | Report 26 §8 CF-01 (finding 7.3 in report 25) | **Plan: integrate in Wave 2.0.** Add `supabase:test:adr11` script invoking `node validation/adr11_finance_compatibility.mjs` and chain it into `supabase:test:all` after the D2 step. No test logic change. |
| CF-02 | D2 publication cleanup (residual `d2_notifications`/`d2_support_messages` in `supabase_realtime`) | Report 25 finding 7.4 — dispositioned NON-BLOCKING, **no CF ID in report 26** | **Plan: evaluate in Wave 2.0; default NO-OP.** The residue is idempotent and cosmetic; cleanup only if the Sprint 2 certification requires a pristine publication diff. Document the decision; do not implement speculatively. |
| CF-03 | `d2_` namespace ownership guard | Not in report 26 (new item from this brief) | **Plan: lightweight guard in Wave 2.0.** A header-comment convention + a CI-style grep check (`validation/` script asserting no non-`d2_` object adopts the prefix and no product object is named `d2_*`). No runtime guard (would add trigger overhead to the certified DB). |
| CF-04 | Four unprefixed cluster-global test roles (`profile_read_test`, `profile_self_update_test`, `operator_contact_test`, `platform_admin_test`) | Report 26 §8 CF-02 (finding 7.2 in report 25) | **Plan: defer rename; document in Wave 2.0.** Renaming is a validation-only change but touches certified D2 evidence; scheduled alongside the next D2 suite revision (Sprint 3 at latest). Interim: CF-03 grep check asserts the four names remain the only unprefixed test roles. |
| CF-05 | Documentation reference verification | Report 26 §8 CF-05 (§5 correction of record) | **Active process rule for all Sprint 2 documents.** Every condition ID, gate ID, file and section reference in documents 27–31 and future Sprint 2 reports must be grep-verified before publication. This package follows it (see §14). |

Unnumbered residuals also carried (from reports 20/23/25): RT-01 timing flake (LOW),
PERF-05 deferred monitor, EF-11 500-vs-422 mapping (LOW), C-02 unused service-role
`adminClient` (LOW — explicitly constrained by R-09), ADR-09 `support_messages` runtime
transport revision criteria, ADR-09 Seq Scan performance note.

## 12. Naming and vocabulary reconciliation

Two documented drifts are resolved by this plan:

1. **Roadmap naming:** `06-migration-roadmap.md` titles Sprint 2 "Authentication (first
   live module)"; certification reports 21/22 and this brief title it "Resident,
   Residence and Association Domain". **Resolution:** the latter is authoritative;
   authentication was delivered inside Sprint 1 (Edge Functions + GoTrue).
2. **Residence role vocabulary:** blueprint docs 01/02/04 use
   `holder | financial_responsible | authorized_resident | dependent | representative |
   temporary_guest`; the shipped certified enum `residence_role` is
   `owner | tenant | resident | dependent | authorized_contact`.
   **Resolution (D-03/D-04):** the shipped enum is canonical. `financial_responsible`
   is **not** a residence role — it is the separate `residence_payers` relationship.
   `representative`/`temporary_guest` are deferred; if needed they become new enum
   values via the same additive mechanism, never a parallel vocabulary.

## 13. Decision log (executive approval required before implementation)

Each decision lists alternatives, recommendation, rationale, risk, migration impact and
future-module impact. Full field-level specifications are in documents 28–30.

### D-01 — Resident vs profile relationship

- **Alternatives:** (A) tenant-scoped `residents` table projecting `profiles` into an
  association; (B) resident = profile + `residence_members` only, no new table; (C)
  extend `tenant_members` with a resident role.
- **Recommendation:** **A**.
- **Rationale:** association-scoped data (registration code, resident lifecycle,
  approval state, association notes) needs a tenant-owned home; (B) forces that data
  into `properties`-scoped rows or jsonb on profiles (breaks tenant boundary); (C)
  violates the certified rule that residents are never `tenant_members` (report 17,
  ADR-01 in `01-architecture-blueprint.md`).
- **Risk:** R-01 concept duplication — mitigated by the invariant that `residents`
  stores zero identity fields (no name, no contacts; FK to `profiles` only).
- **Migration impact:** additive (new table + enum).
- **Future-module impact:** billing, tickets and communication target `residents`
  (tenant-scoped), never raw profiles.

### D-02 — Residence vs property relationship

- **Alternatives:** (A) residence **is** `properties` (extend semantics, add nothing);
  (B) new `residences` table over `properties`; (C) new `occupancies` entity.
- **Recommendation:** **A**. A residence is a property; occupancy is the set of active
  `residence_members`; household is memberships + `household_members`; vacancy = no
  active occupancy. No new residence table.
- **Rationale:** `properties` already carries tenant ownership, unit/block identifiers,
  status and certified RLS (`can_access_residence`). A parallel table would fork the
  tenant boundary and every certified policy.
- **Risk:** R-03 semantics drift — mitigated by explicit vocabulary in document 28 §4.
- **Migration impact:** none on `properties` structure in Sprint 2 (optional
  `occupancy_status` derived view deferred).
- **Future-module impact:** meters anchor to `properties.id` directly (document 28 §11).

### D-03 — Household membership model

- **Alternatives:** (A) users in `residence_members`, non-users in new
  `household_members`; (B) profiles with nullable `user_id` for non-users; (C) jsonb
  dependent lists on the responsible membership.
- **Recommendation:** **A**. (B) breaks the certified 1:1 `profiles`↔`auth.users`
  identity model and NOT NULL constraint; (C) is unauditable and unqueryable.
- **Rationale:** `household_members` (tenant-owned, property-linked, linked to a
  responsible profile) cleanly models minors/dependents without login, with lifecycle
  and audit. Legal representative = the responsible `profile_id` on the row.
- **Risk:** R-01 overlap — invariant: a person with a platform account must not also be
  a `household_members` row for the same property (document 28 §8 prohibited states).
- **Migration impact:** additive.
- **Future-module impact:** communication/consent modules reference household persons;
  billing never does (billing anchors to payers).

### D-04 — Responsible payer model

- **Alternatives:** (A) separate `residence_payers` table with period history; (B)
  `is_payer` flag on `residence_members`; (C) nullable `payer_profile_id` on
  `properties`.
- **Recommendation:** **A**, with exactly one active payer per property (partial unique
  index) in Sprint 2.
- **Rationale:** (B) forces the payer to be an occupant (wrong: off-site owners pay);
  (C) has no history and no tenant-scoped audit trail. (A) preserves responsibility
  history across occupant change, which the historical-integrity principle requires.
- **Risk:** R-04 ambiguity, R-12 duplicates — both mitigated structurally.
- **Migration impact:** additive.
- **Future-module impact:** Sprint 3+ billing party = active `residence_payers` row;
  split payment later relaxes the partial unique to N active rows with shares — no
  redesign.

### D-05 — Ownership and occupancy history

- **Alternatives:** (A) keep one row per (property, profile), replace
  `UNIQUE (property_id, profile_id)` with partial unique on active rows, new row per
  period, `end_date` + `end_reason` on close; (B) separate append-only periods table;
  (C) overwrite in place + audit only.
- **Recommendation:** **A**.
- **Rationale:** (C) violates the historical-integrity principle; (B) doubles read-path
  complexity for the hottest authorization table; (A) preserves the certified
  "one active membership per pair" guarantee while making re-occupancy expressible, and
  keeps the Sprint 1 RLS policies valid unchanged (they filter `status = 'active'`).
- **Risk:** R-19 constraint evolution — gated by migration test asserting zero
  duplicate active pairs; Sprint 1 regression must pass unchanged.
- **Migration impact:** the **only** Sprint 1 schema alteration proposed in Sprint 2:
  drop `UNIQUE (property_id, profile_id)`, add `UNIQUE (property_id, profile_id) WHERE
  status = 'active'`, add `end_reason` column. Requires executive sign-off.
- **Future-module impact:** consumption/billing history joins by period, not by "current
  row", which is what water billing across occupant changes requires.

### D-06 — Association extension model

- **Alternatives:** (A) new 1:1 `association_details` table; (B) widen `tenants`;
  (C) jsonb `metadata` on `tenants`.
- **Recommendation:** **A**, plus `enabled_modules` (jsonb or text[]) on
  `association_details` for per-association module enablement.
- **Rationale:** `tenants` is certified and shared by every policy; keeping it small
  preserves the baseline. Typed columns (registration/CNPJ, legal contacts, address)
  need constraints jsonb cannot enforce. Module enablement must be queryable in RLS-adjacent
  checks later.
- **Risk:** LOW.
- **Migration impact:** additive.
- **Future-module impact:** billing module enablement per association reads
  `enabled_modules`; no schema change needed later.

### D-07 — Lifecycle statuses and role vocabulary

- **Alternatives:** (A) new enums `resident_status`
  (`pending`, `active`, `inactive`, `former`, `deceased`, `blocked`),
  `residence_membership_end_reason` (`moved_out`, `ownership_transferred`,
  `evicted`, `deceased`, `blocked`, `administrative`), `household_relationship`
  (`spouse`, `child`, `parent`, `relative`, `dependent`, `legal_charge`, `other`),
  and `ALTER TYPE tenant_role ADD VALUE 'association_collector'`; (B) text + CHECK;
  (C) reuse `profile_status`.
- **Recommendation:** **A** (enums, consistent with Sprint 1 style).
- **Rationale:** (C) conflates platform identity state with association-scoped state
  (a deceased association resident is not a disabled platform user); (B) loses type
  safety. Collector is a tenant staff role per `02-domain-model-erd.md`
  ("add collector role only"), named `association_collector` for enum consistency —
  **this naming choice itself is flagged for approval**.
- **Risk:** R-18 (LOW).
- **Migration impact:** additive enum values/types only.
- **Future-module impact:** collector mobile workflows (future) read
  `has_tenant_role(tenant, 'association_collector')`.

### D-08 — Allowed administrative overrides

- **Alternatives:** (A) association admin/operator may mutate only association-scoped
  records (`residents`, memberships, payers, household, `association_details` subset)
  via Edge Functions with audit; identity protected fields (`full_name`, contacts
  verification) remain trigger-protected with no staff override; (B) staff may edit
  identity fields with audit; (C) no staff mutations at all.
- **Recommendation:** **A**.
- **Rationale:** preserves the certified protected-field triggers unchanged; ADR-10's
  governed-correction (COR- protocol) flow remains the future path for identity fixes.
- **Risk:** R-08 — bounded by per-table protected-field lists (document 29 §6).
- **Migration impact:** none (Edge Function + policy design).
- **Future-module impact:** correction-request module (future) plugs into the same audit
  sink.

### D-09 — Audit retention

- **Alternatives:** (A) reuse `audit_events` indefinitely, no deletion, retention policy
  deferred to platform operations; (B) per-tenant retention setting in Sprint 2.
- **Recommendation:** **A**. Sprint 2 defines event names and metadata shape only
  (document 30 §5); retention is an operations decision outside this sprint.
- **Risk:** table growth — monitored via performance suite (audit indexes already
  certified).
- **Migration impact:** none.

### D-10 — Deletion vs deactivation

- **Alternatives:** (A) deactivation/terminal-status only, no hard deletes of domain
  records (soft-delete `deleted_at` only where Sprint 1 precedent exists, i.e. contact
  style); (B) hard delete for staff convenience.
- **Recommendation:** **A**. `household_members` may hard-delete only while
  `status = 'pending'` (pre-approval cleanup); everything else transitions.
- **Rationale:** historical-integrity principle; LGPD erasure stays platform-admin-only
  per ADR-10.
- **Risk:** LOW.
- **Migration impact:** none.

### D-11 — Resident onboarding via invitation (additional decision)

- **Alternatives:** (A) `residence_invitations` table + create/accept/revoke Edge
  Functions (as pre-sketched in `02-domain-model-erd.md`); (B) staff create auth users
  directly (service role); (C) defer onboarding to Sprint 3.
- **Recommendation:** **A**, minimal version (email or phone, token hash, expiry,
  single use, proposed residence role + property).
- **Rationale:** without onboarding the sprint delivers no *usable* capability
  (`auth-bootstrap` 404 already anticipates it); (B) violates the service-role
  restriction principle; (C) makes the sprint's acceptance criteria untestable
  end-to-end.
- **Risk:** R-17 — mitigations listed there.
- **Migration impact:** additive.
- **Future-module impact:** same invitation rail serves staff invitations later
  (inviter_type already contemplated in doc 02).

## 14. Documentation integrity statement (CF-05 compliance)

- CF IDs in §11 were cross-checked against `26-sprint-01-foundation-certification.md`
  §8 and report 25 findings 7.1–7.5; the brief's CF-02/CF-03/CF-04 numbering divergence
  is disclosed rather than silently renumbered.
- Gate IDs referenced (SPR1-*, EF-AUTH-*, PERF-*, DB-*, RT-*, PR-*, EC-*) exist in
  `supabase/tests/` and `validation/` as cited.
- Table, enum, function and policy names in §2.1 were verified against
  `supabase/migrations/20260719170000_sprint01_foundation_identity.sql`.
- Sprint 2 gate IDs proposed in documents 29–31 (SPR2-*, EF2-*, PERF2-*) are new and
  marked as proposals; no Sprint 1 ID is reused.

## 15. Final recommendation of this planning package

All executive decisions D-01 … D-11 carry a recommendation and are implementable as
specified. No foundation conflict was found during discovery; the certified baseline
supports every planned extension additively, with exactly one Sprint 1 schema
alteration requiring sign-off (D-05).

**SPRINT 2 PLANNING APPROVED — READY FOR EXECUTIVE REVIEW**
(implementation remains unauthorized until the executive approves D-01 … D-11 and
issues the Sprint 2 execution order)
