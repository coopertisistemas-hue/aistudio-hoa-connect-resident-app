# 37 — Wave 2.0 Execution Roadmap (Waves 2.1 … 2.7)

**Type:** Deterministic execution rules for the remaining Sprint 2 waves
**Wave:** 2.0
**Status:** FROZEN — binding on waves 2.1 … 2.7
**Date:** 2026-07-20

**Purpose.** Make each remaining wave deterministic: a wave's scope, dependencies, gates
and stopping point are decided **now**, not at the moment of implementation. Derived from
document 27 §9 as amended by R1; document 27 remains authoritative where any conflict
exists.

**How to use this.** Each wave below is entered only with explicit authorization, and
exits only when document 36 §3's universal gates **and** the wave's own exit criteria are
met. The universal gates are not repeated per wave — they always apply.

---

## 1. Wave sequence

```
2.0 ✔ → 2.1 → 2.2 → 2.3 → 2.4 → 2.4b → 2.5a → 2.5b → 2.5c → 2.6 → 2.7
```

The mandated decomposition names seven waves (2.1 … 2.7). The approved plan refines two
of them into checkpoints **inside** their wave, without adding scope:

| Mandated wave | Refinement | Reason |
|---|---|---|
| 2.4 | 2.4 (policies) then **2.4b** (mutation RPCs) | the RPC layer must be gated before any contract consumes it (RM-01) |
| 2.5 | **2.5a / 2.5b / 2.5c** | the sprint's largest wave (24 endpoints) kept reviewable, mirroring the 2.3a/2.3b reasoning |

A checkpoint is a review boundary, not a wave: it needs no separate authorization, but
its gates must be green before the next checkpoint starts.

---

## 2. Wave 2.1 — Association domain extension

| | |
|---|---|
| **Objective** | `association_details` table, `tenant_role` enum extension (`association_collector`, D-06/D-07), RLS, indexes |
| **Depends on** | Wave 2.0 · **frozen-list sign-off (document 36 §2)** |
| **Files** | one new migration; `supabase/tests/sprint02_*.sql` |
| **Gates** | SPR2-RLS association read/write; enum regression |
| **Exit** | migration applies cleanly on the certified baseline; Sprint 1 suite green |
| **Rollback** | additive migration; `supabase db reset` locally |
| **Evidence** | migration diff + gate output |

**Determinism notes.** `association_settings_private` is a **separate table**, not a
column set — data minimization is structural (RM-07). The `tenant_permission` extension
totals **12** values including `residences:read_routes` (document 33 §4).

**Stop condition.** Do not create `residents`. That is Wave 2.2.

---

## 3. Wave 2.2 — Resident domain

| | |
|---|---|
| **Objective** | `residents` table, lifecycle enums, RLS, helper functions, invitation tables |
| **Depends on** | Wave 2.1 (collector/permission vocabulary); document 28 approval |
| **Files** | one new migration; SQL tests |
| **Gates** | resident lifecycle; cross-tenant denial; protected-field gates |
| **Exit / Rollback / Evidence** | Wave 2.1 pattern |

**Determinism notes.** `resident_staff_notes` is a separate table (RM-07).
`registration_code` is non-reusable within a tenant and never cleared on
`former`/`deceased` (ARB-22). Resident re-entry is `former → pending` (RM-08).
`residents` policy carries **no** co-household clause — it was deliberately removed
(RM-07); do not reintroduce it as a convenience.

**Stop condition.** No relationship tables. That is Wave 2.3.

---

## 4. Wave 2.3 — Residence and household relationships

| | |
|---|---|
| **Objective** | `household_members`, `residence_payers`, `residence_members` history evolution (D-05), occupancy semantics, all constraints/indexes |
| **Depends on** | Wave 2.2 (residents must exist for payer FK validation) |
| **Files** | one migration (2.3a schema, 2.3b relationship logic); the `residence_members` constraint change in **its own** migration for reviewability |
| **Gates** | history preservation; duplicate-active-responsibility denial; orphan denial; cross-tenant linkage denial; SPR2-FK-01; SPR2-HIST-05/06 |
| **Exit** | all constraints enforced structurally, not procedurally |
| **Rollback** | local reset |

**Determinism notes.**
- **Composite FKs** `(property_id, tenant_id)` and `(resident_id, tenant_id)` on every
  child table, with parent `UNIQUE (id, tenant_id)` (RM-03). The FK rejects the write
  regardless of RLS, Edge Function behavior or any future direct-SQL path.
- **Occupancy is always derived, never stored** (document 33 §4).
- Temporal overlap prevented by `EXCLUDE` constraints (`btree_gist`); rows with NULL
  `start_date` are exempted by the `WHERE` clause **by design** (ARB-11).
- `end_date` is the business date; `revoked_at` is an audit timestamp and is **never**
  used in business queries (ARB-15).
