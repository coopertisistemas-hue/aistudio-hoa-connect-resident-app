# 31 — Sprint 2 Validation and Certification Plan

**Status:** PROPOSED — no test code created. Defines the complete Sprint 2 test and
certification strategy. Gate IDs `SPR2-*`, `EF2-*`, `PERF2-*` are new proposals; Sprint
1 IDs (`SPR1-*`, `EF-AUTH-*`, `PERF-*`, `DB-*`, `RT-*`, `PR-*`, `EC-*`) are referenced,
never redefined.

Test infrastructure inherited from Sprint 1 (certified): transaction-wrapped SQL gates
with `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claim.sub', …)`
(`supabase/tests/sprint01_foundation.sql` pattern); GoTrue password-grant Edge
Function harness (`sprint01_edge_function_auth.test.mjs` pattern,
`supabase functions serve --no-verify-jwt`, endpoint `http://127.0.0.1:54331`);
performance EXPLAIN (ANALYZE, BUFFERS) gates; canonical orchestration
`npm run supabase:test:all`; evidence committed under `validation/evidence/`.

---

## 1. Test surfaces and files (planned, not created)

| File | Purpose | Wave |
|---|---|---|
| `supabase/tests/sprint02_domain.sql` | SQL/RLS/lifecycle/history gates (§3) | 2.1–2.4 |
| `supabase/tests/sprint02_edge_function_fixtures.sql` | users/tenants/residents/residences fixtures (§2) | 2.5 |
| `supabase/tests/sprint02_edge_function_auth.test.mjs` | EF2-* gate suite (§4) | 2.5 |
| `supabase/tests/sprint02_performance_seed.sql` / `sprint02_performance_explain.sql` | PERF2-* (§5) | 2.6 |
| `package.json` | `supabase:test:sprint2*`, extend `supabase:test:all`; CF-01 script | 2.0/2.6 |
| `validation/evidence/sprint02_*` | JSON/MD evidence artifacts | 2.5–2.7 |

`supabase:test:all` target shape after Wave 2.6 (order preserves the certified
order-independence proof):
`sprint1 → edge-func-auth → d2 → sprint2-sql → sprint2-edge → adr11 (CF-01) → sprint1`.

## 2. Fixtures

Extend (never mutate) the Sprint 1 fixture vocabulary. UUID namespacing follows the
certified convention; Sprint 2 fixture UUIDs take a distinct prefix block
(`20260720-…`-style or `c0000000-…` block — fixed at Wave 2.5, documented in the
fixtures file header) so fixtures are greppable and collision-free.

**(R1) Fixture UUID block fixed:** `c0000000-0002-...` (deferred decision closed,
document 27 §13a item 12).

- **Tenant A** (existing seed, Jardim das Nascentes) + **Tenant B** (existing edge
  fixtures) + **Tenant C** (new; pure Sprint 2 tenant with zero Sprint 1 rows —
  proves tenant-additive isolation).
- Users: reuse `resident.a`, `operator.a`, `platform.admin`, `resident.b`,
  `revoked.*`, `disabled.*`, `unrelated.*` (existing). New: `admin.a`
  (association_admin A), `finance.a`, `support.a`, `viewer.a`, `collector.a`,
  `resident.multi` (resident in A **and** B), `payer.offsite` (owner-payer not
  occupying), `invitee.new` (accepts invitation), `resident.c` (tenant C only).
- Domain fixtures: 2 new properties in A (one vacant), 1 in C; residents in all
  statuses (`pending/active/inactive/blocked/former/deceased`); memberships covering
  every role + closed periods with each `end_reason`; household members (minor,
  spouse); payer history (current + 2 ended); invitations in every status.

## 3. SQL and RLS gates (`sprint02_domain.sql`)

Style: transaction-wrapped, `ROLLBACK` at end, DO-blocks raising on failure, gate IDs
in RAISE messages.

### Tenant isolation

- **SPR2-RLS-01** `residents` of tenant A invisible to authenticated caller whose only
  membership is tenant B (and C).
