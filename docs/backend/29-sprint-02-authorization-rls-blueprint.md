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
4. **Collector boundary (new role):** read-only on `properties` (via active tenant
   membership, certified `can_access_residence()`) plus the aggregate occupancy counts
   needed for routes, exposed through `residences:read_routes`. **(R1)** The collector
   holds **no** `residences:read`, therefore reads **zero** `residence_members` rows and
   no resident personal data of any kind. Zero writes in Sprint 2.
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
    all domain operations. **(R1)** Sprint 2 uses the service role in **zero** flows.
    The invitation-accept path, previously the sole exception, is a
    `SECURITY DEFINER` RPC with explicit internal checks — an owner-executed function,
    not a service-role client. Any service-role usage is a certification blocker (R-09).
12. **(R1) Write-permission boundary — no table write grants (RC-06, D-12).**
    Sprint 2 issues **no** INSERT, UPDATE or DELETE grant to `authenticated` on any
    table, certified or new. Certified guarantee #3 (document 27 §2.2) is therefore
    preserved and *extended* to the new tables rather than weakened. All mutations go
    through `SECURITY INVOKER` RPCs whose only grant is `EXECUTE`:

    ```
    GRANT EXECUTE ON FUNCTION public.<rpc>(...) TO authenticated;   -- the write boundary
    -- never: GRANT INSERT/UPDATE/DELETE ON TABLE ... TO authenticated;
    ```

    A `SECURITY INVOKER` function executes as the caller, so **RLS still applies to
    every statement inside it**. The RPC provides atomicity; RLS provides
    authorization; neither substitutes for the other. Policies below therefore still
    specify INSERT/UPDATE `WITH CHECK` predicates — they are evaluated inside the RPC.
    Gate SPR2-GRANT-01 asserts the catalog contains no table write grant to
    `authenticated`.
13. **(R1) Data minimization is architectural, never Edge Function projection (D-14).**
    If an actor must not see a field, that actor must be unable to select it. RLS is
    row-level: a policy that grants a row grants every column of it to anyone holding
    the same JWT, whatever an Edge Function returns. Confidentiality is enforced by
    table separation, policy, RPC read surface, secure view or column grant — the five
    mechanisms enumerated in §8. Edge Function projection is permitted only to shape
    data the caller could already read.

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
| **`residences:read_routes`** *(R1, new)* | ✓ | ✓ | — | — | — | **✓** |
| *(existing)* `residences:read` | ✓ | ✓ | ✓ | ✓ | ✓ | **—** |
| *(existing)* `residences:write` | ✓ | ✓ | — | — | — | — |
| *(existing)* `tenant_members:read/write`, `tenant_context:admin`, `profiles:*`, `profile_contacts:*` | unchanged from certified matrix | | | | | |

**(R1) No existing permission changes its role set.** The previous revision granted the
collector the existing `residences:read`. Verified consequence
(`…foundation_identity.sql:686`): `residence_members_select_tenant_policy` maps
`residences:read` to **every membership row in the tenant** — profile IDs, roles,
periods, primary flags, across all units. That contradicts §4's collector boundary ("no
resident personal data"), and document 30 F-08's planned assertion ("collector lacks
`residents:read`, so the join yields nothing") would have passed while the collector read
the same linkage directly from `residence_members` via PostgREST.

`residences:read_routes` grants property-level reads only and appears in no certified
policy. Keeping every certified policy's audience unchanged is also what makes the Wave
2.7 baseline immutability proof meaningful.

**(R1) Note on `can_access_residence()`.** The certified helper
(`…foundation_identity.sql:347-364`) admits **any active tenant member** regardless of
permission, so a collector reads `properties` rows through it by virtue of membership
alone. This is certified Sprint 1 behavior, not a Sprint 2 regression, and it is
acceptable: `properties` carries no resident personal data. It is recorded here because
it means `residences:read_routes` is about *what the route endpoints may join*, not
about property visibility itself.

## 4. New helper functions (proposed)

