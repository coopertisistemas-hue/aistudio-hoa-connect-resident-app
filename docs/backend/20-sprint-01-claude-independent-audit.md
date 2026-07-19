# 20 — Sprint 1 Claude Independent Audit

> Role: Independent auditor (read-only)  
> Date: July 19, 2026  
> Implementation files: **not modified**  
> Scope: code, migrations, RLS, helpers, Edge Functions, tests, evidence, package manager, perf, D2, OpenCode Go report, Git state

---

## 1. Method

- Reviewed Sprint 1 migration, RLS policies, SECURITY DEFINER helpers, grants, FORCE RLS.
- Reviewed Edge Function shared auth and all Sprint 1 function entrypoints.
- Reviewed edge authorization harness and machine-readable evidence.
- Reviewed package-manager state and OpenCode Go command claims against repo artifacts.
- Reviewed EXPLAIN summary and D2 destructive-setup interaction.
- Executed read-only SQL probes on the restored Sprint 1 schema (post-reset).

No implementation changes were made in this role.

---

## 2. Severity Summary

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 3 |
| OBSERVATION | 3 |

---

## 3. Findings

### C-01 — D2 setup replaces Sprint 1 schema (MEDIUM)

**Evidence:** `validation/d2_setup.sql` drops `tenants`/`profiles`/… and recreates D2-shaped tables. OpenCode Go confirmed edge tests fail if run after D2 without reset.

**Risk:** False confidence if suites are interleaved without restore; not a runtime tenant-isolation bypass by itself.

**Disposition:** Documented sequence + `supabase:test:all` restore path. Acceptable for certification **only** with operational discipline.

**Blocking:** No (with documented sequence).

---

### C-02 — `adminClient` constructed but unused in Sprint 1 functions (LOW)

**Evidence:** `supabase/functions/_shared/auth.ts` always builds service-role client; no Sprint 1 function references `adminClient` for data access. Resident paths use `authClient` (user JWT).

**Risk:** Future misuse of service role could mask RLS. Present code does not demonstrate service-role masking of resident authorization.

**Blocking:** No.

---

### C-03 — EF-11 validation may return non-envelope 500 (LOW)

**Evidence:** `requireString` throws; edge runtime may return non-JSON/PARSE_ERROR. Harness accepts safe 4xx/5xx without stack/SQL leak.

**Risk:** UX/consistency only; not an authorization bypass.

**Blocking:** No.

---

### C-04 — RT-01 notification delivery flake (LOW)

**Evidence:** First D2 run failed RT-01; retry `failures: []`. Isolation cases RT-04…14 green on success run.

**Blocking:** No.

---

### C-05 — Prior premature CERTIFIED documentation (OBSERVATION)

**Evidence:** `1d097a3` / earlier report 17§13 claimed CERTIFIED before independent audits and while edge harness was non-reproducible.

**Disposition:** Corrected by report 18 rewrite and this audit chain.

**Blocking:** No (corrected).

---

### C-06 — Report 17 original text said “no SECURITY DEFINER” (OBSERVATION)

**Evidence:** Migration uses multiple SECURITY DEFINER helpers with `SET search_path = ''`. All definer functions inspected have search_path pinned. FORCE RLS enabled on foundation tables. Grants to `authenticated` are narrow; `audit_events` has no grants to `authenticated` (writes via definer `log_audit_event` only).

**Disposition:** Implementation is safer than the older doc sentence; not an unsafe definer pattern.

**Blocking:** No.

---

### C-07 — Association operator can list multiple tenant-linked profiles (OBSERVATION)

**Evidence:** Operator JWT sees >1 profile under association read policy (expected ADR-10 staff path). Not cross-tenant: operator limited to linked tenant count = 1 in probe.

**Blocking:** No.

---

## 4. Hunt Checklist Results

| Threat | Result |
|---|---|
| Cross-tenant leakage | Denied at EF select + RLS probes |
| Profile enumeration (resident) | Blocked (self policy + RLS count 0) |
| Privilege escalation (full_name) | Trigger + edge ignore |
| Forged tenant context | 403 at tenant-context-select |
| Revoked-user bypass | Empty context |
| Disabled-user bypass | 404 / no active profile |
| Unsafe SECURITY DEFINER | search_path pinned; intentional |
| Unsafe search_path | Not observed on definers |
| Broad grants | No anon table grants; audit not granted to authenticated |
| RLS recursion | Helpers are definer; policies call helpers — standard pattern, no infinite recursion observed in tests |
| Service-role masking | Not used on resident data paths |
| False-positive tests | Prior harness was; remediated to GoTrue + DB assertions |
| Unsafe error exposure | Safe envelopes on denied paths |
| Audit manipulation | Immutability trigger |
| Lockfile ambiguity | npm only |
| Incomplete typecheck | Full app `tsc` exit 0 |
| Cherry-picked performance plans | 12 paths re-seeded and re-explained |
| Undocumented impl differences | D2 vs S1 schema dual-model documented |

---

## 5. Agreement with OpenCode Go

| Topic | Claude position |
|---|---|
| Edge auth executable and green | Agree (35/35, GoTrue) |
| Package manager / typecheck / build | Agree |
| Performance evidence realistic | Agree |
| D2 green with RT-01 flake note | Agree |
| Residual MEDIUM = D2 destructive setup | Agree |
| No CRITICAL/HIGH security bypass remaining | Agree |
| Go verdict PASS WITH FINDINGS | Agree |

No material disagreement requiring reconciliation against certification blockers.

---

## 6. Verdict

```text
CLAUDE AUDIT PASS WITH FINDINGS
```

Findings are MEDIUM/LOW/OBSERVATION only. No CRITICAL or HIGH remains. Independent review supports elevating Sprint 1 foundation usability to certification **if** Agy accepts the documented D2/Sprint 1 run sequence as a non-blocking operational control.