- **SPR2-RLS-02** `household_members` / `residence_payers` / `residence_invitations`
  same isolation per table (one gate each or parameterized loop — final structure in
  Wave 2.4; each table has its own gate ID: -02a/b/c).
- **SPR2-RLS-03** Cross-tenant INSERT: staff of A inserting a row with
  `property_id` of B fails (WITH CHECK + helper tenant mismatch).
- **SPR2-RLS-04** Tenant C (fresh tenant): no Sprint 1 object leaks into C context;
  `current_tenant_context()` for `resident.c` lists only C.

### Self access / cross-denial

- **SPR2-RLS-05** Resident reads own `residents` record (all statuses incl. history).
- **SPR2-RLS-06** Resident cannot read another resident's record in the same tenant
  (non-household) — zero rows, and direct PostgREST count is 0.
- **SPR2-RLS-07** Household member reads co-member resident projection and own
  property's `household_members`; cannot read another property's
  (`can_access_residence` false).
- **SPR2-RLS-08** Cross-residence denial: member of property X gets zero rows for
  property Y memberships/household/payers.
- **SPR2-RLS-09** Payer reads own `residence_payers` history (active + ended); cannot
  read payers of other properties.

### Role-scoped staff access

- **SPR2-RLS-10** `association_admin` full matrix per doc 29 §5 (representative cells,
  all tables).
- **SPR2-RLS-11** `association_operator` can write residents/members/payers/household;
  cannot write `association_details`, cannot read `audit_events` (RPC 403).
- **SPR2-RLS-12** Collector **(R1, strengthened)**: reads the properties list; reads
  **zero rows from `residence_members`** — asserted by a direct select as the collector,
  not by inspecting an Edge Function response, because the previous formulation
  ("no PII in the F-08 payload") would have passed while the collector read every
  membership row in the tenant via PostgREST; zero resident identity fields anywhere;
  zero writes on every Sprint 2 table.
- **SPR2-RLS-13** Finance: reads residents/payers; zero writes; `tenant_audit_events`
  RPC allowed.
- **SPR2-RLS-14** Viewer: read-only; all writes denied.
- **SPR2-RLS-15** Platform admin: reads all Sprint 2 tables; zero write policies (any
  direct INSERT/UPDATE attempt fails); platform support role has zero access.

### Revocation / disabled

- **SPR2-RLS-16** Revoked tenant_membership ⇒ immediate zero staff rows (same
  transaction after status flip — no caching).
- **SPR2-RLS-17** Revoked residence membership ⇒ loses household/payer/property reads;
  retains only platform-self profile/contacts.
- **SPR2-RLS-18** Disabled profile (`profiles.status='disabled'`) ⇒
  `current_profile_id()` NULL ⇒ zero rows from every new policy (fail-closed sweep
  over all Sprint 2 tables).

### Protected fields / spoofing

- **SPR2-RLS-19** INSERT `residents` with `status='active'` rejected (forced pending).
- **SPR2-RLS-20** UPDATE of protected fields (`tenant_id`, `profile_id`,
  `approved_at`, …) rejected by trigger on each protected table (one assertion per
  field class).
- **SPR2-RLS-21** `token_hash` column not selectable by `authenticated`
  (column-privilege gate: direct select raises insufficient_privilege).
- **SPR2-RLS-22** `residence_payers` close-only trigger: editing
  `profile_id/start_date` on any row rejected; only close-shape UPDATE passes.
- **SPR2-RLS-23** Closed `residence_members` row immutable — trigger
  `residence_members_closed_immutable` ships (deferred decision closed, document 27
  §13a item 4), so the gate asserts at SQL level: any UPDATE of a `revoked` row raises.
- **SPR2-RLS-26 (R1)** `residents` SELECT policy contains **no** co-household clause;
  a co-household member reading another resident's row gets zero rows.
- **SPR2-RLS-27 (R1)** `residence_payers`: a household member reads the active row and
  **zero ended rows**; the payer reads their own ended rows; staff with
  `residence_payers:read` read all.
