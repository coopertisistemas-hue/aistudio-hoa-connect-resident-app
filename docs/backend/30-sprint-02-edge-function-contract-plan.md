# 30 — Sprint 2 Edge Function Contract Plan

**Status:** PROPOSED — no function code created. Contracts for the functions genuinely
required by Sprint 2, per `28-sprint-02-domain-model.md` and
`29-sprint-02-authorization-rls-blueprint.md`.

## 1. Shared contract conventions (inherited from Sprint 1 `_shared/`)

- **Auth:** `buildRequestContext(request)` — GoTrue JWT via `authClient` (anon key +
  caller Authorization header, RLS-enforced). Missing/invalid/expired JWT ⇒ 401
  `UNAUTHENTICATED`. Disabled profile ⇒ `current_profile_id()` NULL ⇒ 403 `FORBIDDEN`.
- **Envelope:** `{ data, error: { code, message, requestId } | null, meta: {
  requestId, generatedAt } }`. Error codes (certified set, unchanged):
  `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`,
  `RATE_LIMITED`, `TEMPORARY_UNAVAILABLE`, `INTERNAL_ERROR`. No stack traces, no
  Postgres error leakage (EF-AUTH-15 posture).
- **Tenant resolution:** never trusted from the client. Every mutation resolves
  `tenant_id` from the target entity server-side; client-supplied `tenant_id`, when
  present for disambiguation, is validated against `current_tenant_context()`.
- **Audit:** every mutation emits exactly one `audit_events` row via
  `log_audit_event(tenant_id, action, entity_type, entity_id, source, request_id,
  metadata)` with `source = 'edge_function:<name>'`.
- **Service role:** forbidden for authorization. Sole exception: the invitation-accept
  RPC path (§3), implemented as SECURITY DEFINER `accept_residence_invitation()` with
  internal checks — never as blanket service-role table access (R-09).
- **Idempotency:** natural uniqueness enforced by DB constraints (partial unique
  indexes from doc 28); retries of the same logical operation return 200 with the
  existing entity (`CONFLICT` only for genuinely conflicting state). Mutations that
  create rows accept an optional `client_request_id` echoed into audit metadata;
  duplicate `client_request_id` within 24 h for the same actor+action returns the
  original result (implemented via audit lookup — final mechanism reviewed in Wave 2.5;
  if the lookup cost is unjustified, constraint-based idempotency alone is shipped and
  the deviation is recorded).
- **Pagination:** `limit` (default 50, max 200) + `cursor` (created_at,id). All list
  endpoints.

## 2. Function inventory

| # | Endpoint | Method | Actor | Category |
|---|---|---|---|---|
| F-01 | `association-details-get` | GET | any tenant member / resident / platform admin | association context |
| F-02 | `association-details-update` | PATCH | association admin | association context |
| F-03 | `resident-list` | GET | staff (`residents:read`), finance, support, viewer | association resident mgmt |
| F-04 | `resident-get` | GET | staff; self (own record) | association resident mgmt |
| F-05 | `resident-create` | POST | staff (`residents:write`) | association resident mgmt |
| F-06 | `resident-update` | PATCH | staff (`residents:write`) | association resident mgmt |
| F-07 | `resident-status-transition` | POST | staff (`residents:write`) | status transition |
| F-08 | `residence-list` | GET | staff (`residences:read`), collector, finance, viewer | association residence mgmt |
| F-09 | `residence-get` | GET | staff; household members (own property, scoped projection) | association residence mgmt |
| F-10 | `residence-create` | POST | staff (`residences:write`) | association residence mgmt |
| F-11 | `residence-update` | PATCH | staff (`residences:write`) | association residence mgmt |
| F-12 | `residence-member-assign` | POST | staff (`residences:write`) | household membership |
| F-13 | `residence-member-approve` | POST | staff (`residences:write`) | relationship approval |
| F-14 | `residence-member-end` | POST | staff (`residences:write`) | household membership |
| F-15 | `household-member-upsert` | PUT | responsible resident (own property); staff (`household:write`) | household membership |
| F-16 | `household-member-remove` | DELETE | responsible resident; staff (`household:write`) | household membership |
| F-17 | `residence-payer-assign` | POST | staff (`residence_payers:write`) | residence responsibility |
| F-18 | `residence-payer-end` | POST | staff (`residence_payers:write`) | residence responsibility |
| F-19 | `invitation-create` | POST | staff (`invitations:write`); resident inviter (setting-gated) | onboarding |
| F-20 | `invitation-accept` | POST | authenticated invitee + token | onboarding |
| F-21 | `invitation-revoke` | POST | staff (`invitations:write`); inviter | onboarding |
| F-22 | `resident-moveout-request` | POST | resident self | resident self-service |
| F-23 | `resident-self-get` | GET | resident self | resident profile |
| F-24 | `tenant-audit-list` | GET | admin, finance (`audit:read_association`) | audit retrieval |

