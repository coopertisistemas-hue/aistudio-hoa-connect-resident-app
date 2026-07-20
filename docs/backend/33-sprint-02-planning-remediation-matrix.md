# 33 — Sprint 2 Planning Remediation Matrix

**Type:** Traceability record for the Executive Review resolution wave
**Status:** REMEDIATION COMPLETE — implementation still not authorized
**Date:** 2026-07-20
**Baseline:** HEAD `1e6e4bb118fb3338f278f72a61dcdb5448dd3a3a`, branch
`sprint-01-foundation-identity`, Sprint 1 certified at
`a58a1ed98b0e5299678a41be833729895b31f101`
(tag `hoa-connect-sprint-01-foundation-certified-v1.0.0`)

**Source of conditions:** `32-sprint-02-executive-decision-review.md`, which returned
`EXECUTIVE REVIEW APPROVED WITH CONDITIONS`. Document 32 is **immutable review evidence
and was not modified by this wave.**

**Documents updated:** 27, 28, 29, 30, 31 (revision R1). **Created:** this document.
**No code, migration, Edge Function, test, validation artifact or commit was produced.**

---

## 1. Numbering reconciliation (read first)

Three numbering schemes are in play. Conflating them is itself a CF-05 risk, so they are
mapped explicitly and used consistently below.

| Scheme | Origin | Meaning here |
|---|---|---|
| `ARB-01…ARB-30` | document 32 §4 | the **findings** of the Executive Review |
| `RC-01…RC-41` | document 32 §10 | the **required changes** the review derived from those findings |
| `RM-01…RM-11` | the remediation brief | the **remediation directives** given to this wave |

The brief's `RC-01…RC-11` are renamed `RM-01…RM-11` throughout this document, because
document 32 already defines `RC-01…RC-41` with different content. Mapping:

| Brief directive | This document | Document 32 equivalent |
|---|---|---|
| RC-01 RPC SECURITY INVOKER | RM-01 | RC-01 (ARB-02) |
| RC-02 Atomic mutations | RM-02 | RC-01 (ARB-02) |
| RC-03 Composite foreign keys | RM-03 | RC-10 (ARB-10) |
| RC-04 Invitation model | RM-04 | RC-05/06/07/16 (ARB-03/04/05) |
| RC-05 Staff listing contracts | RM-05 | RC-04 (ARB-07) |
| RC-06 Grant model | RM-06 | RC-02 (ARB-01) |
| RC-07 Data minimization | RM-07 | RC-03/15 (ARB-06) |
| RC-08 Close deferred decisions | RM-08 | RC-27 (ARB-25) |
| RC-09 Residence member indexes | RM-09 | RC-14 (ARB-14) |
| RC-10 PERF2-02 | RM-10 | RC-14 (ARB-14) |
| RC-11 CF-05 expansion | RM-11 | recommendation 7 of document 32 §13 |

**Coverage note.** The eleven brief directives address 12 of the review's 30 findings.
The remaining 18 findings are **not** out of scope — document 32 §10 lists them as
required changes, and the brief's objective is "resolve every condition identified
during Executive Decision Review". All 30 therefore appear exactly once in §3.

---

## 2. Remediation directives (RM-01 … RM-11)

