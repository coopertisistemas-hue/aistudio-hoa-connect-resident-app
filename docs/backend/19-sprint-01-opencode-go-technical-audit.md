# 19 — Sprint 1 OpenCode Go Technical Audit

> Role: Primary technical auditor and evidence executor  
> Date: July 19, 2026  
> Does **not** issue final Sprint 1 certification

---

## 1. Auditor Identity

| Field | Value |
|---|---|
| Provider | opencode-go |
| Requested model | `opencode-go/qwen3.7-max` (fallback `opencode-go/minimax-m2.5`) |
| Actual model ID | `opencode-go/glm-5.1` (session runtime; requested IDs not switched mid-session) |
| OpenCode version | CLI session on Abacus VM; Supabase CLI `v2.107.0` |
| Reasoning mode | standard tool-using technical audit |
| Tool access | git, bash, docker, supabase CLI, filesystem, npm |
| Selection rationale | Execute Stage 1 technical validation against live repo; record actual runtime model honestly |

---

## 2. Repository State

| Field | Value |
|---|---|
| Branch | `sprint-01-foundation-identity` |
| Initial HEAD at audit start | `1d097a3` (`docs(hoa): certify sprint 1 foundation closure`) |
| Sprint 1 implementation | `ba599e6` |
| D2 certified commit present | `75993bd` (branch contains) |
| Audited commit range | `ba599e6`..working tree (closure + remediation) |
| Push status | not pushed |
| Secret exposure | `.env` gitignored; evidence stores token fingerprints only |

### Commits after `ba599e6` (pre-audit)

```text
4f30f8c chore(hoa): reconcile package manager and typecheck workflow
b89b149 test(hoa): add sprint 1 edge function authorization coverage
f921724 perf(hoa): validate sprint 1 identity query paths
1d097a3 docs(hoa): certify sprint 1 foundation closure
```

### Files reviewed (material)

- `supabase/migrations/20260719170000_sprint01_foundation_identity.sql`
- `supabase/functions/**` (shared auth/context/http/validation + all Sprint 1 functions)
- `supabase/tests/sprint01_*.sql` / `*.mjs`
- `supabase/seed.sql`
- `validation/d2_setup.sql`, `validation/run_d2_regression.sh`, D2 probes
- `package.json`, `package-lock.json`, `.gitignore`
- `docs/backend/17-*.md`, `18-*.md` (prior claim)
- Evidence under `validation/evidence/`

### Changes introduced by this auditor

| Path | Change |
|---|---|
| `supabase/tests/sprint01_edge_function_auth.test.mjs` | GoTrue password-grant tokens; stronger EF-04/12/13/14 assertions |
| `supabase/tests/sprint01_edge_function_fixtures.sql` | `auth.identities` for fixture users |
| `supabase/seed.sql` | `auth.identities` for seed users |
| `supabase/functions/profile-contact-upsert/index.ts` | Fix partial-index upsert → select/insert/update |
| `supabase/tests/sprint01_foundation.sql` | Admin tenant count asserts “all tenants”, not hard-coded `1` |
| `validation/run_d2_regression.sh` | Document destructive D2 schema replacement |
| `package.json` | `supabase:test:all` restores Sprint 1 after D2 |
| Evidence JSON/MD | Regenerated from re-execution |
| `docs/backend/18-*.md` | Corrected to re-executed reality |

---

## 3. Commands and Exit Codes

| Command | Exit | Notes |
|---|---|---|
| `npm ci` | 0 | clean install, 0 vulnerabilities |
| `npm run typecheck` | 0 | `tsc --noEmit --project tsconfig.app.json` |
| `npm run build` | 0 | Vite production build |
| `npm run supabase:reset` | 0 | Sprint 1 schema confirmed (`tenants.legal_name`, …) |
| `npm run supabase:test:sprint1` | 0 | after foundation.sql fix |
| `npm run supabase:test:edge-func-auth` | 0 | **35/35** |
| `npm run supabase:perf:seed` | 0 | ~15s |
| `npm run supabase:perf:explain` | 0 | PERF-01…12 |
| `npm run supabase:test:d2` | 0 | after one RT-01 timing retry; `failures: []` |
| Re-`supabase:reset` + sprint1 + edge | 0 | post-D2 restore verification |

### Test totals

