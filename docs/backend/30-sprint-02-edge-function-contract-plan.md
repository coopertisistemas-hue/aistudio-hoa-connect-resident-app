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
- **Service role:** forbidden entirely. **(R1)** Sprint 2 uses it in zero flows; the
  invitation-accept path is a `SECURITY DEFINER` RPC (owner-executed function with
  explicit internal checks), not a service-role client (R-09).
- **(R1) Idempotency — constraint-based only.** `client_request_id` is **removed** from
  the contract. It was specified as "duplicate within 24 h returns the original result,
  implemented via audit lookup", which was unimplementable on three counts: `audit_events`
  has no unique index on `(actor, client_request_id)` so duplicates race; `authenticated`
  holds no read grant on `audit_events` (`…foundation_identity.sql:742-749`); and an
  audit row records that something happened, not the response body, so "the original
  result" could not be reconstructed. Every create in this package has a natural key, so
  DB constraints are sufficient. Shipping a field that does not do what it says is worse
  than not shipping it.
- **(R1) Idempotent replay requires payload equivalence.** A retry returns `200` with the
  existing entity **only if** the incoming payload matches the existing row on the
  natural key *and* the material fields. Otherwise `409 CONFLICT`. The previous rule
  ("unique key replay ⇒ 200 existing") would silently return the wrong unit when an
  operator registered a *different* property reusing a `unit_identifier`, and then attach
  residents to it. Collision usually means operator error, not retry.
- **Pagination:** `limit` (default 50, max 200) + `cursor` (created_at,id). All list
  endpoints.
- **(R1) Contract version:** every response carries `meta.contractVersion = "2.0"`
  (document 27 D-16). Paths remain unversioned, matching the certified Sprint 1
  functions.

## 1.1 Mutation architecture (R1 — RC-01/RC-02, document 27 D-12)

**Every mutation in Sprint 2 executes inside exactly one `SECURITY INVOKER` plpgsql RPC.
Edge Functions never write through PostgREST.**

The previous revision specified Edge Functions orchestrating independent PostgREST
writes while promising transactional semantics — "one transaction" cascades in F-07 and
F-17, a full accept sequence in F-20, and a document 31 gate asserting "failure
mid-cascade ⇒ total rollback, zero partial rows". Each PostgREST call is its own
transaction, so an Edge Function issuing five calls performs five transactions and a
failure on the fourth leaves three committed. The gate would have failed on first
execution, and a partially-applied cascade on a deceased resident is precisely the data
corruption the historical-integrity principle exists to prevent.

This affects **every** mutation, not only cascades: doc §1 requires each one to emit an
audit event, so `INSERT` + `log_audit_event()` is already two statements.

```
Client
  │  HTTPS + user JWT
  ▼
Edge Function          transport · JWT validation · input validation · envelope ·
  │                    error mapping · rate limiting · pagination · response shaping
  │  exactly one RPC call per write request
  ▼
RPC (SECURITY INVOKER) one transaction · all writes · invariant checks RLS cannot
  │                    express (periods, cross-table state) · log_audit_event()
  ▼
RLS                    authorization, evaluated as the calling user inside the RPC
  ▼
Transaction            atomic commit of mutation + relationships + history + audit
  ▼
Audit                  append-only audit_events row, same transaction, always
```

| Layer | Owns | Must never |
|---|---|---|
| Edge Function | HTTP, JWT, input schema, envelope, error codes, rate limiting, pagination cursors, response projection *of data the caller may already read* | perform a write; enforce confidentiality; hold authorization state |
| RPC (`INVOKER`) | the whole transaction: writes, cross-table invariants, audit call | be `DEFINER` (that would move authorization out of RLS); swallow authorization errors |
| RLS | who may read/write which row | be bypassed by service role or elevated function |
| Transaction | all-or-nothing | span two RPC calls |
| Audit | immutable record | be written outside the mutating transaction |

