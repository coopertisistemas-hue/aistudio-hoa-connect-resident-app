# 32 — Sprint 2 Executive Decision Review (Architecture Review Board)

**Type:** Executive Architecture Review — NOT an implementation wave
**Status:** REVIEW COMPLETE — implementation NOT authorized
**Date:** 2026-07-20
**Reviewer:** Architecture Review Board (ARB)
**Material reviewed:** `27-sprint-02-executive-planning.md`, `28-sprint-02-domain-model.md`,
`29-sprint-02-authorization-rls-blueprint.md`, `30-sprint-02-edge-function-contract-plan.md`,
`31-sprint-02-validation-certification-plan.md` (full text, not summaries), verified
against `supabase/migrations/20260719170000_sprint01_foundation_identity.sql` and
`supabase/functions/`.

**No source code, migration, Edge Function or test was produced or executed by this
review. No commit was created. The repository is unmodified except for this document.**

---

## 1. Executive summary

The Sprint 2 planning package is of high quality. Its domain decomposition is correct,
its anti-duplication contract is explicit, its risk register is honest, and its
governance model correctly replicates the certified Sprint 1 chain. The ARB found **no
decision that must be reversed**. The conceptual architecture is sound for the long-term
SaaS trajectory (hundreds of associations, tens of thousands of residents, billing,
metering, tickets, collector and mobile modules).

However, the ARB found **seven blocking defects**, none of which are visible from the
planning documents alone — all seven surfaced only when the documents' claims were
verified against the certified Sprint 1 migration. Four of them make specified flows
**unimplementable or unreachable as written**, not merely sub-optimal:

1. The Edge Function contracts assume multi-statement transactional atomicity that the
   chosen runtime (Edge Function → PostgREST) cannot provide.
2. The flagship onboarding flow (invitation accept) is unreachable for a genuinely new
   user, because it requires a verified contact and no verification path exists.
3. An invitation that is lost or expires can never be reissued.
4. The staff-facing resident lists cannot return the profile fields their contracts
   promise, because the certified `profiles` association-read policy requires an active
   residence membership that pending, former and off-site-payer residents do not have.

Two further blocking items are governance-level: the plan grants `authenticated` direct
write access to tenant-owned structural tables, which **contradicts certified guarantee
#3** of its own baseline (doc 27 §2.2); and three Edge Function contracts enforce data
minimization in the function layer over rows that RLS makes fully readable, which
violates doc 29 §6's own stated rule ("the policy stays a necessary-but-not-sufficient
guard — never the reverse").

One factual error of the CF-05 class was found: both doc 28 §5 and doc 31 (PERF2-02)
describe `idx_residence_members_profile_active` and `idx_residence_members_property_active`
as **partial** indexes filtering `status = 'active'`. They are plain composite indexes on
`(profile_id, status)` and `(property_id, status)`. A performance gate premise and a
history-model argument both rest on this incorrect statement.

Finally, the ARB notes a **process concern**: the package defers roughly a dozen
substantive design decisions to wave execution time ("decided in Wave 2.3", "final
mechanism in Wave 2.5", "decision point recorded for Wave 2.4"). Several of those are
precisely the decisions an executive review exists to settle. They are enumerated in
§7 and must be closed **before** Wave 2.0, not during implementation.

**Verdict: EXECUTIVE REVIEW APPROVED WITH CONDITIONS.** Ten decisions are structurally
sound and may proceed once their conditions are met. D-11's *decision* (invitation-based
onboarding) is correct; its *contract specification* in doc 30 requires re-specification
and re-review before Wave 2.5.

---

## 2. Repository baseline (verified)

| Item | Value | Verification |
|---|---|---|
| Repository | `aistudio-hoa-connect-resident-app` | confirmed |
| Branch | `sprint-01-foundation-identity` | confirmed |
| HEAD at review | `1e6e4bb118fb3338f278f72a61dcdb5448dd3a3a` | confirmed |
| Certified baseline | `a58a1ed98b0e5299678a41be833729895b31f101` | confirmed |
| Certified tag | `hoa-connect-sprint-01-foundation-certified-v1.0.0` | confirmed |
| Planning commit | `1e6e4bb` — `docs(hoa): plan sprint 2 resident residence association domain` | confirmed |
| Working tree at review start | clean | confirmed |
| Migrations present | 1 (`20260719170000_sprint01_foundation_identity.sql`) | confirmed |
| Edge Functions present | 10 + `_shared/` | confirmed (directory listing) |

Sprint 1 remains certified and frozen. This review does not alter that state.

### 2.1 Baseline facts used as review evidence

Verified directly against the migration (line references are to the certified file):

- `tenant_permission` has exactly 9 values (L42–52). `residences:read` /
  `residences:write` exist; no resident, payer, household, invitation, association or
  audit permission exists.
- `has_tenant_permission()` (L304–333) is a hardcoded role→permission matrix.
  `residences:read` is held by admin, operator, support, finance, viewer.
- `residence_members` (L150–165) carries `UNIQUE (property_id, profile_id)`,
  a nullable `start_date`, a nullable `end_date`, **and a `revoked_at timestamptz`
  column**, plus `residence_members_period_valid` CHECK.
- `idx_residence_members_profile_active` (L214) and `idx_residence_members_property_active`
  (L215) are **plain composite B-tree indexes**, not partial indexes.
- `residence_members_select_tenant_policy` (L686) uses
  `has_tenant_permission(tenant_id, 'residences:read')` — i.e. any holder of
  `residences:read` reads **every** membership row in the tenant.
- `properties_select_policy` (L584) is `can_access_residence(id)`;
  `can_access_residence()` (L347–364) returns true for **any active tenant member**,
  regardless of permission.
- `profiles_select_association_policy` (L591–604) requires an **active
  `residence_members` row** for the target profile plus `profiles:read_association`.
- `current_profile_id()` (L232–243) filters `status = 'active'`, so disabled profiles
  fail closed. Confirmed.
- Grants to `authenticated` (L742–749): SELECT+UPDATE on `profiles`; full DML on
  `profile_contacts`; **SELECT only** on `tenants`, `properties`, `tenant_members`,
  `residence_members`; SELECT/INSERT/UPDATE on `profile_preferences`, `profile_devices`.
  No grant on `platform_role_assignments` or `audit_events`.
- `contact_type` = `email | phone | whatsapp` (L18). `verification_state` includes
  `unverified` (L21). **No contact-verification Edge Function exists** in
  `supabase/functions/`.

---

## 3. Review methodology

1. **Full-text reading** of docs 27–31. No summary, no abstract, no derived artifact was
   used as a substitute.
2. **Claim verification (CF-05 discipline applied to the planning package itself).**
   Every structural claim the documents make about the certified baseline — table
   definitions, enum values, index shapes, policy predicates, grants, helper semantics,
   Edge Function inventory — was grep-verified against the migration and function
   directory. This is where the majority of blocking findings originated.
3. **Contract executability analysis.** Each Edge Function contract in doc 30 was tested
   against the actual runtime capability of the certified `_shared/` layer
   (JWT + `authClient` + PostgREST), asking: *can this contract be honored at all?*
4. **Policy-versus-projection analysis.** For every contract that specifies a filtered
   or scoped response, the ARB asked whether RLS constrains the same data, or whether
   the projection is defeatable by direct PostgREST access with the same JWT.
5. **Long-horizon SaaS stress.** Each decision was evaluated at 10 / 100 / 500
   associations and 10,000+ residents, and against the declared future modules
   (billing, metering, notifications, tickets, inspections, collector, mobile).
6. **Cross-document consistency sweep.** Domain model ↔ authorization ↔ contracts ↔
   validation ↔ wave plan, looking for contradictions, duplicated concepts and
   unverifiable invariants.
7. **Finding classification.** CRITICAL (blocks Wave 2.0) / HIGH (blocks the owning
   wave) / MEDIUM (must be resolved before certification) / LOW / OBSERVATION.
   Findings are numbered `ARB-nn` and mapped to decisions in §6 and §7.

### 3.1 Decision-ID reconciliation (mandatory reading)

The review brief and doc 27 §13 use **different meanings for D-05 through D-11**. This
review is organized by the **brief's** taxonomy, with explicit mapping. Suppressing this
divergence would itself be a CF-05 violation.

| Brief decision | Topic (brief) | Corresponding planning decision(s) in doc 27 §13 |
|---|---|---|
| D-01 | Resident Model | D-01 (resident vs profile) |
| D-02 | Residence Model | D-02 (residence vs property) |
| D-03 | Household Model | D-03 (household membership) |
| D-04 | Responsible Payer | D-04 (payer model) |
| D-05 | Lifecycle (changes a certified object) | D-05 (history/constraint evolution) + D-07 (lifecycle enums) |
| D-06 | Association Extension | D-06 (association extension) |
| D-07 | Association Roles | D-07 (role vocabulary / `association_collector`) |
| D-08 | Authorization | doc 29 in full + D-08 (administrative overrides) |
| D-09 | Edge Functions | doc 30 in full |
| D-10 | Historical Integrity | D-05 + D-09 (audit retention) + D-10 (deletion vs deactivation) |
| D-11 | Invitation Model | D-11 (invitation onboarding) |

Three planning decisions have **no slot in the brief's list** and are reviewed in §6.12:
doc 27 D-08 (administrative overrides), D-09 (audit retention), D-10 (deletion vs
deactivation). They are approved; none is blocking.

> **ARB-24 (MEDIUM):** the two numbering schemes must be reconciled into one before any
> Sprint 2 report cites "D-05" again. Recommendation: retain the doc 27 numbering as
> canonical (it is older and already embedded in docs 28–31), and republish the brief's
> taxonomy as a review-only view. Any future document citing a bare `D-nn` without
> naming its source is non-compliant with CF-05.

---

## 4. Findings register

Blocking status is relative to the wave that owns the affected artifact.

| ID | Finding | Class | Decisions |
|---|---|---|---|
| ARB-01 | Write grants to `authenticated` on `properties` / `residence_members` contradict certified guarantee #3 (doc 27 §2.2) | CRITICAL | D-05, D-08, D-09 |
| ARB-02 | Multi-step atomicity (F-07, F-17, F-20, mutation+audit pairs) is unachievable via Edge Function → PostgREST | CRITICAL | D-09, D-10 |
| ARB-03 | Invitation accept requires a verified contact; Sprint 1 forces `unverified` and no verification path exists → new-user onboarding unreachable | CRITICAL | D-11 |
| ARB-04 | Lost/expired invitation can never be reissued (idempotent 200 returns no token; lazy expiry sweep has no reader) | CRITICAL | D-11 |
| ARB-05 | F-20 rate limiting depends on counting failed attempts in `audit_events`; no failure audit action exists and `authenticated` cannot read the table | CRITICAL | D-11 |
| ARB-06 | EF-layer projections over row-readable data (association settings, payer history, resident notes) are bypassable via direct PostgREST | CRITICAL | D-06, D-08 |
| ARB-07 | `profiles_select_association_policy` requires an active membership → profiles of pending / former / off-site-payer residents are invisible to staff; F-03/F-04/F-08 contracts unfulfillable | CRITICAL | D-01, D-08, D-09 |
| ARB-08 | D-05 partial unique on `status='active'` silently drops the certified duplicate guarantee for `pending` rows | HIGH | D-05 |
| ARB-09 | One-active-primary index is cross-tenant → cross-tenant collision and existence leak; contradicts doc 27 §5 | HIGH | D-05, D-08 |
| ARB-10 | Tenant coherence rests on denormalized `tenant_id` + EF checks; no composite FK makes cross-tenant linkage structurally impossible (R-13 is CRITICAL) | HIGH | D-01…D-04, D-11 |
| ARB-11 | No temporal-overlap constraint on payer/membership periods; `residence_members.start_date` nullable → history reconstruction not guaranteed | HIGH | D-04, D-10 |
| ARB-12 | Granting collector `residences:read` silently widens certified policy L686 (full tenant membership read) | HIGH | D-07, D-08 |
| ARB-13 | Doc 28 §12 declares itself the complete list of Sprint 1 changes and is not (missing `properties` grant/policy, `has_tenant_permission()` body, likely `profiles` policy) | HIGH | D-05, D-09 |
| ARB-14 | Factual error: `idx_residence_members_*` described as partial; they are plain composite. Invalidates a D-05 argument and the PERF2-02 premise | HIGH | D-05, D-10 |
| ARB-15 | `revoked_at` (certified) duplicates `end_date`/`end_reason` (proposed) on `residence_members` | MEDIUM | D-05, D-10 |
| ARB-16 | Invariant 5 ("no identity field outside `profiles`") contradicts `household_members.full_name`/`birth_date`; invariant 6 is not machine-checkable as claimed | MEDIUM | D-03, D-10 |
| ARB-17 | No promotion path from `household_members` to a platform user preserving history (minor reaching adulthood) | MEDIUM | D-03 |
| ARB-18 | Doc 29 §5 matrix "revoked ⇒ —" contradicts §6.6 self-history policy (`profile_id = current_profile_id()` unfiltered) | MEDIUM | D-08 |
| ARB-19 | `client_request_id` idempotency via audit lookup is unimplementable (no unique index, no read grant, no stored response) | MEDIUM | D-09 |
| ARB-20 | Create-idempotency returning 200 on natural-key collision masks operator error (F-10 unit reuse) | MEDIUM | D-09 |
| ARB-21 | `residence_payers.end_reason` free text vs membership enum; F-17 emits `'replaced'`, absent from the enum | MEDIUM | D-04, D-10 |
| ARB-22 | `registration_code` reuse after `former` breaks historical reconstruction of the code↔person mapping | MEDIUM | D-01, D-10 |
| ARB-23 | `audit_events` growth strategy (partitioning/retention) deferred indefinitely; it becomes the largest table at scale | MEDIUM | D-10 |
| ARB-24 | Decision-ID divergence between brief and doc 27 | MEDIUM | all |
| ARB-25 | ~12 substantive decisions deferred to wave execution time | MEDIUM | all |
| ARB-26 | GoTrue self-signup posture undefined; invitation does not gate account creation | MEDIUM | D-11 |
| ARB-27 | F-22 move-out request has no queryable state (audit-stream only) | MEDIUM | D-09 |
| ARB-28 | `household_members` hard DELETE conflicts with the historical-integrity principle | LOW | D-03, D-10 |
| ARB-29 | Minors' personal data (name, birth date) stored tenant-side with no retention or erasure path | LOW | D-03 |
| ARB-30 | `platform_support` granted zero access — correct, but leaves support tooling undefined | OBSERVATION | D-08 |

