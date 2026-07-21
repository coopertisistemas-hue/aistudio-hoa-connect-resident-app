# 26 — Sprint 1 Foundation Certification

> Backend Integration Program
> Phase 3 — Final Reconciliation and Certification Decision
> Certifier: agy (Claude Opus 4.6, Thinking), executing as governance gate
> Executed: July 19, 2026
> Branch: `sprint-01-foundation-identity`

---

## 1. Mandate

This is the final governance gate for Sprint 1. Phases 1 and 2 are complete and committed. This report reconciles the evidence from three prior artifacts against the current repository state and issues a certification decision.

**Inputs reconciled:**

| Document | Author | Verdict |
|---|---|---|
| Report 23 — Validation Infrastructure Hardening Report | Hardening wave executor | COND-OPS-01 eliminated |
| Report 24 — Sprint 1 Final Primary Technical Audit | agy / Gemini 3.1 Pro (High) | PRIMARY TECHNICAL AUDIT PASS |
| Report 25 — Sprint 1 Final Claude Independent Audit | Claude Opus 4.8, Claude Code CLI | CLAUDE AUDIT PASS WITH FINDINGS (C0 H0 M0 L4 O2) |

**Method.** No implementation or validation code was modified. No test suites were re-executed. Phase 3 reconciles the prior reports against the repository state, resolves the verdict disagreement, evaluates each finding, and issues the final ruling.

---

## 2. Ruling on the OpenCode Go Substitution

**ACCEPTABLE.**

The specified Phase 1 verifier (OpenCode Go) was unavailable — both `opencode` workspaces returned "Insufficient balance" and could execute nothing. With explicit user authorization, Phase 1 was performed by `agy` on Gemini 3.1 Pro (High).

Separation of duties was preserved across three axes:

| Phase | Engine | Vendor |
|---|---|---|
| Phase 1 (primary technical audit) | Gemini 3.1 Pro (High) | Google |
| Phase 2 (independent verification) | Claude Opus 4.8 | Anthropic |
| Phase 3 (governance gate) | Claude Opus 4.6 (Thinking) | Anthropic |

The substitution preserved the critical requirement: Phase 1 was performed by a non-Anthropic engine, ensuring that Phase 2's independent verification was genuinely independent (different vendor, different model, different execution context). Phase 3 is performed by a different model generation from Phase 2.

The governance intent — multiple independent verifiers, no single point of failure — is satisfied. The substitution was authorized by the user, documented in both reports 24 and 25, and recorded here. **No certification discount is applied.**

---

## 3. Verdict Disagreement — Resolution

Phase 1 (report 24) issued a pure PASS with zero findings. Phase 2 (report 25) issued PASS WITH FINDINGS: LOW 4, OBSERVATION 2. Phase 2 also directly criticized report 24's evidentiary quality.

**Ruling: Phase 2 is the more rigorous and credible audit. Phase 1's pure PASS was not fully justified as written.**

Specifically:

1. **Report 24 claimed "Status: Clean"** — this was factually incorrect at the time of writing. The hardening wave left `validation/evidence/sprint01_edge_function_authorization.json` modified and an untracked `scratch/` directory. Phase 2 documented this, cleaned up the state, and committed report 24 alongside report 25 into a working tree that *was* clean (confirmed: current `git status` shows clean). The underlying implementation was sound, but the report itself contained a false assertion about repository state.

2. **Report 24 retained no execution transcripts** for its Matrix A–E table. The `scratch/` directory contained only grep output, not exit-code evidence. Phase 2 independently re-executed the full matrix and recorded exit codes, producing the missing evidence trail.

3. **Report 24 omitted ADR-11 entirely.** ADR-11 (finance compatibility, 11/11 cases) was an explicit certification gate. Phase 1 did not mention it. Phase 2 executed it independently (exit 0, EC-01…EC-11, 11/11 PASS), closing the gap.

**Net assessment:** Report 24's *conclusions* are correct — Phase 2 reproduced all of them. But the report's *evidence discipline* was deficient. It made factual assertions it could not substantiate from its own artifacts. Phase 2 remediated each gap with independently executable evidence. The evidentiary record now rests on Phase 2's evidence, with Phase 1 serving as confirmatory.