| Directive | Affected documents | Resolution | Remaining risk |
|---|---|---|---|
| **RM-01** RPC `SECURITY INVOKER` as the standard mutation mechanism | 27 (D-12, §2.2, §9 Wave 2.4b), 29 (§2 r12, §4), 30 (§1.1), 31 (SPR2-RPC-01/02) | Canonical layer stack documented with per-layer responsibilities and prohibitions (30 §1.1). Every mutation flow based on independent PostgREST writes removed; RPC inventory of 17 INVOKER + 2 sanctioned DEFINER functions enumerated. New Wave 2.4b builds and gates the RPC layer before any Edge Function exists | plpgsql surface is larger than thin HTTP handlers (R-21): `search_path`, exception handling, dynamic SQL. Mitigated by catalog gates; **residual LOW** |
| **RM-02** Atomic mutations | 27 (D-12, R-22), 30 (§1.1, §5, F-07/F-17/F-20), 31 (SPR2-RPC-03, SPR2-AUDIT-03) | Rule stated: mutation + audit + history + relationship updates share one transaction; Edge Functions orchestrate, RPCs mutate. Atomicity became a **fail-closed gate** (injected failure ⇒ zero domain rows **and** zero audit rows) rather than a claim | none structural. Gate depends on a reliable failure-injection fixture; **residual LOW** |
| **RM-03** Composite foreign keys | 27 (D-13, R-23), 28 (§6.2–6.9, §12), 31 (SPR2-FK-01) | `(property_id, tenant_id) → properties(id, tenant_id)` and `(resident_id, tenant_id) → residents(id, tenant_id)` on every Sprint 2 child table, plus additively on `residence_members`. Parent indexes documented (`UNIQUE (id, tenant_id)` on `properties` and `residents`). Rationale: the FK rejects the write regardless of Edge Function behavior, RLS correctness or any future direct-SQL path — the check cannot be disabled without a migration. Also makes payer-is-resident structural, closing a deferred decision | `properties` gains a certified-object change (frozen list item 2). Validation scan cost is nil on empty tables; **residual LOW** |
| **RM-04** Invitation model | 27 (D-11, §7 a6/a8/a9), 28 (§6.5 rewritten, §6.6 new), 30 (F-19/F-20/F-21), 31 (EF2-F19/F-20) | Full re-specification: token lifecycle and entropy (≥256-bit CSPRNG, SHA-256, short codes prohibited); five-state model with terminal-state trigger; duplicate handling with `409 INVITATION_PENDING` + explicit `reissue`; three-point expiry that never trusts a stale `pending`; complete acceptance case table incl. user-exists / user-does-not-exist / contact-absent / contact-unverified / contact-owned-by-another; tenant and residence binding always derived from the invitation row; trust model replaced with token-as-proof-of-contact; `invitation_accept_attempts` + `invitation.accept_failed` as the throttle substrate | **out-of-band token delivery** (no notification transport in Sprint 2): possession proves control of the invitation, not provably of the contact. Disclosed in 27 §7 assumption 8; removed by the Sprint 3 OTP flow. **Residual MEDIUM, accepted** |
| **RM-05** Staff listing contracts | 28 (§12 item 3), 29 (§6.7), 30 (F-03, F-04, F-08, F-09), 31 (SPR2-RLS-29) | Every endpoint promising names, profile or household data was re-checked against the policies that must supply them. `profiles_select_association_policy` extended by one alternative so `pending`, `former`/`deceased` and off-site-payer residents are visible to staff who already hold `profiles:read_association`. F-08 collector projection replaced by a structural permission split. F-09 household payer view backed by an RLS conjunct | the `profiles` policy change touches a certified object; gated by the Sprint 1 profile-visibility regression. **Residual LOW-MEDIUM until that gate runs** |
| **RM-06** Grant model | 27 (§2.2 g3), 29 (§2 r12, §6.1–6.5 grant lines), 30 (F-10), 31 (SPR2-GRANT-01/02) | Certified guarantee #3 preserved **and extended**: zero INSERT/UPDATE/DELETE grants to `authenticated` on any table, certified or new. `EXECUTE ON FUNCTION` documented as the write-permission boundary. The `properties` INSERT grant previously planned in doc 30 F-10 is withdrawn. Guarantee is now machine-checkable (SPR2-GRANT-01) rather than a prose commitment | none. This is strictly stronger than the certified baseline |
| **RM-07** Data minimization | 27 (D-14, R-24), 28 (§6.1, §6.2, §6.7, §6.8), 29 (§2 r13, §5, §6.2, §6.4, §8), 30 (F-01, F-09), 31 (SPR2-RLS-26/27/28) | Assumption that Edge Functions enforce minimization removed and replaced by a rule: if an actor must not see a field, that actor must be unable to select it. Three violations fixed structurally — `association_settings_private` and `resident_staff_notes` table separation; payer history behind a policy conjunct; co-household clause deleted from the `residents` policy. Document 29 §8 is a complete map of data → mechanism (RLS / secure view / RPC read surface / column grant / no grant). Gates now read **the table as the actor**, never an EF response | unlinked `household_members` duplicates remain heuristic (31 §9). **Residual LOW, disclosed** |
| **RM-08** Close deferred decisions | 27 (§13a), 28 (§8.1, §6.3, §6.9), 29 (§6.3), 30 (F-12, F-16, F-20), 31 (§2) | All twelve closed with rationale, each APPROVED: CHECK expression; occupancy view (none — derived in read RPCs); resident re-entry `former → pending`; closed-row immutability trigger ships; payer-resident enforcement structural; strict household read predicate; move-out request gains queryable state; idempotency constraint-based; primary conflict ⇒ 409; double delete ⇒ 200 no-op; rate-limit substrate; fixture UUID block. Five further items are recorded as **explicitly accepted debt** with named future owners (D-15), which is a decision, not a deferral | none open. Accepted debt is disclosed, not hidden |
| **RM-09** Residence member indexes | 28 (§5.4), 31 (PERF2-02) | Every statement calling `idx_residence_members_*` partial corrected. The indexes are plain composite B-tree on `(profile_id, status)` / `(property_id, status)` (`…foundation_identity.sql:214-215`); the `_active` suffix describes intent. Performance argument rebuilt: a composite index on `(x, status)` does serve `status='active'` seeks, but closed rows still occupy index pages, so Sprint 2 **adds** true partial indexes rather than relying on a false claim | none. Correction verified by citation |
| **RM-10** PERF2-02 | 31 (§5) | Gate rewritten to assert the **new** partial indexes are chosen, no seq scan at fixture scale, and buffer counts compared against the certified composite plan so the benefit is measured. PERF2-08 (`q` search) and PERF2-09 (policy plan after clause removal) added for paths that had no gate | local-stack timings, not production benchmarks — same caveat as Sprint 1. **Residual LOW, disclosed** |
| **RM-11** CF-05 expansion | 27 (§14.1), 28 (§13), 29 (§9), 30 (§6), 31 (§7.1) | Discipline extended from reports to **all** package documents, with six rules: scope, file:line citation requirement, prohibited uncited phrasings, runtime claims treated as baseline claims, a per-document verification record, and an auditor hook (uncited claim = MEDIUM, false claim a gate depends on = HIGH). Documents 28–31 each carry a verification record | the rule constrains authors, not reviewers; enforcement depends on the auditor hook actually being exercised. **Residual LOW** |