Not proposed (explicitly rejected): generic CRUD endpoints per table (violate minimal
contract design); `resident-delete` (D-10); `invitation-list` (folded into
`resident-list`-style query on `residence-get` for staff — revisited if UI requires);
any meter/billing endpoint (out of scope).

## 3. Contract details

Compact schema notation: `?` optional; enums in `|`. All responses use the shared
envelope; `data` shapes below. All IDs are UUIDs. `tenant_id` in responses always
present for tenant-owned entities.

### F-01 `association-details-get` (GET)

- **Actor:** any active tenant member, active resident of the tenant, platform admin.
- **Request:** `?tenant_id=` (must be in caller context).
- **Response `data`:** `{ tenant: {id, legal_name, display_name, slug, status},
  details: {trade_name, registration_number, email, phone, address_*, settings:
  public_projection, enabled_modules} }` — `settings` filtered to a public allow-list
  (`requires_resident_approval`, `allows_resident_invitations`,
  `allows_self_moveout_request`); internal keys withheld.
- **Authorization:** F-01 succeeds iff caller would pass the
  `association_details` SELECT policy.
- **RLS:** plain `authClient` SELECT on `tenants` + `association_details`.
- **Errors:** 401, 403, 404 (tenant not in context).
- **Audit:** none (read).
- **Idempotency:** n/a. **Tests:** EF2-AUTH-F01-01 anonymous 401; -02 disabled 403;
  -03 resident of tenant 200; -04 cross-tenant staff 403/404; -05 platform admin 200;
  -06 settings projection contains no internal keys.

### F-02 `association-details-update` (PATCH)

- **Actor:** `association_admin` (`association_details:write`).
- **Request:** `{ tenant_id, patch: { trade_name?, registration_number?, email?,
  phone?, address_*?, settings?: {...}, enabled_modules?: [...] } }`.
- **Response:** updated details.
- **Authorization:** permission check + RLS UPDATE WITH CHECK.
- **Errors:** 401, 403 (non-admin), 404, 422 (bad enum module name / bad email).
- **Audit:** `association_details.update`, metadata = changed keys (not values for
  sensitive keys).
- **Idempotency:** PATCH is naturally idempotent per same payload.
- **Tests:** admin 200; operator 403; forged tenant 403; invalid module name 422;
  audit row emitted with request_id.

### F-03 `resident-list` (GET)

- **Actor:** staff classes with `residents:read` (admin/operator/finance/support/
  viewer).
- **Request:** `?tenant_id=&status=&property_id=&q=&limit=&cursor=`. `q` matches
  registration_code and profile display fields via the association read path.
- **Response `data`:** `{ items: [{ resident_id, registration_code, status,
  profile: {id, full_name, preferred_name}, properties: [{id, unit_identifier,
  block_identifier, role}], joined_at }], next_cursor }`.
- **Authorization/RLS:** SELECT via policies; profile fields flow through the certified
  `profiles_select_association_policy` chain.
- **Errors:** 401, 403 (resident self attempting staff list), 404.
- **Audit:** none. **Idempotency:** n/a.
- **Tests:** each staff role 200; resident self 403; cross-tenant 0 rows; q-enumeration
  resistance (response shape identical for hit/miss); pagination stable.

### F-04 `resident-get` (GET `?resident_id=`)

- **Actor:** staff (`residents:read`); self (own record, any status).
- **Response:** resident record + profile projection + active memberships + payer rows
  (staff only see payer if `residence_payers:read`) + household summary.
- **Errors:** 401, 403 (other resident's record), 404 (cross-tenant id — NOT_FOUND,
  not 403, to avoid existence oracle; matches certified posture).
