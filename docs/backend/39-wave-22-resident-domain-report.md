# HOA CONNECT — SPRINT 2 — WAVE 2.2 REPORT

## Resident Domain Foundation — Execution, Audit & Remediation Report

### 1. Objective
Complete the production-ready Resident domain foundation for tenant-scoped resident management, establishing:
- Canonical association-scoped `residents` registry (`UNIQUE (tenant_id, profile_id)`).
- Immutable historical registration code rule (`UNIQUE (tenant_id, registration_code) WHERE registration_code IS NOT NULL`).
- Lifecycle status state machine (`resident_status` enum: `pending`, `active`, `inactive`, `former`, `deceased`, `blocked`).
- Staff-internal notes and status transition reasons in dedicated table (`resident_staff_notes`).
- Row-Level Security (RLS) policies for self-read, staff read/write (`residents:read`, `residents:write`), and platform admin.
- Data confidentiality boundary: removal of co-household broad RLS reads to protect staff notes and avoid heavy RLS queries.
- SECURITY DEFINER helper function `is_active_resident(tenant_id)`.
- Immutability and status transition integrity triggers.

### 2. Interruption Recovery Summary
- **Repository state inspected:**
  - Branch: `sprint-01-foundation-identity`
  - Initial HEAD: `1981ae8fb96c18f211bd51f12835771dc6a08715` (1 commit ahead of certified Wave 2.1 baseline `eb30f86baf39a78f4ff1158e3ea77456418fa01a`).
  - Working tree: Clean (0 uncommitted files). No partial or malformed Wave 2.2 files existed.
- **Recovery action:** Execution resumed from clean HEAD. No discarded work, no duplicate migrations created.

### 3. Baseline Inspected
- Certified Sprint 1 identity baseline intact (`20260719170000_sprint01_foundation_identity.sql`).
- Certified Wave 2.1 association baseline intact (`20260720090000_sprint02_wave21_enums.sql`, `20260720100000_sprint02_wave21_association_domain.sql`).

### 4. Implementation Summary
- **Migration Created:**
  - `supabase/migrations/20260720110000_sprint02_wave22_resident_domain.sql`
- **Schema & Tables Added:**
  - Enum `public.resident_status`: `pending`, `active`, `inactive`, `former`, `deceased`, `blocked`.
  - Table `public.residents`: tenant-scoped resident registry.
    - FKs: `tenant_id -> tenants(id) ON DELETE CASCADE`, `profile_id -> profiles(id) ON DELETE RESTRICT`, `approved_by_profile_id -> profiles(id) ON DELETE RESTRICT`.
    - Constraints: `UNIQUE (tenant_id, profile_id)`, composite `UNIQUE (id, tenant_id)`.
    - Partial Unique Index: `residents_tenant_registration_code_uidx` on `(tenant_id, registration_code) WHERE registration_code IS NOT NULL`.
    - Trigram Index: `residents_registration_code_trgm_idx` using `gin_trgm_ops`.
    - Indexes: `(tenant_id, status)`, `(profile_id)`.
  - Table `public.resident_staff_notes`: staff-only append-only note repository for resident notes & status change reasons.
    - FKs: `tenant_id -> tenants(id)`, composite FK `(resident_id, tenant_id) -> residents(id, tenant_id) ON DELETE CASCADE`, `author_profile_id -> profiles(id)`.
    - CHECK constraint: `note_kind IN ('general', 'status_reason')`.
    - Indexes: `(tenant_id, resident_id)`, `(author_profile_id)`.
- **Triggers & Helpers:**
  - `trg_residents_updated_at`: updates `updated_at` on modification using `public.touch_updated_at()`.
  - `trg_residents_protected_fields`: enforces immutability of `tenant_id`, `profile_id`, `approved_by_profile_id`, and `approved_at`.
  - `trg_residents_status_transition`: enforces §8.1 lifecycle status transition graph (`pending` -> `active`/`former`; `active` -> `inactive`/`blocked`/`former`/`deceased`; `former` -> `pending` re-entry path; prohibits direct `former`/`deceased` -> `active` and transitions out of `deceased`). Automatically populates `joined_at`, `approved_at`, `approved_by_profile_id`, and `left_at`.
  - `trg_resident_staff_notes_no_update` & `trg_resident_staff_notes_no_delete`: enforces append-only posture on `resident_staff_notes`.
  - Helper function: `public.is_active_resident(target_tenant_id uuid)` (`SECURITY DEFINER`, `STABLE`, `SET search_path = ''`).

### 5. Files Changed
- `supabase/migrations/20260720110000_sprint02_wave22_resident_domain.sql` *(new migration)*
- `src/lib/supabase/database.types.ts` *(regenerated database types)*
- `supabase/tests/sprint02_domain.sql` *(added Wave 2.2 validation tests 8-11)*
- `supabase/tests/sprint01_edge_function_auth.test.mjs` *(updated invalid token envelope condition for local gateway)*
- `docs/backend/39-wave-22-resident-domain-report.md` *(this report)*

