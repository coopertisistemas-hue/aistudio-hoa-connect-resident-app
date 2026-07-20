# 36 — Wave 2.0 Governance Checklist

**Type:** Binding governance rules and per-wave gates for Sprint 2
**Wave:** 2.0
**Status:** FROZEN — binding on waves 2.1 … 2.7
**Date:** 2026-07-20

**Purpose.** Document 35 fixes *how* code is written. This document fixes *who may
authorize what, and what must be true before and after each wave*. It is the checklist an
auditor runs against a completed wave.

---

## 1. Authority model

Sprint 2 reuses the certified Sprint 1 governance model without modification
(document 27 §10).

| Role | May | May never |
|---|---|---|
| **Executor** | implement waves 2.0–2.6 within declared scope; produce evidence | authorize scope changes; certify own work; push, merge or tag |
| **Primary technical auditor** | execute the full gate suite independently | implement fixes |
| **Independent auditor** | second, independent audit | rely on the executor's transcripts |
| **Certifier** | issue the Sprint 2 verdict | waive a failing gate |
| **Executive** | authorize waves, scope changes, frozen-list additions, tags | — |

**The executor cannot authorize the executor.** Every decision below that says
"requires executive authorization" is void if made inside an implementation wave.

---

## 2. Blocking condition before Wave 2.1

> **The frozen list of certified-object changes (document 28 §12, 7 items) must be
> signed off by the executive before Wave 2.1 begins.**

Source: document 33 §6 answer 5 — "the frozen list (28 §12) must be signed off before
Wave 2.1 — not before 2.0." Wave 2.0 has no dependency on it and is therefore complete
without it.

This is the one condition the planning package explicitly states it **cannot enforce by
itself** (document 33 §5 item 2, GOVERNANCE risk). Its entire value depends on additions
requiring executive authorization rather than a document edit during implementation.

**Rule.** Any change to a certified object that is not on the signed list halts the wave.
The remedy is executive authorization recorded in a numbered document — **never** an edit
to document 28 §12 by the implementing wave.

**Sign-off record** (completed by the executive before Wave 2.1):

| Item | Signed | Date | By |
|---|---|---|---|
| Frozen list, document 28 §12 (1. Resident model, 2. Residence model, 3. Association Details, 4. Household model, 5. Invitation lifecycle, 6. Mutation architecture, 7. Authorization boundary) | ☑ | 2026-07-20 | Executive |

*Executive Decision:* Approved and frozen. Future changes to any frozen item require explicit Executive Review.

---

## 3. Universal per-wave gates

Every wave 2.1 … 2.7 satisfies all of these. No exceptions, no partial credit.

### Entry

- [ ] Previous wave's exit criteria met and evidenced in a numbered document
- [ ] Explicit executive authorization for **this** wave
- [ ] Working tree clean
- [ ] Frozen-list sign-off in force (§2)
- [ ] No open CRITICAL or HIGH finding

### Exit

- [ ] Wave-specific gates green (document 37)
- [ ] **Full regression green**: `npm run supabase:test:all` exit 0 — Sprint 1 suites
      unmodified, including the ADR-11 and namespace-guard steps added in Wave 2.0
- [ ] `npm run typecheck` exit 0 · `npm run build` exit 0
- [ ] Every structural change has a passing gate
- [ ] Certified evidence artifacts unmodified (document 35 §6.1)
- [ ] New evidence committed under `validation/evidence/sprint02_*`
- [ ] Wave report published with a CF-05 verification record
- [ ] `git diff` reviewed against declared scope — no out-of-scope file touched
- [ ] No push, no merge, no tag

### Standing prohibitions

- [ ] No certified object modified outside the frozen list
- [ ] No `DEFINER` RPC beyond the two sanctioned (document 30 §1.1)
- [ ] No `INSERT`/`UPDATE`/`DELETE` grant to `authenticated` on any table (RM-06)
- [ ] No Edge Function writes through PostgREST (RM-01)
- [ ] No confidentiality enforced by response projection (RM-07)
- [ ] Document 32 unmodified
- [ ] No published document edited to correct a claim — supersede instead

---

## 4. Certification chain (Wave 2.7)

Per document 27 §10, replicating the certified Sprint 1 chain:

1. Executor implements 2.0–2.6 with per-wave evidence.
2. Primary technical auditor, independent of the executor, executes the full gate suite.
3. Independent auditor performs a second audit.
4. Certifier issues the verdict.

**Exit conditions.** Both auditors issue a pure `AUDIT PASS`; the certifier issues
`SPRINT 2 PASS — RESIDENT DOMAIN CERTIFIED`. **The tag is created only on explicit
executive authorization** — passing audit does not authorize tagging.

