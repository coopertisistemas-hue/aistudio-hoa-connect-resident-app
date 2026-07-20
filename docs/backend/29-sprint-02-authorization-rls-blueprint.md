# 29 — Sprint 2 Authorization and RLS Blueprint

**Status:** PROPOSED — no policies or functions created. Governs the tables proposed in
`28-sprint-02-domain-model.md` and extends the certified Sprint 1 authorization model.

Sprint 1 certified model (unchanged): RLS ENABLE + FORCE everywhere; authorization
resolved by SECURITY DEFINER, STABLE helpers with `SET search_path = ''`
(`current_profile_id()`, `is_platform_admin()`, `is_active_tenant_member(uuid)`,
`has_tenant_role(uuid, tenant_role)`, `has_tenant_permission(uuid, tenant_permission)`,
`is_active_residence_member(uuid)`, `can_access_residence(uuid)`); `authenticated`
holds SELECT-only on `tenants`/`properties`/`tenant_members`/`residence_members` and no
grant on `platform_role_assignments`/`audit_events`.

---

## 1. Actors

| Actor | Definition (resolution path) |
|---|---|
| Resident self | Active profile acting on own records (`current_profile_id()`). |
| Household member | Profile with active `residence_members` in the same property (any `residence_role`). |
| Residence responsible payer | Profile with active `residence_payers` row for the property. |
| Association administrator | Active `tenant_members` row, role `association_admin`. |
| Association operator | Active `tenant_members` row, role `association_operator`. |
| Collector | Active `tenant_members` row, role `association_collector` (new, D-07). |
| Finance user | Active `tenant_members` row, role `association_finance`. |
| Support user | Active `tenant_members` row, role `association_support`. |
| Association viewer | Active `tenant_members` row, role `association_viewer`. |
| Platform administrator | Active `platform_role_assignments` row, role `platform_admin`. |
| Platform support | Active `platform_role_assignments`, role `platform_support` — exists in the certified enum; Sprint 2 grants it **no** tenant-domain access (observational tooling is a future module). |
| Anonymous user | No valid JWT → PostgREST `anon` / Edge Function 401. No access to anything. |
| Revoked user | Profile whose relevant membership (`tenant_members`/`residence_members`) has `status = 'revoked'` — helpers require `active`, so authority collapses immediately. |
| Disabled user | `profiles.status = 'disabled'` → `current_profile_id()` returns NULL (certified behavior) → all self/scoped policies fail closed. |

## 2. Boundary rules

1. **Self-service boundary:** a resident mutates only own `profiles` editable fields and
   own `profile_contacts` (certified), own pending move-out *requests*, and own
   household `household_members` rows within own active property. A resident never
   writes `residents`, `residence_members`, `residence_payers`,
   `association_details`, or another person's data.
2. **Tenant administrator boundary:** `association_admin` holds all tenant permissions
   inside their tenant only. Cross-tenant is structurally impossible (helpers are
   tenant-parameterized and RLS-enforced; forged tenant IDs fail the helper checks).
3. **Association operator boundary:** operational read/write on residents, residences,
   household, payers, invitations; **no** `tenant_context:admin` (cannot manage staff
   or association settings); **no** finance permission values.
4. **Collector boundary (new role):** read-only on `properties` + active occupancy
   projection needed for routes; **no** resident personal data beyond what
   `residences:read` exposes; zero write in Sprint 2 (meter routes are a future
   module).
5. **Finance boundary:** `association_finance` reads payers/residents/residences;
   Sprint 2 grants finance **no writes** (billing writes arrive with the billing module
   and its own review).
6. **Support boundary:** `association_support` reads residents/residences/contacts for
   assistance; no writes in Sprint 2.
7. **Platform administrator boundary:** read access to tenant-domain tables for
   operations/audit; **no direct write policies** on any Sprint 2 tenant table; any
   platform-side intervention goes through a future governed procedure with audit
   (mirrors ADR-10 P3 posture).
8. **Cross-residence restriction:** household visibility is property-scoped: an active
   member of property X reads household/payer/occupancy data of property X only;
   `can_access_residence(property_id)` is the single gate.
9. **Revoked membership behavior:** revocation is immediate for authorization (helpers
   filter `status='active'`). Closed history rows remain visible to staff; the revoked
   user loses self-read of the tenant's data except their own platform profile/contacts.
10. **Disabled profile behavior:** total fail-closed (see §1). Staff of a tenant can
    still see the disabled profile's existence through association read paths (needed
    for history); no action can be performed *by* the disabled user.
11. **Service-role restriction:** Edge Functions use the RLS-enforced `authClient` for
    all domain operations. Service role is permitted in exactly one Sprint 2 flow:
    invitation acceptance lookup by `token_hash` (document 30 §3), returning only the
    minimal invitation projection, never row-level passthrough. Any other service-role
    usage is a certification blocker (R-09).