All SECURITY DEFINER, STABLE, `SET search_path = ''`, granted EXECUTE to
`authenticated`, mirroring certified helpers:

| Helper | Purpose |
|---|---|
| `is_active_resident(uuid /*tenant*/)` | caller has `residents` row `status='active'` in tenant. |
| `has_active_payer(uuid /*property*/)` | caller is the active payer of the property. |
| `is_household_responsible(uuid /*household_member_id*/)` | caller is `responsible_profile_id` of the row and holds active membership in that property. |
| `is_active_residence_member_of(uuid /*property*/, uuid /*profile*/)` | 2-arg form used by the `household_members` INSERT check, so the check lives in one definer helper rather than as a policy-level join. |
| `current_association_context(uuid /*tenant*/)` | staff-scoped context projection (association details + counts) for staff UIs. |

No helper returns rows the caller could not read via policies (helpers are predicates,
not data sources — the `current_tenant_context()` precedent).

**(R1) SECURITY DEFINER vs SECURITY INVOKER — the boundary.** Two distinct function
classes exist in Sprint 2 and must not be conflated:

| Class | Security | Purpose | Why |
|---|---|---|---|
| **Authorization helpers** (above + certified) | `DEFINER`, `STABLE`, `SET search_path=''` | boolean predicates read by policies | must read `tenant_members`/`residence_members` without triggering those tables' own policies (recursion avoidance) |
| **Mutation RPCs** (D-12, document 30) | **`INVOKER`**, `VOLATILE`, `SET search_path=''` | every domain write, in one transaction with its audit event | must be authorized by RLS *as the caller*; DEFINER here would move authorization into procedural code and re-create the service-role risk class under another name |
| **Two sanctioned DEFINER RPCs** | `DEFINER` with explicit internal checks | `accept_residence_invitation()`, `tenant_audit_events()` | the accept path must read an invitation row the caller cannot see (they are not yet a member); the audit reader must read a table with a platform-admin-only policy. Both check permission internally before returning anything. |

Every DEFINER object is enumerated here; document 31 gate SPR2-RLS-25 asserts the
catalog contains no other DEFINER function in `public` beyond the certified set plus
these two.

**Write path:** no table needs a write grant. RPCs mutate; RLS authorizes inside them
(§2 rule 12). Deviation must be justified per function in document 30.

## 5. Authorization matrix

Legend: R=read, W=write (insert/update via EF), Wself=write own/limited, A=approve/
transition, —=none. "Own" = rows tied to the actor's profile/property scope.

| Capability | resident self | household member | payer | admin | operator | collector | finance | support | viewer | platform admin | anonymous | revoked | disabled |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `profiles` (own) | R Wself | R Wself | R Wself | R* | R* | — | R* | R* | R* | R | — | R Wself (own profile only) | — |
| `profile_contacts` (own) | R Wself | R Wself | R Wself | R* verify* | R* verify* | — | — | R* | — | R | — | R Wself | — |
| `tenants` / `association_details` | R (own tenants) | R | R | R W | R | R | R | R | R | R | — | — | — |
| `properties` (in scope) | R (own) | R (own property) | R (own property) | R W | R W | R | R | R | R | R | — | — | — |
| `residents` (own record) | R | **— (R1)** | R (own) | R W A | R W A | — | R | R | R | R | — | — | — |
| `resident_staff_notes` *(R1)* | — | — | — | R W | R W | — | — | — | — | R | — | — | — |
| `residence_members` | R (own + history own) | R (own property) | R (own property) | R W A | R W A | **— (R1)** | R | R | R | R | — | **R (own closed rows only)** | — |
| `household_members` | R Wself (own property) | R (own property) | R (own property) | R W | R W | — | — | R | R | R | — | — | — |
| `residence_payers` | R (**active row only**, own property) | R (**active row only**) | R (own rows + history) | R W A | R W A | — | R (+ history) | — | R (+ history) | R | — | — | — |
| `association_settings_private` *(R1)* | — | — | — | R W | — | — | — | — | — | R | — | — | — |
| `invitation_accept_attempts` *(R1)* | — | — | — | — | — | — | — | — | — | R | — | — | — |
| `residence_invitations` | create* (resident inviter, if enabled), R own | — | — | R W A | R W A | — | — | — | R | R | token-accept only (via EF) | — | — |
| `audit_events` | — | — | — | R (tenant scope) | — | — | R (tenant scope) | — | — | R | — | — | — |