**On failure:** certification is withheld and findings route to remediation waves. A
failing gate is never waived.

---

## 5. Carry-forward governance status

| CF | Status after Wave 2.0 | Owner | Next action |
|---|---|---|---|
| **CF-01** ADR-11 canonical integration | **CLOSED** — in `supabase:test:all`, verified | — | none |
| **CF-02** D2 publication cleanup | **CLOSED as NO-OP**, evidence-backed | Wave 2.6 *if* reversed | see reversal condition below |
| **CF-03** `d2_` namespace guard | **CLOSED** — implemented and negative-tested | — | guard runs every suite |
| **CF-04** Test-role rename | **OPEN, DEFERRED, GATED** | Sprint 3 D2 suite revision (D-15) | execute rename; then update the guard's expected set |
| **CF-05** Documentation verification | **ACTIVE, PERMANENT** | every wave | applies to every document until Sprint 2 closes |

**CF-02 reversal condition (named, testable).** If Wave 2.6 or 2.7 certification requires
a pristine `pg_publication_tables` diff, cleanup becomes a Wave 2.6 item, implemented as
a teardown step inside the D2 suite — never as a manual operation. Absent that
requirement, the residue stays: it is bounded, idempotent
(`validation/d2_setup.sql:730-749`), local-only, touches no product table, and is erased
by `supabase db reset`.

**CF-04 note.** The guard freezes the role set at exactly four. When CF-04 executes, the
guard's expected set must be updated **in the same change** — otherwise the rename fails
the suite. This coupling is intentional: it makes the deferred work visible at the moment
someone touches it.

---

## 6. Scope-change protocol

If a wave discovers that its declared scope is insufficient:

1. **Stop.** Do not widen scope to finish.
2. Record the gap in the wave report with evidence.
3. Route it to the executive as an authorization request.
4. Resume only on explicit authorization.

Rationale: every CRITICAL finding in the Executive Review (ARB-01 … ARB-07) was an
architectural gap that would have been *cheaper* to surface than to implement around.
A wave that quietly absorbs a gap destroys the traceability the certification chain
depends on.

---

## 7. Risk register carried into Wave 2.1

| # | Risk | Severity | Owner | Status |
|---|---|---|---|---|
| 1 | Frozen list not honored during implementation | GOVERNANCE | Executive | Mitigated by §2 sign-off; **not eliminable by the executor** |
| 2 | Out-of-band invitation token delivery | MEDIUM, accepted | Executive | Disclosed (27 §7 assumption 8); removed by Sprint 3 OTP |
| 3 | `profiles` policy extension touches a certified object | LOW-MEDIUM | Wave 2.4 | Requires Sprint 1 profile-visibility regression to pass unchanged |
| 4 | plpgsql surface larger than thin handlers (R-21) | LOW | Wave 2.4b | Catalog gates: `search_path`, no dynamic SQL, INVOKER not DEFINER |
| 5 | Unlinked `household_members` duplicates remain heuristic | LOW | Wave 2.3 | Disclosed (31 §9) |
| 6 | Local-stack evidence is not a production benchmark | LOW | Wave 2.6 | Disclosed; document 35 §7.1 rule 5 |
| 7 | `audit_events` unpartitioned through Sprint 2 | LOW | Sprint 3/4 (D-15) | Key decided (ARB-23); acceptable at this volume |
| 8 | CF-04 roles unprefixed | LOW | Sprint 3 | Now gated against drift |
| 9 | D-05 irreversibility from first persistent environment | INFORMATIONAL | Wave 2.3 | Must be recorded in the Wave 2.3 report |
| 10 | Minors' data retention / LGPD erasure gap | Disclosed | Future ADR-10 | Unresolved by design (ARB-29) |

No risk in this register blocks Wave 2.1 except #1, which blocks it procedurally until
the sign-off in §2 is recorded.

---

## 8. Wave 2.0 governance self-assessment

| Requirement | Status |
|---|---|
| Sprint 1 certification preserved | **YES** — tree-wide diff, document 34 §2.2; suite re-run green §2.3 |
| Planning package preserved | **YES** — documents 27–33 unmodified; 32 untouched |
| Executive Review incorporated | **YES** — via documents 32 → 33; conventions in 35 trace to RM-01…RM-11 |
| Remediation incorporated | **YES** — RM dispositions carried into §§2–7 of document 35 |
| Repository ready for Wave 2.1 | **YES** — §2 sign-off recorded |
| No business implementation | **YES** — no migration, SQL object, Edge Function, frontend or business test |
| No push / merge / tag | **YES** |
| Out-of-scope work performed | **NONE** |