---

## 5. Architectural observations (cross-cutting)

### 5.1 The runtime cannot honor the contracts (ARB-02)

This is the single most consequential finding. Doc 30 repeatedly specifies transactional
semantics:

- F-07: deceased/former cascade "orchestrates F-14/F-18 closures **in one transaction**,
  each audited";
- F-17: replace flow "closes existing … and inserts new — **one transaction**, two audit
  events";
- F-20: hash → validate → create `residents` → create `residence_members` → mark
  accepted → audit;
- doc 31 §4 asserts a gate: "failure mid-cascade ⇒ **total rollback**, 500 envelope,
  zero partial rows".

The certified `_shared/auth.ts` layer builds a Supabase client over PostgREST. **Each
PostgREST call is its own transaction.** An Edge Function issuing five calls performs
five independent transactions; a failure on the fourth leaves three committed. The
specified gate would fail on first execution, and — worse — a partially-applied cascade
on a deceased resident is exactly the class of data corruption the historical-integrity
principle exists to prevent.

Every mutation that touches more than one row is affected. Note that this includes
**every** mutation in the package, because doc 30 §1 requires each one to emit an audit
event: `INSERT resident` + `log_audit_event()` is already two statements. Sprint 1
escaped this because its mutations were single-row profile/contact operations where a
lost audit row was a tolerable (and audited-as-such) edge case; Sprint 2's domain
operations are not.

**Required resolution:** all Sprint 2 mutations move into `plpgsql` functions declared
**`SECURITY INVOKER`** (not DEFINER), called by the Edge Function via a single RPC. A
`SECURITY INVOKER` function executes in one transaction and **still enforces RLS as the
calling user**, so this preserves the RLS-first guarantee exactly while making atomicity
real. The Edge Function retains its role: JWT validation, input validation, envelope,
error mapping, rate limiting. It stops being an orchestrator of independent writes.

This resolution also resolves ARB-01 (see below) and materially simplifies ARB-19.

### 5.2 The grant posture contradicts the certified guarantee (ARB-01)

Doc 27 §2.2 lists, as certified guarantee #3, a commitment Sprint 2 must not weaken:

> "`authenticated` never receives direct write access to tenant-owned structural tables."

Verified: today `authenticated` holds SELECT only on `tenants`, `properties`,
`tenant_members`, `residence_members`.

Yet doc 30 F-10 states that Wave 2.4 "must add grant + INSERT policy" on `properties`;
F-11 requires UPDATE on `properties` (never mentioned anywhere); doc 29 §6.6 specifies
INSERT and UPDATE policies on `residence_members`, which are inert without accompanying
grants. Doc 29 §6 further generalizes the posture: "Grants … SELECT, INSERT, UPDATE to
`authenticated`" for every new table.

So the package simultaneously promises not to weaken guarantee #3 and plans to weaken it
on two certified tables plus five new ones. This is not a drafting slip — it follows
from the decision to write through PostgREST. It must be resolved deliberately, at
executive level, not discovered by an auditor in Wave 2.7.

**Two coherent options:**

- **(A) RPC-mediated writes (recommended).** With §5.1's `SECURITY INVOKER` RPCs, no
  table write grant is needed at all: `EXECUTE` on the RPC is the grant, and RLS still
  applies to the statements inside it. Guarantee #3 survives **strengthened** — Sprint 2
  would extend the certified posture to its own new tables rather than eroding it.
- **(B) Amend the guarantee.** Explicitly restate guarantee #3 as "write access only
  where a policy pins the row to the caller or to a tenant permission", obtain executive
  sign-off, and record it as an intentional evolution of the certified posture in the
  Sprint 2 certification.

The ARB recommends **(A)**. It is the only option that keeps the Sprint 1 certification
narrative intact, and it is a prerequisite for §5.1 anyway.

### 5.3 Data minimization enforced in the wrong layer (ARB-06)

Doc 29 §6 states the correct rule and then breaks it three times:

> "Where a WITH CHECK cannot fully express the rule … the Edge Function performs the
> check and the policy stays a necessary-but-not-sufficient guard — **never the
> reverse**."

Three contracts are the reverse:

| Contract | Promise | RLS reality |
|---|---|---|
| F-01 `association-details-get` | `settings` filtered to a public allow-list; "internal keys withheld" | doc 29 §6.1 grants row SELECT to every active member/resident → any resident reads the entire `settings` jsonb directly via PostgREST |
| F-09 `residence-get` (household view) | "**active** payer name only (no payer history)" | doc 29 §6.4 grants active household members SELECT on `residence_payers` of the property → full payer history readable directly |
| doc 29 §6.2 `residents` SELECT | co-household members see a "scoped projection" | RLS is row-level: co-members read the whole row, including staff-internal `notes` and `status_reason` |

The third is the most serious. `residents.notes` is specified as "association notes" and
`status_reason` records why someone was blocked, marked deceased or declared former.
Exposing those to everyone sharing a unit is a privacy defect with LGPD implications,
and it will not be caught by any gate in doc 31, because the gates test *access to the
row*, which is intended.

**Required resolution (choose per table, all three are legitimate):**
1. Split the sensitive columns into a staff-only sibling table (`resident_staff_notes`,
   `association_settings_private`) — cleanest, fully RLS-enforced;
2. Expose the non-sensitive projection through a `SECURITY DEFINER` view or RPC and
   remove the broad row grant;
3. Use column-level grants — but note the package already plans its first production use
   of column privileges for `token_hash` (doc 29 §6.5); using an unproven-in-production
   mechanism for three more surfaces at once concentrates risk.

The ARB recommends (1) for `residents.notes`/`status_reason`, (2) for the payer history
projection, and (1) for private association settings.

### 5.4 The profile visibility gap (ARB-07)

`profiles_select_association_policy` (verified, L591–604) grants staff read on a profile
**only if that profile has an active `residence_members` row** in a property of a tenant
where the staff member holds `profiles:read_association`.

Sprint 2 creates four populations of residents who do not satisfy that predicate:

- residents in `status = 'pending'` — created by F-05 *before* any membership exists
  (F-12 explicitly refuses to auto-create residents, so the resident row necessarily
  precedes the membership);
- residents in `former` / `deceased` — memberships closed, so `status='revoked'`;
- **off-site owner payers** — the flagship R-04 scenario, a payer who deliberately has
  no occupancy;
- residents whose only membership is still `pending` approval.

