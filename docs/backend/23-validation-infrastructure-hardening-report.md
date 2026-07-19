# 23 — Validation Infrastructure Hardening Report

> Backend Integration Program  
> Validation Infrastructure Hardening — executed July 19, 2026  
> Scope: elimination of COND-OPS-01 (D2 validation suite destroyed the Sprint 1 schema, imposing a mandatory execution order and a `supabase db reset` between suites)

---

## 1. Architecture Decision

Executive approval selected:

```text
OPTION B
Validation tables with d2_ prefix inside the existing public schema.
```

The decision keeps one database, one schema, one PostgREST configuration, one Realtime server, one RLS model, and isolates only validation objects. No production entity was renamed and no production-oriented code became aware of the `d2_` convention. The prefix exists solely for validation infrastructure.

Sprint 1 remains the reference implementation and was not modified: migrations, RLS, Edge Functions, authorization model, PostgREST configuration, Realtime server configuration and Supabase configuration are byte-identical to the certified state.

---

## 2. Rejected Alternatives

### Option A — Separate database

Rejected. Realtime publications are database-scoped; a second database would require additional infrastructure and would move this wave beyond validation hardening. Outside the approved scope.

### Option C — Dedicated schema

Technically valid, but introduces schema-aware SDK calls, `search_path` management, additional configuration and future maintenance burden, with no measurable benefit over Option B for the current objective.

---

## 3. Approved Solution

Option B satisfies the governing principle of the program:

```text
Solve the smallest problem with the smallest safe change.
```

The D2 validation suite became an isolated consumer of dedicated `d2_`-prefixed validation tables, functions and indexes inside `public`. D2 setup is now non-destructive and idempotent: it drops and recreates only `d2_`-prefixed objects, so any suite can run in any order with no `supabase db reset` before or after.

---

## 4. Implementation Summary

| File | Change |
|---|---|
| `validation/d2_setup.sql` | All tables, functions and indexes renamed with the `d2_` prefix (`d2_tenants`, `d2_profiles`, `d2_support_messages`, `d2_notifications`, `d2_create_support_message()`, etc.). Drop list restricted to `d2_` objects. Publication membership re-established for `public.d2_notifications` and `public.d2_support_messages` only. Sprint 1 objects are never dropped, altered or recreated. |
| `validation/adr09_adr10_sql_tests.sql` | Privilege, RLS, policy and ownership projections repointed to `d2_` objects. |
| `validation/adr09_adr10_runtime_probe.mjs` | Realtime subscriptions and inserts repointed to `d2_notifications` / `d2_support_messages`. Added `waitForRealtimeStreaming()`: a bounded warmup (150 s deadline, delivery-verified) executed after setup, because the local Realtime `ReplicationPoller` only re-checks publication membership on a ~60 s cycle after `d2_setup.sql` re-adds the tables; without the warmup, RT-01 could race that reload (observed in the first execution of this wave). |
| `validation/adr09_realtime_authorization_diagnostic.mjs` | Diagnostic references repointed to `d2_` objects. |
| `validation/run_d2_regression.sh` | Destructive-order warning replaced by the isolation note; execution steps unchanged. |
| `package.json` | `supabase:test:all` no longer contains `supabase db reset`; the chain is now `sprint1 → edge-func-auth → d2 → sprint1` with no reset. |
| `validation/evidence/sprint01_edge_function_authorization.json` | Regenerated during the complete-suite run: 35/35 passed. |

No file under `supabase/migrations`, `supabase/functions`, `src` or `public` was touched.

---

## 5. Validation Matrix

All executions on the local Supabase CLI stack, no manual reset, no destructive cleanup, no undocumented execution order.

| Execution | Result |
|---|---|
| Sprint 1 alone | PASS |
| D2 alone (setup + ADR-09/ADR-10 SQL + runtime probe) | PASS — `failures: []`, executed twice |
| Sprint 1 → D2 | PASS |
| D2 → Sprint 1 | PASS |
| Complete suite `supabase:test:all` (Sprint 1 → Edge Function authorization → D2 → Sprint 1) | PASS — exit 0 on the full `&&` chain |

Realtime probe coverage inside D2: RT-01…RT-14 (authorized delivery, cross-tenant denial, unrelated-user denial, foreign-request denial, guessed-request filter, payload hygiene, single logical event, ordering, revoked participant, concurrent tenants, reconnect) plus PR-10/PR-11 API-surface checks — all passing against the `d2_` tables.

---

## 6. Regression Summary

| Check | Result |
|---|---|
| Sprint 1 SQL suite | PASS (before and after D2, no reset) |
| Edge Function authorization | PASS — 35/35 (`gotrue-password-grant`), evidence regenerated |
| Package manager | unchanged — `npm@10.9.8`, no dependency changes |
| Typecheck (`tsc --noEmit`) | PASS |
| Build (`vite build`) | PASS |
| Performance evidence (`EXPLAIN (ANALYZE, BUFFERS)`) | PASS — index scans on Sprint 1 tables, sub-millisecond executions, equivalent to certified evidence |
| D2 regression | PASS |
| ADR-09 (Realtime authorization) | PASS — RT suite on `d2_notifications` / `d2_support_messages` |
| ADR-10 (platform profile authorization) | PASS — enumeration resistance 403 on `d2_profiles` |
| ADR-11 (finance compatibility) | PASS — 11/11 compatibility cases |
| Realtime notifications | PASS — RT-01…RT-03, RT-13, RT-14 |
| `support_messages` | PASS — RT-04…RT-12 on `d2_support_messages`; Sprint 1 `public.support_messages` untouched |

Reports 17 through 22 are unchanged; the historical audit trail is intact.

---

## 7. Remaining Risks

- **Realtime reload cycle (LOW).** After `d2_setup.sql` re-adds the `d2_` tables to `supabase_realtime`, the local `ReplicationPoller` restarts replication only on its next ~60 s tick. The probe absorbs this with a bounded, delivery-verified warmup (150 s). On an extremely slow host the warmup fails fast with an explicit error — it cannot produce a false pass.
- **Namespace convention (LOW).** `d2_` objects live in `public`. If a future production entity ever adopts the `d2_` prefix, the validation drop list would collide with it. The convention is validation-only and documented here and in `run_d2_regression.sh`.
- **Diagnostic script coverage (LOW).** `adr09_realtime_authorization_diagnostic.mjs` was repointed to `d2_` objects but remains a manual diagnostic, outside the automated suite.

No new MEDIUM, HIGH or CRITICAL findings were introduced.

---

## 8. Outcome

- COND-OPS-01 is eliminated: the D2 suite no longer drops or recreates Sprint 1 foundation objects.
- Sprint 1 behavior is unchanged; D2 behavior is unchanged.
- Validation order is no longer required; the validation infrastructure is deterministic and idempotent.

The repository is ready for the final lightweight certification audit (OpenCode Go → Claude → Agy), scoped to verifying the elimination of COND-OPS-01, the continued validity of previous evidence, and the absence of regressions. No additional product work was performed in this wave.