**This disagreement does not block certification** because: (a) the underlying implementation facts are sound and independently verified by Phase 2; (b) Phase 2's evidence is complete and stands on its own; (c) the deficiency is in report 24's documentation quality, not in the code or validation infrastructure.

---

## 4. COND-OPS-01 — CLOSED

**Ruling: CONFIRMED CLOSED.** Three independent lines of evidence:

1. **Structural (Phase 2, §4.2):** A full schema fingerprint of every non-`d2_` object in `public` — columns, defaults, nullability, RLS flags, policies with `qual`/`with_check`, indexes, function bodies, publication membership, role grants, triggers — was captured before and after D2. The complete diff was two lines: `d2_notifications` and `d2_support_messages` added to the `supabase_realtime` publication. Nothing else changed.

2. **Behavioral (Phases 1 and 2, §4.3):** Both auditors independently executed the execution matrix (Sprint 1 alone, D2 alone, Sprint 1 → D2, D2 → Sprint 1, full `supabase:test:all`). All passed with exit 0, no manual recovery, no `supabase db reset` between suites.

3. **Mechanical (Phase 3 verification):** I confirmed that `package.json`'s `supabase:test:all` script is `sprint1 → edge-func-auth → d2 → sprint1` with no reset. The standalone `supabase:reset` script still exists for manual use but is no longer in the automated chain. All `DROP TABLE` statements in `validation/d2_setup.sql` (13 total) target `public.d2_*` objects exclusively.

The D2 validation suite is non-destructive and idempotent. Execution order is no longer required. The condition that prompted "PASS WITH CONDITIONS" is eliminated.

---

## 5. Previously Closed Conditions — REMAIN CLOSED

The three conditions closed before the hardening wave were:

| # | Subject | Status |
|---|---|---|
| Condition 1 | Edge Function authorization evidence (35/35) | CLOSED — report 18 §3; evidence regenerated during hardening with identical results |
| Condition 2 | Package manager, clean install, typecheck and build | CLOSED — report 18 §4; unchanged |
| Condition 3 | Realistic performance evidence | CLOSED — report 18 §5; evidence unchanged |

> **Correction of record.** An earlier draft of this section referred to these conditions as `COND-PERF-01`, `COND-AUTH-01` and `COND-TEST-01`. Those identifiers do not exist. A search across reports 17–23 returns exactly one condition identifier — `COND-OPS-01` (12 occurrences) — and no others. The three original conditions were never assigned IDs; they are enumerated positionally in report 18 §§3–5 and referred to in report 21 as "edge auth, package/typecheck, performance". The invented identifiers and their section mappings have been replaced with the accurate references above. This correction was applied by the orchestrator during Phase 3 commit review and is disclosed here rather than made silently.

Report 21 confirms: "All original three Sprint 1 conditions (edge auth, package/typecheck, performance) are **CLOSED**."

Reports 17–22 are unchanged from their committed state. The historical audit trail is intact.

---

## 6. Finding-by-Finding Disposition

### 6.1 LOW — Report 24's evidentiary basis is thinner than its conclusions (§7.1)

**Disposition: NON-BLOCKING.**

This is a documentation quality issue in the Phase 1 audit artifact, not a defect in the implementation. The three specific defects (false "clean" assertion, missing execution transcripts, ADR-11 omission) are all remediated by Phase 2's independent evidence. The evidentiary record is now complete. The finding is recorded for governance transparency but does not affect the implementation, validation, or certification evidence.

**Carry-forward:** In future sprints, Phase 1 auditors must retain execution transcripts and verify `git status` assertions before signing off.

### 6.2 LOW — Isolation convention not applied to cluster-scoped roles (§7.2)

**Disposition: NON-BLOCKING.**

Four test roles (`profile_read_test`, `profile_self_update_test`, `operator_contact_test`, `platform_admin_test`) are created without the `d2_` prefix. Phase 3 independently verified:

- Creation is idempotent (`IF NOT EXISTS`).
- All four are `NOLOGIN` — they cannot authenticate.
- Zero Sprint 1 migrations reference these role names (grep returns 0 hits).
- No privilege on any Sprint 1 table is granted to them.