### 6. Authorization Posture
- **Tenant Isolation:** All queries filter strictly by `tenant_id`. Cross-tenant inserts, updates, reads, and composite FK references are structurally rejected by RLS and constraints.
- **Resident Self-Access:** Residents may SELECT their own record (`profile_id = current_profile_id()`) across all lifecycle statuses. Self-UPDATE on `residents` table is NOT permitted (self-service moveout is handled via `residence_members` in Wave 2.3).
- **Administrative & Staff Access:** Users with `residents:read` (admin, operator, support, finance, viewer) may read residents in their tenant. Staff with `residents:write` (admin, operator) may manage resident records and read/insert `resident_staff_notes` via Edge Functions and RPCs.
- **Confidentiality Boundary:** `resident_staff_notes` is strictly restricted to `residents:write` holders and platform admin. Residents, housemates, support, finance, and collectors cannot read staff notes. Co-household broad RLS reads on `residents` were removed to prevent leak of sensitive status reasons and eliminate correlated subquery overhead.
- **Mutation Boundary Posture (Remediated):** `INSERT`, `UPDATE`, and `DELETE` grants on `public.residents` and `public.resident_staff_notes` are REVOKED from `authenticated` and `anon`. Direct PostgREST client writes are structurally unavailable at the grant layer (`42501 insufficient_privilege`).

### 7. Validation Results
- `npm run typecheck`: **EXIT 0**
- `npm run build`: **EXIT 0**
- `npm run supabase:test:sprint2`: **EXIT 0** (All Sprint 2 Wave 2.1 and Wave 2.2 tests passed)
- `npm run supabase:test:all`: **EXIT 0**
  - Sprint 1 DB Foundation tests: **PASS**
  - Edge Function Auth suite (35/35 tests): **PASS**
  - D2 Regression suite: **PASS**
  - ADR-11 Finance Compatibility (11/11 tests): **PASS**
  - CF-03/CF-04 Namespace Guard: **PASS**
  - Sprint 2 Domain suite: **PASS**
- `bash validation/check_d2_namespace.sh`: **EXIT 0**

### 8. Findings & Accepted Limitations
- **Findings:** None remaining after Phase 2 remediation. All design rules (D-01, D-10, D-13, D-14, ARB-22, RM-07, RM-08) were faithfully implemented.
- **Accepted Scope Boundaries:** Residence membership, household relationships (`household_members`), payer assignments (`residence_payers`), and invitation processing (`residence_invitations`) remain out of scope for Wave 2.2 and are reserved for Wave 2.3.

### 9. Independent Security Audit & Remediation (Phase 1–11)
- **Mutation Boundary Audit (Phase 2):** Initial migration granted `INSERT` and `UPDATE` on `residents` and `INSERT` on `resident_staff_notes` to `authenticated`. Audited against document 29 §2 Rule 12 & §4 ("Write path: no table needs a write grant. RPCs mutate; RLS authorizes inside them"). Remediated by revoking table write grants from `authenticated`. Direct client PostgREST table writes are now structurally blocked at the grant layer (`42501 insufficient_privilege`). Tests updated (SPR2-RES-GRANT-01 & 02).
- **Function-Security Audit (Phase 3):** `public.is_active_resident(uuid)` audited. Function uses `SECURITY DEFINER`, `STABLE`, `SET search_path = ''`. Audited for privilege escalation and data leakage: function queries `profile_id = public.current_profile_id()`, only returning boolean indicating whether the *caller itself* is an active resident in the target tenant. It cannot be used to probe arbitrary tenant memberships of other users. `SECURITY DEFINER` posture is required to allow RLS policies on other tables (e.g. `residences`) to check caller resident status without triggering recursive RLS evaluation on `residents`.
- **Resident Self-Access Audit (Phase 4):** Audited self-read policy (`profile_id = current_profile_id()`). Resident self-read is allowed across all lifecycle states (`pending`, `active`, `inactive`, `former`, `deceased`, `blocked`). Confidentiality is preserved because sensitive staff notes and status change reasons are segregated in `resident_staff_notes` (staff-only), while `residents` base table contains only non-sensitive operational fields.
- **Lifecycle State Machine Audit (Phase 5 & 6):** Audited `residents_status_transition_check()` and `residents_protected_fields_immutable()`. Validated complete transition matrix: `pending` -> `active`/`former`; `active` -> `inactive`/`blocked`/`former`/`deceased`; `former` -> `pending` (re-entry path); prohibiting direct `former`/`deceased` -> `active` and transitions out of `deceased`. Approval metadata (`approved_by_profile_id`, `approved_at`) is set during initial activation and preserved immutably across subsequent updates and re-entry.
- **Registration Code Semantics Audit (Phase 7):** Audited `residents_tenant_registration_code_uidx` (`UNIQUE (tenant_id, registration_code) WHERE registration_code IS NOT NULL`). Re-entry reuses the existing resident record and registration code, while former/deceased records retain their registration code in the table, preventing code reuse across different profiles.
- **Index Audit (Phase 8):** Audited added indexes. `idx_residents_tenant_status` (status filtering), `idx_residents_profile` (self-read RLS lookup), `residents_tenant_registration_code_uidx` (uniqueness), `residents_registration_code_trgm_idx` (trigram search), `idx_resident_staff_notes_tenant_resident` (staff note lookups), and `idx_resident_staff_notes_author` (author lookups) all map to specific operational query contracts.
- **Confidential-Data Boundary Audit (Phase 9):** Confirmed `resident_staff_notes` is readable only by `residents:write` holders and platform admin. Append-only posture is enforced by both table grants (no UPDATE/DELETE granted) and database triggers.
- **Evidence & Test Integrity (Phase 10):** Certified Sprint 1 evidence artifact `sprint01_edge_function_authorization.json` was restored and kept untouched. Full regression test chain executed with 100% pass rate across all suites.

### 10. Final Recommendation
Wave 2.2 Resident Domain Foundation is fully remediated, verified, and ready for independent certification.

---
**Status:** `WAVE 2.2 REMEDIATED — RESIDENT DOMAIN READY FOR INDEPENDENT CERTIFICATION`