**Rules.** One write RPC per request. An operation needing two writes needs one RPC, not
two calls. RPCs are `VOLATILE`, `SET search_path = ''`, no dynamic SQL except through
`format(%I/%L)`, and must not catch exceptions in a way that converts an authorization
failure into a success (R-21). Read endpoints may query PostgREST directly where a single
policy-scoped select suffices; they use a read RPC where a projection must be enforced
rather than merely applied (document 29 §8).

**RPC inventory** — one per mutating endpoint: `association_details_update`,
`resident_create`, `resident_update`, `resident_status_transition`, `residence_create`,
`residence_update`, `residence_member_assign`, `residence_member_approve`,
`residence_member_end`, `residence_moveout_request`, `household_member_upsert`,
`household_member_end`, `household_member_promote`, `residence_payer_assign`,
`residence_payer_end`, `invitation_create`, `invitation_revoke`, plus the two sanctioned
`DEFINER` RPCs `accept_residence_invitation` and `tenant_audit_events`.

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
  details: {trade_name, registration_number, email, phone, address_*, settings,
  enabled_modules} }`.
- **(R1) `settings` is returned in full, and that is safe**, because
  `association_details.settings` now holds only the four allow-listed member-visible
  keys (doc 28 §6.1). Internal configuration lives in `association_settings_private`,
  which this endpoint does not read and which no member-scoped policy exposes. The
  previous design promised an Edge Function "public projection" over a jsonb column that
  every member could read in full via PostgREST — a projection, not a control (D-14).
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
- **(R1) Authorization/RLS:** SELECT via policies; profile fields flow through the
  **extended** `profiles_select_association_policy` (document 28 §12 item 3, document 29
  §6.7). The certified predicate required an active `residence_members` row, so this
  contract was unfulfillable for `pending`, `former`/`deceased` and off-site-payer
  residents — their profiles were invisible and the list would have rendered records
  with no name. The extension adds one alternative (a `residents` row in the tenant) and
  grants no access to any actor who did not already hold `profiles:read_association`.
- **(R1) `q` search** matches `registration_code` (trigram index, doc 28 §6.2) and
  profile display fields through the same policy chain; PERF2-08 gates this path, which
  previously had no gate.
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
  require `close_memberships`/`close_payers` explicit flags). **(R1)** The cascade runs
  inside `resident_status_transition()` as a single transaction — not as orchestrated
  F-14/F-18 calls, which would have been independent transactions leaving a
  half-closed resident on any mid-cascade failure. Each closure is still audited
  individually, in the same transaction.
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
  no stored occupancy column. **(R1)** Computed using the **new** partial indexes
  `idx_residence_members_property_open` / `_profile_open` (document 28 §5.4). The
  certified `idx_residence_members_*` indexes are plain composite, not partial
  (`…foundation_identity.sql:214-215`); the earlier wording here was incorrect.
- **(R1) Collector scoping is structural, not projected.** The collector holds
  `residences:read_routes` and **not** `residences:read`, so every query it can issue —
  through this endpoint or directly via PostgREST — returns `{id, unit_identifier,
  block_identifier, address_*, occupancy_state}` and nothing else. The previous design
  granted the collector the existing `residences:read` and relied on an EF column
  projection plus a test asserting "the join yields nothing because collector lacks
  `residents:read`". That test would have passed while the collector read every
  `residence_members` row in the tenant directly: certified policy
  `residence_members_select_tenant_policy` (`…foundation_identity.sql:686`) is keyed on
  `residences:read`. The gate now reads `residence_members` **as the collector** and
  asserts zero rows (document 31 SPR2-RLS-12).
- **Errors:** 401, 403, 404. **Audit:** none.
- **Tests:** roles matrix; collector projection has zero PII keys; vacant filter
  correct against fixtures.

### F-09 `residence-get` (GET `?property_id=`)

- **Actor:** staff; household: any active member / active payer of the property.
- **Response (staff):** property + active+historical memberships + household_members +
  payer history + pending invitations count.
- **Response (household):** property + active memberships (profile display names) +
  household_members + **active** payer name only.
- **(R1) The "no payer history" promise is now enforced by RLS**, not by this
  projection: the `residence_payers` SELECT policy carries a `status = 'active'`
  conjunct for household members (document 29 §6.4), so ended rows are unreachable even
  by direct PostgREST access. Previously household members were granted the whole table
  for the property while the contract promised the active row only.
- **(R1) Housemate visibility lives here.** The co-household clause was removed from the
  `residents` SELECT policy (document 29 §6.2); this endpoint is the sanctioned,
  property-scoped way for a resident to see who they live with, and it returns display
  names only — never resident lifecycle status, staff notes or status reasons.
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
- **(R1) RLS:** the previously planned INSERT **grant** on `properties` is
  **withdrawn**. `authenticated` gains no write grant on any table (document 29 §2 rule
  12); the write executes inside `residence_create()` (`SECURITY INVOKER`), where the
  INSERT policy `WITH CHECK has_tenant_permission(tenant_id,'residences:write')` is
  evaluated as the caller. Certified guarantee #3 is therefore preserved. `properties`
  still appears in the frozen list (document 28 §12 item 2) for its
  `UNIQUE (id, tenant_id)` composite-FK parent constraint.
- **Errors:** 401, 403, 409 (`UNIQUE(tenant_id, unit_identifier)`), 422.
- **Audit:** `residence.create`.
- **(R1) Idempotency:** replay returns 200 with the existing property **only if** the
  payload matches it on the material fields; a `unit_identifier` collision carrying
  different address/label data ⇒ `409 UNIT_IDENTIFIER_CONFLICT`. Returning 200 for a
  genuinely different unit would attach residents to the wrong property.
- **Tests:** happy; identical replay 200; **conflicting** duplicate unit 409; operator
  200; viewer 403; forged tenant 403; direct PostgREST INSERT by any actor ⇒ permission
  denied.

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
- **(R1) Primary conflict — decision closed:** a second active primary for the same
  profile **in the same tenant** ⇒ `409 PRIMARY_CONFLICT`. No silent auto-demotion:
  demoting a residence the operator did not name is a surprising side effect on a
  legally meaningful flag. Demotion is an explicit `residence-member-update` call.
  The constraint is tenant-scoped (document 28 §6.9), so a person may hold one primary
  residence per association.
- **Tests:** identical replay 200-idempotent; second primary ⇒ 409; cross-tenant
  profile 404; direct PostgREST INSERT ⇒ permission denied.

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
- **(R1) Semantics — no hard delete.** The row transitions to `status='former'` with
  `end_date` and an audit snapshot. Hard deletion was removed (document 28 §6.3): its
  only justification was pre-approval cleanup, and Sprint 2 has no household approval
  flow, so it contradicted the historical-integrity principle applied everywhere else.
  The endpoint keeps its name and DELETE verb; the effect is a terminal transition.
- **Errors:** 401, 403, 404.
- **Audit:** `household_member.remove` (snapshot).
- **(R1) Idempotency — decision closed:** a second call on an already-`former` row ⇒
  **200 no-op** (client simplicity; the desired end state holds).
- **Tests:** self remove 200; non-responsible member 403; audit snapshot present.

### F-17 `residence-payer-assign` (POST)

- **Actor:** staff (`residence_payers:write`).
- **Request:** `{ property_id, profile_id, start_date?, force_close_existing?:
  bool }`.
- **Semantics:** if an active payer exists and `force_close_existing` is false ⇒ 409;
  with true, closes existing (`end_reason='replaced'` — now an enum value, document 28
  §7) and inserts the new row. **(R1)** Both writes happen inside
  `residence_payer_assign()`, one transaction, two audit events. The new row must not
  overlap any historical period (EXCLUDE constraint, document 28 §6.4) ⇒ 409 on
  overlap.
- **(R1) Guard is structural:** `residence_payers.resident_id` carries a composite FK
  to `residents (id, tenant_id)`, so a payer who is not a resident of that tenant cannot
  be written at all. The previous design referenced `profiles` and enforced this in the
  Edge Function, with a trigger deferred to Wave 2.3 and a fallback of "EF-only with a
  periodic integrity test" — a periodic test detects violations, it does not prevent
  them. Status must still be in (`active`,`inactive`), checked in the RPC.
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
  value}, proposed_role: <residence_role>, expires_in_hours?: <=720, reissue?: bool }`.