For all four, `F-03 resident-list` and `F-04 resident-get` cannot return the
`profile: {id, full_name, preferred_name}` block their contracts specify — the join
yields nothing. An association admin would see a resident list where the newly
registered residents have no names. Doc 30 F-03 asserts the opposite ("profile fields
flow through the certified `profiles_select_association_policy` chain"); that assertion
is incorrect.

**Required resolution:** extend the association-read path to recognize the `residents`
table as an association relationship — i.e. a profile is readable by tenant staff if it
has an active membership **or** a `residents` row in that tenant (any status). This is a
change to a certified policy and therefore must be added to doc 28 §12 (see ARB-13),
gated by a Sprint 1 regression proof, and reviewed as carefully as D-05. It is
unavoidable: without it, the resident domain has no usable staff UI.

### 5.5 Tenant coherence is procedural, not structural (ARB-10)

R-13 (cross-tenant property association) is classified CRITICAL, and the stated
mitigation is "all writes resolve tenant from the target entity server-side; composite
checks; forged-tenant EF tests". Every new table carries a denormalized `tenant_id` with
an independent FK to `tenants`, exactly as certified `residence_members` does. Nothing
in the schema prevents a row whose `tenant_id` is A and whose `property_id` belongs to
tenant B. The guarantee rests entirely on Edge Function correctness and test coverage.

For a CRITICAL risk in a multi-tenant SaaS, that is weaker than necessary. PostgreSQL
can make it structural at near-zero cost:

```
-- on each tenant-owned parent
ALTER TABLE properties ADD UNIQUE (id, tenant_id);
ALTER TABLE residents  ADD UNIQUE (id, tenant_id);

-- on each new child
FOREIGN KEY (property_id, tenant_id) REFERENCES properties (id, tenant_id)
```

With composite FKs, a cross-tenant link is rejected by the database regardless of Edge
Function behavior, RLS correctness, or future direct-SQL access. The ARB regards this as
the highest value-per-effort change in the entire package: it converts the plan's single
CRITICAL structural risk into an impossibility, and it retroactively hardens
`residence_members` as well.

**Required for all new tables. Recommended (additive, non-breaking) for
`residence_members`.**

### 5.6 Period integrity is under-specified (ARB-11, ARB-21, ARB-14, ARB-15)

The historical-integrity principle is the strongest idea in the package, but its
implementation is thinner than its ambition:

- **No overlap constraint.** `UNIQUE (property_id) WHERE status='active'` prevents two
  *currently* active payers. It does not prevent two *closed* payer rows whose
  `[start_date, end_date]` ranges overlap. The question "who was responsible for unit
  X on 2027-03-15?" — the exact question water billing across an occupant change must
  answer — can return two rows. The same applies to memberships. Resolution:
  `EXCLUDE USING gist (property_id WITH =, daterange(start_date, end_date, '[)') WITH &&)`
  (requires `btree_gist`), or an equivalent asserted gate.
- **Nullable `start_date`.** Certified `residence_members.start_date` is nullable and
  cannot be made NOT NULL without touching existing rows. A membership with no start
  date has no reconstructable period. Sprint 2 EFs must always set it, and a gate must
  assert that all Sprint-2-created rows carry one.
- **Duplicated closure vocabulary (ARB-15).** `residence_members` already has a
  certified `revoked_at timestamptz`. D-05 adds `end_date` + `end_reason`. Three columns
  now describe closure, two of them redundantly, with no stated rule about which is
  authoritative. Decide now: either `revoked_at` becomes the audit timestamp and
  `end_date` the business-effective date (defensible, must be documented), or
  `revoked_at` is declared deprecated-on-arrival.
- **Inconsistent reason typing (ARB-21).** Memberships get an enum; payers get free text
  "enum candidate deferred", and F-17 immediately writes the literal `'replaced'` —
  a value absent from the membership enum. Two closure vocabularies will diverge within
  one sprint. Use one enum, and add `replaced` to it.
- **Factual error (ARB-14).** Doc 28 §5 argues that re-occupancy is safe because "the
  certified partial indexes … already filter `status = 'active'` and keep working
  unchanged", and PERF2-02 asserts the occupancy projection "uses certified partial
  active membership indexes". Verified: L214–215 create **plain composite** indexes on
  `(profile_id, status)` and `(property_id, status)`. The D-05 conclusion survives (a
  composite index on `(x, status)` still serves `status='active'` lookups), but the
  stated reasoning is wrong, and the PERF2-02 gate is written against an index shape
  that does not exist. Correct the documents; consider actually creating the partial
  indexes, which at 25,000 membership rows with 30% closed history is a measurable win.

### 5.7 Deferred decisions (ARB-25)

The package defers to wave execution: the `end_reason` CHECK expression (28 §5); the
occupancy view mechanism (28 §4); resident re-entry / D-01a (28 §8.1); the closed-row
immutability trigger (28 §6.6); the payer-resident invariant enforcement mechanism
(28 §6.4); the household staff-read predicate (29 §6.3); the move-out request mechanism
(29 §6.2, 30 F-22); the idempotency mechanism (30 §1); the primary-demotion behavior
(30 F-12); the double-delete semantics (30 F-16); the rate-limit mechanism (30 F-20);
and the fixture UUID block (31 §2).

Several are genuinely wave-appropriate (CHECK syntax, UUID prefix). But **D-01a
(resident re-entry), the idempotency mechanism, the rate-limit mechanism, the household
read predicate and the payer-invariant enforcement are architectural**, and each is
listed in this review as a required change. An executive review that leaves them open
has not discharged its function.

---

## 6. Decision-by-decision analysis

### 6.1 D-01 — Resident Model

**Status: APPROVED WITH CONDITIONS**

**Summary.** A tenant-scoped `residents` table projects a platform `profile` into an
association, holding only association-specific data (registration code, lifecycle
status, approval metadata, notes) with `UNIQUE (tenant_id, profile_id)`. Alternatives
considered by the plan: resident-as-membership-only (B), resident-as-tenant_member (C).

**Strengths.** The decision is correct and well argued. It preserves the certified
identity boundary (zero identity columns — invariant declared and testable by grep). It
gives association-scoped data a tenant-owned home, which is a precondition for RLS
isolation at 500 associations. It makes multi-association residency natural (one row per
association) rather than an exception. It correctly refuses (C), which would have
collapsed the certified staff/resident separation. Billing, tickets and communication
targeting `residents.id` rather than `profiles.id` is the right long-term anchor,
because it keeps tenant scoping in the FK itself.

**Weaknesses.**
- The staff read path does not work (ARB-07): pending, former and off-site-payer
  residents have no readable profile, so the resident record exists without a name.
- `notes` and `status_reason` are staff-internal but co-household-readable (ARB-06).
- Re-entry is unresolved (`former → active` prohibited, `UNIQUE (tenant_id, profile_id)`
  blocks a second row, recommendation deferred to Wave 2.2 as "D-01a").
- `registration_code` may be reused after a resident leaves, destroying the historical
  code↔person mapping (ARB-22) — a real problem for financial history in Brazilian HOA
  practice, where the matrícula appears on historical boletos.

**Risks.** R-01 (duplication) is well mitigated. The residual risks are ARB-07
(delivery-blocking), ARB-06 (privacy) and ARB-22 (financial traceability).

**Alternatives considered by the ARB.** A period-based `residents` model (rows per
association-membership period, mirroring D-05) was considered and **rejected**: a
resident registry is a registry, not an occupancy; periods belong on memberships. The
single-row model with an audited status history is correct.

**Final recommendation.** Approve the model. Fix the read path, split the staff-only
columns, and settle re-entry now.

**Required changes before implementation.**
1. **(ARB-07, CRITICAL)** Extend the association profile-read path to include profiles
   with a `residents` row in the tenant (any status). Add to doc 28 §12; regression-gate
   it as a certified-object change.
2. **(ARB-06, CRITICAL)** Move `notes` and `status_reason` out of the co-household
   readable surface (staff-only sibling table recommended).
3. **(ARB-22, MEDIUM)** Make `registration_code` non-reusable within a tenant (drop the
   `WHERE registration_code IS NOT NULL` reuse window, or retain historical codes in an
   append-only mapping).
4. **(ARB-25, MEDIUM)** Settle D-01a **now**. ARB recommendation: allow
   `former → pending` re-entry on the same row, with every transition audited. Do not
   defer to Wave 2.2.
5. **(ARB-10, HIGH)** Add `UNIQUE (id, tenant_id)` to `residents` to support composite
   FKs from `residence_payers` and future billing tables.

---

### 6.2 D-02 — Residence Model

**Status: APPROVED**

**Summary.** The residence *is* `properties`. No new table. Occupancy is derived from
active `residence_members`; household is memberships + `household_members`; vacancy is
the absence of active occupancy.

**Strengths.** This is the strongest decision in the package. It avoids forking the
tenant boundary and every certified policy — a parallel `residences` table would have
required duplicating `can_access_residence()`, `properties_select_policy` and the entire
Sprint 1 RLS surface, with permanent drift risk. Deriving occupancy rather than storing
it eliminates an entire class of status-drift bugs (R-10) at the cost of a join that the
existing indexes serve. Anchoring future meters to `properties.id` is correct and keeps
1:N and shared-meter topologies open, which matters because shared water meters across
units are common in Brazilian HOAs and a stored 1:1 assumption would have been expensive
to unwind.

**Weaknesses.**
- Derived occupancy costs a per-row correlated lookup on the residence list. At 2,000+
  properties with a `?occupancy=vacant` filter, this needs verification, not assumption
  (PERF2-02 covers it, but against a mischaracterized index — ARB-14).
- `properties_select_policy` = `can_access_residence(id)` admits **any active tenant
  member** regardless of permission. This is certified Sprint 1 behavior, not a Sprint 2
  regression, but Sprint 2 adds the collector to the population it admits (ARB-12,
  handled under D-07).
- Writes to `properties` require new grants/policies (ARB-01, ARB-13) not disclosed in
  doc 28 §12.

**Risks.** R-03 (owner ≠ occupant) is correctly mitigated by explicit vocabulary. R-14
(meter linkage) is correctly pre-empted. No new structural risk.

**Alternatives considered.** (B) a `residences` table over `properties` and (C) an
`occupancies` entity were both correctly rejected. The ARB agrees: (B) duplicates the
tenant boundary, (C) is what `residence_members` already is.

**Final recommendation.** Approve as specified.

**Required changes before implementation.**
1. **(ARB-13, HIGH)** Disclose the `properties` INSERT/UPDATE grant+policy in doc 28 §12
   as a Sprint 1 certified-object change (or eliminate it via §5.2 option A).
2. **(ARB-14, HIGH)** Correct the index characterization and re-derive the PERF2-02
   premise; consider creating true partial indexes.

---

### 6.3 D-03 — Household Model

**Status: APPROVED WITH CONDITIONS**

**Summary.** Platform users live in `residence_members`; persons without login live in a
new `household_members` table (tenant-owned, property-linked, with a
`responsible_profile_id`). Legal representative = the responsible profile. Duplicate
prevention is application-side plus audit review.

**Strengths.** Correctly refuses (B) nullable `profiles.user_id`, which would have
destroyed the certified 1:1 identity model and the `NOT NULL REFERENCES auth.users`
constraint — a decision that would have contaminated every authorization helper. Also
correctly refuses (C) jsonb dependent lists, which are unqueryable and unauditable.
Modeling the legal representative as the responsible profile rather than as a new role
is elegant and sufficient for Sprint 2.

**Weaknesses.**
- **Invariant contradiction (ARB-16).** Doc 28 §9 invariant 5 states "No identity field
  stored outside `profiles`/`profile_contacts`", while §6.3 stores `full_name` and
  `birth_date` in `household_members`. Both cannot be true. The invariant means
  "no identity field *of a platform user*"; as written it is false and a grep-based gate
  for it (promised in doc 31 §8 via doc 27 R-01) would fail or be quietly weakened.
- **Invariant 6 is not machine-checkable (ARB-16).** "No `household_members` row
  duplicates an active user membership" is listed under "machine-checkable invariants",
  but `household_members` has no `profile_id`, so no SQL predicate can evaluate it. Doc
  31 §9 concedes the check is heuristic (name + birth date). The invariant should not be
  listed as machine-checkable.
- **No promotion path (ARB-17).** A minor who reaches adulthood, or a dependent who
  obtains a login, must become a `residence_members` row. Nothing in the package
  specifies how, and the household row's history (start date, relationship) has no
  destination. This is a certainty, not an edge case, over a multi-year SaaS lifetime.
- **Hard DELETE (ARB-28)** conflicts with the historical-integrity principle applied
  everywhere else. Doc 28 §6.3 even notes the pre-approval justification does not apply
  ("Sprint 2 has no approval flow for household members"), then allows deletion anyway.
- **Minors' data (ARB-29):** names and birth dates of children stored tenant-side, with
  no retention policy and no erasure path (LGPD erasure remains platform-admin future
  work per ADR-10). Acceptable for Sprint 2, but must be disclosed.

**Risks.** R-01 overlap is the main one and is only partially mitigated. Duplicate
household persons across re-registrations will accumulate at scale with no constraint to
stop them.

**Alternatives considered by the ARB.** Adding a nullable `linked_profile_id` to
`household_members` was considered and is **recommended**: it makes invariant 6 truly
machine-checkable (`NOT EXISTS (active residence_members for the same
property+linked_profile_id)`), and it provides the promotion path — on promotion, set
`linked_profile_id`, close the household row with a status, and open the membership,
preserving both histories.

**Final recommendation.** Approve the two-table split. Add the linkage column, restate
the invariants truthfully, and define promotion.

**Required changes before implementation.**
1. **(ARB-16, MEDIUM)** Restate invariant 5 as "no identity field **of a platform user**
   outside `profiles`/`profile_contacts`". Remove invariant 6 from the machine-checkable
   list, or make it checkable via (2).
2. **(ARB-17/ARB-16, MEDIUM)** Add `linked_profile_id uuid NULL REFERENCES profiles`;
   specify the household→user promotion procedure and its audit action.
3. **(ARB-28, LOW)** Replace hard DELETE with a terminal status, or restrict DELETE to
   rows created within a short window by the same actor. Preserve the audit snapshot
   either way.
4. **(ARB-10, HIGH)** Composite FK `(property_id, tenant_id) → properties (id, tenant_id)`.
5. **(ARB-29, LOW)** Disclose the minors' data posture and retention gap explicitly in
   the Sprint 2 certification.

---

### 6.4 D-04 — Responsible Payer

**Status: APPROVED WITH CONDITIONS**

**Summary.** A separate `residence_payers` table with period history, one active payer
per property (partial unique), independent of occupancy and ownership. Explicitly
relaxable to N active rows with shares for future split payment.

**Strengths.** The decision is right and the reasoning is right. Rejecting (B) an
`is_payer` flag on membership is essential — the off-site owner who pays but does not
occupy is the normal case in Brazilian HOAs, not an exception, and a flag on occupancy
makes that person inexpressible. Rejecting (C) a column on `properties` correctly
preserves history. The stated relaxation path to split payment (drop the partial unique,
add shares) is genuinely non-breaking, which is a strong forward-compatibility property.
Preserving responsibility history across occupant change is exactly what water billing
across a move-out requires.

**Weaknesses.**
- **No temporal overlap constraint (ARB-11).** The uniqueness guarantee covers only
  currently-active rows. Historical reconstruction — the decision's entire purpose — is
  not guaranteed.
- **Cross-table invariant enforced procedurally.** "Payer must be a resident of the same
  tenant" is specified as an Edge Function check, with a DB trigger "evaluated in Wave
  2.3; if too costly, EF-only with a periodic integrity test". A periodic test detects
  violations; it does not prevent them. With composite FKs (ARB-10), tenant coherence
  becomes structural, and only the resident-existence half needs a trigger.
- **Free-text `end_reason` (ARB-21)** diverging from the membership enum in the same
  sprint.
- **Billing readiness is partial.** The payer *identity* anchor is correct. Two billing
  inputs remain unmodeled and unmentioned: the unit's participation quota (fração ideal /
  rateio weight) and, for metered billing, the meter↔period alignment. Both are Sprint 3
  concerns, but the quota belongs to the *unit*, and `properties.metadata` jsonb is the
  only home available — worth stating explicitly so Sprint 3 does not discover it late.

**Risks.** R-04 (payer≠occupant) well mitigated. R-12 (duplicate active) mitigated for
active rows only. Financial integrity over history is the open exposure.

**Alternatives considered by the ARB.** Modeling responsibility as a period-typed
attribute of `residents` rather than of the property was considered and **rejected**:
responsibility attaches to the unit, and a unit's payer changes independently of any
resident's association status.

**Final recommendation.** Approve. Close the temporal integrity gap before billing
depends on it — retrofitting an exclusion constraint over dirty historical data is far
more expensive than declaring it now.

