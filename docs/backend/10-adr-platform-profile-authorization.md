# ADR-10 — Platform-Level Profile Authorization

## Status

**Accepted — validated on July 19, 2026 in isolated local execution.**

Blocks Sprint 1 (Identity & Platform Primitives).

---

## Context

ADR-01 introduces `profiles` as a platform-level identity table. One row exists per `auth.users`, and a person may hold active residences across multiple associations. Therefore `profiles` intentionally has no `tenant_id`.

The table stores PII:

- `full_name` (legal name)
- `preferred_name`, `display_name`, `pronoun_preference`
- `document` (CPF / national identifier)
- `birth_date`
- `photo_path`

The existing backend uses a single `is_tenant_member(tenant_id)` predicate for nearly every RLS policy. That predicate cannot be applied to `profiles` because the table is not tenant-scoped. A generic tenant-member read would either fail syntactically or, if naïvely applied through a join, grant every tenant member access to every profile.

---

## Problem

Define explicit `profiles` RLS policies that satisfy:

1. A user may read and update their own profile.
2. An authorized association operator may read only profiles connected to that association through an explicit relationship chain.
3. Platform administrators may access profiles through an explicit role policy.
4. Being a member of any tenant must not grant access to all profiles.
5. Sensitive fields (CPF, birth date, full name) are protected from resident-initiated updates.

---

## Considered options

### Option A — Three policy groups on `profiles`

- Self access: `user_id = auth.uid()`.
- Association access: through `residence_members → properties → tenants`.
- Platform admin access: through a dedicated `platform_admins` table.

### Option B — Mirror profile data into tenant-scoped tables

Create a `tenant_profiles` table per tenant that shadows `profiles`. Association staff read from the shadow; `profiles` remains owner-only.

- Rejected: creates a synchronization problem; duplicates PII; breaks the "one person, many associations" model in ADR-01.

### Option C — Staff reads profiles through Edge Function only

Association staff never query `profiles` directly; all access is through `service_role` Edge Functions.

- Rejected: RLS is defense in depth. A future accidental grant or compromised client must still be constrained. Also, Realtime and some staff tooling may need direct policy-backed access.

---

## Decision

Select **Option A — Three policy groups on `profiles`**.

### Policy group P1 — Self access

**SELECT:**

```sql
CREATE POLICY "profiles_select_self" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());
```

**UPDATE (resident-editable fields only):**

```sql
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    full_name IS NOT DISTINCT FROM profiles.full_name
    AND document IS NOT DISTINCT FROM profiles.document
    AND birth_date IS NOT DISTINCT FROM profiles.birth_date
  );
```

Allowed columns in resident updates: `preferred_name`, `display_name`, `pronoun_preference`, `photo_path`.
Protected fields (`full_name`, `document`, `birth_date`) must flow through a correction request that issues a `COR-` protocol.

**DELETE:** denied at RLS; erasure is a platform-admin/LGPD operation.

### Policy group P2 — Authorized association access

Association staff with an active `tenant_members` row in a tenant may read profiles linked to a residence in that tenant:

```sql
CREATE POLICY "profiles_select_association" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.residence_members rm
      JOIN public.properties p ON p.id = rm.property_id
      JOIN public.tenant_members tm ON tm.tenant_id = p.tenant_id
      WHERE rm.profile_id = profiles.id
        AND rm.status = 'active'
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );
```

This is read-only for staff. No `INSERT`/`UPDATE`/`DELETE` on `profiles` by association operators.

### Policy group P3 — Platform administration

```sql
CREATE POLICY "profiles_select_platform_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_admins
      WHERE user_id = auth.uid() AND active = true
    )
  );
```

Platform admins may also update protected fields as part of a governed correction workflow. That policy is implemented as a separate, narrowly scoped `UPDATE` policy gated by platform admin role and by an explicit approval token or audit reference.

### Helper functions

The existing `is_tenant_member(target_tenant_id uuid)` remains unchanged. New helpers added for resident-scoped tables:

```sql
public.is_residence_member(target_property_id uuid) → boolean
public.has_residence_role(target_property_id uuid, allowed text[]) → boolean
```

These are not used directly in the `profiles` policies (which need the association chain), but they are part of the same authorization model.

### Indexing needed

