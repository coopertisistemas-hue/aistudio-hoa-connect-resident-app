# 40 — Wave 2.3 Residence & Household Domain Report

**Wave:** 2.3
**Topic:** Residence & Household Domain Foundation
**Status:** HOTFIX DEPLOYED — PENDING FINAL CODEX CLOSEOUT
**Date:** 2026-07-20

---

## 1. Objective

Implement the Residence and Household domain foundation approved in Sprint 2 planning (documents 27–37), establishing historical occupancy semantics, household composition, composite foreign key integrity (D-13), and temporal exclusion constraints (D-04/D-05).

This wave extends the certified `residence_members` table with history evolution (frozen item #1), creates the `household_members` table for non-platform persons, and enforces structural tenant isolation via composite FKs.

`residence_payers` (financial responsible) and `residence_invitations` are excluded per executive directive. No RPCs were created — mutations remain gated behind the RLS policy surface for Wave 2.4b.

---

## 2. Baseline Inspected

| Item | Value |
|---|---|
| Repository | `aistudio-hoa-connect-resident-app` |
| Branch | `sprint-01-foundation-identity` |
| Initial HEAD | `011f2ebed932bb18651b108a991bbd519231c10e` (Wave 2.2 certified baseline; the previously recorded value `011f2eb4ebfbefc72c1c684d0b1686940a02f6eb` was a transcription error — that hash does not exist in this repository) |
| Final HEAD | (uncommitted working tree) |
| Certified baseline | 4 migrations: Sprint 1 + Wave 2.1 enums + Wave 2.1 association + Wave 2.2 resident |

---

## 3. Implementation Summary

### 3.1 Frozen List Changes

| # | Object | Change | Source |
|---|---|---|---|
| 1 | `residence_members` | D-05 full evolution: columns, constraints, triggers, indexes | doc 28 §12 item 1 |
| 2 | `properties` | Add `UNIQUE (id, tenant_id)` composite-FK parent | doc 28 §12 item 2 |
| 7 | extensions | `CREATE EXTENSION IF NOT EXISTS btree_gist` | doc 28 §12 item 7 |

### 3.2 New Enums

| Enum | Values |
|---|---|
| `residence_membership_end_reason` | `moved_out`, `ownership_transferred`, `tenancy_ended`, `evicted`, `deceased`, `blocked`, `replaced`, `administrative` |
| `household_relationship` | `spouse`, `child`, `parent`, `relative`, `dependent`, `legal_charge`, `other` |
| `household_member_status` | `active`, `inactive`, `former` |

### 3.3 Residence Membership — D-05 History Evolution

**New columns on `residence_members`:**
- `end_reason residence_membership_end_reason NULL` — closure reason vocabulary
- `requested_end_date date NULL` — resident move-out request target date
- `moveout_requested_at timestamptz NULL` — timestamp of move-out request

**Constraint changes:**
- Dropped `UNIQUE (property_id, profile_id)` (replaced by partial)
- Added `UNIQUE (property_id, profile_id) WHERE status IN ('active','pending')` — one open membership per pair
- Added `UNIQUE (id, tenant_id)` — composite FK parent key (D-13)
- Added `UNIQUE (tenant_id, profile_id) WHERE status='active' AND is_primary` — tenant-scoped, one active primary per profile per tenant
- Added CHECK `residence_members_closure_complete` — closed rows require end_date + end_reason
- Added composite FK `(property_id, tenant_id) → properties (id, tenant_id)` (D-13)
- Added EXCLUDE constraint `residence_members_no_overlap` — no overlapping occupancy periods per (property, profile) using gist

**New trigger:**
- `trg_residence_members_closed_immutable` — blocks any UPDATE on rows with `status='revoked'` (ERRCODE: `feature_not_supported`)

**New partial indexes:**
- `idx_residence_members_profile_open` — `(profile_id) WHERE status='active'`
- `idx_residence_members_property_open` — `(property_id) WHERE status='active'`

### 3.4 `household_members` Table

Non-platform persons (minors, dependents without login) represented per document 28 §6.3 (D-03).

**Columns:** `id uuid PK`, `tenant_id`, `property_id`, `responsible_profile_id → profiles(id)`, `full_name`, `birth_date`, `relationship household_relationship`, `status household_member_status DEFAULT 'active'`, `start_date`, `end_date`, `notes`, `linked_profile_id → profiles(id)`, `created_at`, `updated_at`.

**Key constraints:**
- Composite FK `(property_id, tenant_id) → properties (id, tenant_id)` (D-13)
- Partial unique `(property_id, linked_profile_id) WHERE linked_profile_id IS NOT NULL AND status='active'`
- CHECK `household_members_period_valid` — `end_date >= start_date`

**Triggers:**
- `touch_updated_at()` on UPDATE
- `trg_household_members_protected_fields` — immutability of `tenant_id`, `property_id`, `responsible_profile_id`
- `trg_household_members_no_delete` — append-only, soft-delete via `status='former'`

**Indexes:**
- `idx_household_members_property_status` — `(property_id, status)`
- `idx_household_members_responsible_status` — `(responsible_profile_id, status)`
- `idx_household_members_tenant_status` — `(tenant_id, status)`

### 3.5 `properties` Extension

Added `UNIQUE (id, tenant_id)` for composite FK parent support (frozen item #2, D-13). Idempotent — `id` is already unique as the primary key.

---

## 4. Authorization Posture

### 4.1 Grant Model

- **All tables:** `REVOKE ALL FROM PUBLIC, anon, authenticated` then `GRANT SELECT TO authenticated`
- **No INSERT/UPDATE/DELETE grants to authenticated** on any new or modified table (SPR2-RESD-GRANT-01)
- Mutation surface is gated behind RLS policies whose INSERT/UPDATE only grant through `SECURITY INVOKER` RPCs (Wave 2.4b)

### 4.2 RLS Policies — `residence_members`

| Policy | Operation | Condition |
|---|---|---|
| `residence_members_select_self_policy` (certified, unchanged) | SELECT | `profile_id = current_profile_id()` |
| `residence_members_select_tenant_policy` (certified, unchanged) | SELECT | `has_tenant_permission(tenant_id, 'residences:read') OR is_platform_admin()` |
| `residence_members_insert_policy` (new) | INSERT | `has_tenant_permission(tenant_id, 'residences:write')` |
| `residence_members_update_policy` (new) | UPDATE | `has_tenant_permission(tenant_id, 'residences:write')` |

### 4.3 RLS Policies — `household_members` (REMEDIATED)

| Policy | Operation | Condition |
|---|---|---|
| `household_members_select_policy` | SELECT | `is_active_residence_member(property_id)` (co-household) OR `is_household_responsible(id)` (responsible, active-residence-validated) OR `has_tenant_permission(tenant_id, 'household:read')` (staff) OR `is_platform_admin()` |
| `household_members_insert_policy` | INSERT | `has_tenant_permission(tenant_id, 'household:write')` |
| `household_members_update_policy` | UPDATE | `has_tenant_permission(tenant_id, 'household:write')` |

**Remediation note:** The original SELECT policy used `responsible_profile_id = public.current_profile_id()` as a standalone predicate, which did not validate that the responsible profile still held an active, unrevealed residence membership for the property. Replaced by `is_household_responsible(id)`, a SECURITY DEFINER helper that validates: (1) caller profile matches `responsible_profile_id`, (2) caller has an active `residence_members` row for the same property (`status = 'active'`), and (3) tenant identity is implicit through the property reference.

### 4.4 New Helper: `is_household_responsible(uuid /* householed_member_id */)`

SECURITY DEFINER, STABLE, `SET search_path = ''`. Returns true iff the current profile is the `responsible_profile_id` of the target row AND holds an active `residence_members` row (`status = 'active'`) for the same property. False for anonymous, revoked, moved-out, former, cross-property and cross-tenant callers.

### 4.5 Actor Summary

| Actor | residence_members | household_members |
|---|---|---|
| Resident self | own rows (all statuses) | responsible rows (active authority only) + co-household rows |
| Staff (`residences:read` / `household:read`) | all tenant rows | all tenant rows |
| Staff (`residences:write` / `household:write`) | INSERT/UPDATE | INSERT/UPDATE |
| Platform admin | all tenants | all tenants |
| Former/revoked/moved-out responsible | own history | denied (no active residence authority) |
| Collector | denied (no `residences:read`) | denied (no `household:read`) |
| Anonymous | denied (no select grant) | denied (no select grant) |
| Unaffiliated user | denied (RLS filters) | denied (RLS filters) |

### 4.6 Tenant Isolation

Composite FKs `(property_id, tenant_id) → properties (id, tenant_id)` structurally prevent cross-tenant writes at the database level. RLS policies enforce cross-tenant read isolation for `authenticated` users.

---

## 5. Lifecycle & Occupancy

### 5.1 Historical Occupancy (D-05)

- Closing a membership updates status to `revoked` with mandatory `end_date` + `end_reason`
- Revoked rows are immutable — any UPDATE is blocked by trigger
- Re-occupancy creates a new row (new period), never overwrites the old one
- EXCLUDE constraint prevents overlapping periods for the same `(property, profile)` pair
- Partial unique prevents duplicate open (`active`/`pending`) memberships

### 5.2 Household Lifecycle

- `active → inactive → former` transitions
- No hard deletes — soft-delete only via `status='former'`
- Protected fields (tenant_id, property_id, responsible_profile_id) are immutable after creation
- `linked_profile_id` provides structural uniqueness for linked platform users

### 5.3 Future Compatibility

The `properties` table serves as the canonical residence entity (D-02). The period model supports future billing anchor (`residence_payers`) without schema redesign.

---

## 6. Platform-User Duplication Invariant (REMEDIATED)

### 6.1 Invariant

No profile may simultaneously exist as an active `residence_members` row AND an active `household_members` row (with `linked_profile_id`) for the same property.

### 6.2 Enforcement Mechanism

Trigger function `prevent_platform_user_household_duplicate()` attached to both tables:

- **Direction A** — `BEFORE INSERT OR UPDATE ON household_members`: if `linked_profile_id IS NOT NULL AND status = 'active'`, rejects if an open residence_members row (`status IN ('active','pending')`) exists for the same (property, profile).
- **Direction B** — `BEFORE INSERT OR UPDATE ON residence_members`: if `NEW.status IN ('active','pending')`, rejects if an active household_members row (`status = 'active'`) exists with `linked_profile_id = NEW.profile_id` for the same property.

### 6.3 Concurrency

PostgreSQL advisory lock (`pg_advisory_xact_lock`) on a deterministic hash of `(property_id, profile_id)` acquired before the EXISTS check, serializing concurrent mutations targeting the same pair. Transaction-scoped: automatically released on commit/rollback.

### 6.4 Status Semantics

- `residence_members.status IN ('active','pending')` → open/conflicting (per doc 28 §5 item 2)
- `household_members.status = 'active'` → conflicting
- `household_members.status IN ('inactive','former')` → non-conflicting
- `residence_members.status = 'revoked'` → non-conflicting
- Historical/inactive rows do NOT violate the invariant

---

## 7. Validation Results

| Command | Result |
|---|---|
| `npm run typecheck` | EXIT 0 |
| `npm run build` | EXIT 0 |
| `npm run supabase:test:sprint2` | EXIT 0 (17 DO blocks, all waves + remedial gates) |
| `npm run supabase:test:all` | EXIT 0 (full aggregate suite) |
| `bash validation/check_d2_namespace.sh` | EXIT 0 (namespace guard PASS) |

### 7.1 Core Validation Gates (Wave 2.3 original)

| # | Gate ID | Description | Status |
|---|---|---|---|
| 1 | SPR2-RESD-01 | Invalid tenant FK rejected | PASS |
| 2 | SPR2-RESD-02 | Invalid profile FK rejected | PASS |
| 3 | SPR2-RESD-03 | Invalid property FK rejected | PASS |
| 4 | SPR2-RESD-04 | Cross-tenant composite FK rejected | PASS |
| 5 | SPR2-RESD-05 | Historical occupancy preserved (close + reopen + immutability) | PASS |
| 6 | SPR2-RESD-05e | EXCLUDE — overlapping period rejected | PASS |
| 7 | SPR2-RESD-06 | Duplicate open membership rejected | PASS |
| 8 | SPR2-RESD-07 | Duplicate active primary per tenant rejected | PASS |
| 9 | SPR2-RESD-08 | Invalid date ordering rejected | PASS |
| 10 | SPR2-RESD-09 | Revoked without end_date/end_reason rejected | PASS |
| 11 | SPR2-RESD-10 | Anonymous denied (both tables) | PASS |
| 12 | SPR2-RESD-11 | Unrelated authenticated user denied | PASS |
| 13 | SPR2-RESD-12 | Collector denied (no residences:read) | PASS |
| 14 | SPR2-RESD-13 | Resident self-read + staff access + platform admin | PASS |
| 15 | — | Wave 2.2 regression | PASS |
| 16 | — | Sprint 1 regression | PASS |
| 17 | — | D2 namespace preserved | PASS |
| 18 | — | ADR-11 compatibility (11/11) | PASS |
| 19 | — | Edge Function auth (35/35) | PASS |

### 7.2 Remediation Gates — Finding 1 (Authorization)

| # | Gate ID | Description | Status |
|---|---|---|---|
| 20 | SPR2-HH-RESP-01 | Active responsible resident reads own household members | PASS |
| 21 | SPR2-HH-RESP-02 | Former responsible (moved_out) denied | PASS |
| 22 | SPR2-HH-RESP-03 | Revoked responsible (blocked) denied | PASS |
| 23 | SPR2-HH-RESP-04 | Moved-out responsible denied | PASS |
| 24 | SPR2-HH-RESP-05 | Cross-property responsible denied | PASS |
| 25 | SPR2-HH-RESP-06 | Cross-tenant responsible denied | PASS |
| 26 | SPR2-HH-RESP-07 | No-membership authenticated user denied | PASS |
| 27 | SPR2-HH-RESP-08 | Collector denied | PASS |
| 28 | SPR2-HH-RESP-09 | Anonymous denied | PASS |
| 29 | SPR2-HH-RESP-10 | Staff household:read access preserved | PASS |

### 7.3 Remediation Gates — Finding 2 (Cross-Table Invariant)

| # | Gate ID | Description | Status |
|---|---|---|---|
| 30 | SPR2-DUP-01 | Direction A: Active residence profile → household_member (linked) rejected | PASS |
| 31 | SPR2-DUP-02 | Direction B: Active linked household_member → residence_members rejected | PASS |
| 32 | SPR2-DUP-03 | Direction A update: Setting conflicting linked_profile_id rejected | PASS |
| 33 | SPR2-DUP-04 | Direction B reopen: Revoked→active conflicting with household_member rejected | PASS |
| 34 | SPR2-DUP-05 | Same profile different property — allowed | PASS |
| 35 | SPR2-DUP-06 | Historical/inactive rows do not conflict | PASS |
| 36 | SPR2-DUP-07 | Non-linked household members remain valid | PASS |
| 37 | SPR2-DUP-08 | Failed conflicting mutation leaves no partial data | PASS |
| 38 | SPR2-DUP-09 | Non-conflicting residence insert works normally | PASS |
| 39 | — | Existing Wave 2.2 resident/profile behavior intact | PASS |

---

## 8. Files Changed

| File | Action |
|---|---|
| `supabase/migrations/20260720120000_sprint02_wave23_residence_household.sql` | Created. Remediated with: `is_household_responsible()` helper, `prevent_platform_user_household_duplicate()` trigger function, 2 cross-table triggers, fixed SELECT policy, GRANT EXECUTE |
| `supabase/tests/sprint02_domain.sql` | Extended. Original Wave 2.3: test blocks 12–15. Remediation: test blocks 16–17 (20 new gates) |
| `supabase/tests/sprint01_edge_function_fixtures.sql` | Updated (revoked row now includes end_date + end_reason for CHECK compatibility) |
| `src/lib/supabase/database.types.ts` | Regenerated (`npm run supabase:types`) |

---

## 9. Codex Remediation Record

### 9.1 Certification Outcome

Independent Codex certification returned **FAIL**. Publication was blocked pending remediation of three findings.

### 9.2 Finding 1 — Household Visibility Broader Than Authorized

**Root Cause:** The `household_members_select_policy` predicate `responsible_profile_id = public.current_profile_id()` granted household visibility to any profile stored as `responsible_profile_id`, regardless of whether that profile still held an active, unrevoked residence membership at the affected property. A former, moved-out, inactive, blocked or revoked responsible profile retained household authority by ID reference alone.

**Correction:** Created `is_household_responsible(uuid)` helper (SECURITY DEFINER, STABLE, `SET search_path = ''`) that validates:
1. Caller profile matches `responsible_profile_id` on the target household_member row
2. Caller has an active `residence_members` row (`status = 'active'`) for the same property

The SELECT policy now uses `OR public.is_household_responsible(id)` instead of `OR responsible_profile_id = public.current_profile_id()`.

**Tests:** 10 regression gates (Test 16, SPR2-HH-RESP-01 through SPR2-HH-RESP-10) validating active, former, revoked, moved-out, cross-property, cross-tenant, no-membership, collector, anonymous, and staff scenarios.

### 9.3 Finding 2 — Platform-User Duplication Invariant Not Enforced

**Root Cause:** The partial unique index `UNIQUE (property_id, linked_profile_id) WHERE linked_profile_id IS NOT NULL AND status = 'active'` only prevented duplicate active rows within `household_members`. It did not prevent the same profile from existing simultaneously in `residence_members` (active/pending) and `household_members` (active, linked) for the same property — violating the canonical boundary between platform residents and non-user household persons (doc 28 §9 invariant 6).

**Correction:** Created `prevent_platform_user_household_duplicate()` trigger function enforcing both mutation directions:
- Direction A: `household_members` INSERT/UPDATE blocked if `linked_profile_id` has active/pending `residence_members` on same property
- Direction B: `residence_members` INSERT/UPDATE to `active`/`pending` blocked if `profile_id` is linked from an active `household_members` on same property

Concurrency: `pg_advisory_xact_lock` on `(property_id, profile_id)` hash prevents race windows.

**Tests:** 10 regression gates (Test 17, SPR2-DUP-01 through SPR2-DUP-09) validating both directions, UPDATE transitions, reopen scenarios, cross-property allowance, historical/inactive non-conflict, non-linked validity, partial-data absence, and Wave 2.2 compatibility.

### 9.4 Finding 3 — Validation Report Overstated Certification Readiness

**Root Cause:** Original document 40 claimed that "the platform-user duplication invariant is enforced" and that "the Wave is fully validated." These claims were unsupported by the test suite and implementation at the time of certification.

**Correction:** This document (40) has been updated:
- Status changed from "COMPLETE — READY FOR INDEPENDENT AUDIT" to "REMEDIATED — PENDING RECERTIFICATION"
- Removed unsupported claims about invariant enforcement and full validation
- Section 4.3 updated to reflect the remediated SELECT policy
- Section 6 added with enforcement mechanism description, concurrency posture, and status semantics
- Section 9 (this section) added with full remediation record
- Final recommendation revised to request recertification, not publication

---

## 10. Limitations & Accepted Scope Boundaries

- **No RPC layer:** Mutations are not yet available — reserved for Wave 2.4b. INSERT/UPDATE policies exist but are unreachable from direct PostgREST calls (no table write grants).
- **No `residence_payers`:** Financial responsibility excluded per executive directive.
- **No `residence_invitations`:** Onboarding excluded per executive directive.
- **No `residences` table:** D-02 is preserved — `properties` IS the canonical residence entity.
- **No Edge Functions:** CRUD surface belongs to Wave 2.5.
- **D-05 irreversibility:** Once a second period row exists for any `(property, profile)` pair, restoring `UNIQUE (property_id, profile_id)` is impossible without data loss.
- **Advisory-lock overhead:** Serialization on `(property_id, profile_id)` adds a modest locking cost under concurrent mutation; acceptable for the scale of this sprint and removable in favor of a unique constraint-based approach if two-table unique constraints become available in a future PostgreSQL release.
- **Unlinked household members:** Persons registered without `linked_profile_id` rely on name+birth-date deduplication heuristics; the cross-table invariant cannot cover them structurally and this is disclosed in document 28 §9 invariant 6.
- **Trigger SECURITY INVOKER posture (R-01):** `prevent_platform_user_household_duplicate()` currently executes as `SECURITY INVOKER` (the PostgreSQL default). Wave 2.3 mutation access is limited to authorized staff who also hold `residences:read` — the EXISTS checks work correctly. **Wave 2.4b must revisit this before resident-initiated RPC mutations are introduced.** Future resident-initiated RPCs may execute under a caller whose RLS-filtered reads cannot observe conflicting rows owned by other profiles. Wave 2.4b must resolve this before enabling such write paths. Acceptable options include a narrowly scoped `SECURITY DEFINER` helper or an equivalently safe structural solution. Fixed `search_path`, full schema qualification, tenant validation and negative tests remain mandatory. Severity: INFORMATIONAL for Wave 2.3; mandatory design gate for Wave 2.4b.

---

## 11. CF-05 Verification Record

| Claim | Source |
|---|---|
| Frozen list items 1, 2, 7 | `docs/backend/28-sprint-02-domain-model.md` §12 |
| D-05 closure semantics | `docs/backend/28-sprint-02-domain-model.md` §5.1 |
| D-13 composite FKs | `docs/backend/27-sprint-02-executive-planning.md` §13 |
| household_members model | `docs/backend/28-sprint-02-domain-model.md` §6.3 |
| RLS plan + is_household_responsible | `docs/backend/29-sprint-02-authorization-rls-blueprint.md` §4, §6.3 |
| Cross-table invariant enforcement | `docs/backend/28-sprint-02-domain-model.md` §6.3, §9 invariant 6 |
| Zero write grant guarantee | `supabase/migrations/20260720120000_sprint02_wave23_residence_household.sql` (grant lines) |
| Certified residence_members RLS | `supabase/migrations/20260719170000_sprint01_foundation_identity.sql:678-686` |

---

## 12. Operational Remediation Summary

Wave 2.3 publication conditions have been operationalized and verified with verifiable empirical evidence:

1. The household visibility defect is corrected with the `is_household_responsible(id)` SECURITY DEFINER helper and 10 negative authorization gates.
2. The cross-table duplication invariant is structurally enforced with the `prevent_platform_user_household_duplicate()` trigger function, advisory-lock concurrency control, and 10 validation gates covering both mutation directions.
3. All publication conditions (production Supabase audit, data preservation evidence, Vercel production deployment verification, Edge Function smoke tests, and commit `b24ced9` scope classification) have been completed.

---

## 13. Final Publication Conditions Closure

### 13.1 Privileged Production Supabase Verification

Direct privileged inspection of live production project `xcuxcqbctfjgccsdqwgl` was conducted via linked CLI (`supabase migration list --linked` and `supabase db dump --linked`):

- **Applied Migration History:** Verified 5 matching migrations between local repository and remote database:
  - `20260719170000_sprint01_foundation_identity.sql`
  - `20260720090000_sprint02_wave21_enums.sql`
  - `20260720100000_sprint02_wave21_association_domain.sql`
  - `20260720110000_sprint02_wave22_resident_domain.sql`
  - `20260720120000_sprint02_wave23_residence_household.sql`
- **Function Definitions Verified:**
  - `resident.current_profile_id()`: STABLE SECURITY DEFINER with `SET search_path = ''`.
  - `resident.has_tenant_permission()`: STABLE SECURITY DEFINER with `SET search_path = ''`.
  - `resident.is_active_residence_member()`: STABLE SECURITY DEFINER with `SET search_path = ''`.
  - `resident.is_household_responsible(uuid)`: STABLE SECURITY DEFINER with `SET search_path = ''`.
  - `resident.prevent_platform_user_household_duplicate()`: PLPGSQL trigger function with `SET search_path = ''` using advisory locking.
- **Trigger Attachments Verified:**
  - `trg_household_members_no_platform_dup` attached `BEFORE INSERT OR UPDATE` on `resident.household_members`.
  - `trg_residence_members_no_household_dup` attached `BEFORE INSERT OR UPDATE` on `resident.residence_members`.
  - Bidirectional enforcement active.
- **RLS & Grants Posture:**
  - RLS enabled on all 15 tables in `resident` schema.
  - `GRANT USAGE ON SCHEMA resident TO authenticated;` active (no usage grant to `anon`).
  - Core domain tables (`residents`, `residence_members`, `household_members`, `tenants`, `tenant_members`, `properties`, `association_details`, `association_settings_private`, `resident_staff_notes`) have ONLY `SELECT` grants for `authenticated`. No direct `INSERT`, `UPDATE`, or `DELETE` grants exist.
  - PostgREST exposure in `supabase/config.toml`: `api.schemas = ["public", "graphql_public", "resident"]`.

### 13.2 Data-Preservation Evidence

- **Destructive SQL Analysis:** Automated inspection of all migration SQL files for `DROP TABLE`, `DROP SCHEMA`, `TRUNCATE`, `DELETE FROM`, `CASCADE`, `CREATE OR REPLACE TABLE` returned ZERO destructive table/schema deletion statements (`ON DELETE CASCADE` is present only as declarative FK ON DELETE actions).
- **Catalog & Row Count Co-existence:** Catalog dump confirms preserved `public` tables co-exist alongside newly created `resident` schema namespace.
- **Defensible Conclusion:** No evidence of production data loss was found.
- **Historical Limitation:** Pre-migration baseline table snapshot counts were not recorded prior to initial deployment; co-existence and lack of destructive DDL statements form the basis of this conclusion.

### 13.3 Vercel Production Verification

Direct inspection via Vercel CLI (`vercel inspect`) and HTTP probing:

- **Project:** `aistudio-hoa-connect-resident-app` (under team `cooperti-sistemas-projects`)
- **Deployment ID:** `dpl_AHCmoMqbeDUWhFwNfrGXTMghnJEr`
- **Deployment URL:** `https://aistudio-hoa-connect-resident-jomux7osx.vercel.app`
- **Production Alias:** `https://hoaconnect-res.vercel.app`
- **Deployment Status:** `● Ready`
- **Associated Git Commit:** `b24ced93279f11d9debbc23cac929789d1d8b319` on branch `sprint-01-foundation-identity`
- **HTTP Smoke Checks:**
  - Root route `/` -> HTTP 200 OK
  - Manifest `/manifest.json` -> HTTP 200 OK
  - Favicon `/icons/icon-192.svg` -> HTTP 200 OK
  - SPA bundle assets -> HTTP 200 OK

### 13.4 Edge Function Verification

All 10 expected resident Edge Functions verified deployed and active on project `xcuxcqbctfjgccsdqwgl`:

1. `auth-bootstrap` (HTTP 401 unauthenticated)
2. `auth-context` (HTTP 401 unauthenticated)
3. `profile-contact-delete` (HTTP 401 unauthenticated)
4. `profile-contact-upsert` (HTTP 401 unauthenticated)
5. `profile-contacts-list` (HTTP 401 unauthenticated)
6. `profile-get` (HTTP 401 unauthenticated)
7. `profile-update` (HTTP 401 unauthenticated)
8. `resident-auth` (HTTP 401 unauthenticated)
9. `tenant-context-list` (HTTP 401 unauthenticated)
10. `tenant-context-select` (HTTP 401 unauthenticated)

No unexpected 404, 500, CORS, or schema errors observed. Automated suite `npm run supabase:test:edge-func-auth` passed 35/35 test cases (EXIT 0).

### 13.5 Commit `b24ced9` Scope Classification

File-by-file audit of commit `b24ced93279f11d9debbc23cac929789d1d8b319`:

1. `.gitignore` — `ANCILLARY BUT JUSTIFIED` (Prevents local environment files `.env*` from being committed during migration runs).
2. `src/lib/supabase/database.types.ts` — `REQUIRED` (Exposes `resident` schema types for frontend type checking).
3. `supabase/config.toml` — `REQUIRED` (Adds `resident` to `api.schemas`).
4. `supabase/functions/_shared/auth.ts` — `REQUIRED` (Targets `resident` schema in Edge Function auth helper).
5. `supabase/migrations/20260719170000_sprint01_foundation_identity.sql` — `REQUIRED` (Establishes `resident` schema namespace).
6. `supabase/migrations/20260720090000_sprint02_wave21_enums.sql` — `REQUIRED` (Isolates enums in `resident` schema).
7. `supabase/migrations/20260720100000_sprint02_wave21_association_domain.sql` — `REQUIRED` (Isolates association domain tables/policies in `resident` schema).
8. `supabase/migrations/20260720110000_sprint02_wave22_resident_domain.sql` — `REQUIRED` (Isolates resident domain tables/policies in `resident` schema).
9. `supabase/migrations/20260720120000_sprint02_wave23_residence_household.sql` — `REQUIRED` (Isolates residence & household domain tables/triggers/policies in `resident` schema).
10. `supabase/seed.sql` — `ANCILLARY BUT JUSTIFIED` (Populates `resident` schema in seed).
11. `supabase/tests/sprint01_edge_function_auth.test.mjs` — `ANCILLARY BUT JUSTIFIED` (Updates Edge Function auth test assertions for `resident` schema).
12. `supabase/tests/sprint01_edge_function_fixtures.sql` — `ANCILLARY BUT JUSTIFIED` (Updates Edge Function test fixture SQL for `resident` schema).
13. `supabase/tests/sprint01_foundation.sql` — `ANCILLARY BUT JUSTIFIED` (Updates foundation pgTAP tests for `resident` schema).
14. `supabase/tests/sprint02_domain.sql` — `ANCILLARY BUT JUSTIFIED` (Updates domain pgTAP tests for `resident` schema).
15. `validation/evidence/sprint01_edge_function_authorization.json` — `ANCILLARY BUT JUSTIFIED` (Updates Edge Function authorization evidence).

Zero unrelated files or Wave 2.4 functionality were introduced.

### 13.6 Residual Findings

Only informational / future-wave design findings remain open (R-01 through R-04 as detailed in §10). Specifically, R-01 (trigger `SECURITY INVOKER` posture) is documented as a mandatory design gate for Wave 2.4b before resident-initiated write RPCs are introduced.

### 13.7 Final Closeout Candidate Status

### 13.8 Wave 2.3.1 Hotfix Record

Wave 2.3.1 corrected the production SPA deep-route fallback and two publication-evidence inaccuracies. No Wave 2.3 database behavior or business capability was changed.

```text
WAVE 2.3.1 HOTFIX DEPLOYED — PENDING FINAL CODEX CLOSEOUT
```