- **Response:** `{ invitation_id, expires_at, invite_token }` — **plaintext token
  returned once**, only `token_hash` persisted (≥256-bit CSPRNG, SHA-256 at rest;
  document 28 §6.5.1).
- **(R1) Duplicate and reissue handling — the deadlock is removed.** Executed inside
  `invitation_create()`, one transaction:
  1. Sweep expired pending rows for this (property, contact) pair ⇒
     `invitation.expire`; this releases the pending partial unique.
  2. No live pending row ⇒ create, return a new token, `invitation.create`.
  3. Live pending row and `reissue` absent/false ⇒ **`409 INVITATION_PENDING`**
     carrying `invitation_id` and `expires_at` so the UI can offer reissue.
  4. Live pending row and `reissue: true` (requires `invitations:write`) ⇒ revoke it
     (`revoked_at`, `superseded_by` → new row), create a replacement with a **new
     token**; two audit events in one transaction.
  5. Contact already resolves to an active membership in the property ⇒
     `409 ALREADY_MEMBER`, no row created.

  The previous rule — "duplicate pending ⇒ 200 with existing invitation (no new
  token)" — meant that once a token was lost, undelivered or expired, no working token
  could ever be issued to that person for that unit again, and the `200` response
  concealed it.
- **Errors:** 401, 403, 404, 409 (`INVITATION_PENDING`, `ALREADY_MEMBER`), 422.
- **Audit:** `invitation.create`, `invitation.expire`, `invitation.revoke` (reissue).
- **Tests:** live duplicate ⇒ 409 with reissue affordance; `reissue:true` ⇒ new token
  and `superseded_by` set; **expired** pending ⇒ swept then created with a new token;
  resident inviter blocked when the setting is off ⇒ 403; token never stored plaintext
  (SQL gate over column contents); token entropy ≥256 bits (generator gate).

