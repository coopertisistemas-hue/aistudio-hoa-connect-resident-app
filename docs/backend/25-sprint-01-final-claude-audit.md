# 25 — Sprint 1 Final Claude Independent Certification Audit

> Backend Integration Program
> Phase 2 — independent verification, executed July 19, 2026
> Auditor: Claude (Opus 4.8), Claude Code CLI
> Scope: verify elimination of COND-OPS-01; Sprint 1 unchanged; D2 unchanged; no new risk

---

## 1. Mandate and Method

This audit is deliberately narrow. It does not reopen Sprint 1 architecture and does not redesign the hardening solution. It answers four questions only:

1. Is COND-OPS-01 genuinely closed?
2. Is Sprint 1 behavior unchanged?
3. Is D2 behavior unchanged?
4. Was any new relevant risk introduced?

**Method.** No implementation or validation code was modified. Verification combined static analysis of the diff with independent re-execution of the validation matrices. Phase 1's conclusions were treated as claims to be reproduced, not as evidence.

**Governance note.** The specified Phase 1 verifier (OpenCode Go) was unavailable — both `opencode` workspaces returned `Insufficient balance` and could execute nothing. With explicit user authorization, Phase 1 was performed by `agy` on Gemini 3.1 Pro (High), and report 24 was named `24-sprint-01-final-primary-technical-audit.md` to reflect the engine actually used. Separation of duties was preserved: a non-Anthropic engine performed Phase 1, Claude performed Phase 2.

---

## 2. Repository State

| Item | Value |
|---|---|
| Branch | `sprint-01-foundation-identity` |
| HEAD at audit start | `172af5922d57e6f9b03a637b9ea9e4c7f361b2ec` |
| Commits under audit | `ea7f842`, `976a388`, `172af59` |
| Working tree | clean (after relocating Phase 1 scratch artifacts and restoring a regenerated evidence file) |
| Push / merge / amend / tag | none performed |

---

## 3. Scope Integrity — CONFIRMED

`git diff --name-only d8adf20..HEAD` yields exactly eight files:

```text
docs/backend/23-validation-infrastructure-hardening-report.md
package.json
validation/adr09_adr10_runtime_probe.mjs
validation/adr09_adr10_sql_tests.sql
validation/adr09_realtime_authorization_diagnostic.mjs
validation/d2_setup.sql
validation/evidence/sprint01_edge_function_authorization.json
validation/run_d2_regression.sh
```

Zero files under `supabase/migrations/*`, `supabase/functions/*`, `supabase/tests/sprint01_*`, `supabase/seed.sql`, or `docs/backend/17-*`…`22-*`.

**Result: ZERO Sprint 1 functional changes.** Reports 17–22 are unchanged; the historical audit trail is intact.

The only `package.json` change removes `npm run supabase:reset` from the middle of `supabase:test:all`. This is the precise mechanical signature of COND-OPS-01 closure — the recovery reset is gone, not merely relocated.

---

## 4. COND-OPS-01 Closure — CONFIRMED CLOSED

### 4.1 Static proof

A strict negative search for any surviving un-prefixed `public.*` reference:

```bash
grep -nP "public\.(?!d2_)" validation/d2_setup.sql                        # 0 hits
grep -nP "public\.(?!d2_)" validation/adr09_adr10_sql_tests.sql           # 0 hits
grep -nP "public\.(?!d2_)" validation/adr09_adr10_runtime_probe.mjs       # 0 hits
grep -nP "public\.(?!d2_)" validation/adr09_realtime_authorization_diagnostic.mjs  # 1 hit (templated, see §7.5)
```

Every `DROP TABLE` in `validation/` targets a `d2_`-prefixed relation. All 11 tables, 11 functions, 13 indexes, the `REVOKE`/`GRANT` block, and both `ALTER PUBLICATION` statements are `d2_`-scoped. Sprint 1 table names appear in `validation/` only inside `validation/evidence/*.json`, which is recorded *output* from prior runs, not live code — correctly not a defect.