\* = via association-scoped read paths certified in Sprint 1 (`profiles:read_association`,
`profile_contacts:read_association`, `profile_contacts:verify`).

Revoked/disabled semantics: "revoked" column = user with revoked *tenant/residence*
membership (platform identity still active) — keeps only platform-self rows. "Disabled"
= `profiles.status='disabled'` — `current_profile_id()` NULL → no rows anywhere.

**(R1) Three matrix corrections.**

1. *Revoked user's own history.* The previous matrix said `—` while §6.6 specified a
   self policy filtering `profile_id = current_profile_id()` **without** a status
   filter. A revoked *membership* leaves the *profile* active, so the policy returns the
   user's closed rows and the matrix cell was wrong. Resolved in favor of the policy:
   residents may read their own occupancy history. This is correct on the merits
   (LGPD access rights) and is now stated consistently in both places.
2. *Co-household read of `residents`.* Removed entirely (D-14). A co-household member
   sees housemates through the property-scoped `residence-get` read RPC, never by
   reading the `residents` table. This closes the staff-notes exposure and removes the
   correlated `EXISTS` from the policy.
3. *Collector on `residence_members`.* Now `—`, not "R (active only)". The previous
   value was unachievable: `residences:read` grants all rows or none (§3).

**Payer history vs active payer.** Household members and the resident self see the
**active** payer row only; ended rows are visible to the payer themselves (own rows) and
to staff holding `residence_payers:read`. The previous design granted household members
the whole table for the property while F-09 promised "active payer name only" — a
projection RLS did not back.

## 6. Per-table RLS plan

**(R1) Grant posture, corrected.** New tables get `REVOKE ALL` from
`anon, authenticated`, then **SELECT-only** grants where a policy scopes the rows. No
table receives an INSERT, UPDATE or DELETE grant (§2 rule 12). The INSERT/UPDATE
policies specified below are still required and still enforced — they are evaluated
inside the `SECURITY INVOKER` RPCs, which execute as the caller.

Where a `WITH CHECK` cannot express a rule (period overlap, cross-table state), the
**RPC** performs the check inside the same transaction, and the policy remains the
necessary-but-not-sufficient guard — never the reverse. The previous revision assigned
that role to the Edge Function, which put the check outside both the transaction and the
security boundary.

**(R1) Confidentiality mechanisms.** Where a projection was previously promised by an
Edge Function, one of these now enforces it (D-14):

| Mechanism | Used for |
|---|---|
| Table separation | `association_settings_private`, `resident_staff_notes` |
| Policy predicate | payer history (staff permission) vs active payer (household) |
| RPC read surface | `tenant_audit_events()`, occupancy projections |
| Column grant | `residence_invitations.token_hash` exclusion |
| No grant at all | `invitation_accept_attempts` |

### 6.1 `association_details`

- **Grants (R1):** SELECT to `authenticated` only. Writes via RPC `association_details_update()` (§2 rule 12). No INSERT path — the row is seeded with the tenant (document 28 §6.1).
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

- **Grants (R1):** SELECT to `authenticated` only. Writes via RPCs `resident_create()`, `resident_update()`, `resident_status_transition()`. No DELETE (D-10).
- **SELECT (R1):** `profile_id = current_profile_id()` (self, all statuses incl.
  history) `OR has_tenant_permission(tenant_id, 'residents:read') OR
  is_platform_admin()`. **The co-household `EXISTS` clause is removed.** Two independent
  reasons: (a) confidentiality — RLS is row-level, so the clause exposed the whole
  resident row to housemates, and after R1 the staff-only fields moved to
  `resident_staff_notes` but the principle stands; (b) performance — a correlated
  `EXISTS` OR-ed into a policy is evaluated per candidate row and defeats index-only
  paths on the staff list at 10,000 residents, the sprint's worst RLS plan shape.
  Housemate visibility is served by `residence-get` (document 30 F-09), property-scoped
  and explicitly projected.