### F-20 `invitation-accept` (POST)

- **Actor:** authenticated user (any profile) presenting a valid token.
- **Request:** `{ invite_token }`.
- **(R1) Semantics — re-specified.** `SECURITY DEFINER accept_residence_invitation(token)`,
  one transaction, full case table in document 28 §6.5.5:
  hash → lookup → **record the attempt** (before any validation branch, so unknown
  tokens are counted too) → throttle check → validate (`pending`, not expired) → bind
  contact → resolve resident → create membership → consume → audit.
- **(R1) Trust model — token-as-proof-of-contact.** The previous rule required the
  caller to hold a **verified** contact matching the invitee. That was unsatisfiable:
  Sprint 1 forces `verification_state='unverified'` on contact insert, and **no
  contact-verification Edge Function exists** (`supabase/functions/` listing) — the only
  verification path is the staff `profile_contacts:verify` permission, which staff
  cannot exercise on someone who is not yet a resident. Every genuine new invitee would
  have received `403 INVITEE_MISMATCH`; the flagship onboarding flow deadlocked on its
  first execution.
  **Replacement:** possession of a ≥256-bit single-use token delivered to the invited
  contact *is* the verification event. On acceptance the matching contact is created or
  transitioned to `verified`, attributed to the invitation. Contact already owned by a
  **different** profile ⇒ `409 CONTACT_CONFLICT` (never reassigned).
- **Errors:** 401; 403 (disabled profile); **404** — single constant-shaped body for
  unknown / expired / revoked / already-accepted tokens (enumeration resistance, R-17);
  409 (`ALREADY_MEMBER`, `CONTACT_CONFLICT`); 429 `RATE_LIMITED`.
- **(R1) Rate limiting — real substrate.** `invitation_accept_attempts` (document 28
  §6.6) plus the new `invitation.accept_failed` audit action. Threshold: >10 failures per
  profile per hour or >20 per `token_hash_prefix` per hour ⇒ 429. The previous mechanism
  ("per-caller attempt counting via audit lookup") did not exist: the audit catalog held
  only successes, and `authenticated` cannot read `audit_events`.