- **SPR2-RLS-28 (R1)** `association_settings_private` and `resident_staff_notes`
  return zero rows for residents, co-household members, collector, finance, support and
  viewer.
- **SPR2-RLS-29 (R1)** Extended `profiles_select_association_policy`: staff read the
  profile of a `pending` resident, a `former` resident and an off-site payer with no
  membership; a staff member of another tenant reads none of them; Sprint 1
  profile-visibility gates pass unchanged.

### Lifecycle transitions

- **SPR2-LIFE-01** Full `residents.status` transition graph: every legal edge passes,
  every illegal edge (incl. `deceased→active`, `former→active` unless D-01a re-entry
  path is exercised via `former→pending`) raises.
- **SPR2-LIFE-02** Membership `pending→active→revoked(end_reason)` legal chain;
  `revoked→active` impossible.
- **SPR2-LIFE-03** Deceased cascade (via EF in EF2 suite; SQL gate asserts the
  resulting invariant set: no active memberships/payers after cascade fixtures).

### Historical integrity

- **SPR2-HIST-01** Close + re-assign same (property, profile) yields two rows, exactly
  one active (partial unique enforced; second active INSERT raises).
- **SPR2-HIST-02** Closed rows carry `end_date` (+`end_reason` for memberships) —
  CHECK assertion over mutated fixtures.
- **SPR2-HIST-03** Payer replacement preserves ended row; exactly one active payer per
  property across the fixture set (aggregate assertion).
- **SPR2-HIST-04** One active primary residence per profile enforced (second active
  primary INSERT raises).

### Audit

- **SPR2-AUDIT-01** Every EF-triggering SQL-path mutation performed through the definer
  audit function produces exactly one row with expected action/entity/request_id
  (representative per action class; full per-action coverage in EF2 suite).
- **SPR2-AUDIT-02** `audit_events` UPDATE/DELETE still raises (regression on certified
  immutability with Sprint 2 rows present).

### Grants, RPCs and atomicity (R1)

- **SPR2-GRANT-01** The catalog contains **no** INSERT/UPDATE/DELETE grant to
  `authenticated` on any table in `public` — certified or new (document 29 §2 rule 12).
  This is the machine-checkable form of certified guarantee #3.
- **SPR2-GRANT-02** Direct PostgREST INSERT/UPDATE/DELETE attempts by `authenticated`
  on every Sprint 2 table ⇒ `permission denied` from the grant layer.
- **SPR2-RPC-01** Every mutation RPC is `SECURITY INVOKER`, `VOLATILE`,
  `SET search_path = ''`; the two sanctioned `DEFINER` RPCs
  (`accept_residence_invitation`, `tenant_audit_events`) are the **only** DEFINER
  functions beyond the certified helper set (catalog assertion).
- **SPR2-RPC-02** RLS still applies inside an INVOKER RPC: a caller without permission
  invoking the RPC directly gets zero rows written and an error, not a silent success.
- **SPR2-RPC-03 — atomicity.** An injected failure partway through each multi-write RPC
  (`resident_status_transition` deceased cascade, `residence_payer_assign` replace,
  `accept_residence_invitation`) leaves **zero domain rows and zero audit rows**. This
  replaces the previous EF2-F07 rollback gate, which asserted a property the Edge
  Function to PostgREST model could not provide.
- **SPR2-FK-01 — structural tenant coherence.** For every Sprint 2 child table, an
  INSERT combining a valid `tenant_id` of A with a valid `property_id`/`resident_id` of
  B raises a **foreign key violation**, executed as a superuser bypassing RLS to prove
  the guarantee does not depend on policy or application code (document 27 D-13).
- **SPR2-HIST-05 (R1)** No Sprint-2-created `residence_members` or `residence_payers`
  row has a NULL `start_date`.
- **SPR2-HIST-06 (R1)** EXCLUDE constraints reject overlapping historical periods for
  the same (property, profile) membership and the same property's payers.

### Recursion / plans

- **SPR2-RLS-24** No infinite recursion: each new policy exercised under
  `SET LOCAL ROLE authenticated` completes (the co-household clause of `residents`
  and the household INSERT check specifically).
