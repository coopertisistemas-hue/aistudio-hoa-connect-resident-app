# 07 — Risk Assessment, Execution Plan & Production Readiness

> Deliverables 11 (Risk Assessment), 12 (Execution Plan), 15 (Production Readiness Checklist).

---

## 1. Risk register

Scoring: Probability × Impact, both 1–5. **Exposure ≥ 15 requires a named owner and a mitigation
that lands before the dependent sprint opens.**

### 1.1 Critical and high

| ID | Risk | P | I | Exp | Mitigation | Lands |
|---|---|:--:|:--:|:--:|---|---|
| **R-01** | **Resident tokens issued against role-agnostic RLS.** Any resident reads/mutates the association's full financial ledger via PostgREST with only the anon key (audit HIGH-01) | 5 | 5 | **25** | ADR-07 grant revocation + role-aware policies + CI regression tests 4 & 6 | **Sprint 0 — blocking** |
| **R-02** | **First-access flow abused.** CPF + birth date are semi-public in Brazil; a weak activation path hands over an account | 4 | 5 | **20** | Rate limit per CPF *and* IP, generic responses, code only to stored contact, short TTL, attempt cap, audit every attempt, independent review in-sprint | **Sprint 2** |
| **R-03** | **Cross-tenant write via unvalidated entity IDs.** Service-role clients bypass RLS; `meter-readings-api` already accepts `water_meter_id` with no ownership check (HIGH-02) | 4 | 5 | **20** | Mandatory `resolveResidenceScope` middleware step; no endpoint ships without it; code review checklist item | Sprint 1 |
| **R-04** | **Duplicate financial writes under retry.** No idempotency anywhere; compensating-delete sagas are non-transactional (MEDIUM-07) | 4 | 4 | **16** | `idempotency_keys` + unique constraints (ADR-08); mandatory on all mutations | Sprint 1 |
| **R-05** | **ADR-07 breaks an unknown consumer.** Revoking grants is fleet-wide | 2 | 5 | 10 | Audit verified no consumer uses PostgREST; stage on branch project; Admin smoke tests; single-statement rollback; low-traffic window | Sprint 0 |
| **R-06** | **Money precision defects.** Existing `numeric(14,2)`; new code introduces floats | 3 | 5 | 15 | Integer minor units across the wire (ADR-03); cent-level reconciliation tests against `billing_titles` | Sprint 4 |
| **R-07** | **Household privacy policy wrong.** §2.2 decides whether a dependent sees the water bill | 3 | 4 | 12 | **Product sign-off required** on the role capability matrix before Sprint 3 | Sprint 3 |
| **R-08** | **Destructive change against real production data.** Live tenant classification (production vs. pre-pilot) is unresolved | 3 | 5 | 15 | **Decision D4 required.** Until resolved, treat all live data as production: no destructive migrations, staging project for all development | **Sprint 0** |

### 1.2 Medium