- **Audit:** none. **Tests:** self 200 own; self 404/403 other tenant's resident;
  staff 200; revoked staff membership ⇒ 403.

### F-05 `resident-create` (POST)

- **Actor:** staff (`residents:write`).
- **Request:** `{ property_id?, profile_id?, invitee_contact?: {type, value},
  registration_code?, notes? }` — exactly one of `profile_id` (link existing profile,
  e.g. found via prior invitation flow) or `invitee_contact` (delegates to F-19 and
  returns the invitation) must be present.
- **Response:** `{ resident_id, status: 'pending', invitation_id? }`.
- **Authorization:** permission; `property_id` must belong to resolved tenant.
- **RLS:** INSERT `residents` WITH CHECK (status forced `pending`).
- **Errors:** 401, 403, 404, 409 (resident already exists for tenant+profile), 422.
- **Audit:** `resident.create`.
- **Idempotency:** `UNIQUE(tenant_id, profile_id)` ⇒ retry returns 200 with existing.
- **Tests:** happy path; duplicate 200-idempotent; forged property of other tenant 404;
  status spoof `active` rejected (WITH CHECK); audit emitted.

### F-06 `resident-update` (PATCH `?resident_id=`)

- **Actor:** staff (`residents:write`).
- **Request:** `{ patch: { registration_code?, notes? } }`.
- **Response:** updated resident.
- **Errors:** 401, 403, 404, 409 (registration_code conflict), 422.
- **Protected:** `tenant_id`, `profile_id`, approval fields — trigger rejects; EF never
  sends them.
- **Audit:** `resident.update` (changed keys).
- **Tests:** happy; protected-field attempt 409/422 (trigger surfaced as CONFLICT);
  code conflict 409.

### F-07 `resident-status-transition` (POST)

- **Actor:** staff (`residents:write`).
- **Request:** `{ resident_id, target_status: 'active'|'inactive'|'blocked'|'former'|
  'deceased', reason?, effective_date?, close_memberships?: bool,
  close_payers?: bool }`.
- **Semantics:** validates against the §8.1 transition graph of doc 28
  (`pending→active` = approve; sets `approved_by/approved_at`; `deceased`/`former`
  require `close_memberships`/`close_payers` explicit flags — orchestrates F-14/F-18
  closures in one transaction, each audited).
- **Response:** `{ resident_id, status, closed: {memberships: n, payers: n} }`.
- **Errors:** 401, 403, 404, 409 (illegal transition, e.g. `deceased→active`), 422.
- **Audit:** `resident.approve` or `resident.status_change` (+ child closure events).
- **Idempotency:** same target_status replay ⇒ 200 no-op (already in target).
- **Tests:** every legal transition; every illegal transition 409; deceased cascade
  closes periods with `end_reason='deceased'`; audit count matches.

### F-08 `residence-list` (GET)

- **Actor:** staff `residences:read` (incl. collector), finance, viewer.
- **Request:** `?tenant_id=&status=&occupancy=occupied|vacant&block=&limit=&cursor=`.
- **Response:** properties + derived occupancy (active member count, payer presence) —
  computed from certified partial active indexes; no stored occupancy column.
- **Collector scoping:** collector role receives `{id, unit_identifier,
  block_identifier, address_*, occupancy_state}` only — no resident identity fields
  (column projection in EF, since collector lacks `residents:read` the join yields
  nothing — assert in test).
- **Errors:** 401, 403, 404. **Audit:** none.
- **Tests:** roles matrix; collector projection has zero PII keys; vacant filter
  correct against fixtures.

### F-09 `residence-get` (GET `?property_id=`)

- **Actor:** staff; household: any active member / active payer of the property.
- **Response (staff):** property + active+historical memberships + household_members +
  payer history + pending invitations count.
- **Response (household):** property + active memberships (profile display names) +
  household_members + **active** payer name only (no payer history).
- **Authorization:** `can_access_residence(property_id)` for household; permission for
  staff.
- **Errors:** 401, 403 (member of another property), 404 (cross-tenant).
- **Tests:** resident of property A reading property B ⇒ 403; household projection
  excludes history + staff-only fields.

### F-10 `residence-create` (POST)