- **Audit:** `invitation.accept` (+ `resident.create`/`resident.status_change`,
  `residence_member.assign`, `profile_contact.verify_by_invitation`) on success;
  `invitation.accept_failed` on failure. `tenant_id` always derived from the invitation
  row, never from the client.
- **Idempotency:** replay of a consumed token ⇒ constant-shaped 404 (terminal-state
  trigger enforces single use, not application logic).
- **Tests:** accept happy path for a brand-new user with **no verified contact**
  (the case that previously deadlocked), both `requires_resident_approval` settings;
  contact created-and-verified and unverified-then-verified paths; contact owned by
  another profile ⇒ 409; expired / revoked / unknown / replayed ⇒ **byte-equal** 404
  bodies; no timing oracle distinguishing token existence (unique-index probe);
  throttle ⇒ 429 after threshold; failed attempts recorded even for unknown tokens;
  transaction atomicity — an injected failure after the resident insert leaves zero
  rows and zero audit events.

### F-21 `invitation-revoke` (POST)

- **Actor:** staff (`invitations:write`) or the inviter.
- **Request:** `{ invitation_id }`.
- **Errors:** 401, 403, 404, 409 (already accepted/declined/expired).
- **Audit:** `invitation.revoke`. **Idempotent** replay 200.
- **Tests:** staff revoke 200; non-inviter resident 403; accept-after-revoke ⇒ 404.

### F-22 `resident-moveout-request` (POST)

- **Actor:** resident self with active membership.
- **Request:** `{ membership_id, requested_end_date, reason? }`.
- **(R1) Semantics — queryable state, not an audit-only signal.** The RPC sets
  `requested_end_date` and `moveout_requested_at` on the membership (additive columns,
  document 28 §6.9) and emits the audit event. Staff list open requests with a normal
  filtered query and clear them by running F-14. The previous design left
  `residence_members` unchanged and expected staff to discover requests by reading the
  audit stream: an append-only log is not a work queue — there was no way to list open
  requests, mark one handled, or distinguish a second request from the first.
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

**(R1) Added actions (5):** `invitation.accept_failed` (brute-force substrate, F-20) ·
`profile_contact.verify_by_invitation` (token-as-proof-of-contact, F-20) ·
`household_member.promote` (household → platform user, document 28 §6.3) ·
`resident_staff_note.create` (append-only staff notes, document 28 §6.8) ·
`association_settings_private.update` (changed **keys** only, never values).

Total: 25 actions.

All use `log_audit_event()` (certified), `entity_type` = table name, `request_id` =
envelope request id, metadata = changed-keys/snapshot as specified per function.

**(R1) Audit is emitted inside the mutating transaction**, by the RPC, never by the Edge
Function after a separate write (§1.1). This converts "every mutation emits exactly one
audit row" from a convention that a mid-flight failure could break into a structural
property: gate SPR2-AUDIT-03 injects a failure and asserts zero domain rows **and** zero
audit rows. Audit immutability is already certified; Sprint 2 adds per-action generation
tests plus this atomicity gate.

## 6. Verification record (R1 — CF-05 §14.1 of document 27)

Runtime and baseline claims in this document were verified rather than assumed:
each PostgREST call is its own transaction (runtime property; the reason §1.1 exists,
asserted by gate SPR2-RPC-01 rather than cited); `authenticated` holds no read grant on
`audit_events` and SELECT-only on the four structural tables
(`…foundation_identity.sql:725-749`); `residence_members_select_tenant_policy` is keyed
on `residences:read` (L686); `profiles_select_association_policy` requires an active
membership (L591–604); `contact_type` = `email|phone|whatsapp` (L18);
`verification_state` includes `unverified` (L21) and contact insert forces it (certified
spoof guard); **no contact-verification Edge Function exists** — verified by listing
`supabase/functions/`, which contains exactly `auth-bootstrap`, `auth-context`,
`resident-auth`, `tenant-context-list`, `tenant-context-select`, `profile-get`,
`profile-update`, `profile-contacts-list`, `profile-contact-upsert`,
`profile-contact-delete` and `_shared/`.