## 3. Permission model extension

`has_tenant_permission()` keeps its certified hardcoded matrix style. Proposed
additions (D-07), per role:

| Permission | admin | operator | finance | support | viewer | collector |
|---|---|---|---|---|---|---|
| `residents:read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `residents:write` | ✓ | ✓ | — | — | — | — |
| `residence_payers:read` | ✓ | ✓ | ✓ | — | ✓ | — |
| `residence_payers:write` | ✓ | ✓ | — | — | — | — |
| `household:read` | ✓ | ✓ | — | ✓ | ✓ | — |
| `household:write` | ✓ | ✓ | — | — | — | — |
| `invitations:read` | ✓ | ✓ | — | — | ✓ | — |
| `invitations:write` | ✓ | ✓ | — | — | — | — |
| `association_details:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `association_details:write` | ✓ | — | — | — | — | — |
| `audit:read_association` | ✓ | — | ✓ | — | — | — |
| *(existing)* `residences:read` | ✓ | ✓ | ✓ | ✓ | ✓ | **+ ✓ (collector added here)** |
| *(existing)* `residences:write` | ✓ | ✓ | — | — | — | — |
| *(existing)* `tenant_members:read/write`, `tenant_context:admin`, `profiles:*`, `profile_contacts:*` | unchanged from certified matrix | | | | | |

Collector receives `residences:read` so `can_access_residence()`-based property reads
work for route listing; collector receives nothing else. This is the only change to an
existing permission's role set.

## 4. New helper functions (proposed)

All SECURITY DEFINER, STABLE, `SET search_path = ''`, granted EXECUTE to
`authenticated`, mirroring certified helpers:

| Helper | Purpose |
|---|---|
| `is_active_resident(uuid /*tenant*/)` | caller has `residents` row `status='active'` in tenant. |
| `has_active_payer(uuid /*property*/)` | caller is the active payer of the property. |
| `is_household_responsible(uuid /*household_member_id*/)` | caller is `responsible_profile_id` of the row and holds active membership in that property. |
| `current_association_context(uuid /*tenant*/)` | staff-scoped context projection (association details + counts) for staff UIs. |

No helper returns rows the caller could not read via policies (helpers are predicates,
not data sources — the `current_tenant_context()` precedent).

**SECURITY DEFINER needs:** only the helpers above + reuse of certified ones. No new
table needs function-mediated writes: writes go through Edge Functions using the
caller-context `authClient`, authorized by RLS WITH CHECK. (Deviation from this rule
must be justified per function in document 30.)

## 5. Authorization matrix

Legend: R=read, W=write (insert/update via EF), Wself=write own/limited, A=approve/
transition, —=none. "Own" = rows tied to the actor's profile/property scope.

| Capability | resident self | household member | payer | admin | operator | collector | finance | support | viewer | platform admin | anonymous | revoked | disabled |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `profiles` (own) | R Wself | R Wself | R Wself | R* | R* | — | R* | R* | R* | R | — | R Wself (own profile only) | — |
| `profile_contacts` (own) | R Wself | R Wself | R Wself | R* verify* | R* verify* | — | — | R* | — | R | — | R Wself | — |
| `tenants` / `association_details` | R (own tenants) | R | R | R W | R | R | R | R | R | R | — | — | — |
| `properties` (in scope) | R (own) | R (own property) | R (own property) | R W | R W | R | R | R | R | R | — | — | — |
| `residents` (own record) | R | R (co-members only, via property) | R (own) | R W A | R W A | — | R | R | R | R | — | — | — |
| `residence_members` | R (own + history own) | R (own property) | R (own property) | R W A | R W A | R (active only) | R | R | R | R | — | history of own closed rows: **—** (staff channel) | — |
| `household_members` | R Wself (own property) | R (own property) | R (own property) | R W | R W | — | — | R | R | R | — | — | — |
| `residence_payers` | R (own property) | R (own property) | R (own rows + history) | R W A | R W A | — | R | — | R | R | — | — | — |
| `residence_invitations` | create* (resident inviter, if enabled), R own | — | — | R W A | R W A | — | — | — | R | R | token-accept only (via EF) | — | — |
| `audit_events` | — | — | — | R (tenant scope) | — | — | R (tenant scope) | — | — | R | — | — | — |

\* = via association-scoped read paths certified in Sprint 1 (`profiles:read_association`,
`profile_contacts:read_association`, `profile_contacts:verify`).

Revoked/disabled semantics: "revoked" column = user with revoked *tenant/residence*
membership (platform identity still active) — keeps only platform-self rows. "Disabled"
= `profiles.status='disabled'` — `current_profile_id()` NULL → no rows anywhere.

## 6. Per-table RLS plan