- **Actor:** staff (`residences:write`).
- **Request:** `{ tenant_id, label, nickname?, address_line1, address_line2?,
  district?, city, state, postal_code?, unit_identifier, block_identifier?,
  metadata? }`.
- **Response:** created property.
- **RLS:** `authenticated` has **no INSERT grant on `properties`** in Sprint 1 —
  Wave 2.4 must add grant + INSERT policy WITH CHECK
  `has_tenant_permission(tenant_id,'residences:write')` (schema change recorded in doc
  28 §12 amendment; additive).
- **Errors:** 401, 403, 409 (`UNIQUE(tenant_id, unit_identifier)`), 422.
- **Audit:** `residence.create`. **Idempotency:** unique key replay ⇒ 200 existing.
- **Tests:** happy; duplicate unit 200-idempotent; operator 200; viewer 403; forged
  tenant 403.

### F-11 `residence-update` (PATCH `?property_id=`)

- **Actor:** staff (`residences:write`).
- **Request:** `{ patch: { label?, nickname?, address fields?, status?,
  unit_identifier?, block_identifier? } }` — `status` changes to `inactive` warn if
  active occupancy exists (409 unless `force: true`, audited).
- **Errors:** 401, 403, 404, 409, 422.
- **Audit:** `residence.update`. **Tests:** occupancy-conflict 409; force path audit.

### F-12 `residence-member-assign` (POST)

- **Actor:** staff (`residences:write`).
- **Request:** `{ property_id, profile_id, role: <residence_role>, is_primary?,
  start_date?, approve?: bool }` — `approve: true` creates `active` (staff authority);
  default creates `pending`.
- **Semantics:** profile must have a `residents` row in the tenant (auto-create
  `pending` resident if absent? — **decision:** no auto-create; EF returns 422
  `RESIDENT_REQUIRED` pointing to F-05; keeps invariant 8 explicit).
- **Response:** membership row.
- **Errors:** 401, 403, 404, 409 (duplicate active membership — partial unique), 422
  (RESIDENT_REQUIRED, bad role).
- **Audit:** `residence_member.assign`.
- **Idempotency:** partial unique replay ⇒ 200 existing.
- **Tests:** duplicate active 200-idempotent; second *primary* for profile auto-demotes
  or 409 (decision in Wave 2.5 — recommend 409, explicit); cross-tenant profile 404.

### F-13 `residence-member-approve` (POST)

- **Actor:** staff (`residences:write`).
- **Request:** `{ membership_id }`.
- **Semantics:** `pending → active`; validates no conflicting active row (same pair)
  and primary-unique invariant.
- **Errors:** 401, 403, 404, 409 (already active/revoked, conflict).
- **Audit:** `residence_member.approve`. **Idempotent** replay 200.
- **Tests:** pending→active 200; revoked 409; race-safe (two approves ⇒ one winner).

### F-14 `residence-member-end` (POST)

- **Actor:** staff (`residences:write`).
- **Request:** `{ membership_id, end_date?, end_reason: <enum>, notes? }`.
- **Semantics:** active→revoked closure per D-05 (sets end_date/end_reason; row
  becomes immutable).
- **Errors:** 401, 403, 404, 409 (already closed), 422 (bad reason/end_date < start).
- **Audit:** `residence_member.end`.
- **Idempotency:** replay ⇒ 200 with existing closed row.
- **Tests:** closure preserves row (history); re-assign after closure creates new row
  (D-05); update-after-close blocked (trigger) ⇒ 409.

### F-15 `household-member-upsert` (PUT)

- **Actor:** responsible resident (active member of the property) or staff
  (`household:write`).
- **Request:** `{ property_id, household_member_id?, full_name, birth_date?,
  relationship: <enum>, notes?, status? }` — upsert by `household_member_id`; staff may
  set `status`; resident may not (422).
- **Guards:** `responsible_profile_id` = caller (self-service) or explicit (staff);
  duplicate-person check vs active `residence_members` (invariant 6) ⇒ 409.
- **Errors:** 401, 403 (member of other property), 404, 409, 422.
- **Audit:** `household_member.create` / `household_member.update`.
- **Idempotency:** keyed by id; create retries guarded by EF-side duplicate check
  (name+birth_date+property) returning existing.
- **Tests:** resident manages own property's members 200; other property 403; staff
  200; status spoof by resident 422.