- **SPR2-RLS-25** New helpers are `STABLE` + `SET search_path = ''` (catalog
  assertion mirroring the report-20 C-06 check).

## 4. Edge Function gates (`sprint02_edge_function_auth.test.mjs`)

Harness: certified GoTrue password-grant pattern; suites per function F-01…F-24.
Generic classes applied to **every** function (parameterized matrix, IDs
`EF2-AUTH-<Fnn>-<class>`):

1. **anonymous** ⇒ 401 UNAUTHENTICATED.
2. **invalid token / expired token** ⇒ 401.
3. **self access** where applicable ⇒ 200 with scoped projection.
4. **forged tenant** (body tenant_id of another tenant) ⇒ 403/404, zero side effects.
5. **forged residence** (property_id of another tenant) ⇒ 404, zero side effects.
6. **insufficient role** (viewer/collector hitting write endpoints; operator hitting
   admin-only) ⇒ 403.
7. **cross-tenant attempt** (staff of A targeting B entities) ⇒ 404 + audit absence.
8. **revoked user** ⇒ 403.
9. **disabled user** ⇒ 403.
10. **invalid input** ⇒ 422 VALIDATION_ERROR (per schema field class).
11. **internal failure** (injected DB error via fixture) ⇒ 500 INTERNAL_ERROR envelope,
    no Postgres leakage (EF-AUTH-15 posture).
12. **audit generation** ⇒ exactly one `audit_events` row per successful mutation,
    verified via SQL side-channel with expected action/metadata keys.

Function-specific suites (highlights, non-exhaustive):

- **EF2-F07-*** transition matrix incl. deceased cascade closes memberships + payers
  atomically (failure mid-cascade ⇒ total rollback, 500 envelope, zero partial rows).
- **EF2-F10-*** duplicate `(tenant_id, unit_identifier)` ⇒ 200 idempotent replay.
- **EF2-F12-*** duplicate active membership ⇒ 200 idempotent; RESIDENT_REQUIRED 422.
- **EF2-F17-*** off-site owner payer assign 200; second payer 409; replace flow emits
  two audit events.
- **EF2-F19-*** token returned once; DB stores hash only (SQL cross-check);
  duplicate pending ⇒ 200 idempotent.
- **EF2-F20-*** accept happy path converts bootstrap-404 user into resident
  (`requires_resident_approval` on/off both paths); expired/revoked/unknown token ⇒
  identical 404 shape (byte-equal error bodies); invitee contact mismatch ⇒ 403;
  token replay ⇒ 404; per-caller failure threshold ⇒ 429 RATE_LIMITED.
- **EF2-F22-*** move-out request by non-owner membership ⇒ 403.
- **EF2-F24-*** finance 200, operator 403, cross-tenant empty.

Evidence: JSON written to `validation/evidence/sprint02_edge_function_authorization.json`
(same artifact convention as Sprint 1).

## 5. Performance gates (`PERF2-*`)

Fixture scale (must exceed Sprint 1's 51 tenants / 502 properties / 3,257 profiles /
3,004 memberships to prove headroom for realistic association scale, R-15):

| Entity | Rows |
|---|---|
| tenants | ≥ 100 |
| properties | ≥ 2,000 |
| profiles | ≥ 10,000 |
| residents | ≥ 10,000 (multi-association profiles included) |
| residence_members | ≥ 25,000 (≥ 30% closed history rows) |
| household_members | ≥ 15,000 |
| residence_payers | ≥ 8,000 (≥ 40% ended) |
| residence_invitations | ≥ 3,000 |
| audit_events | ≥ 100,000 |

Gates (EXPLAIN (ANALYZE, BUFFERS), plans + timings committed as evidence):

- **PERF2-01** `resident-list` hot path (tenant + status filter + profile join):
  index scan on `residents(tenant_id, status)`; no seq scan on `residents`.