Grant posture follows Sprint 1: new tables get `REVOKE ALL` from `anon, authenticated`,
then explicit grants. Write grants go to `authenticated` only where a policy pins the
row to the caller; staff writes are granted on the table but constrained by
tenant-permission WITH CHECK (the certified `profile_contacts` insert-self pattern
generalized). Where a WITH CHECK cannot fully express the rule (e.g. period overlap),
the Edge Function performs the check and the policy stays a necessary-but-not-sufficient
guard — never the reverse.

### 6.1 `association_details`

- **Grants:** SELECT, INSERT, UPDATE to `authenticated`. No DELETE.
- **SELECT:** `has_tenant_permission(tenant_id, 'association_details:read') OR
  is_active_residence_member-of-tenant OR is_active_resident(tenant_id) OR
  is_platform_admin()`. (Residents may read the public association projection — name,
  contacts. If field-level secrecy is later required, split a view; Sprint 2 keeps the
  row readable to members.)
- **INSERT:** WITH CHECK `has_tenant_permission(tenant_id,
  'association_details:write')` (admin only) — normally one row seeded at tenant
  creation.
- **UPDATE:** USING + WITH CHECK same permission.
- **DELETE:** none.
- **Protected fields:** `tenant_id` immutable (trigger candidate, mirrors
  `profiles_protected_fields_immutable` pattern).
- **Recursion risk:** low — policies call helpers on `tenant_members` (already
  definer-wrapped).

### 6.2 `residents`

- **Grants:** SELECT, INSERT, UPDATE to `authenticated`. No DELETE (D-10).
- **SELECT:** `profile_id = current_profile_id()` (self, all statuses incl. history)
  `OR has_tenant_permission(tenant_id, 'residents:read') OR is_platform_admin() OR
  EXISTS (active residence_membership of the target profile in a property where caller
  is an active household member)` — the last clause lets co-household members see the
  resident record of people they live with (scoped projection; see note below).
- **INSERT:** WITH CHECK `has_tenant_permission(tenant_id, 'residents:write')` +
  `status = 'pending'` forced (mirrors the certified verification-spoof guard: initial
  status cannot be forged to `active`; approval is a separate UPDATE).
- **UPDATE:** USING `has_tenant_permission(tenant_id, 'residents:write')`; WITH CHECK
  same + protected-field trigger below. Self-service move-out *request* is modeled as
  an Edge Function writing a guarded field or a request row — final mechanism in
  Wave 2.5 (document 30 `resident-moveout-request`); if implemented as UPDATE, a
  dedicated self policy allows only `status_reason` append with status unchanged.
- **DELETE:** none.
- **Protected fields (trigger `residents_protected_fields_immutable`):**
  `tenant_id`, `profile_id`, `approved_by_profile_id`, `approved_at` — immutable after
  set; `registration_code` change allowed but audited.
- **Recursion risk:** the co-household clause joins `residence_members` for the target
  profile — both sides through definer helpers to avoid policy-on-policy recursion
  (assert in SPR2-RLS gates with a recursive-plan check).

### 6.3 `household_members`

- **Grants:** SELECT, INSERT, UPDATE, DELETE to `authenticated`.
- **SELECT:** `can_access_residence(property_id)` (covers members, tenant staff with
  `residences:read`, platform admin) `OR is_household_responsible(id)`.
  (`can_access_residence` already bundles exactly these three classes — reuse keeps the
  certified single gate; collector gets read via its `residences:read` grant **only if
  product wants collectors to see dependents** — default: collectors excluded by using
  a stricter predicate `has_tenant_permission(tenant_id,'household:read')` for staff
  instead of the broad helper. **Decision point recorded for Wave 2.4** — recommend
  strict predicate.)
- **INSERT:** WITH CHECK `(is_household_responsible-by-property OR
  has_tenant_permission(tenant_id,'household:write'))` AND `responsible_profile_id`
  must reference a profile with active membership in `property_id` (definer helper
  `is_active_residence_member_of(property_id, profile_id)` — new 2-arg helper).
- **UPDATE:** USING same classes; WITH CHECK same; `property_id`, `tenant_id`,
  `responsible_profile_id` protected by trigger (move between properties = delete +
  create, audited).
- **DELETE:** responsible resident or `household:write` staff; audited (D-10).
- **Recursion risk:** medium — INSERT check references `residence_members`; keep the
  check inside one definer helper; gate SPR2-RLS-recursion asserts no infinite
  recursion under concurrent policy evaluation.

### 6.4 `residence_payers`

- **Grants:** SELECT, INSERT, UPDATE to `authenticated`. No DELETE.
- **SELECT:** `has_active_payer(property_id)` (self incl. own ended history:
  `profile_id = current_profile_id()`) `OR` active household member of property
  (`is_active_residence_member(property_id)`) `OR has_tenant_permission(tenant_id,
  'residence_payers:read') OR is_platform_admin()`.