**Required changes before implementation.**
1. **(ARB-11, HIGH)** Add a period-overlap exclusion constraint per property (btree_gist
   over `daterange(start_date, end_date, '[)')`), or an equivalent asserted invariant
   with a blocking gate.
2. **(ARB-21, MEDIUM)** Type `end_reason` as the shared closure enum; add `replaced`.
3. **(ARB-10, HIGH)** Composite FKs to `properties (id, tenant_id)` and
   `residents (id, tenant_id)` — the latter also enforces the payer-is-resident
   invariant structurally, replacing the deferred trigger question entirely.
4. **(MEDIUM)** Document where the participation quota will live (recommendation:
   typed column on `properties` in Sprint 3, not jsonb).

---

### 6.5 D-05 — Lifecycle (change to a certified Sprint 1 object)

**Status: APPROVED WITH CONDITIONS** — *special scrutiny applied as directed*

**Summary.** The only Sprint 1 schema alteration proposed: drop
`UNIQUE (property_id, profile_id)` on `residence_members`, replace with a partial unique
`WHERE status = 'active'`, add `end_reason`, and add a one-active-primary-per-profile
partial unique. Plus additive enum creation and `tenant_role`/`tenant_permission`
extensions.

**Migration safety.** The mechanics are sound. `ALTER TYPE … ADD VALUE` is additive and
non-breaking. Dropping a unique constraint never fails. Creating the replacement partial
unique **can** fail if duplicate active pairs exist — but they cannot, because the old
constraint forbade all duplicates. The migration is therefore safe on the certified
baseline by construction. Adding a nullable column is safe. Good.

**Regression risk.** Genuinely low, and the reasoning is correct: the certified policies
filter `status = 'active'` via helpers and are unaffected by uniqueness. The certified
indexes continue to serve. The claimed "Sprint 1 regression must pass unchanged" is
achievable. The mandated migration test (zero duplicate active pairs) is appropriate.

**Rollback.** Adequate for the current state: no production environment exists, so
`supabase db reset` to baseline is a complete rollback. **This will not be true again.**
Once a hosted environment exists, dropping a unique constraint is trivially reversible
only while no duplicate rows have been created; after the first legitimate re-occupancy
row, reverting to the original constraint is impossible without data loss. The plan
should state this: **D-05 is the last moment at which this change is free.**

**Certification impact.** The plan's "baseline immutability proof" is the right
instrument, but as scoped it is insufficient (ARB-13): doc 28 §12 declares itself the
complete list of Sprint 1 changes and omits the `properties` grant/policy (disclosed
only in doc 30 F-10 as an "amendment"), the `properties` UPDATE grant implied by F-11,
and — after ARB-07's resolution — a `profiles` policy change. A structural diff run
against an incomplete approved-set list will flag legitimate changes as blockers, or
worse, the list will be edited during Wave 2.7 to match what was built, which would
hollow out the entire proof.

**Additive evolution and future compatibility.** Good. The period-row model is the right
long-term choice, and it is the enabler for consumption billing across occupant changes.

**Weaknesses.**
- **ARB-08 (HIGH) — silent weakening.** `WHERE status = 'active'` leaves `pending` rows
  entirely unconstrained. Today, `UNIQUE (property_id, profile_id)` prevents two pending
  invitations/assignments for the same person and unit; after D-05, staff (or a retried
  Edge Function call, or two concurrent operators) can create unlimited duplicate
  pending memberships. R-19 claims the guarantee is "preserved for all active rows",
  which is true and incomplete. The fix is trivial:
  `UNIQUE (property_id, profile_id) WHERE status IN ('active','pending')`. This
  preserves the certified guarantee for every non-closed row and still permits
  re-occupancy history. The ARB regards the current form as an unnecessary regression.