| ID | Risk | P | I | Exp | Mitigation |
|---|---|:--:|:--:|:--:|---|
| R-09 | Frontend contract drift — a backend limitation leaks into a type change, breaking certified UX | 3 | 4 | 12 | Parity rule (Doc 06 §1.1); type changes require architecture escalation |
| R-10 | Assembler divergence — labels drift from certified copy | 3 | 3 | 9 | Assembler test vectors built from existing fixtures (Doc 03 §6) |
| R-11 | Admin App regression from shared-schema changes | 3 | 4 | 12 | All changes additive; no applied migration edited; no deployed function modified; Admin smoke suite per sprint |
| R-12 | Auth config not production-ready — localhost `site_url`, no SMTP, empty redirect list (MEDIUM-05) | 4 | 3 | 12 | Sprint 0 item 0.5 |
| R-13 | Open signup + zero-member self-join = latent privilege path (MEDIUM-03/04) | 3 | 4 | 12 | Sprint 0 items 0.4, 0.5 |
| R-14 | PII over-exposure to residents — co-resident data, `association-api GET /members` (MEDIUM-01) | 3 | 4 | 12 | Minimal co-resident projection (Doc 03 §3.3); `residents-api`/`association-api /members` never resident-reachable |
| R-15 | Realtime subscription leaks data across profiles | 4 | 5 | 20 | July 19, 2026 validation proved `support_messages` isolation failure under `postgres_changes`; remediate ADR-09 before Sprint 1 can open |
| R-16 | Storage path traversal / cross-tenant write | 2 | 5 | 10 | Server constructs every path; client never supplies one (Doc 05 §1.3) |
| R-17 | Line items don't sum to invoice total | 3 | 4 | 12 | Deferred constraint trigger; a resident seeing inconsistent totals destroys trust |
| R-18 | Edge Function cold starts miss the 200 ms p95 target | 3 | 3 | 9 | 9 grouped functions rather than 60; aggregate endpoints; measured in Sprint 8 |
| R-19 | Scope creep into Collector/Admin migration | 3 | 3 | 9 | Explicit non-goals (Doc 01 §4); Collector primitives delivered but Collector features are not |
| R-20 | Reproducibility — Collector repo has no lockfile; Vite 8 is very new | 3 | 2 | 6 | Commit lockfiles; pin; CI build gate |
| **R-21** | **Repository exposure posture.** `.env` is tracked, no `.gitignore` exists, and future secrets are unprotected from accidental commit (F6) | 3 | 3 | 9 | Sprint 0 item 0.9: create `.gitignore`, `.env.example`, inspect Git history, prohibit service-role keys in frontend repos |
| R-22 | **Finance readiness gap.** `tariff_plans` is empty; billing engine has not completed a verified end-to-end run (Doc 06 §2.1) | 3 | 4 | 12 | Finance Readiness Gate must be green before Sprint 4; fallback to profile/residence/notices/support proofs |

### 1.3 Accepted limitations

| ID | Limitation | Why accepted |
|---|---|---|
| A-01 | Per-device session revocation is approximate — GoTrue exposes no device registry (Doc 02 §3.6) | Global sign-out is honoured; per-device is best-effort. **Must be surfaced to product** — the UX should not imply more precision than exists |
| A-02 | Resident writes are not queued offline (Doc 05 §3.1) | Deliberate. Optimistic financial writes are a worse failure than an honest offline message |
| A-03 | Deployed Edge Function source cannot be diffed against repo source with current token scope (audit INFO-01) | Accepted; mitigated by not modifying any deployed function |
| A-04 | `EducationCard`, `PrivacySection`, `AboutInfo` have no backend | Editorial content; database-backing adds migrations to copy edits for no benefit |

---

## 2. Open questions requiring a human decision

| # | Question | Blocks | Recommendation |
|---|---|---|---|
| D1 | `profiles` + `residence_members`, or `residents.user_id`? | Sprint 1 | **`profiles` + `residence_members`** (ADR-01) — the alternative caps the platform at one association per person |
| D2 | Revoke PostgREST grants? | Sprint 0 | **Yes** (ADR-07) — no known consumer breaks; it is the only structural fix for R-01 |
| D3 | Rebuild `tickets` as `support_requests`? | Sprint 7 | **Yes** (ADR-06) — 0 rows makes this free today and expensive later |
| D4 | Is the live tenant production or pre-pilot? | Sprint 0 | **Owner must confirm.** Until then, treat as production |
| D5 | Household privacy: may a `dependent` see invoices? | Sprint 3 | Default **no** (Doc 04 §2.2) — requires product sign-off, not an engineering decision |
| D6 | Is per-device session revocation a real requirement? | Sprint 3 | If yes, a custom session layer is needed; if no, adjust the UX copy (A-01) |

---

## 3. Execution plan

### 3.1 Environments

| Env | Purpose | Data |
|---|---|---|
| **Local** | Development | `supabase start` + `seed.sql` + synthetic residents |
| **Branch/Staging** | Integration, migration rehearsal, RLS suite | Anonymized/synthetic — **never production data** (guardrail) |
| **Production** | `xcuxcqbctfjgccsdqwgl` | Live |