### F-16 `household-member-remove` (DELETE `?id=`)

- **Actor:** responsible resident; staff (`household:write`).
- **Semantics:** hard delete allowed (D-10) with audit capturing the removed payload
  snapshot in metadata.
- **Errors:** 401, 403, 404.
- **Audit:** `household_member.remove` (snapshot).
- **Idempotency:** second delete ⇒ 404 (acceptable) or 200 no-op — decide Wave 2.5
  (recommend 200 no-op for client simplicity).
- **Tests:** self remove 200; non-responsible member 403; audit snapshot present.

### F-17 `residence-payer-assign` (POST)

- **Actor:** staff (`residence_payers:write`).
- **Request:** `{ property_id, profile_id, start_date?, force_close_existing?:
  bool }`.
- **Semantics:** if an active payer exists and `force_close_existing` is false ⇒ 409;
  with true, closes existing (`end_reason='replaced'`) and inserts new — one
  transaction, two audit events.
- **Guard:** payer profile is `residents` row of tenant, status in (active, inactive)
  (doc 28 §6.4 invariant).
- **Errors:** 401, 403, 404, 409 (active payer exists), 422 (payer not resident).
- **Audit:** `residence_payer.assign` (+ `residence_payer.end` when replacing).
- **Idempotency:** same (property, profile, active) replay ⇒ 200.
- **Tests:** off-site owner payer 200 (R-04); second payer 409; replace flow closes
  history correctly.

### F-18 `residence-payer-end` (POST)

- **Actor:** staff (`residence_payers:write`).
- **Request:** `{ payer_id, end_date?, end_reason? }`.
- **Errors:** 401, 403, 404, 409 (already ended).
- **Audit:** `residence_payer.end`. **Idempotent** replay 200.
- **Tests:** closure; ended rows immutable (trigger) 409 on edit attempt.

### F-19 `invitation-create` (POST)

- **Actor:** staff (`invitations:write`, `inviter_type='association'`); resident
  inviter (active member of property, `inviter_type='resident'`, only when
  `settings.allows_resident_invitations`).
- **Request:** `{ property_id, invitee_contact: {type: 'email'|'phone'|'whatsapp',
  value}, proposed_role: <residence_role>, expires_in_hours?: <=720 }`.
- **Response:** `{ invitation_id, expires_at, invite_token }` — **plaintext token
  returned once**, only `token_hash` persisted.
- **Errors:** 401, 403, 404, 409 (pending invitation exists for same contact+property),
  422.
- **Audit:** `invitation.create`.
- **Idempotency:** partial unique replay ⇒ 200 with existing invitation (no new token).
- **Tests:** duplicate pending 200-idempotent; resident inviter blocked when setting
  off 403; token not stored plaintext (SQL gate asserts hash column only).

### F-20 `invitation-accept` (POST)

- **Actor:** authenticated user (any profile) presenting a valid token.
- **Request:** `{ invite_token }`.
- **Semantics:** SECURITY DEFINER `accept_residence_invitation(token)`:
  hash → lookup → validate (status pending, not expired) → assert invitee contact
  matches the caller's verified contact of that type (anti token-forwarding; if no
  verified match ⇒ 403 `INVITEE_MISMATCH`) → create/attach `residents` (per
  association `requires_resident_approval`: pending or active) → create
  `residence_members` (proposed role; pending if approval required else active) → mark
  accepted → audit.
- **Errors:** 401; 403 (INVITEE_MISMATCH, disabled profile); 404 (unknown/expired/
  already-used token — **single constant-shaped 404** for all invalid-token classes:
  enumeration resistance R-17); 409 (already a member).
- **Rate limiting:** `RATE_LIMITED` after N failures per caller/IP (mechanism in Wave
  2.5 — platform rate-limit decision; at minimum per-caller attempt counting via audit
  lookup).
- **Audit:** `invitation.accept` (tenant_id from invitation).
- **Idempotency:** replay of consumed token ⇒ 404 constant shape.
- **Tests:** full accept happy path (bootstrap 404 user becomes resident); expired ⇒
  404; wrong contact ⇒ 403; replay ⇒ 404; timing/shape equality across failure classes.

### F-21 `invitation-revoke` (POST)

