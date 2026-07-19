# 18 — Sprint 1 Conditions Closure Report

> Backend Integration Program  
> Sprint 1 Conditions Closure — revalidated July 19, 2026 (OpenCode Go certification audit)

---

## 1. Repository State

| Field | Value |
|---|---|
| Branch | `sprint-01-foundation-identity` |
| Sprint 1 implementation | `ba599e6` |
| Certified D2 commit | `75993bd0d7b69aaa3641a7b43185c8c4862da8e3` |
| Push status | not pushed |
| Working tree policy | remediation and audit commits only; secrets excluded |

---

## 2. Original Conditions

From `docs/backend/17-sprint-01-foundation-identity-report.md`:

1. Executable Edge Function authorization tests
2. Package-manager reconciliation and clean typecheck
3. Realistic `EXPLAIN (ANALYZE, BUFFERS)` evidence

Prior closure commits (`4f30f8c`, `b89b149`, `f921724`, `1d097a3`) attempted closure. Independent re-execution found Edge Function authorization **not reproducible** (self-signed JWT rejected by `auth.getUser()`; D2 setup clobbered Sprint 1 schema). This report records the **re-executed** closure.

---

## 3. Condition 1 — Edge Function Authorization

### Inventory

| Function | Auth |
|---|---|
| `auth-bootstrap` | Bearer JWT via GoTrue |
| `auth-context` | Bearer JWT via GoTrue |
| `profile-get` | Bearer JWT via GoTrue |
| `profile-update` | Bearer JWT via GoTrue |
| `profile-contacts-list` | Bearer JWT via GoTrue |
| `profile-contact-upsert` | Bearer JWT via GoTrue |
| `profile-contact-delete` | Bearer JWT via GoTrue |
| `tenant-context-list` | Bearer JWT via GoTrue |
| `tenant-context-select` | Bearer JWT via GoTrue |
| `resident-auth` | Bearer JWT via GoTrue |

### Harness

- `supabase/tests/sprint01_edge_function_auth.test.mjs`
- Real local endpoint: `http://127.0.0.1:54331/functions/v1`
- Auth mode: **GoTrue password grant** (not self-signed JWT)
- Prerequisite: `supabase functions serve --no-verify-jwt` (gateway JWT skip; function still calls `getUser()`)
- Fixtures: `supabase/tests/sprint01_edge_function_fixtures.sql` (+ `auth.identities`)

### Results (re-executed)

```text
35/35 passed (0 failed)
authMode: gotrue-password-grant
```

| Category | Result |
|---|---|
| EF-01 Anonymous denied | PASS (10 functions, 401 UNAUTHENTICATED) |
| EF-02 Invalid/expired token | PASS |
| EF-03 Valid self access | PASS (6 endpoints, 200) |
| EF-04 Cross-profile denial | PASS (self-only + RLS count 0) |
| EF-05 Cross-tenant denial | PASS 403 |
| EF-06 Forged tenant context | PASS 403 |
| EF-07 Insufficient permission | PASS 403 |
| EF-08 Platform admin path | PASS (isPlatformAdmin true) |
| EF-09 Revoked membership | PASS (0 residences/tenants) |
| EF-10 Disabled user | PASS 404 |
| EF-11 Invalid input safe | PASS (422 / safe 5xx) |
| EF-12 Protected fields | PASS (full_name unchanged in DB) |
| EF-13 Verification spoofing | PASS (edge unverified + SQL trigger deny) |
| EF-14 Audit immutable | PASS (row created + update denied) |
| EF-15 Internal error safe | PASS |

Evidence: `validation/evidence/sprint01_edge_function_authorization.json`

### Minimal code fix included

`profile-contact-upsert` no longer uses `ON CONFLICT` against a **partial** unique index (which produced false 409). Select-then-insert/update preserves `verification_state='unverified'` hardcoding.

---

## 4. Condition 2 — Package Manager and Typecheck