**No development against production.** Today the Resident App's `.env` points at the production
project. Sprint 0 item 0.7 changes that; until it does, every local `npm run dev` is one careless
call away from live data.

### 3.2 Migration discipline

- Applied migrations are **never edited** — new work goes in new files (protected-asset list).
- Every migration is additive, reversible, and rehearsed on staging before production.
- Naming: `YYYYMMDDHHMMSS_<module>_<action>.sql`, continuing the existing convention.
- Every migration ships with: RLS policies, policy `COMMENT`s, indexes, and RLS tests **in the
  same commit**. A table without a policy never reaches `main`.

### 3.3 Governance workflow

Per `AGENTS.md`: architecture is human-defined; agents execute scoped tasks; gates are
`type-check → lint → build`; commits in Portuguese (conventional); UI text in Portuguese; only
sprint files staged; no unnecessary refactors.

**Stop rules apply.** Work halts on security ambiguity, tenant-boundary risk, or RLS/policy
ambiguity — as this document does at D1–D6, rather than resolving them unilaterally.

### 3.4 Definition of done (per module)

1. Migration applied to staging, RLS tests green
2. Edge Function deployed, `verify_jwt=true`, zod validation, audit logging, idempotency where mutating
3. Assembler unit-tested against the demo fixture
4. API service is a drop-in replacement — signature parity verified
5. Hook import swapped; **zero** changes to hooks, pages, components, or types
6. Every scenario in the module's fixture file reproduced against live data
7. UX compared state-by-state against the `c245c6c` baseline
8. Feature flag rollback verified
9. Type-check, lint, build all PASS
10. Documentation updated

---

## 4. Production readiness checklist

Signed off in Sprint 9. Every item is binary.

### Security

- [ ] `anon` holds **zero** grants on `public`; `authenticated` holds only the two narrow `SELECT` grants on `notifications` and `support_messages` required by ADR-09 — verified by test
- [ ] Every table has RLS enabled and at least one documented policy
- [ ] All 11 RLS negative-test classes green in CI
- [ ] `is_tenant_member()` hardened with `SET search_path = ''`
- [ ] `tenant_members` bootstrap policy fixed (MEDIUM-03)
- [ ] `disable_signup = true`
- [ ] Captcha on login and first access
- [ ] Rate limiting on all auth endpoints, per identifier **and** per IP
- [ ] CORS restricted to known origins — no `*`
- [ ] `.gitignore` covers `.env*`, `node_modules/`, build outputs, and OS/IDE files in all three repos; `.env.example` documents browser-safe variables only
- [ ] No service-role key, SMTP password, or third-party API secret committed in any frontend repository
- [ ] Service-role key exists only in Edge Function environment
- [ ] Independent security review of first access completed and findings closed
- [ ] Storage buckets all private; no public bucket exists
- [ ] Client never constructs a storage path
- [ ] Error responses leak no internals (closes LOW-02)

### Data integrity

- [ ] Idempotency enforced on every mutating endpoint
- [ ] `UNIQUE (receivable_id)` on `billing_titles` (closes LOW-03)
- [ ] Unique constraint on `meter_readings` idempotency key
- [ ] Line items sum to invoice total — enforced by constraint
- [ ] Money is integer minor units end to end; reconciled to the cent against `billing_titles`
- [ ] Consumption derives from a **server-looked-up** previous reading (closes HIGH-02)
- [ ] Protocol numbers unique, monotonic, never reused
- [ ] Soft delete honoured in every read path

### Multi-tenancy

- [ ] Every business table carries `tenant_id`
- [ ] Every Edge Function filters by resolved tenant — never a client-supplied one
- [ ] Every residence-scoped endpoint runs `resolveResidenceScope`
- [ ] Storage paths are tenant-prefixed
- [ ] Cross-tenant isolation verified by automated test
- [ ] Multi-membership users work (`resolveTenant`, not `.single()`)
- [ ] No hardcoded reference to Santa Terezinha anywhere in backend code