- **PERF2-02 (R1, rewritten)** `residence-get` occupancy projection. The previous
  formulation asserted the query "uses certified partial active membership indexes";
  those indexes are **not partial** — `idx_residence_members_profile_active` and
  `idx_residence_members_property_active` are plain composite B-tree indexes on
  `(profile_id, status)` and `(property_id, status)`
  (`...foundation_identity.sql:214-215`); the `_active` suffix describes intent, not
  structure. The gate now asserts: (a) the **new** partial indexes
  `idx_residence_members_property_open` / `_profile_open` (document 28 §5.4) are chosen
  by the planner for `status='active'` lookups; (b) no sequential scan on
  `residence_members` at the §5 fixture scale; (c) buffer counts are compared against
  the certified composite-index plan and recorded as evidence, so the benefit of the
  new partial indexes is measured rather than asserted.
- **PERF2-03** `current_tenant_context()` with multi-association profile
  (`resident.multi`): regression vs Sprint 1 plan shape.
- **PERF2-04** Payer lookup by property (billing-critical path): unique partial index
  hit.
- **PERF2-05** `tenant_audit_events` RPC paged scan: uses
  `idx_audit_events_tenant_created`; no full table scan at 100k rows.
- **PERF2-06** Invitation accept hash lookup: unique index hit, constant time.
- **PERF2-08 (R1)** `resident-list` `q` search path (registration code + profile
  display fields across the policy boundary): trigram index hit on
  `residents.registration_code`; no sequential scan at 10,000 residents in one tenant.
  This path had no gate previously.
- **PERF2-09 (R1)** `residents` SELECT policy plan shape after removal of the
  co-household `EXISTS` clause: index scan, no correlated subquery, compared against the
  pre-removal plan and recorded as evidence.
- **PERF2-07** Sprint 1 PERF-01…PERF-05 re-run on the Sprint 2 fixture scale
  (regression — proves Sprint 2 indexes/constraints didn't degrade certified paths;
  PERF-05 association-path scan remains a monitored item per report 18).

## 6. Regression strategy (Sprint 1 preservation)

- The certified suites run **unmodified**: `supabase:test:sprint1`,
  `supabase:test:edge-func-auth`, `supabase:test:d2`, `supabase:perf:*`, plus
  `npm ci`, `npm run typecheck`, `npm run build`.
- `supabase:test:all` extended per §1; the final `sprint1` re-run proves Sprint 2
  artifacts leave Sprint 1 gates green (same order-independence philosophy).
- **Baseline immutability proof (new gate, Wave 2.7):** structural catalog dump of all
  non-`d2_` objects before/after Sprint 2 (technique proven in report 25's
  fingerprinting); the diff must equal **exactly the frozen list in document 28 §12**.
  **(R1)** The approved set is no longer assembled from several documents — the previous
  version required combining doc 28 §12 with a `properties` grant disclosed only inside
  doc 30 F-10, and omitted the `profiles` policy change entirely. An approved set spread
  across documents either flags legitimate changes as blockers or gets edited during
  Wave 2.7 to match what was built, which hollows out the proof. The frozen list is
  signed off **before Wave 2.1**; any addition requires new executive authorization, not
  a document edit. Anything else in the diff = certification blocker.
  Note the `properties` INSERT grant that appeared in the old approved set is
  **withdrawn**: no table write grant exists (SPR2-GRANT-01).
- CF-01: `node validation/adr11_finance_compatibility.mjs` wired as
  `supabase:test:adr11` inside `supabase:test:all`; EC-01…EC-11 must stay 11/11.
- D2 suite untouched (CF-02 publication residue, CF-03 namespace guard check,
  CF-04 role names per doc 27 §11 dispositions).

## 7. Acceptance criteria (Sprint 2 done = all true)

1. All SPR2-* SQL gates green.
2. All EF2-* gates green; evidence artifact committed.
3. All PERF2-* gates green at §5 scale; evidence committed.
4. All Sprint 1 gates green unmodified (incl. final re-run).
5. Baseline immutability proof diff == approved set only.
6. Every audit action in doc 30 §5 has ≥ 1 generation test + immutability regression
   green.
7. Every authorization-matrix cell of doc 29 §5 has ≥ 1 automated gate (coverage map
   committed).