| Field | Value |
|---|---|
| Canonical manager | npm |
| Validated version | 10.9.8 |
| `packageManager` | `"npm@10.9.8"` |
| Canonical lockfile | `package-lock.json` |
| Competing lockfiles | none (`pnpm-lock.yaml` / `pnpm-workspace.yaml` absent) |
| `auto-imports.d.ts` | gitignored generated artifact |

| Command | Exit |
|---|---|
| `npm ci` | 0 |
| `npm run typecheck` | 0 |
| `npm run build` | 0 |
| `npm run supabase:test:sprint1` | 0 |
| `npm run supabase:test:edge-func-auth` | 0 |
| `npm run supabase:test:d2` | 0 (after one RT-01 timing retry) |

---

## 5. Condition 3 — Performance Evidence

| Entity | Rows (re-seed) |
|---|---|
| tenants | 51 |
| properties | 502 |
| profiles | 3257 |
| tenant_members | 252 |
| residence_members | 3004 |
| profile_contacts | 8872 |
| audit_events | 10008 |

Seed: `supabase/tests/sprint01_performance_seed.sql` (~15s)  
EXPLAIN: `supabase/tests/sprint01_performance_explain.sql`  

All PERF-01…12 captured. Critical auth paths use indexes. PERF-02 and PERF-05 retain acceptable sequential scans at fixture scale.

Evidence:

- `validation/evidence/sprint01_identity_explain_evidence.md`
- `validation/evidence/sprint01_identity_explain_summary.json`

---

## 6. Regression

| Suite | Result |
|---|---|
| Sprint 1 SQL RLS (`supabase:test:sprint1`) | PASS |
| Edge Function authorization | 35/35 PASS |
| D2 (`supabase:test:d2`) | PASS (`failures: []`) after RT-01 retry |
| notifications Realtime | green in D2 evidence |
| support_messages Option B | green |
| ADR-10 / ADR-11 surface | green |

### D2 vs Sprint 1 schema ordering (explicit)

`validation/d2_setup.sql` **drops and recreates** foundation tables with the D2-shaped schema. It is **destructive** to the Sprint 1 migration schema.

Required sequence:

```text
1. npm run supabase:reset                 # Sprint 1 schema
2. npm run supabase:test:sprint1
3. supabase functions serve --no-verify-jwt
4. npm run supabase:test:edge-func-auth
5. npm run supabase:perf:seed && npm run supabase:perf:explain
6. npm run supabase:test:d2               # replaces schema with D2
7. npm run supabase:reset                 # restore Sprint 1 before further S1 work
```

Documented in `validation/run_d2_regression.sh` and `package.json` `supabase:test:all`.

---

## 7. Residual Non-Blocking Items

| Item | Class |
|---|---|
| RT-01 notification delivery timing flake (1st D2 run) | NON-BLOCKING (retry green; isolation tests green) |
| PERF-05 association scan at larger scale | DEFERRED monitor |
| EF-11 missing required fields may surface as 500 from uncaught `requireString` | LOW (safe envelope; no stack/SQL leak) |
| D2 setup remains destructive to Sprint 1 tables | OPERATIONAL (documented sequence; not isolation bypass) |

---

## 8. Conditions Status

| Condition | Status |
|---|---|
| Edge Function authorization | **CLOSED** |
| Package manager and typecheck | **CLOSED** |
| Performance evidence | **CLOSED** |

---

## 9. Closure Verdict (implementation conditions only)

```text
CONDITIONS CLOSED — AWAITING INDEPENDENT AUDITS (19/20) AND AGY CERTIFICATION (21)
```

OpenCode Go does not issue final Sprint 1 certification in this document. See:

- `docs/backend/19-sprint-01-opencode-go-technical-audit.md`
- `docs/backend/20-sprint-01-claude-independent-audit.md`
- `docs/backend/21-sprint-01-final-certification.md`