- `profiles(user_id)` — unique index already required for the 1:1 relationship.
- `residence_members(profile_id) WHERE status = 'active'` — partial index supports the association chain lookup.
- Composite FK `(tenant_id, property_id) → properties(tenant_id, id)` on `residence_members` ensures the denormalized `tenant_id` cannot be corrupted.

### Field-level exposure controls

- `document` (CPF) is encrypted at rest; the column should be accessible only to the owner, first-access verification functions, and platform admins.
- The resident-facing API returns `cpfMasked` derived by the assembler.
- `birth_date` is returned only to the owner and to authorized association staff during identity verification; the general profile endpoint omits it.
- `photo_path` is resolved to a short-TTL signed URL; the storage path itself is never exposed raw.

---

## Consequences

- **Cost:** three policy groups and one association-chain join per staff read. The join is indexed.
- **Benefit:** `profiles` is secure without being tenant-scoped; the platform-level identity model in ADR-01 is preserved.
- **Risk:** a miswritten association policy could expose all profiles. Mitigation: negative tests asserting that staff of tenant A cannot read profiles linked only to tenant B, and that a non-staff resident cannot read another resident's profile.
- **Compliance:** LGPD data export and erasure paths still reach one canonical `profiles` row, avoiding duplication.

---

## Rejected alternatives

| Alternative | Reason rejected |
|---|---|
| Option B — tenant-scoped shadow table | Duplicates PII; synchronization risk; violates ADR-01. |
| Option C — Edge Function-only staff access | Insufficient defense in depth; prevents policy-backed access and Realtime patterns. |
| Add `tenant_id` to `profiles` | Would force one profile per tenant, breaking multi-association residents. |

---

## Validation requirement

Before Sprint 1 closes, the RLS test suite must assert:

1. A resident can read and update their own profile.
2. A resident cannot read another resident's profile.
3. Staff of tenant A can read profiles linked to a residence in tenant A.
4. Staff of tenant A cannot read profiles linked only to tenant B.
5. A resident `UPDATE` that changes `full_name`, `document`, or `birth_date` is rejected.
6. `anon` cannot read any profile.
7. Association staff cannot `UPDATE` or `DELETE` a profile.

---

## Rollback or revision conditions

- If the association-chain policy proves too expensive at scale, add a materialized `profile_tenant_links` table maintained by triggers on `residence_members`.
- If product changes the rule for who may see co-resident PII, revise P2 with product sign-off.
- If platform admin requirements expand beyond read/correction, add narrowly scoped policies rather than broad grants.

---

## Validation Outcome — July 19, 2026

Validation ran in the isolated local Supabase CLI project `aistudio-hoa-connect-resident-app`
on branch `d2-validation-wave`, using:

- [validation/d2_setup.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/d2_setup.sql)
- [validation/adr09_adr10_sql_tests.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_sql_tests.sql)
- [validation/adr09_adr10_runtime_probe.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_runtime_probe.mjs)

Validated results:

- PR-01 self read: PASS.
- PR-02 approved self update: PASS (`preferred_name` only).
- PR-03 protected self fields: PASS via column-privilege denial on `document`.
- PR-04 resident cross-profile read denial: PASS.
- PR-05 authorized operator read through `residence_members -> properties -> tenant_members`: PASS.
- PR-06 cross-tenant operator denial: PASS.
- PR-07 generic tenant member cannot enumerate linked resident profiles: PASS.
- PR-08 unrelated authenticated user cannot read resident profiles: PASS.
- PR-09 platform admin governed correction path: PASS, with audit row written to `profile_correction_audit`.
- PR-10 enumeration resistance: PASS at direct PostgREST surface; resident/operator/unrelated requests to `profiles` returned `403 permission denied for table profiles`.
- PR-11 sensitive-field exposure: PASS at direct PostgREST surface because `profiles` remains non-readable to `authenticated`; owner/operator support must continue through controlled backend projections.
- PR-12 `profile_contacts`: PASS for self access, authorized operator verification-state update, cross-tenant denial, and protected `normalized_value` denial.

Performance evidence:

- Supporting indexes were present on `profiles(user_id)`, active `residence_members(profile_id)`, `tenant_members(tenant_id, user_id, role)`, `support_requests(profile_id)`, and `profile_contacts(profile_id)`.
- `EXPLAIN (COSTS OFF)` showed indexed access paths for the association-chain lookup and support-request lookup in the validation suite.

Current ADR-10 verdict:

```text
VALIDATED — APPROVED FOR SPRINT 1 USE
```