---

## 3. Executive Review findings (ARB-01 … ARB-30) — each exactly once

| Finding | Class | Affected documents | Resolution | Remaining risk |
|---|---|---|---|---|
| **ARB-01** write grants contradict certified guarantee #3 | CRITICAL | 27, 29, 30, 31 | RM-06: zero table write grants; `EXECUTE` is the boundary; SPR2-GRANT-01 | none |
| **ARB-02** multi-step atomicity unachievable via PostgREST | CRITICAL | 27, 29, 30, 31 | RM-01/RM-02: INVOKER RPCs, one transaction, atomicity gate | LOW (plpgsql surface, R-21) |
| **ARB-03** invitation accept unreachable (verified contact required, no verification path) | CRITICAL | 27, 28, 30 | RM-04: token-as-proof-of-contact; contact created/verified on accept | MEDIUM (out-of-band delivery), accepted |
| **ARB-04** lost/expired invitation cannot be reissued | CRITICAL | 28, 30 | RM-04: expire-then-mint, `409 INVITATION_PENDING`, explicit `reissue`, `superseded_by` | none |
| **ARB-05** rate limiting has no substrate | CRITICAL | 28, 30, 31 | RM-04: `invitation_accept_attempts` + `invitation.accept_failed`; threshold specified | none |
| **ARB-06** EF-layer projections over row-readable data | CRITICAL | 27, 28, 29, 30, 31 | RM-07: table separation, policy conjunct, clause removal; §8 map; actor-level gates | LOW |
| **ARB-07** profile visibility gap breaks staff lists | CRITICAL | 28, 29, 30, 31 | RM-05: `profiles_select_association_policy` extended by one alternative | LOW-MEDIUM until regression gate runs |
| **ARB-08** partial unique drops the pending guarantee | HIGH | 27, 28 | `WHERE status IN ('active','pending')` | none |
| **ARB-09** one-primary index is cross-tenant | HIGH | 27, 28 | scoped to `(tenant_id, profile_id)` | none |
| **ARB-10** tenant coherence procedural, not structural | HIGH | 27, 28, 31 | RM-03: composite FKs + parent uniques | LOW |
| **ARB-11** no temporal overlap constraint; nullable `start_date` | HIGH | 28, 31 | EXCLUDE constraints on payers and memberships (`btree_gist`); SPR2-HIST-05/06 | legacy rows with NULL `start_date` exempted by the `WHERE` clause — by design |
| **ARB-12** collector inherits `residences:read` | HIGH | 27, 28, 29, 30, 31 | new `residences:read_routes`; collector removed from `residences:read`; gate reads `residence_members` as collector | none |
| **ARB-13** doc 28 §12 "complete list" incomplete | HIGH | 28, 30, 31 | list rebuilt (7 items), declared **frozen**, sign-off required before Wave 2.1; additions need executive authorization, not an edit | governance risk if the freeze is not honored — called out in §5 |
| **ARB-14** indexes wrongly described as partial | HIGH | 28, 31 | RM-09/RM-10 | none |
| **ARB-15** `revoked_at` vs `end_date`/`end_reason` duplication | MEDIUM | 27, 28 | authoritative rule table (28 §5.2): `end_date` business date, `revoked_at` audit timestamp, never used for business queries | none |
| **ARB-16** invariant 5 false; invariant 6 not checkable | MEDIUM | 28 | invariant 5 restated ("of a platform user"); invariant 6 made checkable via `linked_profile_id` partial unique; invariant table now names each enforcement mechanism | unlinked rows heuristic (LOW, disclosed) |
| **ARB-17** no household → platform user promotion path | MEDIUM | 28, 30 | `linked_profile_id` + `household_member_promote()` RPC + audit action; procedure specified | none |
| **ARB-18** revoked-history matrix cell contradicts §6.6 | MEDIUM | 29 | resolved in favor of the policy; matrix corrected; rationale recorded | none |
| **ARB-19** `client_request_id` idempotency unimplementable | MEDIUM | 30 | field removed; constraint-based idempotency only | clients must retry on natural keys — documented |
| **ARB-20** idempotent 200 masks operator error | MEDIUM | 30 | 200 only on payload equivalence; otherwise 409 (`UNIT_IDENTIFIER_CONFLICT`) | none |
| **ARB-21** payer `end_reason` free text vs enum | MEDIUM | 28 | single shared `residence_membership_end_reason` enum; `replaced` added | none |
| **ARB-22** reusable `registration_code` breaks history | MEDIUM | 28 | code non-reusable within a tenant; never cleared on `former`/`deceased` | none |
| **ARB-23** `audit_events` growth undecided | MEDIUM | 27, 28 | partitioning key **chosen** (monthly RANGE on `created_at`, `tenant_id` leading in indexes), recorded as a forward constraint; implementation Sprint 3/4 (D-15) | table grows unpartitioned through Sprint 2 — acceptable at this volume |
| **ARB-24** decision-ID divergence | MEDIUM | 27, 33 | doc 27 numbering canonical; brief taxonomy mapped in 32 §3.1; this document's §1 reconciles all three schemes | none |
| **ARB-25** ~12 deferred decisions | MEDIUM | 27, 28, 29, 30, 31 | RM-08: all closed (§13a) | none open |
| **ARB-26** GoTrue self-signup posture undefined | MEDIUM | 27, 28 | assumption 9: invitations gate residency, not account creation; `auth-bootstrap` 404 already models the accountless state | open signup is a product posture, disclosed |
| **ARB-27** F-22 has no queryable state | MEDIUM | 28, 30 | `requested_end_date` + `moveout_requested_at` columns; staff query normally | none |
| **ARB-28** household hard delete conflicts with historical integrity | LOW | 28, 30 | hard DELETE removed; terminal transition instead; no DELETE grant | none |
| **ARB-29** minors' data retention gap | LOW | 27 | disclosed in assumption 9; owned by the future ADR-10 erasure workflow | LGPD exposure disclosed, unresolved by design |
| **ARB-30** `platform_support` has no tooling | OBSERVATION | 29 | unchanged — zero tenant access is the correct conservative posture; observational tooling remains a future module | none |