8. No CRITICAL/HIGH findings open from either auditor.
9. Working tree clean; docs 27–31 + wave reports + audit/certification reports
   present and grep-verified (CF-05 as expanded in document 27 §14.1 — every baseline
   claim carries a file:line citation, including in planning documents).
10. **(R1)** SPR2-GRANT-01/02 green: `authenticated` holds no table write grant
    anywhere; certified guarantee #3 machine-verified rather than asserted.
11. **(R1)** SPR2-RPC-01/02/03 green: mutation RPCs are INVOKER, RLS applies inside
    them, and every multi-write operation is atomic with its audit event.
12. **(R1)** SPR2-FK-01 green: cross-tenant linkage rejected by the database with RLS
    bypassed.
13. **(R1)** Every row of the document 29 §8 data-minimization map has a gate that reads
    **the table as the actor**, not an Edge Function response.
14. **(R1)** Zero deferred architectural decisions remain open (document 27 §13a).

## 7.1 Verification record (R1 — CF-05 §14.1 of document 27)

Baseline claims verified against
`supabase/migrations/20260719170000_sprint01_foundation_identity.sql` at HEAD `1e6e4bb`:
membership indexes are plain composite, not partial (L214–215) — the correction driving
PERF2-02; `idx_audit_events_tenant_created` exists as cited by PERF2-05 (L217);
`authenticated` grants (L725–749); `residence_members_select_tenant_policy` keyed on
`residences:read` (L686). Sprint 1 fixture scale (51 tenants / 502 properties / 3,257
profiles / 3,004 memberships / 8,872 contacts / 10,008 audit events) taken from report
26 as cited in document 27 §2.1.

## 8. Certification governance

Replication of the certified Sprint 1 chain (report 22, report 26), no model change:

| Step | Role | Responsibility |
|---|---|---|
| 1 | Executor | Waves 2.0–2.6, per-wave evidence, wave reports |
| 2 | Primary technical auditor | Independent execution of §3–§6 suites; findings report with CRITICAL/HIGH/MEDIUM/LOW/OBS classes |
| 3 | Independent read-only auditor | Code + evidence + documentation audit; threat hunt incl. SECURITY DEFINER review (R-07), service-role usage (R-09), recursion (R-06); grep-verification of every doc claim (CF-05) |
| 4 | Governance certifier | Reconciliation; strict dual-PASS gate — exact `AUDIT PASS` from both auditors, zero CRITICAL/HIGH, all §7 criteria true ⇒ issues `SPRINT 2 PASS — RESIDENT DOMAIN CERTIFIED` |

Auditor independence: executors of step 2 and 3 must be different agents/models than
the wave executor and from each other (Sprint 1 precedent: vendor/model separation;
substitution rules per report 26 apply and must be disclosed).

Certification outputs (planned docs, not created by this plan):
`32-sprint-02-implementation-report.md` … wave/audit/closure sequence mirroring
17→26, ending in a final certification document and, **only on explicit executive
order**, tag `hoa-connect-sprint-02-resident-domain-certified-v1.0.0`.

## 9. Known validation limitations (disclosed)

- **(R1, resolved)** The rate-limit gate no longer depends on a deferred decision: the
  mechanism is `invitation_accept_attempts` + `invitation.accept_failed`
  (document 28 §6.6), so EF2-F20 asserts a real threshold.
- **(R1, narrowed)** `household_members` duplicate detection: rows carrying
  `linked_profile_id` are now constraint-enforced (partial unique, document 28 §6.3).
  Only **unlinked** rows — persons with no platform account — remain heuristic
  (name + birth_date), enforced in the RPC and audited. Residual duplicate risk accepted
  and disclosed (LOW), materially smaller than before.
- **(R1, resolved)** Move-out requests have queryable state
  (`requested_end_date`, `moveout_requested_at`), so staff no longer depend on
  audit-stream reads to find them.
- PERF2 timings are local-stack evidence (Docker, certified CLI), not production
  benchmarks — same caveat as Sprint 1 PERF suite.