- Partial indexes `idx_residence_members_property_open` / `_profile_open` are **added**;
  certified composite indexes are not altered (RM-09).
- Household hard `DELETE` does not exist — terminal transition only (ARB-28).

**Required report item.** D-05 becomes irreversible from the first persistent
environment onward. The Wave 2.3 report must record this explicitly (document 27 §13).

**Stop condition.** No policies for the new tables yet. That is Wave 2.4.

---

## 5. Wave 2.4 — Authorization and RLS

| | |
|---|---|
| **Objective** | complete policy set for all new tables, new `tenant_permission` values, helper functions (document 29) |
| **Depends on** | Waves 2.1–2.3 schema |
| **Files** | one migration (policies/helpers only); SQL RLS suite |
| **Gates** | full authorization matrix (document 31 §3) incl. revoked and disabled actors, recursion checks; SPR2-RLS-26/27/28/29; PERF2-09 |
| **Exit** | **every matrix cell in document 29 §5 has a passing automated gate** |

**Determinism notes.**
- `profiles_select_association_policy` is extended by **one alternative** so `pending`,
  `former`/`deceased` and off-site-payer residents are visible to staff already holding
  `profiles:read_association` (RM-05). This **touches a certified object** — it is on the
  frozen list, and the **Sprint 1 profile-visibility regression must pass unchanged**
  before it is trusted (document 33 §5 item 3).
- Collector holds `residences:read_routes`, **not** `residences:read` (ARB-12). The gate
  reads `residence_members` **as the collector**.
- **SPR2-RLS-21 is scheduled early in this wave, not at the end** — it is the first
  production use of PostgREST column-level grants (`token_hash`) and the behavior is not
  yet confirmed (document 33 §6 answer 3). Discovering a surprise there late would
  invalidate downstream contract work.
- Every gate reads **the table as the actor** (RM-07).

**Stop condition.** No RPCs. That is Wave 2.4b.

---

## 6. Wave 2.4b — Mutation RPC layer

| | |
|---|---|
| **Objective** | the `SECURITY INVOKER` plpgsql RPCs performing every Sprint 2 mutation, with `log_audit_event()` in the same transaction |
| **Depends on** | Wave 2.4 — **policies must exist**: the RPCs rely on RLS for authorization, not on their own checks |
| **Files** | one migration (functions + `EXECUTE` grants only); RPC gates in `supabase/tests/sprint02_domain.sql` |
| **Gates** | atomicity (injected failure ⇒ zero domain rows **and** zero audit rows); catalog gates (`SET search_path=''`, no dynamic SQL, INVOKER not DEFINER); SPR2-GRANT-01; SPR2-RPC-01/02/03 |
| **Exit** | every mutation in document 30 has **exactly one** RPC; `authenticated` holds **no** INSERT/UPDATE/DELETE grant on any table |
| **Rollback** | drop the functions; no table was altered |

**Determinism notes.** 17 `INVOKER` RPCs + exactly 2 sanctioned `DEFINER`
(`accept_residence_invitation`, `tenant_audit_events`) — document 30 §1.1. A third
`DEFINER` is a scope change requiring authorization (document 36 §6).

**Known implementation-time determination.** The exact `format()` shape of RPC bodies and
the failure-injection technique for SPR2-RPC-03 are bounded and gated, not open
(document 33 §6 answer 3). Atomicity depends on a reliable failure-injection fixture —
build it first; a gate that cannot inject failure proves nothing.

**Stop condition.** No Edge Functions. That is Wave 2.5.

---

## 7. Wave 2.5 — Edge Function contracts

| | |
|---|---|
| **Objective** | the 24 endpoints of document 30, in 6 categories |
| **Depends on** | Wave 2.4b |
| **Files** | **new directories only** under `supabase/functions/`; `supabase/tests/sprint02_edge_function_*.mjs` |
| **Gates** | EF2-AUTH suite mirroring the Sprint 1 GoTrue harness; audit-event assertion per mutation |
| **Rollback** | delete new function directories; baseline functions untouched |

**Checkpoints:**

| | Endpoints |
|---|---|
| **2.5a** | association + resident (F-01…F-07, F-23) |
| **2.5b** | residence + household + payer (F-08…F-18, F-22) |
| **2.5c** | onboarding + audit (F-19…F-21, F-24) |

**Determinism notes.**
- Edge Functions are **transport and validation only**; each write endpoint issues
  **exactly one** RPC call (document 35 §2.3).
- **No confidentiality by projection.** F-08's collector projection is a structural
  permission split; F-09's household payer view is backed by an RLS conjunct (RM-05).
- Idempotency per document 35 §2.6: equivalent repeat ⇒ 200; conflicting repeat ⇒ 409;
  double delete ⇒ 200 no-op; duplicate invitation ⇒ `409 INVITATION_PENDING` with
  explicit `reissue`.