### 3.1 Document-32 required changes not separately listed above

`RC-31` (platform rate-limit mechanism) is satisfied by RM-04's per-endpoint substrate;
a platform-wide mechanism is not required for Sprint 2's single throttled endpoint.
`RC-30` (API versioning) is closed by D-16 (`meta.contractVersion`, unversioned paths,
named decision point before the first mobile client). `RC-32`–`RC-36` are folded into
the D-06, D-07 and RM-05 rows. `RC-37`–`RC-41` are folded into ARB-28, ARB-29, D-05
irreversibility, SPR2-RLS-21 early scheduling and the Wave 2.5 split respectively.

---

## 4. Consistency pass

Checked across documents 27–31 after all edits.

| Dimension | Result |
|---|---|
| **Terminology** | "residence" = `properties` row; "resident" = `residents` row; "household" = memberships + `household_members`; "payer" = `residence_payers`. Consistent. "Occupancy" is always derived, never stored |
| **Table names** | 27/28/29/30/31 agree on the 8 new tables: `association_details`, `association_settings_private`, `residents`, `resident_staff_notes`, `household_members`, `residence_payers`, `residence_invitations`, `invitation_accept_attempts` |
| **Enums** | 6 new + 2 extensions. `tenant_permission` extension is **12** values (11 original + `residences:read_routes`); stated identically in 28 §7 and 29 §3. `residence_membership_end_reason` has 8 values incl. `replaced`, shared by memberships and payers — no second closure vocabulary remains |
| **Role names** | `association_admin`, `association_operator`, `association_finance`, `association_support`, `association_viewer`, `association_collector`. Collector definition fixed in 28 §7.1 and referenced by 29 §2 r4 |
| **Actor matrix** | 29 §5 corrected in three cells (revoked history, co-household `residents`, collector `residence_members`) and extended with three new tables. No cell now contradicts a §6 policy |
| **Edge Function contracts** | 24 endpoints unchanged in number. Every mutating endpoint names its RPC; the 30 §1.1 inventory (17 INVOKER + 2 DEFINER) covers every mutation in the 30 §2 inventory |
| **Validation plan** | Every R1 structural change has a gate: SPR2-GRANT-01/02, SPR2-RPC-01/02/03, SPR2-FK-01, SPR2-HIST-05/06, SPR2-RLS-26/27/28/29, PERF2-08/09. Acceptance criteria extended to 14 |
| **Implementation waves** | 2.0 → 2.1 → 2.2 → 2.3 → 2.4 → **2.4b (new)** → 2.5a/b/c → 2.6 → 2.7. Wave 2.4b precedes 2.5 because the RPC layer must be gated before contracts consume it |
| **Carry-forwards** | CF-01…CF-05 dispositions unchanged. CF-05 expanded in scope (RM-11), not redefined |
| **Contradictions found in the R1 pass** | None. The 15 contradictions listed in document 32 §7.1 were each traced to their resolution row above |