- **INSERT:** WITH CHECK `has_tenant_permission(tenant_id, 'residents:write')` +
  `status = 'pending'` forced (mirrors the certified verification-spoof guard: initial
  status cannot be forged to `active`; approval is a separate UPDATE).
- **UPDATE:** USING `has_tenant_permission(tenant_id, 'residents:write')`; WITH CHECK
  same + protected-field trigger below.
- **(R1) Self-service move-out request — mechanism closed.** It is **not** a `residents`
  UPDATE. The `residence_moveout_request()` RPC sets `requested_end_date` and
  `moveout_requested_at` on the caller's own `residence_members` row (document 28 §6.9),
  under a dedicated self policy scoped to those two columns with `status` unchanged.
  `residents` therefore needs no self-UPDATE policy at all, and the earlier
  `status_reason` append path is void — that column moved to the staff-only
  `resident_staff_notes` (document 28 §6.8).
- **DELETE:** none.
- **Protected fields (trigger `residents_protected_fields_immutable`):**
  `tenant_id`, `profile_id`, `approved_by_profile_id`, `approved_at` — immutable after
  set; `registration_code` change allowed but audited.
- **Recursion risk:** the co-household clause joins `residence_members` for the target
  profile — both sides through definer helpers to avoid policy-on-policy recursion
  (assert in SPR2-RLS gates with a recursive-plan check).

### 6.3 `household_members`

- **Grants (R1):** SELECT to `authenticated` only. Writes via RPCs `household_member_upsert()`, `household_member_end()`, `household_member_promote()`. **No DELETE** — hard delete removed in R1 (document 28 §6.3); correction uses `status='former'`.
- **SELECT (R1 — deferred decision closed, strict predicate adopted):**
  `is_active_residence_member(property_id)` (household co-members)
  `OR is_household_responsible(id)`
  `OR has_tenant_permission(tenant_id, 'household:read')` (staff)
  `OR is_platform_admin()`.
  The broad `can_access_residence()` is **not** used. Verified reason: that helper
  admits **any active tenant member** regardless of permission
  (`…foundation_identity.sql:347-364`), which would expose dependants' and minors' names
  and birth dates to every staff member — including the collector, who is explicitly
  barred from personal data. The strict permission predicate is the difference between
  "staff" and "staff who are supposed to see children's data".
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

- **Grants (R1):** SELECT to `authenticated` only. Writes via RPCs `residence_payer_assign()`, `residence_payer_end()`. No DELETE.
- **SELECT (R1, split by row state):**
  `(resident_id resolves to current_profile_id())` — own rows including ended history —
  `OR (status = 'active' AND is_active_residence_member(property_id))` — household
  members see the **current** payer only, never history —
  `OR has_tenant_permission(tenant_id, 'residence_payers:read')` — staff see all rows —
  `OR is_platform_admin()`.
  The `status = 'active'` conjunct is what makes F-09's "active payer name only, no
  history" promise real; previously that projection existed only in the Edge Function
  and was bypassable with the same JWT.
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

- **Grants (R1):** SELECT to `authenticated` on all columns **except `token_hash`** (column-level grant). Writes via RPCs `invitation_create()`, `invitation_revoke()` and the DEFINER `accept_residence_invitation()`. No DELETE.
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

**(R1) One certified policy changes: `profiles_select_association_policy`.**
The certified predicate (`…foundation_identity.sql:591-604`) requires the target profile
to hold an **active `residence_members` row**. Four Sprint 2 populations do not:
`pending` residents (created before any membership exists), `former`/`deceased`
residents, off-site owner payers, and residents whose only membership is still
`pending`. For all four, staff resident lists would show records with no name, making
`resident-list`/`resident-get` unusable.

