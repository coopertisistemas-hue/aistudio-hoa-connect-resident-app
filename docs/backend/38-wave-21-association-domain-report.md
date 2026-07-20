# 38 — Wave 2.1 Association Domain Foundation Report

**Wave:** 2.1
**Topic:** Association Domain Foundation Extension
**Status:** COMPLETE — READY FOR INDEPENDENT AUDIT
**Date:** 2026-07-20

---

## 1. Objective

Implement the tenant-scoped Association Details foundation approved in Sprint 2 planning (documents 27–37), extending the certified tenant model (`tenants`) without advancing into Resident, Household, Invitation or frontend integration.

---

## 2. Baseline Inspected

- **Repository:** `aistudio-hoa-connect-resident-app`
- **Branch:** `sprint-01-foundation-identity`
- **Initial HEAD:** `2778043931c5ba0141710e9dd12c909eaa96d4de`
- **Certified Tag:** `hoa-connect-sprint-01-foundation-certified-v1.0.0` (`a58a1ed98b0e5299678a41be833729895b31f101`)
- **Wave 2.0 Governance:** Executive sign-off on 7 frozen items registered in document 36 §2.

---

## 3. Implementation Summary

1. **Enum Additions:**
   - `tenant_role` extended with `association_collector` (D-06/D-07).
   - `tenant_permission` extended with 12 new permission values: `residents:read`, `residents:write`, `residence_payers:read`, `residence_payers:write`, `household:read`, `household:write`, `invitations:read`, `invitations:write`, `association_details:read`, `association_details:write`, `audit:read_association`, `residences:read_routes`.

2. **Authorization Matrix Helper:**
   - Extended `public.has_tenant_permission(target_tenant_id, target_permission)` to implement the approved role-permission matrix (document 29 §3).

3. **Domain Tables:**
   - `public.association_details` (document 28 §6.1): strict 1:1 extension of `tenants`, carrying trade name, registration number (CNPJ/corporate ID), email, phone, address, `settings` JSONB (restricted to 4 allow-listed keys), and `enabled_modules` JSONB (restricted to 5 allow-listed modules).
   - `public.association_settings_private` (document 28 §6.7 / D-14): separate 1:1 table for private operational settings, accessible only by `association_admin` (`association_details:write`) and platform admin.

4. **Database Constraints & Triggers:**
   - Global partial unique index on `association_details(registration_number) WHERE registration_number IS NOT NULL`.
   - Immutable `tenant_id` triggers on both tables (`association_details_protected_fields_immutable`, `association_settings_private_protected_fields_immutable`).
   - `touch_updated_at()` triggers on both tables.
   - Automatic tenant creation trigger (`on_tenant_created`) seeding 1:1 rows on tenant creation.

5. **RLS & Grant Layer Posture:**
   - `RLS ENABLE + FORCE` on both tables.
   - `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated`.
   - `GRANT SELECT` to `authenticated`.
   - **Zero `INSERT`, `UPDATE`, `DELETE` grants to `authenticated` or `anon` on any table** (RM-06 / `SPR2-GRANT-01`). Direct writes remain blocked.

---

## 4. Files Changed

- `supabase/migrations/20260720090000_sprint02_wave21_enums.sql` (new)
- `supabase/migrations/20260720100000_sprint02_wave21_association_domain.sql` (new)
- `supabase/tests/sprint02_domain.sql` (new)
- `validation/evidence/sprint02_wave21_association_domain.json` (new)
- `package.json` (updated `supabase:test:sprint2` script and chained into `supabase:test:all`)
- `src/lib/supabase/database.types.ts` (regenerated TypeScript types matching local schema)

---

## 5. Tests Executed & Validation Results

- **`npm run typecheck`:** PASS (exit 0)
- **`npm run build`:** PASS (exit 0)
- **`npm run supabase:test:sprint2`:** PASS (exit 0, all 7 test blocks green)
- **`npm run supabase:test:all`:** PASS (exit 0, full aggregate suite green)
  - Sprint 1 foundation suite: PASS
  - Edge Function authorization suite: PASS
  - D2 regression suite: PASS
  - ADR-11 compatibility suite: PASS
  - Sprint 2 Wave 2.1 domain suite: PASS
- **`bash validation/check_d2_namespace.sh`:** PASS (CF-03/CF-04 guard verified)

---

## 6. CF-05 Verification Record

Baseline claims and file references verified directly:
- `supabase/migrations/20260719170000_sprint01_foundation_identity.sql:29-54` (`tenant_role` and `tenant_permission` enums).
- `supabase/migrations/20260719170000_sprint01_foundation_identity.sql:304-329` (`has_tenant_permission()` matrix).
- `docs/backend/28-sprint-02-domain-model.md:228-261` (`association_details` model).
- `docs/backend/28-sprint-02-domain-model.md:567-580` (`association_settings_private` model).
- `docs/backend/29-sprint-02-authorization-rls-blueprint.md:251-268` (`association_details` RLS).
- `docs/backend/29-sprint-02-authorization-rls-blueprint.md:76-86` (Zero table write grant posture).

---

## 7. Risks, Findings & Accepted Limitations

- **No RPC mutations in Wave 2.1:** In accordance with the execution roadmap (document 37 §1), mutation RPCs are assigned to Wave 2.4b. Table write grants remain revoked, so direct table mutations by `authenticated` fail fail-closed at the grant layer (`42501`).
- **No business domain leakage:** No Resident, Residence, Household, Invitation, metering or billing functionality was implemented in Wave 2.1.

---

## 8. Final Recommendation

Wave 2.1 execution is complete, fully validated, evidence-backed, and ready for independent technical audit.

```text
WAVE 2.1 COMPLETE — ASSOCIATION DOMAIN READY FOR INDEPENDENT AUDIT
```