- **Actor:** staff (`invitations:write`) or the inviter.
- **Request:** `{ invitation_id }`.
- **Errors:** 401, 403, 404, 409 (already accepted/declined/expired).
- **Audit:** `invitation.revoke`. **Idempotent** replay 200.
- **Tests:** staff revoke 200; non-inviter resident 403; accept-after-revoke ⇒ 404.

### F-22 `resident-moveout-request` (POST)

- **Actor:** resident self with active membership.
- **Request:** `{ membership_id, requested_end_date, reason? }`.
- **Semantics:** sets membership into a staff-visible pending-closure state — modeled
  as audit event + `residence_members` unchanged until staff runs F-14 (simplest
  approvable flow; no new status value). Response confirms receipt.
- **Errors:** 401, 403 (not own membership), 404, 409 (already closed), 422 (past
  date).
- **Audit:** `residence_member.moveout_request` (staff queue reads audit via F-24 or a
  derived list — UI concern).
- **Tests:** self 200; other's membership 403; staff executes F-14 referencing the
  request.

### F-23 `resident-self-get` (GET)

- **Actor:** any active profile.
- **Response `data`:** `{ residents: [{ tenant: {id, display_name}, resident_id,
  registration_code, status, properties: [...] }] }` across all associations of the
  caller — answers "one profile, multiple associations" in the API.
- **RLS:** `residents` self policy only.
- **Errors:** 401; 403 disabled. **Audit:** none.
- **Tests:** multi-tenant fixture returns both; revoked resident record still returned
  with its status (history) but grants no other access.

### F-24 `tenant-audit-list` (GET)

- **Actor:** `audit:read_association` (admin, finance).
- **Request:** `?tenant_id=&entity_type=&entity_id=&actor_profile_id=&from=&to=
  &limit=&cursor=`.
- **Semantics:** SECURITY DEFINER `tenant_audit_events(...)` RPC (doc 29 §6.7) —
  `audit_events` table policy unchanged (platform-admin only); RPC filters
  `tenant_id` after permission check.
- **Errors:** 401, 403, 404, 422 (bad cursor/range).
- **Audit:** none (read of audit is not audited in Sprint 2 — recursion avoidance;
  platform-level observability is a future module).
- **Tests:** admin 200 own tenant; operator 403; cross-tenant 404/empty; immutable
  rows (attempted UPDATE via SQL gate, not EF).

## 4. RLS interaction summary

| Function | Table access | Via |
|---|---|---|
| F-01/02 | `tenants`, `association_details` | caller-context RLS |
| F-03…F-07 | `residents`, `profiles` (assoc read path), `residence_members`, `residence_payers` | caller-context RLS + WITH CHECK |
| F-08…F-11 | `properties`, derived occupancy | caller-context RLS (F-10 requires new INSERT grant+policy, doc 28 §12 amendment) |
| F-12…F-14 | `residence_members` | caller-context RLS + transition trigger |
| F-15/16 | `household_members` | caller-context RLS |
| F-17/18 | `residence_payers` | caller-context RLS + close-only trigger |
| F-19/21 | `residence_invitations` (no token column) | caller-context RLS, column-grant exclusion of `token_hash` |
| F-20 | `accept_residence_invitation()` | SECURITY DEFINER RPC (sole sanctioned elevation) |
| F-22 | `residence_members` (read own) + audit insert | caller-context RLS |
| F-23 | `residents` self | caller-context RLS |
| F-24 | `tenant_audit_events()` | SECURITY DEFINER RPC over `audit_events` |

## 5. Audit event catalog (Sprint 2 actions)

`association_details.update` · `resident.create` · `resident.update` ·
`resident.approve` · `resident.status_change` · `residence.create` ·
`residence.update` · `residence_member.assign` · `residence_member.approve` ·
`residence_member.end` · `residence_member.moveout_request` ·
`household_member.create` · `household_member.update` · `household_member.remove` ·
`residence_payer.assign` · `residence_payer.end` · `invitation.create` ·
`invitation.accept` · `invitation.revoke` · `invitation.expire`

All use `log_audit_event()` (certified), `entity_type` = table name, `request_id` =
envelope request id, metadata = changed-keys/snapshot as specified per function. Audit
immutability is already certified; Sprint 2 adds per-action generation tests only.