Extended predicate — one additional alternative, no new actor gains access:

```
EXISTS (active residence_members … )                       -- certified, unchanged
OR EXISTS (SELECT 1 FROM residents r
           WHERE r.profile_id = profiles.id
             AND has_tenant_permission(r.tenant_id, 'profiles:read_association'))
```

Anyone reading through the new branch already held `profiles:read_association` in that
tenant. Gated by the Sprint 1 profile-visibility regression, which must pass unchanged.
Recorded as item 3 of the frozen list in document 28 §12.

No policy changes to `profile_contacts`, `tenants`, `properties`, `tenant_members`,
`platform_role_assignments`, `profile_preferences`, `profile_devices`, `audit_events`.
Association-scoped audit read (new) is delivered
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
7. **(R1)** Direct PostgREST **write** attempt on any table by `authenticated` ⇒
   `permission denied` from the grant layer, before RLS is consulted (§2 rule 12).
8. **(R1)** Every confidentiality claim is tested **against the table, as the actor**,
   never through an Edge Function response. For each (actor, table, sensitive column)
   pair the gate issues a direct select and asserts zero rows or missing privilege.
   This is the test shape that would have caught the three D-14 violations.
9. **(R1)** An RPC whose transaction fails midway ⇒ zero domain rows **and** zero audit
   rows. Atomicity is a fail-closed property, not a performance detail.
10. **(R1)** A cross-tenant write attempted with valid IDs from two tenants ⇒ foreign
    key violation from the composite FK, independently of any application check (D-13).

## 8. Data minimization map (R1 — RC-07)

Every field that must not reach an actor, and the non-bypassable mechanism enforcing it.
No row in this table is enforced by Edge Function projection.

| Data | Must not reach | Mechanism | Where |
|---|---|---|---|
| Association internal config | residents, members, non-admin staff | separate table `association_settings_private` | doc 28 §6.7 |
| Resident staff notes / status reasons | residents, co-household members, collector, finance, support | separate table `resident_staff_notes`, `residents:write` only | doc 28 §6.8 |
| Payer history (ended rows) | household members, resident self (other than own rows) | policy conjunct `status='active'` | §6.4 |
| Housemates' resident records | co-household members | co-household clause removed; property-scoped read RPC instead | §6.2 |
| Invitation `token_hash` | all `authenticated` | column-level grant exclusion | §6.5 |
| Failed acceptance attempts | all `authenticated` | no grant at all | doc 28 §6.6 |
| Resident personal data | collector | `residences:read_routes` grants no membership or resident access | §3 |
| Dependants'/minors' data | collector, finance, viewer | strict `household:read` predicate | §6.3 |
| Audit events | all `authenticated` (table) | certified platform-admin policy unchanged; access only via definer RPC gated on `audit:read_association` | §6.7 |

## 9. Verification record (R1 — CF-05 §14.1 of document 27)

Verified against `supabase/migrations/20260719170000_sprint01_foundation_identity.sql`
at HEAD `1e6e4bb`: `has_tenant_permission()` matrix and its 9 certified permissions
(L42–52, L304–333); `residence_members_select_tenant_policy` keyed on `residences:read`
(L686); `can_access_residence()` admits any active tenant member (L347–364);
`properties_select_policy` = `can_access_residence(id)` (L584);
`profiles_select_association_policy` requires an active membership (L591–604);
`current_profile_id()` filters `status='active'` (L232–243); `authenticated` grants are
SELECT-only on `tenants`/`properties`/`tenant_members`/`residence_members` and absent on
`platform_role_assignments`/`audit_events` (L725–749). The claim that a
`SECURITY INVOKER` function preserves RLS while providing single-transaction semantics is
a PostgreSQL property, not a baseline property, and is asserted by gate SPR2-RPC-01
rather than by citation.