### 4.2 Structural proof (stronger than inspection)

Rather than eyeballing individual tables, I captured a full structural fingerprint of **every non-`d2_` object in `public`** — columns with defaults and nullability, RLS enabled/forced flags, all policies with `qual` and `with_check` expressions, all indexes, hashed function definitions, publication membership, role grants, and triggers — immediately before and immediately after the D2 suite, with no reset between.

```text
reset → sprint1 (exit 0) → FINGERPRINT_BEFORE (254 lines)
      → d2 suite (exit 0) → FINGERPRINT_AFTER  (256 lines)
```

The complete diff across the entire Sprint 1 surface:

```diff
 --PUBLICATION--
+public.d2_notifications
+public.d2_support_messages
```

**Nothing else changed.** No Sprint 1 column, default, RLS flag, policy expression, index, function body, grant, or trigger was altered by the D2 suite. The two added lines are D2 registering its own prefixed tables for Realtime — the intended behavior.

Re-fingerprinting after the *entire* official suite produced the identical two-line delta against baseline.

### 4.3 Behavioral proof — independent execution matrix

All matrices executed by me, exit codes recorded verbatim:

| Matrix | Sequence | Exit | Result |
|---|---|---|---|
| Baseline | `supabase db reset` | 0 | clean baseline |
| A | Sprint 1 SQL | 0 | PASS |
| B | D2 suite (`supabase:test:d2`) | 0 | PASS |
| C | Sprint 1 → D2 → **Sprint 1, no recovery reset** | 0 | PASS |
| D | → Edge Function authorization, no reset | 0 | PASS — 35/35 |
| E | Official `npm run supabase:test:all` | 0 | PASS |
| — | ADR-11 (`node validation/adr11_finance_compatibility.mjs`) | 0 | PASS — EC-01…EC-11, 11/11 |

Post-suite state: Sprint 1 tables present and populated (`profiles=7 tenants=2 properties=2 profile_contacts=5 residence_members=4 tenant_members=2 audit_events=6`), coexisting with 11 `d2_` tables.

**No manual recovery, no hidden reset, and no execution order was required at any point.** COND-OPS-01 is closed on both structural and behavioral evidence.

---

## 5. Realtime Warmup Assessment — DETERMINISTIC

`waitForRealtimeStreaming()` (`adr09_adr10_runtime_probe.mjs:189`):

- Inserts a **real probe row** and blocks on genuine delivery via `waitForEventCount` — it is not a fixed sleep.
- Bounded by a hard 150 s deadline.
- Throws explicitly on expiry; cannot silently pass without a Realtime event.
- Operates on `d2_notifications`, so no test data reaches any Sprint 1 object.

The 150 s bound is justified: `d2_setup.sql` re-adds tables to `supabase_realtime`, and the local `ReplicationPoller` re-checks publication membership on a ~60 s cycle, so the bound covers ~2.5 cycles. A slow host fails loudly rather than falsely passing.

### 5.1 False-positive hunt — both vacuous-pass paths are closed

I specifically attacked the two ways this suite could report green without proving anything:

**(a) Dead-channel denial passes.** `observeNoNewEvents` (line 175) asserts only `events.length === baselineCount`, which would pass trivially if a channel never subscribed. This is closed upstream: `subscribeToInserts` (lines 140–157) hard-awaits `SUBSCRIBED`, rejects on `CHANNEL_ERROR`/`TIMED_OUT` with a 7 s timeout, and adds a post-subscribe settle. Every denial channel is proven live before assertion.

**(b) `d2_support_messages` streaming inferred rather than proven.** The warmup directly proves only `d2_notifications`. However RT-04 is a *positive* delivery assertion on `d2_support_messages` (`rt04Snapshot.length !== 1` → recorded failure, line 345) and executes **before** the first support_messages denial test (rt05, line 363). Streaming is proven before it is relied upon.

Warmup rows cannot contaminate later assertions: the warmup channel is unsubscribed, and Realtime delivers only post-subscribe inserts, so rows written during warmup are never redelivered to subsequent channels. The D2 SQL assertions run before the probe, so no count-based assertion sees warmup rows.