---

## 5. Remaining risks requiring executive attention

None blocks Wave 2.0. Four items are the executive's to carry, not the executor's.

1. **Out-of-band invitation token delivery (MEDIUM, accepted).** Sprint 2 has no
   notification transport, so tokens are relayed by staff. Onboarding security depends
   partly on staff behavior outside the system. Removed by the Sprint 3 OTP flow.
   The executive is accepting a disclosed residual, not an unknown.
2. **The frozen list must actually stay frozen (GOVERNANCE).** Document 28 §12 is the
   sole approved set for the Wave 2.7 immutability proof. Its value depends entirely on
   additions requiring executive authorization rather than a document edit during
   implementation. This is the one condition this wave cannot enforce by itself.
3. **The `profiles` policy extension touches a certified object (LOW-MEDIUM).** It is
   the minimum change that makes the resident domain usable, it widens an existing
   predicate by one alternative, and it grants no access to any actor who did not
   already hold `profiles:read_association`. It nonetheless requires the Sprint 1
   profile-visibility regression to pass unchanged before it is trusted.
4. **Accepted debt with named owners (D-15).** Permission-matrix refactor, audit
   partitioning, OTP verification, LGPD erasure, CF-04 role renaming. Each is a decision
   to defer with a named future owner, not an open question — but each will eventually
   need executive scheduling.