- **ARB-09 (HIGH) — a cross-tenant constraint.** `UNIQUE (profile_id) WHERE status =
  'active' AND is_primary` is **global across tenants**. A person who is primary
  resident in association A and is then registered in association B will cause B's admin
  to hit a unique violation caused by a row in a tenant they cannot see. That is (a) a
  functional failure in the multi-association scenario the package explicitly promises
  to support, (b) a cross-tenant information leak if the constraint error surfaces, and
  (c) a direct contradiction of doc 27 §5 ("cross-tenant references are structurally
  impossible"). This is the only cross-tenant constraint in the design.
  Options: scope it to `(tenant_id, profile_id)`; or treat "primary" as
  platform-level and move it to `profiles`; or derive it. ARB recommends
  **`UNIQUE (tenant_id, profile_id) WHERE status='active' AND is_primary`** — primary
  residence is meaningful per association.
- **ARB-14 (HIGH)** — the argument rests on a false index characterization (§5.6).
- **ARB-15 (MEDIUM)** — `revoked_at` vs `end_date`/`end_reason` triple vocabulary.
- **ARB-01 (CRITICAL)** — the accompanying INSERT/UPDATE grants on `residence_members`
  are the guarantee-#3 breach.

**Alternatives considered.** (B) a separate append-only periods table was rejected for
read-path complexity on the hottest authorization table — the ARB **agrees**, and notes
the rejection is more strongly justified than the document states: `residence_members`
is read by `is_active_residence_member()` and `can_access_residence()`, which are
invoked per row by certified policies. Splitting it would have degraded every RLS
evaluation platform-wide. (C) overwrite-plus-audit was correctly rejected.

**Final recommendation.** Approve the change, with the pending-row gap closed and the
primary constraint scoped. The ARB explicitly endorses the alteration of the certified
object: it is small, provably safe on the current data, correctly reasoned, and the
alternative (living with `UNIQUE (property_id, profile_id)` forever) would make
re-occupancy permanently inexpressible — a far larger long-term debt.

**Required changes before implementation.**
1. **(ARB-08, HIGH)** Partial unique becomes `WHERE status IN ('active','pending')`.
2. **(ARB-09, HIGH)** Scope the primary-residence unique to `(tenant_id, profile_id)`.
3. **(ARB-13, HIGH)** Republish doc 28 §12 as a genuinely complete list; the baseline
   immutability proof's approved set is derived from it and **frozen before Wave 2.1**.
   Any later addition to the list requires a new executive authorization, not a doc edit.
4. **(ARB-14, HIGH)** Correct the index claims in docs 28 and 31.
5. **(ARB-15, MEDIUM)** Declare the authoritative closure column set and the status of
   `revoked_at`.
6. **(ARB-01, CRITICAL)** Resolve the grant posture per §5.2 (RPC-mediated writes
   recommended).
7. **(MEDIUM)** Record in the Wave 2.3 report that D-05 is irreversible once
   re-occupancy rows exist in any persistent environment.

---

### 6.6 D-06 — Association Extension

**Status: APPROVED WITH CONDITIONS**

**Summary.** A 1:1 `association_details` table extending `tenants` with legal/registration
data, address, official contacts, `settings` jsonb and `enabled_modules`.

**Strengths.** Keeping `tenants` small is the correct SaaS instinct: it is referenced by
every certified policy, and widening it would have touched the hottest shared object in
the schema. Typed columns for registration data enable constraints that jsonb cannot.
`enabled_modules` is the right place for per-association module gating and will serve
billing, metering and premium modules without further schema change — a genuine
forward-compatibility win. Strict 1:1 with `ON DELETE CASCADE` is clean.

**Weaknesses.**
- **ARB-06 (CRITICAL)** — `settings` is row-readable by every member/resident while F-01
  promises an allow-list projection. Association operational policy is not catastrophic
  to leak, but the pattern is wrong and this is the easiest of the three instances to
  fix.
- `registration_number` (CNPJ) is unique *per tenant* only, with national uniqueness
  "deferred (platform decision)". `UNIQUE (tenant_id, registration_number)` is nearly
  vacuous on a 1:1 table — it permits exactly one row per tenant anyway. At 500
  associations, two tenants sharing a CNPJ means duplicate onboarding of the same legal
  entity, which is a billing and legal problem. The ARB recommends a global partial
  unique on `registration_number` now; it costs one index and is far cheaper than
  de-duplicating later.
- `settings` and `enabled_modules` as untyped jsonb with no schema validation. F-02
  promises 422 on "bad enum module name", implying a server-side allow-list that is not
  specified anywhere. Specify the permitted module keys and settings keys, or the
  validation is unimplementable.
- No lifecycle is stated ("row lives and dies with the tenant"), yet doc 29 §6.1 grants
  INSERT to admins. Who creates the row, and when? If it is seeded at tenant creation,
  no INSERT policy is needed and the grant should be dropped (least privilege). If
  admins create it, a tenant can have zero rows and F-01 must define that response.

**Risks.** LOW as classified, once ARB-06 is resolved.

**Alternatives considered.** (B) widening `tenants` and (C) jsonb metadata were correctly
rejected.

**Final recommendation.** Approve.

**Required changes before implementation.**
1. **(ARB-06, CRITICAL)** Separate private settings from the member-readable projection
   (sibling table recommended), or remove the broad row grant and serve F-01 from a
   definer view.
2. **(MEDIUM)** Global partial unique on `registration_number`.
3. **(MEDIUM)** Specify the allow-listed `settings` keys and `enabled_modules` values;
   without it F-02's 422 is undefined.
4. **(LOW)** Define row creation (seed at tenant creation recommended; drop the INSERT
   grant if so) and F-01's behavior when the row is absent.

---

### 6.7 D-07 — Association Roles

**Status: APPROVED WITH CONDITIONS**

**Summary.** Add `association_collector` to `tenant_role`; add 11 `tenant_permission`
values; extend the `has_tenant_permission()` matrix; keep enums rather than text+CHECK.

**Strengths.** Enum consistency with Sprint 1 is right, and `ALTER TYPE … ADD VALUE` is
genuinely additive. Refusing to reuse `profile_status` for association-scoped lifecycle
is a correct and important distinction — a deceased association resident is not a
disabled platform user, and conflating them would have coupled tenant operations to
platform identity state permanently. The permission taxonomy is coherent, reasonably
granular, and the role×permission matrix in doc 29 §3 is explicit and testable. Granting
finance and support **no writes** in Sprint 2 is appropriately conservative.

**Weaknesses.**
- **ARB-12 (HIGH) — collector inherits too much.** Doc 29 §3 grants the collector the
  **existing** `residences:read` permission, and states this is "the only change to an
  existing permission's role set". Verified consequence: certified policy L686
  (`residence_members_select_tenant_policy`) admits any holder of `residences:read`.
  The collector therefore gains read access to **every membership row in the tenant** —
  profile IDs, roles, periods, primary flags — for all 2,000 units. Doc 29 §4 states the
  collector boundary is "read-only on `properties` + active occupancy projection … no
  resident personal data". Those two statements are incompatible. Doc 30 F-08 compounds
  the error: "since collector lacks `residents:read` the join yields nothing — assert in
  test". The join against `residents` yields nothing; the join against
  `residence_members` yields everything. A test asserting "zero PII keys" in the F-08
  *response* would pass while the collector reads the same data directly via PostgREST.
  Additionally, `can_access_residence()` already admits any active tenant member, so the
  collector reads all properties regardless of permission.
  **Resolution:** introduce a distinct permission (e.g. `residences:read_routes`) that
  grants property-level reads only, and do not add the collector to `residences:read`.
  This keeps every certified policy's audience unchanged — which is also what makes the
  baseline immutability proof meaningful.
- **Role taxonomy is at its practical limit.** Six tenant roles with a hardcoded
  20-value permission matrix inside a SECURITY DEFINER function is workable today and
  will not scale to the declared module roadmap (billing, metering, tickets,
  inspections, mobile collector each want 2–4 permissions). At ~40 permissions the
  hardcoded `OR` chain becomes a maintenance and review liability, and every addition
  edits a certified function body. This is not a Sprint 2 blocker — the ARB explicitly
  does **not** recommend introducing a `role_permissions` table now, because doing so
  would replace a certified, gate-covered mechanism mid-sprint. It should be a planned
  Sprint 3/4 refactor with its own review.
- **Naming.** `association_collector` was flagged by the plan itself for approval. It is
  consistent with the existing `association_*` prefix and reads correctly in Portuguese
  context (*leiturista*/*cobrador* — note these are different jobs). If the role is
  intended for **meter reading**, `association_collector` is misleading and
  `association_meter_reader` is clearer; if it is intended for **payment collection**,
  the name is right. The ARB cannot resolve this from the documents and requires a
  product answer.

**Risks.** R-18 is correctly LOW for the mechanism. ARB-12 is the real risk and is a
privilege-boundary issue, not an enum issue.

**Final recommendation.** Approve the vocabulary and the enum mechanism. Do not grant
the collector an existing permission.

**Required changes before implementation.**
1. **(ARB-12, HIGH)** New narrow permission for collector property reads; remove the
   collector from `residences:read`. Add a gate asserting the collector reads **zero**
   `residence_members` rows.
2. **(MEDIUM)** Confirm the collector's actual job (meter reading vs payment collection)
   and name the role accordingly. Renaming an enum value later is materially harder than
   naming it correctly now.
3. **(MEDIUM)** Record the permission-matrix scalability limit as an accepted debt with
   a named future review (Sprint 3/4).
4. **(LOW)** State explicitly that `has_tenant_permission()` body modification is a
   certified-object change (doc 28 §12 lists it; the immutability proof must expect it).

---

### 6.8 D-08 — Authorization

**Status: APPROVED WITH CONDITIONS**

**Summary.** RLS-first, extended from the certified model: new SECURITY DEFINER STABLE
helpers with `SET search_path = ''`; per-table policies; a 13-actor × 9-surface matrix;
explicit fail-closed checklist; service role restricted to a single sanctioned path.

**Strengths.** The model is the most rigorous part of the package. The actor list is
genuinely complete — including the two that reviews usually omit, *revoked* and
*disabled*, with correct semantics verified against `current_profile_id()`'s
`status='active'` filter. The fail-closed checklist (§7) is excellent and directly
testable. Reusing certified helpers rather than writing parallel ones is the right
recursion mitigation (R-06). Requiring new helpers to be predicates rather than data
sources ("helpers are predicates, not data sources") is exactly the right rule for
avoiding SECURITY DEFINER escalation (R-07), and it is stated crisply enough to audit.
Restricting the service role to one path with an explicit "any other use is a
certification blocker" (R-09) is strong governance. Denying `platform_support` all
tenant access is correctly conservative. Routing association audit reads through a
definer RPC while leaving `audit_events`' platform-admin-only policy untouched is
elegant — it adds a capability without adding a grant.

**Weaknesses.**
- **ARB-06 (CRITICAL)** — three violations of the document's own layering rule (§5.3).
- **ARB-01 (CRITICAL)** — the grant posture (§5.2).
- **ARB-07 (CRITICAL)** — the profile visibility gap makes the staff read paths
  non-functional (§5.4).
- **ARB-12 (HIGH)** — the collector's inherited breadth (§6.7).
- **ARB-18 (MEDIUM) — internal contradiction.** The §5 matrix says a revoked user has
  **no** access to their own closed membership history ("history of own closed rows: —
  (staff channel)"), while §6.6 specifies extending the self policy to
  `profile_id = current_profile_id()` **without a status filter**. A user with a revoked
  *membership* still has an active *profile*, so the policy returns their closed rows and
  the matrix cell is wrong. Decide which is intended — the ARB recommends the policy
  (residents seeing their own occupancy history is correct and LGPD-friendly) and
  correcting the matrix.
- **Recursion risk is real where flagged.** The `residents` co-household clause (§6.2)
  and the `household_members` INSERT check (§6.3) both reach into `residence_members`
  from a policy. The mitigation (wrap in definer helpers) is correct and standard. The
  ARB notes that the `residents` co-household clause should be **removed entirely**
  rather than wrapped — see below — which eliminates the harder of the two cases.
- **Performance of the `residents` SELECT policy.** The policy is
  `self OR permission OR platform_admin OR EXISTS(co-household join)`. A correlated
  `EXISTS` OR-ed into a policy is evaluated per candidate row and typically defeats
  index-only paths on the staff list at 10,000 residents. Removing the co-household
  clause (which ARB-06 requires anyway, for privacy) leaves three cheap predicates and a
  clean plan. Co-household visibility of housemates then comes from F-09
  `residence-get`, where it belongs — property-scoped, projected, and already specified.
- **The disabled-user path is asserted, not derived.** "`profiles.status='disabled'` ⇒
  `current_profile_id()` NULL ⇒ zero rows" holds for policies that reference
  `current_profile_id()` directly or through helpers. It must be verified per new policy
  that none has a branch reachable without it. SPR2-RLS-18 sweeps all tables, which is
  the right gate — keep it mandatory.
- **Platform-admin boundaries are correct** (read-only, no write policies, no new
  grants, any intervention through a future governed procedure per ADR-10). The ARB
  endorses this without conditions. One note: doc 29 §5 grants platform admin read on
  every Sprint 2 table including `household_members` (minors' data) with no audit of that
  read. R-08's mitigation mentions "audit events on any platform read of sensitive
  lists"; no contract implements it. Either implement it or drop the claim.

**Alternatives considered by the ARB.** Moving all authorization into Edge Functions and
relaxing RLS was considered and **firmly rejected** — it would abandon the certified
RLS-first guarantee and make every future direct-SQL or new-client access path unsafe.
The opposite (expressing everything in RLS, no EF checks) is impossible for period and
cross-table rules. The specified hybrid, with RLS as the necessary condition, is
correct; it simply must be applied consistently.

**Final recommendation.** Approve the model. It is minimal in the right sense: no new
role hierarchy, no parallel permission system, no service-role dependency. Fix the three
layering violations and the profile read path.

**Required changes before implementation.**
1. **(ARB-06, CRITICAL)** Realign the three EF-only projections with RLS (§5.3).
2. **(ARB-01, CRITICAL)** Resolve the grant posture (§5.2), preferably via
   `SECURITY INVOKER` RPCs, which preserves guarantee #3 intact.
3. **(ARB-07, CRITICAL)** Extend the association profile-read path (§5.4).
4. **(ARB-12, HIGH)** Narrow the collector permission.
5. **(HIGH)** Remove the co-household clause from the `residents` SELECT policy; serve
   housemate visibility through F-09's property-scoped projection.
6. **(ARB-18, MEDIUM)** Reconcile the revoked-history matrix cell with §6.6.
7. **(MEDIUM)** Settle the deferred `household_members` staff-read predicate now — the
   ARB endorses the document's own recommendation (strict
   `has_tenant_permission(tenant_id,'household:read')` rather than the broad
   `can_access_residence()`), which also keeps the collector out of dependents' data.
8. **(MEDIUM)** Either implement platform-read auditing for sensitive lists or remove
   the claim from R-08.

---

### 6.9 D-09 — Edge Functions

**Status: APPROVED WITH CONDITIONS**

**Summary.** 24 endpoints in 6 categories, sharing the certified envelope, error codes,
JWT auth and audit conventions. Server-side tenant resolution. Constraint-based
idempotency plus an optional `client_request_id`. Cursor pagination. Generic CRUD
explicitly rejected.

**Strengths.** The contract discipline is high. Rejecting generic per-table CRUD in
favor of intention-revealing operations (`residence-member-end`, not
`residence-member-update`) is the right choice for a domain where transitions carry
legal meaning, and it is what makes per-action audit coherent. Never trusting
client-supplied `tenant_id` is correct and consistent. Returning 404 rather than 403 for
cross-tenant IDs to avoid an existence oracle is a thoughtful security posture inherited
from Sprint 1. The audit catalog (20 actions) is complete relative to the domain
operations and maps cleanly to `log_audit_event()`. Separation of concerns between EF
(validation, envelope, rate limiting) and DB (authorization, integrity) is stated
correctly — even though §5.1 shows it is not achievable with the specified mechanism.

**Weaknesses.**
- **ARB-02 (CRITICAL)** — the atomicity assumption (§5.1). This affects F-07, F-17,
  F-20, and every mutation+audit pair, and it invalidates a doc 31 gate.
- **ARB-19 (MEDIUM) — `client_request_id` idempotency is unimplementable as specified.**
  "Duplicate `client_request_id` within 24h for the same actor+action returns the
  original result (implemented via audit lookup)". Three obstacles: `audit_events` has
  no unique index on `(actor, client_request_id)` so duplicates race; `authenticated`
  has no read grant on `audit_events` (verified) so the lookup needs another definer
  RPC; and an audit row records that something happened, not the response body, so "the
  original result" cannot be reconstructed. Either ship constraint-based idempotency
  only (adequate for every create in this package, since all have natural keys), or
  build a real `idempotency_keys` table storing the response. The ARB recommends the
  former for Sprint 2 and dropping `client_request_id` from the contract rather than
  shipping a field that does not do what it says.
- **ARB-20 (MEDIUM) — idempotent-200 masks operator error.** F-10 returns 200 with the
  existing property when `(tenant_id, unit_identifier)` collides. But a collision here
  usually means an operator is registering a *different* unit with a duplicated
  identifier — silently returning the existing unit will attach residents to the wrong
  property. Recommendation: return 200 only when the incoming payload matches the
  existing row on the natural key **and** the material fields; otherwise 409. Same for
  F-12.
- **ARB-27 (MEDIUM) — F-22 has no state.** The move-out request is "modeled as audit
  event + `residence_members` unchanged", with staff discovering requests by reading the
  audit stream via F-24. Audit is an append-only log, not a work queue: there is no way
  to mark a request handled, no way to list open requests, and a second request creates a
  second indistinguishable event. Doc 31 §9 concedes this. For a resident-facing
  self-service feature this is thin. Recommendation: add a `pending_closure` boolean or a
  `requested_end_date` column on `residence_members` (both additive), giving staff a
  queryable queue, or defer F-22 to Sprint 3 rather than shipping a feature that cannot
  be operated.
- **Rate limiting is unspecified platform-wide.** F-20 needs it (ARB-05). No mechanism
  exists in the certified `_shared/` layer. This is a platform capability, not a
  per-function detail, and it should be decided once.
- **F-08's collector projection** is defeated by direct table access (ARB-12).
- **Endpoint count.** 24 endpoints is a large Wave 2.5. The waves are otherwise
  well-sequenced, but 2.5 carries roughly half the sprint's implementation risk. Consider
  splitting it (2.5a association+resident, 2.5b residence+household+payer, 2.5c
  onboarding+audit) with gate checkpoints, mirroring the reviewable-migration reasoning
  already applied to Wave 2.3.
- **Public API evolution is not addressed.** No versioning convention, no deprecation
  policy, no statement of whether these endpoints are internal-only. With a resident
  mobile app and a collector mobile app on the roadmap, clients will pin to these
  contracts and cannot be force-upgraded. Decide now whether the URL carries a version
  (`/v1/…`) — retrofitting versioning after mobile clients ship is expensive.

**Final recommendation.** Approve the contract set. The inventory is right-sized, the
conventions are sound, and the omissions are honest. The execution mechanism must change.

**Required changes before implementation.**
1. **(ARB-02, CRITICAL)** Move every multi-statement mutation into `SECURITY INVOKER`
   plpgsql RPCs; restate F-07/F-17/F-20 accordingly; keep the doc 31 rollback gate,
   which then becomes meaningful.
2. **(ARB-19, MEDIUM)** Drop `client_request_id` or specify a real idempotency store.
3. **(ARB-20, MEDIUM)** Idempotent 200 only on payload equivalence; otherwise 409.
4. **(ARB-27, MEDIUM)** Give F-22 queryable state, or defer it.
5. **(MEDIUM)** Decide the platform rate-limiting mechanism before Wave 2.5 (it is a
   precondition for D-11).
6. **(MEDIUM)** Decide the API versioning convention now.
7. **(LOW)** Consider splitting Wave 2.5.

---

### 6.10 D-10 — Historical Integrity

**Status: APPROVED WITH CONDITIONS**

**Summary.** Append-only audit via the certified immutable `audit_events`; period rows
rather than overwrites; terminal statuses instead of deletes; closure always recording
when and why; retention deferred to platform operations.

**Strengths.** The principle is correctly identified as foundational rather than
decorative, and it is applied consistently across memberships, payers and invitations.
Reusing the certified append-only `audit_events` with its immutability trigger — rather
than inventing a second audit sink — is exactly right; a parallel history mechanism
would have been the single worst outcome available here. Requiring one audit event per
mutation, with `entity_type`, `entity_id`, `request_id` and changed-key metadata, gives
genuine legal traceability. The no-hard-delete posture aligns with LGPD's tension between
erasure and record-keeping by keeping erasure a governed platform-admin operation
(ADR-10) rather than an operator convenience.

**Weaknesses.**
- **Reconstruction is not actually guaranteed (ARB-11).** Overlapping historical periods
  are permitted; `residence_members.start_date` is nullable. "Who was responsible for
  unit X on date D" — the question billing and legal disputes will ask — can return
  zero or two rows. The principle deserves a constraint, not only a convention.
- **ARB-02 (CRITICAL) applies here too.** Without transactional atomicity, a mutation can
  commit while its audit event fails, or a cascade can half-apply. An append-only log
  that is missing entries is worse than no guarantee, because it is trusted. The RPC
  resolution makes mutation+audit atomic by construction.
- **ARB-15 (MEDIUM)** — three overlapping closure columns.
- **ARB-22 (MEDIUM)** — reusable `registration_code` breaks the historical code↔person
  mapping.
- **ARB-23 (MEDIUM) — growth.** D-09(planning) defers retention entirely. At 500
  associations with the specified event density, `audit_events` becomes the largest table
  in the system by an order of magnitude, and it can never be pruned under the
  append-only rule. The certified indexes `(tenant_id, created_at DESC)` and
  `(actor_profile_id, created_at DESC)` serve queries well, but index maintenance and
  vacuum cost grow without bound. Sprint 2 need not implement partitioning; it should
  **choose the partitioning key now** (recommendation: monthly `RANGE` on `created_at`,
  with `tenant_id` as the leading index column), because converting a large unpartitioned
  table later requires a maintenance window this product does not want to schedule.
- **Rollback capability.** The plan's rollback story ("locally reset; no production
  exists") is adequate today and stated honestly. It should be recorded that from the
  first persistent environment onward, the additive-only migration discipline becomes the
  actual rollback mechanism, and D-05 in particular becomes one-way (§6.5).
- **Household hard-delete (ARB-28)** is the one place the principle is abandoned, without
  a strong justification.

**Final recommendation.** Approve. Convert the strongest principle in the package from
convention into constraint.

**Required changes before implementation.**
1. **(ARB-11, HIGH)** Period-overlap exclusion constraints on `residence_payers` and
   `residence_members`; require `start_date` on all Sprint-2-created memberships.
2. **(ARB-02, CRITICAL)** Atomic mutation+audit via RPC.
3. **(ARB-15/ARB-21/ARB-22, MEDIUM)** Single closure vocabulary; enum-typed reasons;
   non-reusable registration codes.
4. **(ARB-23, MEDIUM)** Choose the `audit_events` partitioning key and record it as a
   forward constraint in doc 28 §11, even though nothing is built in Sprint 2.
5. **(ARB-28, LOW)** Reconcile household deletion with the principle.

---

### 6.11 D-11 — Invitation Model

**Status: APPROVED WITH CONDITIONS** — *conditions are blocking; the flow requires
re-specification, not hardening*

**Summary.** A `residence_invitations` table with hashed single-use expiring tokens, a
`SECURITY DEFINER accept_residence_invitation(token)` RPC, and create/accept/revoke
endpoints (F-19/F-20/F-21). Constant-shaped 404 across all invalid-token classes;
partial unique preventing duplicate open invitations; plaintext token returned once.

**The decision itself is correct and the ARB approves it.** Rejecting (B) staff-created
auth users via service role preserves the R-09 restriction that is central to the
security model. Rejecting (C) deferral is right: without onboarding, Sprint 2 delivers no
end-to-end usable capability, and `auth-bootstrap`'s existing 404 state already
anticipates this flow. Several security properties are well chosen: hash-at-rest,
single-use, expiry, constant-shaped errors for enumeration resistance, the definer RPC
with internal checks rather than blanket service-role access, and column-level exclusion
of `token_hash` from `authenticated`.

**However, the specified flow cannot onboard a new resident.** Three defects, two of
which are functional deadlocks:

- **ARB-03 (CRITICAL) — the accept path is unreachable.** F-20 requires: "assert invitee
  contact matches the caller's **verified** contact of that type (anti token-forwarding;
  if no verified match ⇒ 403 `INVITEE_MISMATCH`)". Verified against the baseline: Sprint 1
  forces `verification_state = 'unverified'` on contact insert (certified spoof guard),
  and **no contact-verification Edge Function exists** in `supabase/functions/` — the
  only verification path is the `profile_contacts:verify` staff permission. So a brand-new
  invitee signs up, adds their email as `unverified`, presents a valid token, and receives
  403. The only escape is for association staff to verify the contact first — but staff
  cannot see the person until they are a resident, which is what the invitation creates.
  The flagship flow deadlocks on its first execution. Note the anti-forwarding *intent*
  is sound; the mechanism is unavailable.
- **ARB-04 (CRITICAL) — an invitation cannot be reissued.** The partial unique
  `(property_id, invitee_contact_type, invitee_contact_value) WHERE status='pending'`
  plus F-19's "duplicate pending ⇒ 200 with existing invitation (**no new token**)" means
  that once a token is lost — undelivered email, wrong number, expired link — staff can
  never issue a working token to that person for that unit again. Expiry is swept
  "lazily (on read)", but no actor reads pending invitations on the invitee's behalf, and
  a row stuck at `pending` past `expires_at` blocks the unique index indefinitely. There
  is no revoke-and-recreate path specified either (F-21 revoke exists, so the manual
  workaround is revoke-then-create — it must be *specified*, and staff must be told,
  because the 200-idempotent response actively conceals the problem).
- **ARB-05 (CRITICAL) — rate limiting has no substrate.** F-20's brute-force resistance
  depends on `RATE_LIMITED` "at minimum per-caller attempt counting via audit lookup".
  But the audit catalog (doc 30 §5) contains only `invitation.accept` — successes.
  Failures are never recorded, so there is nothing to count. And `authenticated` has no
  read grant on `audit_events` (verified), so even a recorded failure could not be
  counted without another definer RPC. The stated minimum mechanism does not exist.

**Further weaknesses.**
- **Token entropy is unspecified.** Doc 28 says `token_hash text NOT NULL UNIQUE`; doc 27
  assumption 6 says "hashed at rest". Neither states the token's entropy, generator or
  hash function. This matters: because lookup is by hash, the hash must be deterministic
  and unsalted (SHA-256), which means **all brute-force resistance comes from token
  entropy alone**. Specify: ≥256-bit CSPRNG token, URL-safe encoding, SHA-256 at rest,
  and explicitly forbid short human-readable codes — a 6-digit code under this scheme
  would be trivially enumerable, and nothing in the current text prevents one.
- **ARB-26 (MEDIUM) — no delivery channel, and signup is ungated.** Notifications are out
  of scope, so the plaintext token is returned to the *inviter*, who relays it by
  unspecified means. Two consequences: token possession no longer proves control of the
  invited contact (weakening the anti-forwarding rationale behind ARB-03's mechanism),
  and the security of onboarding depends on staff behavior outside the system. Separately,
  F-20 requires an already-authenticated caller, so account creation happens via GoTrue
  signup **before** any invitation check — meaning invitations gate *residency*, not
  *account creation*. If self-signup is open, anyone can create a profile. This posture is
  never stated and must be.
- Replay of a consumed token returns 404 (correct). Expired-versus-unknown-versus-consumed
  all return a byte-equal 404 (correct, and the byte-equality gate in doc 31 is a good
  test). Timing equality is asserted; with a unique-index hash lookup this is
  approximately true, but the post-lookup validation branches (expiry check, contact
  match, membership check) have different costs — the timing claim should be scoped to
  "no timing oracle distinguishing token existence", which is what the index lookup
  actually provides.
- Tenant validation is sound: `tenant_id` derives from the invitation row, never the
  client.
- Atomic acceptance is specified correctly in intent (create resident + membership + mark
  accepted + audit) and, as a `SECURITY DEFINER` plpgsql RPC, this one flow **does** get
  real transactional atomicity — the ARB notes it is the only mutation in the package
  that does, which is itself evidence for the §5.1 recommendation.

**Alternatives considered by the ARB.**
- *Token-as-proof-of-contact (recommended).* Deliver the token to the invited contact;
  on successful acceptance, mark that contact `verified` for the accepting profile.
  Possession of a high-entropy token delivered to the contact **is** the verification
  event. This resolves ARB-03 without weakening anti-forwarding beyond what the missing
  delivery channel already concedes, and it is a coherent security story.
- *Ship a contact-verification flow in Sprint 2.* Cleaner long-term and needed anyway,
  but expands scope significantly (OTP generation, delivery, throttling) and depends on
  the same missing notification transport.
- *Defer verification, accept any authenticated caller with a valid token.* Simplest;
  acceptable only if tokens are high-entropy and single-use, but it permits deliberate
  token forwarding.

The ARB recommends the first, with the second scheduled for Sprint 3.

**Final recommendation.** Approve the decision to build invitation-based onboarding.
**Do not authorize Wave 2.5 implementation of F-19/F-20 until the flow is
re-specified and re-reviewed.** The re-specification is a bounded piece of work — it does
not disturb the schema, only the contract and one constraint.

**Required changes before implementation.**
1. **(ARB-03, CRITICAL)** Replace the verified-contact precondition with the
   token-as-proof-of-contact model (and mark the contact verified on accept), or ship a
   verification flow. The current specification cannot execute.
2. **(ARB-04, CRITICAL)** Specify reissue: F-19 must expire the stale pending row and
   mint a new token when the existing one is past `expires_at`; return a new token
   whenever the caller holds `invitations:write` and the prior token is unusable; document
   revoke-then-recreate as the explicit staff path. Reconsider whether the partial unique
   should include `expires_at > now()`.
3. **(ARB-05, CRITICAL)** Add an `invitation.accept_failed` audit action (or a dedicated
   attempt-counter table) and a definer counting function; or adopt the platform
   rate-limit mechanism decided under D-09. Without one of these, F-20 has no
   brute-force resistance.
4. **(HIGH)** Specify token entropy (≥256-bit CSPRNG), encoding and hash (SHA-256);
   explicitly forbid short codes.
5. **(ARB-26, MEDIUM)** State the GoTrue self-signup posture and the out-of-band token
   delivery limitation in the Sprint 2 certification as an accepted, disclosed risk.
6. **(ARB-10, HIGH)** Composite FK to `properties (id, tenant_id)`.
7. **(MEDIUM)** Confirm that column-level grants behave as expected through PostgREST
   before relying on them for `token_hash` — this is the mechanism's first production use
   (doc 29 §6.5 acknowledges this), and SPR2-RLS-21 must run early in Wave 2.4, not at the
   end.

---

### 6.12 Planning decisions outside the brief's taxonomy

**doc 27 D-08 — Allowed administrative overrides: APPROVED.** Staff mutate
association-scoped records only; identity protected fields remain trigger-protected with
no staff override; ADR-10's governed-correction protocol remains the future path. This is
correct and conservative, and it preserves the certified triggers untouched. No
conditions.

**doc 27 D-09 — Audit retention: APPROVED WITH CONDITIONS.** Deferring retention policy
to platform operations is reasonable for Sprint 2. Condition: choose the partitioning key
now (ARB-23) and record it as a forward constraint.

**doc 27 D-10 — Deletion vs deactivation: APPROVED WITH CONDITIONS.** Terminal statuses
over hard deletes is right. Condition: reconcile the `household_members` hard-delete
exception (ARB-28), whose stated justification (pre-approval cleanup) does not apply
because Sprint 2 has no household approval flow.

---

## 7. Cross-check: consistency across the package

### 7.1 Contradictions found

| # | Contradiction | Documents | Finding |
|---|---|---|---|
| 1 | Guarantee "authenticated never receives write access to tenant-owned structural tables" vs planned INSERT/UPDATE grants on `properties`, `residence_members` and all new tables | 27 §2.2 ↔ 29 §6, 30 F-10/F-11 | ARB-01 |
| 2 | "Policy is necessary-but-not-sufficient, never the reverse" vs three EF-only projections | 29 §6 ↔ 29 §6.1/6.4/6.2, 30 F-01/F-09 | ARB-06 |
| 3 | Collector boundary "no resident personal data" vs collector granted `residences:read`, which certified policy L686 maps to all membership rows | 29 §4 ↔ 29 §3 + baseline | ARB-12 |
| 4 | Revoked user "history of own closed rows: —" vs self policy without status filter | 29 §5 ↔ 29 §6.6 | ARB-18 |
| 5 | Doc 28 §12 "complete list" of Sprint 1 changes vs doc 30 F-10's `properties` grant "amendment" (+ F-11 UPDATE, + ARB-07's `profiles` policy) | 28 §12 ↔ 30 F-10 | ARB-13 |
| 6 | Invariant 5 "no identity field outside `profiles`" vs `household_members.full_name`/`birth_date` | 28 §9 ↔ 28 §6.3 | ARB-16 |
| 7 | Invariant 6 listed as machine-checkable vs conceded heuristic enforcement | 28 §9 ↔ 31 §9 | ARB-16 |
| 8 | Certified indexes described as partial; they are plain composite | 28 §5, 31 PERF2-02 ↔ baseline L214–215 | ARB-14 |
| 9 | F-03/F-04 return profile fields for all residents vs `profiles_select_association_policy` requiring an active membership | 30 F-03 ↔ baseline L591–604 | ARB-07 |
| 10 | "One transaction" cascades vs Edge Function → PostgREST execution model | 30 F-07/F-17/F-20, 31 §4 ↔ certified `_shared/` | ARB-02 |
| 11 | F-20 rate limiting "via audit lookup" vs no failure audit action and no audit read grant | 30 F-20 ↔ 30 §5 + baseline | ARB-05 |
| 12 | F-20 requires a verified contact vs Sprint 1 forcing `unverified` and no verification function existing | 30 F-20 ↔ baseline | ARB-03 |
| 13 | "Cross-tenant references are structurally impossible" vs a global cross-tenant unique index on primary residence | 27 §5 ↔ 28 §6.6 | ARB-09 |
| 14 | R-08 mitigation claims "audit events on any platform read of sensitive lists" vs no contract implementing it | 27 R-08 ↔ 30 | §6.8 |
| 15 | Brief D-05…D-11 vs doc 27 D-05…D-11 denote different decisions | brief ↔ 27 §13 | ARB-24 |

### 7.2 Duplicated concepts

The anti-duplication contract (doc 28 §2) is genuinely good and prevents the large-scale
duplication that R-01 targets. Four residual duplications remain:

1. **Closure vocabulary** — `revoked_at` (certified) vs `end_date` + `end_reason`
   (proposed) on `residence_members`; plus `payer_status='ended'` + `end_date` +
   free-text `end_reason` on payers. Three columns and two vocabularies for one concept
   (ARB-15, ARB-21).
2. **Person data** — `profiles.full_name` vs `household_members.full_name`. Justified by
   the two-population design, but it means "the set of people in a household" must be
   assembled from two tables with different identity guarantees, forever. Accepted; the
   `linked_profile_id` recommendation (ARB-17) mitigates the worst consequence.
3. **Occupancy state** — derived from `residence_members` (correct), while
   `properties.status` is administrative and `residents.status` is association-scoped.
   Three status concepts that operators will conflate. The prohibited-state matrix
   (doc 28 §8.2) handles this well; keep it prominent in the staff UI contract.
4. **Approval semantics** — `residents.status='pending'`, `residence_members.status=
   'pending'`, and `invitation_status='pending'` each mean a different approval, and
   `association_details.settings.requires_resident_approval` governs two of them. The
   interaction is specified but intricate; it deserves a single state diagram in the Wave
   2.2 report.

No large-scale concept duplication was found. R-01's mitigation is effective.

### 7.3 Future maintenance risks

- The hardcoded permission matrix inside a certified SECURITY DEFINER function grows with
  every module (§6.7). Each addition edits certified code.
- 24 Edge Functions with no versioning convention, about to acquire mobile clients (§6.9).
- `settings` and `enabled_modules` as unvalidated jsonb become de-facto schema without
  migration discipline (§6.6).
- Two person-populations that must be joined for every household-wide operation (§7.2).
- The `d2_` validation namespace and the four unprefixed cluster-global test roles
  (CF-03/CF-04) remain deferred; harmless now, but cluster-global names collide silently
  when a second test suite arrives.

### 7.4 Migration risks

- **D-05 is one-way** after the first re-occupancy row exists in a persistent environment
  (§6.5). Now is the only free moment.
- **Partial unique on `active` only** permanently admits duplicate `pending` rows;
  tightening it later requires cleaning accumulated duplicates (ARB-08).
- **Adding overlap-exclusion constraints later** requires repairing dirty historical data;
  adding them now costs one index each (ARB-11).
- **Composite FKs are cheap now, expensive later** — they require the parent
  `UNIQUE (id, tenant_id)` and a full validation scan on populated tables (ARB-10).
- **`audit_events` partitioning** is inexpensive at zero rows and a maintenance window at
  10⁷ (ARB-23).
- **Enum additions are additive; enum *renames* are not.** The `association_collector`
  naming question (§6.7) should be settled before the value exists.

Every one of these is cheaper to resolve before Wave 2.1 than at any later point. That
observation is the core of this review's recommendation.

---

## 8. SaaS scalability review

### 8.1 By scale

**10 associations / ~500 residents.** The architecture is correct and comfortably
over-engineered for this point. No bottleneck. All specified paths work.

**100 associations / ~5,000 residents.** Still correct. The specified performance
fixtures (doc 31 §5) target exactly this range and above, which is the right call. Watch:
the `residents` SELECT policy's co-household `EXISTS` clause (§6.8) and per-row
`can_access_residence()` on property lists.

**500 associations / ~25,000 residents / ~50,000 membership rows.** Three pressure points:

1. **Policy-function evaluation.** Every `properties` read invokes `can_access_residence()`
   per candidate row; every `residents` read invokes `has_tenant_permission()` plus,
   as specified, a correlated `EXISTS`. These are SQL `STABLE` functions and are usually
   inlined, but the OR-ed correlated subquery is the one shape that reliably degrades.
   Removing the co-household clause (already required for ARB-06) is also the single
   most valuable scale fix.
2. **`audit_events` volume.** With ~20 audited actions across 25,000 residents plus
   routine operations, this table dominates. Certified indexes serve the queries; the
   unbounded growth and vacuum cost are the issue (ARB-23).
3. **Membership history growth.** At 30% closed rows (doc 31's own fixture assumption),
   every active-membership lookup scans through history unless the indexes are genuinely
   partial. They are not (ARB-14). Creating true partial indexes on
   `status='active'` is a direct, cheap win at this scale.

**10,000 residents in a single large association.** The tenant-scoped indexes
(`(tenant_id, status)`) handle this. The `resident-list` path with a `q` search across
registration code *and* profile display fields is the risk: it spans `residents` and
`profiles` across a policy boundary with no specified search index. PERF2-01 covers the
filter path but not the search path. **Add a gate for `q` search**, and expect to need a
trigram index or a denormalized search column — the latter would need care given the
zero-identity-columns invariant on `residents`.

**Multiple administrators per association.** Fully supported; `tenant_members` is
many-to-many with roles. No concurrency control is specified for competing staff edits
(e.g. two operators assigning different payers simultaneously). The partial unique
indexes make the database the arbiter, which is correct, but F-13's "race-safe (two
approves ⇒ one winner)" test is the only place this is acknowledged. Extend that pattern
to F-17 and F-12.

**Future premium modules / integrations.** `enabled_modules` is the right gate. The
permission-matrix scalability limit (§6.7) is the constraint that will bind first.

### 8.2 Would become a bottleneck

| Bottleneck | Binds at | Mitigation |
|---|---|---|
| Co-household `EXISTS` in `residents` policy | ~100+ associations, large tenants | Remove the clause (also required by ARB-06) |
| Non-partial membership indexes with 30% history | ~500 associations | Create true partial indexes on `status='active'` |
| `audit_events` unbounded growth | ~500 associations / 12+ months | Choose partitioning key now, implement in Sprint 3/4 |
| `resident-list` `q` search across the policy boundary | large single tenants | Add a PERF2 gate; plan a trigram or search column |
| Hardcoded permission matrix in a certified function | ~3 more modules | Planned Sprint 3/4 refactor to a permission table |
| Per-row `can_access_residence()` on property lists | large tenants | Already a monitored Sprint 1 item (PERF-05); keep monitoring |
| 24 unversioned Edge Function contracts | first mobile client release | Decide versioning before Wave 2.5 |

Nothing in the architecture becomes *incorrect* at scale. Every item above is a
performance or maintenance concern with a known remedy, which is the right property for a
foundation sprint.

---

## 9. Executive questions — explicit answers

**1. Is the resident model future-proof?**
**Yes, structurally — with one required fix.** The tenant-scoped projection over a
platform profile is the correct long-term shape: it supports multi-association residency,
keeps identity single-sourced, and gives billing/tickets/communication a tenant-scoped
anchor. It is not *deliverable* until the profile read-path gap (ARB-07) is closed, and
re-entry (D-01a) must be settled now rather than in Wave 2.2.

**2. Is the residence model sufficiently generic?**
**Yes.** Residence-is-property with derived occupancy is the most robust decision in the
package. It supports vacancy, multi-occupancy, off-site ownership, shared and multiple
meters, and unit-level billing anchors without a schema change. The main residual is that
`unit_identifier` remains the only unit key — correctly, since nothing keys on the string
value.

**3. Is any concept duplicated?**
**Not materially at the entity level; yes at the attribute level.** The anti-duplication
contract (doc 28 §2) works. Four residual duplications: closure vocabulary
(`revoked_at` vs `end_date`/`end_reason`, plus two reason typings), person data across
`profiles`/`household_members`, three coexisting status concepts, and three distinct
"pending" approval semantics. Only the closure vocabulary requires a fix (ARB-15,
ARB-21).

**4. Is billing naturally supported?**
**Yes for the payer anchor; partially for the rest.** `residence_payers` with period
history is exactly the right billing anchor, and the split-payment relaxation path is
genuinely non-breaking. Two gaps: historical reconstruction is not constraint-guaranteed
(ARB-11), which billing will depend on; and the unit participation quota (fração ideal /
rateio weight) has no specified home. Neither is a Sprint 2 deliverable, but the first
must be constrained now.

**5. Is metering naturally supported?**
**Yes.** Anchoring meters to `properties.id` with no 1:1 assumption is correct and
deliberately preserves shared-meter and multi-meter topologies. Consumption billing across
occupant changes works *provided* period integrity is enforced (ARB-11) — the meter model
depends on the payer/occupancy periods being unambiguous over time.

**6. Can one resident safely belong to multiple associations?**
**Yes by design; no as currently constrained.** One profile → N `residents` rows and N
memberships is correct and F-23 exposes it. But the global
`UNIQUE (profile_id) WHERE status='active' AND is_primary` (ARB-09) makes a person's
registration in a second association fail on a constraint caused by an invisible row in
the first — a functional failure and a cross-tenant leak. Scope the index to the tenant
and the answer becomes an unqualified yes.

**7. Can ownership history always be reconstructed?**
**Not as specified.** The period-row model is right, and closure always records when and
why. But overlapping historical periods are permitted, `residence_members.start_date` is
nullable, and — most importantly — without transactional atomicity (ARB-02) a mutation can
commit while its audit event does not. Add the exclusion constraints, require
`start_date`, and make mutation+audit atomic; then the answer is yes.

**8. Is the authorization model minimal?**
**Yes.** No new role hierarchy, no parallel permission system, no service-role dependency,
helpers as predicates rather than data sources, one sanctioned elevation path. It is
minimal in the sense that matters. The failures are consistency failures (data
minimization in the wrong layer, one over-broad permission grant), not excess machinery.

**9. Is any role unnecessary?**
**No role is unnecessary; one is prematurely privileged and possibly misnamed.** All six
tenant roles map to real association functions. `association_collector` has no write
capability in Sprint 2 and exists to prepare mobile collector workflows — acceptable, but
it must not inherit `residences:read` (ARB-12), and its name should match its actual job
before the enum value exists. `platform_support` correctly receives nothing.

**10. Is any future migration likely?**
**Yes — five, and four are avoidable by acting now.** (a) `audit_events` partitioning —
unavoidable, plan the key now; (b) permission matrix → table refactor — likely at ~3 more
modules, plan it; (c) tightening the pending-duplicate constraint — **avoidable** by
fixing ARB-08 now; (d) adding period-overlap constraints over dirty data — **avoidable**
by fixing ARB-11 now; (e) adding composite tenant FKs to populated tables — **avoidable**
by fixing ARB-10 now. Split-payment relaxation and enum additions are additive and do not
count as migrations in the risky sense.

**11. Which decision carries the highest technical debt?**
**D-09 (Edge Functions), because of ARB-02.** The contracts are specified against an
execution model that cannot deliver their stated semantics. Building 24 endpoints as
PostgREST orchestrators and later converting the multi-step ones to RPCs means rewriting
the mutation layer after it has tests, evidence and a certification built on it. The debt
is not the contracts — those are good — it is the mechanism. Second place: D-11, whose
specified flow cannot execute at all (ARB-03/04/05), though its blast radius is one
feature rather than the whole function layer.

**12. Which decision most improves long-term maintainability?**
**D-02 (Residence Model).** Refusing to create a parallel residence table avoided forking
the tenant boundary and duplicating every certified policy, helper and index — the single
largest maintenance liability the sprint could have created. Deriving occupancy instead of
storing it eliminates a whole class of drift bugs permanently. **Runner-up: D-01**, whose
zero-identity-columns invariant keeps identity single-sourced as the product grows to
multiple modules and clients; it is the discipline that makes LGPD compliance tractable
later.

---

## 10. Required changes before implementation (consolidated)

### 10.1 Blocking — must be resolved and re-reviewed before Wave 2.0 exits

| # | Change | Finding | Decisions |
|---|---|---|---|
| RC-01 | Move every multi-statement mutation into `SECURITY INVOKER` plpgsql RPCs called by the Edge Functions; restate F-07/F-17/F-20 and the doc 31 rollback gate | ARB-02 | D-09, D-10 |
| RC-02 | Resolve the write-grant posture: adopt RPC-mediated writes preserving certified guarantee #3, **or** obtain explicit executive sign-off amending it | ARB-01 | D-05, D-08, D-09 |
| RC-03 | Realign the three EF-only projections with RLS (association settings; payer history; `residents.notes`/`status_reason`) | ARB-06 | D-06, D-08 |
| RC-04 | Extend the association profile-read path to recognize `residents` rows; add it to doc 28 §12 with a Sprint 1 regression proof | ARB-07 | D-01, D-08 |
| RC-05 | Re-specify the invitation accept precondition (token-as-proof-of-contact recommended) | ARB-03 | D-11 |
| RC-06 | Specify invitation reissue/expiry-sweep so a lost or expired invitation can be replaced | ARB-04 | D-11 |
| RC-07 | Provide a real rate-limit substrate for F-20 (failure audit action or attempt table), or adopt a platform mechanism | ARB-05 | D-11, D-09 |

### 10.2 High — must be resolved before the owning wave begins

| # | Change | Finding | Wave |
|---|---|---|---|
| RC-08 | Partial unique becomes `WHERE status IN ('active','pending')` | ARB-08 | 2.3 |
| RC-09 | Scope the primary-residence unique to `(tenant_id, profile_id)` | ARB-09 | 2.3 |
| RC-10 | Add `UNIQUE (id, tenant_id)` on parents and composite FKs on all new child tables; recommended for `residence_members` | ARB-10 | 2.1–2.3 |
| RC-11 | Period-overlap exclusion constraints; require `start_date` on Sprint-2-created memberships | ARB-11 | 2.3 |
| RC-12 | New narrow collector permission; remove collector from `residences:read`; gate asserting zero membership rows | ARB-12 | 2.1/2.4 |
| RC-13 | Republish doc 28 §12 as genuinely complete; freeze the immutability-proof approved set before Wave 2.1 | ARB-13 | 2.0 |
| RC-14 | Correct the index characterization in docs 28/31; consider creating true partial indexes | ARB-14 | 2.0/2.3 |
| RC-15 | Remove the co-household clause from the `residents` SELECT policy | ARB-06, §6.8 | 2.4 |
| RC-16 | Specify invitation token entropy (≥256-bit CSPRNG), encoding and hash; forbid short codes | §6.11 | 2.2 |

### 10.3 Medium — must be resolved before Sprint 2 certification

RC-17 single closure vocabulary and `revoked_at` disposition (ARB-15) ·
RC-18 restate invariants 5 and 6 truthfully; add `linked_profile_id` (ARB-16) ·
RC-19 define the household→platform-user promotion path (ARB-17) ·
RC-20 reconcile the revoked-history matrix cell (ARB-18) ·
RC-21 drop `client_request_id` or build a real idempotency store (ARB-19) ·
RC-22 idempotent 200 only on payload equivalence (ARB-20) ·
RC-23 enum-typed payer closure reasons including `replaced` (ARB-21) ·
RC-24 non-reusable `registration_code` (ARB-22) ·
RC-25 choose the `audit_events` partitioning key and record it (ARB-23) ·
RC-26 reconcile the decision-ID numbering (ARB-24) ·
RC-27 close the deferred architectural decisions listed in §5.7 (ARB-25) ·
RC-28 state the GoTrue self-signup posture and token-delivery limitation (ARB-26) ·
RC-29 give F-22 queryable state or defer it (ARB-27) ·
RC-30 decide the API versioning convention · RC-31 decide the platform rate-limit
mechanism · RC-32 global partial unique on `registration_number` · RC-33 specify
allow-listed `settings`/`enabled_modules` values · RC-34 confirm the collector's job and
name · RC-35 add a PERF2 gate for the `resident-list` `q` search path · RC-36 implement
or withdraw the R-08 platform-read auditing claim.

### 10.4 Low / disclosure

RC-37 reconcile household hard-delete with the historical-integrity principle (ARB-28) ·
RC-38 disclose the minors'-data retention gap (ARB-29) · RC-39 record that D-05 becomes
irreversible in any persistent environment · RC-40 run SPR2-RLS-21 (column-privilege
gate) early in Wave 2.4, since `token_hash` is the mechanism's first production use ·
RC-41 consider splitting Wave 2.5.

---

## 11. Decision matrix

| Decision | Topic | Status | Conditions |
|---|---|---|---|
| D-01 | Resident Model | APPROVED WITH CONDITIONS | Profile read-path fix (RC-04); staff-note separation (RC-03); settle re-entry D-01a; non-reusable registration code; `UNIQUE (id, tenant_id)` |
| D-02 | Residence Model | APPROVED | None blocking. Disclose `properties` grant in doc 28 §12 (RC-13); correct index claims (RC-14) |
| D-03 | Household Model | APPROVED WITH CONDITIONS | Add `linked_profile_id`; restate invariants 5/6; define promotion path; composite FK; reconcile hard delete |
| D-04 | Responsible Payer | APPROVED WITH CONDITIONS | Period-overlap constraint (RC-11); enum closure reasons; composite FKs enforcing payer-is-resident structurally |
| D-05 | Lifecycle (certified-object change) | APPROVED WITH CONDITIONS | Pending-row uniqueness (RC-08); tenant-scoped primary index (RC-09); complete §12 list frozen (RC-13); index claims corrected (RC-14); grant posture resolved (RC-02); irreversibility recorded |
| D-06 | Association Extension | APPROVED WITH CONDITIONS | Private-settings separation (RC-03); global CNPJ uniqueness; specify settings/module allow-lists; define row creation |
| D-07 | Association Roles | APPROVED WITH CONDITIONS | Narrow collector permission (RC-12); confirm role name; record permission-matrix scalability debt |
| D-08 | Authorization | APPROVED WITH CONDITIONS | RC-01, RC-02, RC-03, RC-04, RC-12, RC-15; reconcile revoked-history cell; settle household read predicate; implement or withdraw R-08 audit claim |
| D-09 | Edge Functions | APPROVED WITH CONDITIONS | Transactional RPCs (RC-01); idempotency mechanism (RC-21/22); F-22 state; rate-limit and versioning decisions |
| D-10 | Historical Integrity | APPROVED WITH CONDITIONS | Overlap constraints and mandatory `start_date` (RC-11); atomic mutation+audit (RC-01); single closure vocabulary; partitioning key chosen |
| D-11 | Invitation Model | APPROVED WITH CONDITIONS | **Blocking:** accept-flow re-specification (RC-05), reissue path (RC-06), rate-limit substrate (RC-07), token entropy (RC-16). Wave 2.5 F-19/F-20 not authorized until re-reviewed |

**Approved without conditions:** D-02.
**Approved with conditions:** D-01, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11.
**Rejected:** none.
**Postponed:** none.

*(Planning-only decisions outside the brief taxonomy: doc 27 D-08 APPROVED; doc 27 D-09
APPROVED WITH CONDITIONS; doc 27 D-10 APPROVED WITH CONDITIONS — see §6.12.)*

---

## 12. Implementation prerequisites

Before Wave 2.0 may be authorized:

1. **Executive rulings** on RC-02 (grant posture — the guarantee-#3 question is an
   executive call, not a technical one), RC-05 (invitation trust model), and the
   collector's job definition (RC-34).
2. **Documents 27–31 republished** with all §10.1 and §10.2 changes incorporated. The
   ARB requires re-review of the revised doc 30 §F-19/F-20 and doc 28 §12 specifically;
   the remaining changes may be verified by the primary technical auditor at wave exit.
3. **Doc 28 §12 frozen** as the immutability-proof approved set, with an explicit rule
   that additions require new executive authorization rather than a document edit.
4. **The §5.7 deferred decisions closed** in the republished documents (RC-27).
5. **Decision-ID numbering reconciled** (RC-26) so no future report cites an ambiguous
   `D-nn`.
6. **Wave 2.0 unchanged otherwise** — the baseline verification and CF-01 integration
   scope is correct as planned and may proceed once the above is done.
7. **Wave 2.5 gate:** F-19/F-20 implementation remains unauthorized pending the
   re-review in (2).

Governance model, wave sequencing, validation strategy, fixture design, performance
scale targets and the dual-auditor certification chain are **approved as specified** and
require no changes beyond the gate additions noted in §10.

---

## 13. Executive recommendations

1. **Adopt `SECURITY INVOKER` RPCs as the Sprint 2 mutation mechanism.** This single
   change resolves the atomicity defect, preserves the certified no-write-grant
   guarantee, makes mutation+audit atomic, and simplifies idempotency. It is the highest
   leverage decision available and it is far cheaper now than after 24 endpoints exist.
2. **Make tenant isolation structural.** Composite FKs convert the plan's only CRITICAL
   structural risk (R-13) from "enforced by correct code" into "impossible". Cost: one
   unique index per parent. This is the best value-per-effort item in the review.
3. **Constrain history, don't merely intend it.** Exclusion constraints and mandatory
   start dates are cheap on empty tables and expensive over dirty data. The
   historical-integrity principle is the package's best idea; give it teeth now.
4. **Fix the three layering violations before writing any policy.** Data minimization
   belongs in RLS. An Edge Function projection over a row-readable table is not a control.
5. **Re-specify the invitation flow before Wave 2.5, and treat it as a small
   re-planning exercise, not a hardening pass.** The schema is fine; the contract is not
   executable.
6. **Close the deferred decisions now.** Twelve open architectural questions entering an
   implementation sprint will be answered under delivery pressure by the executor, which
   is precisely the failure mode this review exists to prevent.
7. **Preserve the governance chain exactly as planned.** The dual-auditor, strict
   dual-PASS model certified in Sprint 1 is working — this review's findings were
   themselves produced by applying its CF-05 verification discipline to the planning
   package. Extend that discipline explicitly: **every claim a planning document makes
   about the certified baseline must be grep-verified before the document is published**,
   not only claims in implementation reports. Seven of this review's blocking findings
   would have been caught at authoring time by that rule.
8. **Do not treat the volume of conditions as a negative signal.** The package's
   architecture is sound and its decisions are, with one exception, the ones the ARB
   would have chosen independently. The conditions are concentrated in mechanism and in
   verification of baseline claims — both correctable without redesign.

---

## 14. Review integrity statement (CF-05 compliance)

- All five planning documents were read in full. No summary was substituted.
- Every structural claim about the certified baseline cited in this review was verified
  against `supabase/migrations/20260719170000_sprint01_foundation_identity.sql` or
  `supabase/functions/` at HEAD `1e6e4bb`. Line references are to that file.
- Finding IDs `ARB-01…ARB-30` and change IDs `RC-01…RC-41` are introduced by this
  document and do not reuse any Sprint 1 or Sprint 2 identifier.
- Gate IDs referenced (`SPR2-*`, `EF2-*`, `PERF2-*`, `PERF-05`, `EF-AUTH-15`, `C-02`,
  `CF-01…CF-05`, `R-01…R-19`, `D-01…D-11`, `F-01…F-24`) are cited as they appear in
  documents 27–31 and reports 17–26; none was invented.
- The decision-ID divergence between the review brief and doc 27 §13 is disclosed in
  §3.1 rather than silently reconciled.
- No source code, migration, Edge Function, test or fixture was created, modified or
  executed. No test suite was run. No commit was created. No branch or tag was modified.
  The repository is unchanged except for the addition of this file.

---

## 15. Final decision

Ten of eleven decisions are structurally sound and require conditions rather than
redesign. The eleventh (D-11) is a correct decision with an inexecutable contract
specification. No decision is rejected; none is postponed. The conditions are
concentrated in the mutation mechanism, in three authorization-layering corrections, and
in claims about the certified baseline that did not survive verification — all
correctable without altering the domain architecture.

Implementation is **not** authorized by this document. Wave 2.0 may be authorized only
after §12's prerequisites are satisfied.

```
EXECUTIVE REVIEW APPROVED WITH CONDITIONS — DECISIONS MUST BE UPDATED BEFORE IMPLEMENTATION
```