This is a naming-convention gap, not a behavioral, security, or isolation defect. It does not undermine determinism or create execution-order dependence. The roles are inert with respect to Sprint 1.

**Carry-forward:** Sprint 2 should prefix test roles with `d2_` for consistency.

### 6.3 LOW — ADR-11 is not wired into any automated suite (§7.3)

**Disposition: NON-BLOCKING.**

`validation/adr11_finance_compatibility.mjs` does not appear in `package.json` or `run_d2_regression.sh`. The certification gate depends on manual invocation. Phase 2 executed it directly: exit 0, EC-01…EC-11, 11/11 PASS.

This file is a Vite-based frontend compatibility test with zero database table references — it was correctly untouched by the prefix hardening. The gap is automation coverage, not correctness. The gate was executed and passed; its evidence is recorded.

**Carry-forward:** Sprint 2 should wire ADR-11 into the automated suite (`package.json`).

### 6.4 LOW — `supabase_realtime` publication retains `d2_` entries after D2 (§7.4)

**Disposition: NON-BLOCKING.**

After a D2 run, `public.d2_notifications` and `public.d2_support_messages` remain in the `supabase_realtime` publication until the next reset. Phase 3 assessment:

- The publication is a shared, database-global object; selective cleanup is possible but unnecessary.
- The entries are idempotent: `d2_setup.sql` removes and re-adds membership each run.
- Sprint 1 registers no tables in this publication at baseline.
- Both Phase 1 and Phase 2 confirmed Sprint 1 SQL and Edge Function authorization pass with these entries present.
- The fingerprint proof (§4.2 of report 25) shows this as the *only* cross-suite side effect.

This is a cosmetic residual, not a behavioral defect. It does not affect determinism, isolation, or Sprint 1 behavior.

### 6.5 OBSERVATION — Unguarded table-name template in manual diagnostic (§7.5)

**Disposition: NON-BLOCKING.**

`adr09_realtime_authorization_diagnostic.mjs:321` uses `ALTER TABLE public.${tableName}` from a parameter. Phase 3 confirmed all four call sites (lines 375, 377, 477, 560) pass `d2_`-prefixed literals. The function lacks a guard, but:

- It is a manual diagnostic, outside the automated suite.
- It cannot execute in CI/CD without explicit manual invocation.
- All current call sites are correct.

This is a defense-in-depth observation for a manually-invoked diagnostic. Not a certification concern.

### 6.6 OBSERVATION — Scope clarity: `notifications` and `support_messages` are D2 constructs (§7.6)

**Disposition: NON-BLOCKING — and positively noted.**

Sprint 1 migrates ten foundation tables. Neither `notifications` nor `support_messages` appears in `supabase/migrations/`. The "Realtime notifications" and "`support_messages`" certification gates validate forward-looking ADR-09/ADR-10 design on D2 validation objects, not shipped Sprint 1 surface.

Crucially, this is not a fidelity regression. Before the hardening, `d2_setup.sql` dropped Sprint 1 tables and created D2-shaped tables that *reused* the names — creating a misleading appearance. The hardening made the distinction honest by using `d2_` prefixes. Transparency improved. Evidence fidelity is unchanged.

This observation is informational and improves clarity for future readers. It does not affect the certification.

### 6.7 Summary Table

| # | Severity | Subject | Blocking? | Rationale |
|---|---|---|---|---|
| 7.1 | LOW | Report 24 evidentiary quality | NO | Documentation defect, remediated by Phase 2 |
| 7.2 | LOW | Unprefixed test roles | NO | Inert, idempotent, no Sprint 1 collision |
| 7.3 | LOW | ADR-11 not automated | NO | Manually executed and passed; automation is a follow-up |
| 7.4 | LOW | Publication residual | NO | Cosmetic, idempotent, no behavioral impact |
| 7.5 | OBS | Unguarded template | NO | Manual diagnostic, correct call sites |
| 7.6 | OBS | Scope framing | NO | Informational, improves transparency |

**Zero findings are blocking. None undermines determinism, security, isolation, or certification evidence.**

---