Two further items are disclosed rather than open: local-stack performance evidence is
not a production benchmark (Sprint 1 precedent), and D-05 becomes irreversible from the
first persistent environment onward (27 §13 D-05, Wave 2.3 report requirement).

---

## 6. Final validation

**1. Are all Executive Review conditions incorporated?**
Yes. All 30 findings (ARB-01…ARB-30) appear exactly once in §3, each with its resolution
and affected documents. The eleven brief directives (RM-01…RM-11) are resolved in §2.
Document 32's `RC-01…RC-41` are covered either directly or through §3.1.

**2. Does any deferred architectural decision remain?**
No. All twelve are closed in document 27 §13a, each APPROVED with rationale. Five items
are recorded as **accepted debt** with named future owners (D-15) — a decision to defer
implementation, with the architectural choice already made (for example, the audit
partitioning *key* is chosen even though partitioning is not built).

**3. Is any implementation ambiguity left?**
None that would change an architectural outcome. Three implementation-time
determinations remain, each bounded and gated: the exact `format()` shape of RPC bodies;
the failure-injection technique for SPR2-RPC-03; and whether PostgREST column-level
grants behave as expected for `token_hash` — its first production use, which is why
SPR2-RLS-21 is scheduled early in Wave 2.4 rather than at the end.

**4. Does the planning package preserve Sprint 1 certification guarantees?**
Yes, and it strengthens two. Guarantee #3 moves from prose to machine-checkable and now
covers new tables too (zero write grants anywhere). Certified helpers, triggers, policies
and Edge Functions are untouched except for the four changes in the frozen list, of which
one (`profiles` policy) is new in R1 and disclosed rather than discovered later. All 16
gates of report 26 remain in the regression path unmodified.

**5. Can Wave 2.0 begin immediately after executive authorization?**
Yes, subject to one sequencing condition already in the plan: the frozen list (28 §12)
must be signed off before Wave 2.1 — not before 2.0. Wave 2.0 is baseline verification
plus CF-01 integration and has no dependency on any R1 change.

---

## 7. Source control statement

| Item | Value |
|---|---|
| Initial HEAD | `1e6e4bb118fb3338f278f72a61dcdb5448dd3a3a` |
| Final HEAD | `1e6e4bb118fb3338f278f72a61dcdb5448dd3a3a` (unchanged) |
| Commits created | none |
| Push / merge / tag | none |
| Modified (uncommitted) | `docs/backend/27…31` |
| Created (untracked) | `docs/backend/33-sprint-02-planning-remediation-matrix.md` |
| Unmodified | `docs/backend/32-…` (immutable review evidence), all code, migrations, Edge Functions, tests, validation |

```
SPRINT 2 PLANNING FULLY REMEDIATED — READY FOR IMPLEMENTATION AUTHORIZATION
```