---

## 6. Regression Verification

| Gate | Result | Basis |
|---|---|---|
| Sprint 1 SQL suite | PASS | executed, exit 0, before *and* after D2 with no reset |
| Edge Function authorization | PASS — 35/35, 0 failed | executed; evidence summary independently parsed |
| Package manager / `npm ci` | PASS | unchanged; no dependency edits in diff |
| Typecheck | PASS | no `src/` or config changes in diff; re-verified in Phase 1 |
| Build | PASS | as above |
| Performance | PASS | Sprint 1 indexes byte-identical in fingerprint; query paths unchanged |
| D2 regression | PASS | executed, exit 0 |
| ADR-09 | PASS | RT-01…RT-14 green on `d2_` tables |
| ADR-10 | PASS | enumeration resistance on `d2_profiles` |
| ADR-11 | PASS — 11/11 | executed independently by me (see §7.3) |
| Realtime notifications | PASS | RT-01…RT-03, RT-13, RT-14 |
| `support_messages` | PASS | RT-04…RT-12 |
| Execution-order independence | PASS | §4.2 fingerprint + §4.3 matrix |

---

## 7. Findings

No CRITICAL, HIGH, or MEDIUM findings. All findings below are LOW or OBSERVATION and none undermines determinism, security, isolation, or certification evidence.

### 7.1 LOW — Report 24's evidentiary basis is thinner than its conclusions

Report 24's conclusions are correct; I reproduced every one of them. But as written it has three defects:

- It states **"Status: Clean"**, which was **false at the time of authoring** — the run had left `validation/evidence/sprint01_edge_function_authorization.json` modified and an untracked `scratch/` directory in the repository root.
- It presents an exit-code table for Matrices A–E but **retained no execution transcripts**. Its `scratch/` directory contained only grep dumps. The matrix claims were therefore unsubstantiated by artifacts at the time of writing.
- It **omits ADR-11 entirely**, despite ADR-11 11/11 being an explicit item in the Phase 1 mandate and a named certification gate.

**Why non-blocking:** the underlying facts are sound. Phase 2 independently re-executed the full matrix with recorded exit codes, added a structural fingerprint proof stronger than Phase 1's `\d public.profiles` spot check, and executed ADR-11 (11/11 PASS). The evidentiary gap is closed by this report rather than left open.

### 7.2 LOW — Isolation convention not applied to cluster-scoped roles

`d2_setup.sql` creates four cluster-global roles **without** the `d2_` prefix: `profile_read_test`, `profile_self_update_test`, `operator_contact_test`, `platform_admin_test`. Roles are cluster-scoped, not schema-scoped, so they fall outside the prefix isolation guarantee and are never dropped.

Mitigating facts, all verified: creation is idempotent (`IF NOT EXISTS`); all four are `NOLOGIN` and cannot authenticate; `grep` confirms **no Sprint 1 migration references these names**, so there is no collision; and every table-level grant to them targets `d2_` relations only — they receive `USAGE` on `public`/`auth` and `EXECUTE auth.uid()`, but **no privilege on any Sprint 1 table**.

Impact is naming-convention completeness, not behavior or security.

### 7.3 LOW — ADR-11 is not wired into any automated suite

`validation/adr11_finance_compatibility.mjs` appears in neither `package.json` nor `run_d2_regression.sh`. The ADR-11 certification gate therefore depends on a manual invocation. I ran it directly: exit 0, cases EC-01…EC-11, 11/11 PASS.

Note this file is a **vite-based frontend compatibility test with zero database table references**, so it was correctly left untouched by the prefix hardening — its omission from the wave is not a defect. The gap is only that the gate is not automated.

### 7.4 LOW — `supabase_realtime` publication retains `d2_` entries after D2