### Reliability

- [ ] Home p95 < 200 ms
- [ ] Per-section degradation verified on `/inicio`
- [ ] Every screen functions with Realtime unavailable
- [ ] Offline banner fires correctly on network loss
- [ ] Load tested at 100× current data volume
- [ ] Connection pooling within the 25-connection limit
- [ ] Alerting on error rate, latency, auth failures, RLS denials

### Compliance & privacy

- [ ] LGPD data export implemented
- [ ] LGPD erasure reaches **storage objects**, not only rows
- [ ] PII never logged; `tenant_id` never logged in production (guardrail)
- [ ] CPF encrypted at rest; only masked values returned
- [ ] `audit_logs` written on every mutation — verified by coverage test
- [ ] Retention policies implemented per Doc 05 §1.5
- [ ] Co-resident data minimized (R-14)

### Operations

- [ ] Staging environment mirrors production
- [ ] Every migration rehearsed on staging
- [ ] Rollback runbook per module
- [ ] Feature flags verified to roll back cleanly
- [ ] On-call and escalation defined
- [ ] Backup and restore tested — restore actually performed, not merely configured
- [ ] Deployed function versions tagged against repo commits (closes INFO-01)

### Frontend contract

- [ ] `src/fixtures/types.ts` unchanged from `c245c6c`
- [ ] Zero changes to hooks beyond import paths
- [ ] Zero changes to pages and components
- [ ] Every scenario in all six fixture files reproduced live
- [ ] UX certified against baseline, state by state
- [ ] Build PASS, lint clean, type-check clean
- [ ] Demo services retired only after a full live billing cycle

---

## 5. Success criteria

The program is complete when:

1. Every one of the **52 production-relevant demo-service operations** is served by a live Edge Function. Client-side utilities, static catalogs, session operations, and demo-only controls are explicitly excluded from this count.
2. `src/demo/*` is deleted, and **no screen, component, hook, or type changed** to make that possible.
3. A second association can be onboarded with **no code changes** — the actual test of multi-tenancy.
4. `anon` and `authenticated` can be proven, by automated test, to read nothing directly.
5. The certified UX at `c245c6c` is indistinguishable from the live app, state for state.

Criterion 3 is the one that decides whether this is a SaaS platform or a single-customer
application with SaaS-shaped tables. Criterion 5 is the one the program brief opens with.

---

## 6. What could still go wrong that this plan does not fully solve

Stated plainly, because a risk register that projects total confidence is not useful:

- **The frontend types may encode assumptions the real data violates.** The fixtures were authored
  before the backend was examined. `consumptionScenarios.ts` assumes readings arrive monthly with
  a known window; the live table holds **one** reading. The first real billing cycle will surface
  mismatches no amount of design review can predict. Sprints 4 and 5 should carry explicit slack.
- **`tariff_plans` and `tariff_ranges` are empty.** The billing engine has never been configured
  or exercised end-to-end. The Resident App reads its output. The Finance Readiness Gate (Doc 06
  §2.1) exists to detect this before Sprint 4 begins. If the gate fails, the program must fall back
  to profile/residence/notices/support as the early integration proof and return to Finance once
  billing is demonstrably ready.
- **Only one tenant has ever existed.** Multi-tenancy is asserted by schema, not demonstrated by
  operation. Success criterion 3 is the first genuine test, and it is late in the program.
  Consider onboarding a synthetic second tenant in staging during Sprint 1 rather than discovering
  tenancy defects in Sprint 9.
- **The Admin App is under active development by another team.** Its schema is shared. The audit
  is a point-in-time snapshot from 2026-07-17 and will drift. Re-verify before Sprint 0 executes.

---

*End of blueprint. All claims trace to firsthand inspection of the repositories and the read-only
Supabase audit of 2026-07-17/18. Items marked inferred or approximate are labelled inline.*