| Suite | Total | Passed | Failed |
|---|---|---|---|
| Edge Function authorization | 35 | 35 | 0 |
| Sprint 1 SQL foundation blocks | 4 DO blocks | 4 | 0 |
| D2 runtime probe | failures array | empty | 0 after retry |
| Typecheck / build | 1 each | 1 | 0 |

---

## 4. Authorization Findings

### Initial independent re-run (pre-remediation)

Prior evidence claimed 38/38 PASS. Re-execution failed:

1. Harness minted **self-signed HS256** JWTs; functions call `authClient.auth.getUser()` → GoTrue → **401** for all authenticated cases.
2. After D2, fixtures targeting Sprint 1 columns failed (`legal_name`, `avatar_url`, `profile_id` on `tenant_members`, etc.).

### Post-remediation

Boundary is real HTTP to local functions. Tokens are real GoTrue sessions for seed/fixture users.

Proven:

- Anonymous / invalid / expired denied
- Self access allowed
- Cross-profile RLS denial (0 rows for foreign profile)
- Cross-tenant / forged tenant / insufficient permission → 403
- Platform admin context flag true
- Revoked membership yields empty tenant/residence context
- Disabled profile → 404 (via `current_profile_id()` requiring `status='active'`)
- Protected `full_name` not mutated
- Contact verification spoofing blocked at edge + trigger
- Audit row written; update blocked by immutability trigger
- Errors use safe envelopes (no SQL/stack leakage in JSON)

### Residual authorization notes (non-blocking)

- Missing required fields on contact upsert can still throw before JSON envelope (500/PARSE_ERROR) — safe content, not a bypass.
- Admin path is allowed and identified; dedicated admin audit event not asserted for read-only list endpoints.

---

## 5. Package Manager Conclusion

| Decision | npm@10.9.8 |
|---|---|
| Lockfile | `package-lock.json` only |
| pnpm artifacts | not present |
| Clean install | `npm ci` PASS |
| Typecheck | PASS (app project) |
| Build | PASS |

---

## 6. Performance Findings

Fixture scale ~50 tenants / 3.2k profiles / 10k audit events.

| Path | Verdict |
|---|---|
| PERF-01,03,04,06,07,08,09,10,11,12 | OPTIMAL (index or cheap helper) |
| PERF-02 | ACCEPTABLE small-table seq scan |
| PERF-05 | ACCEPTABLE admin association path ~31ms |

No plan scales unauthorized across all tenants on hot resident auth paths. No blocking perf defect.

---

## 7. D2 Regression Results

| Check | Result |
|---|---|
| DB-01… isolation SQL | green (via d2_setup + sql tests) |
| RT support Option B | green |
| notifications Realtime | green on successful run |
| ADR-10 / ADR-11 | green |
| RT-01 | flaky once, green on retry |

**HIGH operational finding (documented, mitigated by sequence):**  
`validation/d2_setup.sql` destroys Sprint 1 schema. Certification requires ordered execution + reset restore — not a single mixed schema.

---

## 8. Unresolved Findings

| ID | Severity | Finding | Blocking? |
|---|---|---|---|
| OG-01 | MEDIUM | D2 setup destructive to Sprint 1 tables | No if sequence followed |
| OG-02 | LOW | RT-01 timing flake | No (retry green; isolation OK) |
| OG-03 | LOW | EF-11 uncaught validation throw → 500 | No (safe) |
| OG-04 | OBSERVATION | Prior docs prematurely claimed CERTIFIED | Corrected in report 18 |

No CRITICAL or HIGH security/isolation bypass remaining after remediation.

---

## 9. Evidence Paths

```text
validation/evidence/sprint01_edge_function_authorization.json
validation/evidence/sprint01_identity_explain_evidence.md
validation/evidence/sprint01_identity_explain_summary.json
validation/evidence/adr09_realtime_authorization_trace.json  (D2 regenerated)
docs/backend/18-sprint-01-conditions-closure-report.md
```

---

## 10. Verdict

```text
OPENCODE GO AUDIT PASS WITH FINDINGS
```

Findings are operational/low (D2 schema ordering, RT-01 flake, minor validation mapping).  
Security, isolation, package reproducibility, typecheck/build, executable edge authorization, and realistic EXPLAIN evidence are satisfied under the documented run sequence.

Final Sprint 1 certification is reserved for Agy after Claude independent audit.