The publication is a shared, database-global object. After a D2 run, `public.d2_notifications` and `public.d2_support_messages` remain registered until the next reset — the one persistent cross-suite side effect the fingerprint detected. It is idempotent (`d2_setup.sql` removes and re-adds membership each run), it removes no Sprint 1 entry, and Sprint 1 registers no tables in this publication at baseline, so there is no interference. Sprint 1 SQL and Edge Function authorization both pass with these entries present.

### 7.5 OBSERVATION — Unguarded table-name template in the manual diagnostic

`adr09_realtime_authorization_diagnostic.mjs:321` builds `ALTER TABLE public.${tableName} REPLICA IDENTITY ...` from a parameter. All four call sites (lines 375, 377, 477, 560) pass `d2_`-prefixed literals, so the behavior is correct today. The function itself carries no guard restricting `tableName` to validation objects. This script is a manual diagnostic outside the automated suite.

### 7.6 OBSERVATION — Scope clarity: `notifications` and `support_messages` are D2 constructs, not Sprint 1 tables

Sprint 1's migrated foundation is ten tables: `audit_events`, `platform_role_assignments`, `profile_contacts`, `profile_devices`, `profile_preferences`, `profiles`, `properties`, `residence_members`, `tenant_members`, `tenants`. `grep` over `supabase/migrations/` confirms **no migration creates `notifications` or `support_messages`.**

The "Realtime notifications" and "`support_messages`" certification gates therefore validate **forward-looking ADR-09/ADR-10 design** on D2 validation objects, not shipped Sprint 1 surface. This must not be misread as certifying production Realtime tables that do not yet exist.

Importantly, this is **not a fidelity regression introduced by the hardening wave.** Before the wave, `d2_setup.sql` dropped the real Sprint 1 tables and created D2-shaped tables that merely *reused* the names `notifications` and `support_messages`. The Realtime evidence was always produced against D2-shaped objects. The wave changed only the names, making the distinction honest rather than hiding it. Evidence fidelity is unchanged; transparency improved.

---

## 8. Hunt Checklist

| Target | Result |
|---|---|
| Accidental Sprint 1 changes | None — §3, and §4.2 fingerprint identical |
| Validation false positives | None — both vacuous-pass paths closed, §5.1 |
| Hidden destructive SQL | None — every `DROP` is `d2_`-scoped |
| Sprint 1 / `d2_` collisions | None — table, function, index, trigger, policy and role namespaces verified disjoint |
| Incorrect RLS on D2 tables | None observed — all 11 tables `ENABLE` + `FORCE` RLS, `REVOKE ALL` from `anon`/`authenticated` then selective grants (deny-by-default) |
| Realtime publication mistakes | None — publication touches `d2_` tables only; §7.4 records the residual |
| Warmup masking delivery failures | No — delivery-verified and fails explicitly, §5 |
| Test data contamination | None — Sprint 1 row counts consistent; warmup writes only to `d2_notifications` |
| Stale D2 object accumulation | Tables dropped/recreated each run; residual roles §7.2 and publication entries §7.4 |
| Documentation / implementation drift | §7.1 (report 24), §7.6 (scope framing) |
| Incomplete execution-matrix proof | §7.1 — remediated by independent re-execution |

---

## 9. Verdict

```text
CLAUDE AUDIT PASS WITH FINDINGS
```

Severity rollup: **CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 4 · OBSERVATION 2**

COND-OPS-01 is genuinely closed, proven structurally and behaviorally. Sprint 1 behavior is unchanged. D2 behavior is unchanged. No new MEDIUM or higher risk was introduced.

The verdict is `PASS WITH FINDINGS` rather than a pure `PASS` for one reason: report 24 asserted a clean working tree that was not clean, retained no execution transcripts, and omitted a mandated certification gate (ADR-11). Those are defects in the Phase 1 audit artifact, not in the implementation, and Phase 2 has closed each of them with independent executable evidence. I record them rather than absorb them silently so that Phase 3 can weigh them explicitly under the certification policy.

Recommendation to Phase 3: findings 7.1–7.6 are **non-blocking**. None affects determinism, security, isolation, or the integrity of the certification evidence now on record.

No implementation code was modified during this audit.