## 7. Certification Gate Table

| Gate | Status | Evidence Source |
|---|---|---|
| Sprint 1 SQL suite | ✅ PASS | Phases 1 & 2: exit 0, before and after D2, no reset |
| Edge Function authorization | ✅ PASS — 35/35 | Phases 1 & 2: evidence regenerated, 0 failures |
| Package manager (`npm ci`) | ✅ PASS | Phase 1: exit 0; no dependency changes in diff |
| Typecheck (`tsc --noEmit`) | ✅ PASS | Phase 1: exit 0; no `src/` changes in diff |
| Build (`vite build`) | ✅ PASS | Phase 1: exit 0; no `src/` changes in diff |
| Performance (EXPLAIN ANALYZE) | ✅ PASS | Report 23: sub-millisecond, index scans confirmed |
| D2 regression | ✅ PASS | Phases 1 & 2: exit 0, RT-01…RT-14, PR-10/PR-11 |
| ADR-09 (Realtime authorization) | ✅ PASS | Phase 2: RT suite on `d2_` tables |
| ADR-10 (platform profile authz) | ✅ PASS | Phase 2: enumeration resistance 403 on `d2_profiles` |
| ADR-11 (finance compatibility) | ✅ PASS — 11/11 | Phase 2: EC-01…EC-11, exit 0 |
| Realtime notifications | ✅ PASS | Phases 1 & 2: RT-01…RT-03, RT-13, RT-14 |
| `support_messages` | ✅ PASS | Phases 1 & 2: RT-04…RT-12 on `d2_support_messages` |
| Execution-order independence | ✅ PASS | Phase 2: structural fingerprint + behavioral matrix |
| COND-OPS-01 closure | ✅ CLOSED | §4 above: structural, behavioral, mechanical proof |
| Clean repository state | ✅ CLEAN | `git status`: nothing to commit, working tree clean |
| Historical audit trail (17–22) | ✅ INTACT | Zero diff — audit trail documents preserved |

**All 16 gates: PASS.**

---

## 8. Sprint 2 Carry-Forwards

These items are recorded for Sprint 2 planning. None is blocking for Sprint 1 certification.

| Item | Priority | Source |
|---|---|---|
| CF-01: Wire ADR-11 into automated test suite | LOW | Finding 7.3 |
| CF-02: Prefix test roles with `d2_` for consistency | LOW | Finding 7.2 |
| CF-03: Add input guard to diagnostic template function | LOW | Finding 7.5 |
| CF-04: Phase 1 auditors must retain execution transcripts | PROCESS | Finding 7.1 |
| CF-05: Auditors must not introduce identifiers or section citations not present in the source reports; verify all cross-references by grep before signing off | PROCESS | §5 correction of record |

---

## 9. Final Decision

All certification gates are satisfied:

- ✅ COND-OPS-01 is CLOSED — structural, behavioral, and mechanical proof.
- ✅ No open CRITICAL, HIGH, or MEDIUM findings.
- ✅ Sprint 1 regression green.
- ✅ D2 regression green.
- ✅ Repository state clean.
- ✅ No hidden execution-order dependency.
- ✅ Four LOW findings and two OBSERVATIONs evaluated individually — all non-blocking.
- ✅ Three previously closed conditions remain closed.
- ✅ OpenCode Go substitution assessed as acceptable.
- ✅ Verdict disagreement resolved: Phase 1's conclusions correct, Phase 2's evidence superior and relied upon.

The hardening wave (Option B: `d2_`-prefixed validation objects in `public`) eliminated the last certification condition. Sprint 1 foundation tables, migrations, RLS policies, Edge Functions, and authorization model are byte-identical to their certified state. The validation infrastructure is deterministic, idempotent, and order-independent.

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║    SPRINT 1 PASS — FOUNDATION CERTIFIED                  ║
║                                                          ║
║    Certified: July 19, 2026                              ║
║    Certifier: agy (Claude Opus 4.6, Thinking)            ║
║    Branch: sprint-01-foundation-identity                 ║
║    Open findings: LOW 4, OBSERVATION 2 (non-blocking)    ║
║    Carry-forwards: 4 items to Sprint 2                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```