- Invitation tokens: ≥256-bit CSPRNG, SHA-256 stored, **short codes prohibited**;
  three-point expiry that never trusts a stale `pending`; tenant and residence binding
  always derived from the invitation row (RM-04).
- `meta.contractVersion`, unversioned paths (D-16).
- Sprint 1 functions are **not** modified.

**Standing acceptance.** Token delivery is out-of-band in Sprint 2 — possession proves
control of the invitation, not provably of the contact. This is accepted, disclosed
(27 §7 assumption 8), and removed by the Sprint 3 OTP flow. **Do not attempt to solve it
inside Sprint 2.**

**Stop condition.** No performance work. That is Wave 2.6.

---

## 8. Wave 2.6 — Validation and performance evidence

| | |
|---|---|
| **Objective** | performance seed + EXPLAIN gates at defined scale; full regression; evidence capture |
| **Depends on** | Wave 2.5 |
| **Files** | `supabase/tests/sprint02_performance_*.sql`; `validation/evidence/sprint02_*` |
| **Gates** | PERF2-01…PERF2-09; `supabase:test:all` extended with Sprint 2 suites |
| **Exit** | all gates green; evidence committed |

**Determinism notes.** Fixture scale and the full EXPLAIN / query-review / index-review
policy are fixed in document 35 §7 — including the requirement that PERF2-02 **compare
buffer counts against the certified composite-index plan** so the new partial indexes'
benefit is measured rather than asserted, and PERF2-09 compare policy plan shape before
and after the co-household clause removal.

**This is the first wave authorized to perform SQL optimization.** Waves 2.1–2.5 must not
pre-optimize; an index added without a gate showing the planner choosing it is
write-amplification with no reader (document 35 §7.3).

**Also this wave:** the CF-02 reversal condition is evaluated (document 36 §5). If
certification requires a pristine publication diff, the D2 teardown is added here.

**Stop condition.** No self-certification. That is Wave 2.7.

---

## 9. Wave 2.7 — Independent audit and certification

| | |
|---|---|
| **Objective** | dual independent audit + governance certification, replicating the certified Sprint 1 chain |
| **Depends on** | Wave 2.6 |
| **Files** | `docs/backend/` audit and certification reports **only** |
| **Entry** | all technical gates green; working tree clean; **no CRITICAL/HIGH finding open** |
| **Exit** | both auditors issue pure `AUDIT PASS`; certifier issues `SPRINT 2 PASS — RESIDENT DOMAIN CERTIFIED` |
| **Rollback** | certification withheld; findings route to remediation waves |

**Determinism notes.**
- **The tag is created only on explicit executive authorization.** Passing audit does not
  authorize tagging.
- The immutability proof runs against the **signed** frozen list (document 28 §12) — its
  evidentiary value depends entirely on that list not having been edited during
  implementation (document 36 §2).
- CF-05 auditor hook applies to every Sprint 2 document: uncited claim = MEDIUM; false
  claim a gate depends on = HIGH.
- The executor may not audit or certify their own work (document 36 §1).

---

## 10. Cross-wave invariants

True at the end of **every** wave, 2.1 through 2.7:

1. `npm run supabase:test:all` exits 0, with Sprint 1 suites unmodified.
2. `authenticated` holds zero INSERT/UPDATE/DELETE grants on any table.
3. No certified object differs from the baseline except signed frozen-list items.
4. Every structural change has a passing gate.
5. Certified evidence artifacts are byte-identical to their committed state.
6. `docs/backend/32` is unmodified.
7. No push, no merge, no tag.
8. The working tree contains nothing outside the wave's declared scope.

An invariant violation is a **stop condition**, not a finding to be noted and carried.

---

## 11. Roadmap verification record (CF-05)

| Claim | Source |
|---|---|
| Wave objectives, files, dependencies, entry/exit, rollback | document 27 §9, read directly |
| 2.4b placement and rationale | document 27 §9 (R1, new — D-12); document 33 §4 |
| 2.5a/b/c endpoint split | document 27 §9, quoted |
| 17 INVOKER + 2 DEFINER RPCs | document 30 §1.1, read directly |
| PERF2-02 comparative requirement; PERF2-08/09 | document 31 §5, read directly |
| SPR2-RLS-21 scheduled early | document 33 §6 answer 3 |
| Frozen list = 7 items, signed before 2.1 | document 33 §3 (ARB-13), §6 answer 5 |
| `tenant_permission` = 12 values | document 33 §4 |
| Tag only on executive authorization | document 27 §9 Wave 2.7 |
| Accepted residual on token delivery | document 33 §5 item 1 |

Every wave above has a declared stop condition. A wave that reaches its stop condition
and continues has left its authorization.