- **INSERT:** WITH CHECK `has_tenant_permission(tenant_id,'residence_payers:write')`
  AND payer profile is a resident of the tenant (helper `profile_is_tenant_resident(
  tenant_id, profile_id)`) AND `status='active'` forced (initial `ended` rows make no
  sense).
- **UPDATE:** restricted shape: only `status → 'ended'` + `end_date` + `end_reason`
  allowed; enforced by trigger `residence_payers_close_only` (USING/WITH CHECK
  permission + trigger field guard). Changing the payer = close + insert (history
  preserved).
- **DELETE:** none.
- **Protected fields:** `tenant_id`, `property_id`, `profile_id`, `start_date`
  immutable.
- **Recursion risk:** low (helpers only).

### 6.5 `residence_invitations`

- **Grants:** SELECT, INSERT, UPDATE to `authenticated`. No DELETE.
- **SELECT:** `has_tenant_permission(tenant_id,'invitations:read') OR
  is_platform_admin() OR (inviter_profile_id = current_profile_id())`. **Token column
  never selectable by `authenticated`:** enforce by *column-level grant* — grant SELECT
  on all columns **except** `token_hash` to `authenticated` (PostgREST column
  privileges), the Sprint-1-era D2 precedent (`profile_read_test` column grants)
  applied to production for the first time. `token_hash` is read only inside the
  SECURITY DEFINER accept RPC.
- **INSERT:** staff WITH CHECK `invitations:write` (+ `inviter_type='association'`),
  or resident inviter: active member of `property_id` + `inviter_type='resident'` +
  association setting `settings->>'allows_resident_invitations' = 'true'` (checked in
  EF; policy checks membership only).
- **UPDATE:** only `status` transitions via staff (`invitations:write` → revoke) or the
  accept RPC; `token_hash`, `invitee_*`, `property_id`, `tenant_id` immutable
  (trigger).
- **DELETE:** none (revoke, don't delete).
- **SECURITY DEFINER need:** `accept_residence_invitation(token text)` RPC —
  hashes input, looks up by `token_hash`, validates expiry/status, creates/attaches
  profile + `residents` (pending→active per association setting) + `residence_members`
  (proposed role, `pending` or `active` per association approval setting), marks
  invitation accepted, writes audit. This is the one sanctioned service-role-adjacent
  path; implemented as a definer function executing as owner but with explicit internal
  checks, not blanket row access. Rate limiting at the Edge Function.
- **Recursion risk:** none in policies; the accept RPC is procedural.

### 6.6 `residence_members` (policy evolution)

Certified policies (`residence_members_select_self_policy`,
`residence_members_select_tenant_policy`) remain valid because they filter
`status='active'` via helpers. Sprint 2 additions:

- **SELECT history:** extend self policy to include caller's own closed rows
  (`profile_id = current_profile_id()` without status filter) — residents can see
  their own history. Staff read unchanged (already all rows in tenant via
  `residences:read`).
- **INSERT:** WITH CHECK `has_tenant_permission(tenant_id,'residences:write')` +
  `status='pending'` forced unless association auto-approve setting (EF decides; policy
  allows `pending|active` for staff, never self-insert).
- **UPDATE:** staff `residences:write`; WITH CHECK same; trigger
  `residence_members_transition_guard` enforces §8.3 transition legality + protected
  fields (`tenant_id`, `property_id`, `profile_id`, `start_date`).
- **DELETE:** none (close, don't delete).
- **Recursion risk:** unchanged helpers; D-05 constraint change does not affect policy
  semantics (they are status-based, not unique-based).

### 6.7 Existing tables

No policy changes to `profiles`, `profile_contacts`, `tenants`, `properties`,
`tenant_members`, `platform_role_assignments`, `profile_preferences`,
`profile_devices`, `audit_events`. Association-scoped audit read (new) is delivered
through a SECURITY DEFINER RPC `tenant_audit_events(tenant_id, from, to, limit)`
gated by `audit:read_association` — the table itself keeps its certified
platform-admin-only policy; no new grant on `audit_events`.

## 7. Failure-mode requirements (fail-closed checklist)

Every new policy and helper must satisfy, with an automated gate each (document 31):

1. NULL `current_profile_id()` (disabled/anonymous) ⇒ zero rows.
2. Revoked membership ⇒ zero scoped rows on first subsequent query (no cache).
3. Forged `tenant_id` in body/query ⇒ helper returns false (tenant derived from
   target entity, never trusted from client).
4. Cross-tenant IDs combined in one request ⇒ FK + helper both fail.
5. Direct PostgREST access attempts on new tables by `anon` ⇒ permission denied
   (no grants), by `authenticated` outside policy ⇒ zero rows / WITH CHECK violation.
6. Service-role key absence in function env ⇒ function refuses mutations (defense in
   depth for R-09).
