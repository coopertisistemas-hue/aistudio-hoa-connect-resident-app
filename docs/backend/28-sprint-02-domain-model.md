# 28 — Sprint 2 Domain Model Specification

**Status:** PROPOSED — no migrations created. Implements decisions D-01 … D-11 of
`27-sprint-02-executive-planning.md`. Every name marked *(existing)* refers to the
certified Sprint 1 schema in
`supabase/migrations/20260719170000_sprint01_foundation_identity.sql`.

---

## 1. Entity overview

| Entity | Table | Tenant-owned | Status | Sprint |
|---|---|---|---|---|
| Association (tenant) | `tenants` *(existing)* | self | frozen | 1 |
| Association extension | `association_details` *(new)* | yes (1:1) | proposed | 2 |
| Platform identity | `profiles` *(existing)* | no | frozen | 1 |
| Contacts / verification | `profile_contacts` *(existing)* | no | frozen | 1 |
| Resident (association-scoped) | `residents` *(new)* | yes | proposed | 2 |
| Residence / unit | `properties` *(existing)* | yes | frozen (semantics extended, schema unchanged) | 1→2 |
| Household — platform users | `residence_members` *(existing, one constraint evolution per D-05)* | yes | extended | 1→2 |
| Household — non-platform persons | `household_members` *(new)* | yes | proposed | 2 |
| Responsible payer | `residence_payers` *(new)* | yes | proposed | 2 |
| Onboarding | `residence_invitations` *(new)* | yes | proposed | 2 |
| Audit | `audit_events` *(existing)* | yes (nullable tenant) | frozen | 1 |

## 2. Canonical concept map (anti-duplication contract)

This section is the binding answer to "what is the canonical X entity" and the primary
mitigation of risk R-01.

- **Person (identity):** `profiles` — one per `auth.users`, platform-level, no
  `tenant_id`. Identity data: `full_name`, `preferred_name`, `avatar_url`, locale,
  timezone. Contacts and their verification: `profile_contacts` only.
- **Resident:** `residents` — the association-scoped projection of a profile. Holds
  *only* association-specific data: registration code, resident lifecycle status,
  approval metadata, association notes. **Must not** duplicate name, contacts, document
  or any identity field.
- **Residence:** `properties` — the physical/legal unit inside a tenant. A residence is
  not an occupancy and not a household; those are relationships over it.
- **Occupancy / household (users):** `residence_members` — profile ↔ property with
  `residence_role`, period and status.
- **Household (persons without login):** `household_members` — dependents, minors and
  other persons under a responsible profile. Never authenticates.
- **Financial responsibility:** `residence_payers` — profile ↔ property with period.
  Payer ≠ occupant ≠ owner; all three are independent relationships.
- **Staff:** `tenant_members` *(existing)* — administration, operations, finance,
  support, viewer, and (per D-07) collector. Residents are never `tenant_members`.
- **Platform administration:** `platform_role_assignments` *(existing)* — unchanged.

Relationship cardinality:

- One profile → many `residents` (one per association) — answers "can a resident belong
  to multiple associations": **yes**, via multiple `residents` rows.
- One profile → many active `residence_members` across properties/tenants — "linked to
  multiple residences": **yes**.
- One profile → many roles simultaneously (resident in tenant A, staff in tenant B,
  platform admin): **yes** — roles live in separate tables by design.

## 3. Identity data vs association-specific data

| Data | Home | Editable by |
|---|---|---|
| full_name | `profiles` (immutable trigger) | nobody post-creation (ADR-10 COR flow future) |
| preferred_name, avatar_url, locale, timezone | `profiles` | self (certified `profiles_update_self_policy`) |
| contacts + verification state | `profile_contacts` | self (insert forces `unverified`); association verification perms exist (`profile_contacts:verify`) |
| registration code (matrícula), resident status, approval, association notes | `residents` | association staff via Edge Functions |
| residence role, period, is_primary | `residence_members` | association staff via Edge Functions |
| dependent data (name, birth date, relationship) | `household_members` | responsible resident (limited) + association staff |
| payer link + period | `residence_payers` | association staff |

**Self-editable (Sprint 2 additions):** residents may propose their own move-out
(transition request → staff approval), manage their household non-user members within
staff-set limits, and accept/decline invitations. **Approval-required:** registration
code assignment, any status transition to `active`, payer assignment, any change to
another person's data, all staff-only fields.

**Contact verification:** unchanged from Sprint 1 — `verification_state` on
`profile_contacts` with the certified consistency CHECK and protected-field trigger.
Association-level verification uses the existing `profile_contacts:verify` permission;
no new verification model in Sprint 2.

## 4. Residence semantics (D-02/D-03)

- `properties.status` (`property_status`: `active | inactive | under_review`) remains
  the *administrative* state of the unit.
- **Occupied/vacant is derived**, not stored: a property is occupied iff at least one
  `residence_members` row with `status = 'active'` and period-valid exists.
  A derived view (`property_occupancy_view`, SECURITY DEFINER or plain view — decided in
  Wave 2.3) may expose this; no stored column in Sprint 2 (avoids R-10 drift).
- **Role semantics on `residence_members.residence_role`:**
  - `owner` — holds ownership/title relation to the unit; may or may not occupy.
  - `tenant` — rents the unit (locatário); typically occupies.
  - `resident` — occupies without ownership/tenancy instrument (e.g. family member
    ceded use).
  - `dependent` — platform-user dependent of a responsible occupant.
  - `authorized_contact` — may act/receive information on behalf of the household
    without occupancy or responsibility.
- **Primary residence:** existing `is_primary` on `residence_members`; Sprint 2 adds a
  partial unique index guaranteeing **at most one active primary residence per profile**
  (new constraint — see §10). Primary vs secondary is therefore a membership attribute,
  not a property attribute.
- **Move-in/move-out history:** period rows per D-05 — see §5.
- **Vacancy:** derived (no active occupancy). `property_status = 'inactive'` is an
  administrative suspension, independent of vacancy.

## 5. History model (D-05)

The only Sprint 1 schema alteration proposed:

1. Drop `UNIQUE (property_id, profile_id)` on `residence_members`.
2. Add `UNIQUE (property_id, profile_id) WHERE status = 'active'` (partial).
3. Add column `end_reason residence_membership_end_reason NULL` with CHECK:
   `end_reason IS NOT NULL` iff `status = 'revoked'` … modeled precisely as:
   `(status = 'revoked') = (end_reason IS NOT NULL OR end_date IS NOT NULL)` — final
   CHECK expression fixed in Wave 2.3 migration review; the invariant is "a closed
   membership always records when and why".

Rules:

- Closing a membership = `status → 'revoked'` + `end_date` + `end_reason` (single Edge
  Function, audited). Rows are never updated again after closure (application-level
  rule + audit trigger consideration in Wave 2.4).
- Re-move-in of the same profile = **new row** (new period). The certified partial
  indexes (`idx_residence_members_profile_active`, `…_property_active`) already filter
  `status = 'active'` and keep working unchanged.
- Existing certified RLS policies filter on `status = 'active'` via helpers; closed
  rows remain readable to tenant staff for history (policy extension in document 29).
- The same period+reason pattern applies to the new `residence_payers` table from day
  one.

`residence_membership_end_reason` (proposed enum): `moved_out`,
`ownership_transferred`, `tenancy_ended`, `evicted`, `deceased`, `blocked`,
`administrative`.

## 6. Proposed new tables

Conventions inherited from Sprint 1: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`,
`created_at`/`updated_at timestamptz NOT NULL DEFAULT now()` with
`touch_updated_at()` trigger, RLS ENABLE + FORCE, `REVOKE ALL` from
`anon, authenticated` then explicit minimal grants, `SET search_path = ''` on all
functions.

### 6.1 `association_details`

- **Purpose:** legal/operational extension of `tenants` (D-06). Registration (e.g.
  CNPJ), trade name, official contacts, address, operational settings, module
  enablement.
- **Tenant ownership:** `tenant_id uuid NOT NULL UNIQUE REFERENCES tenants ON DELETE
  CASCADE` — strict 1:1.
- **Columns (proposed):** `trade_name text`, `registration_number text`,
  `email text`, `phone text`, `address_line1 text`, `address_line2 text`,
  `district text`, `city text`, `state text`, `postal_code text`,
  `settings jsonb NOT NULL DEFAULT '{}'` (association policies, e.g.
  `requires_resident_approval`, `allows_self_moveout_request`),
  `enabled_modules jsonb NOT NULL DEFAULT '[]'` (e.g. `["residents"]`; billing added by
  future sprints).
- **Uniqueness:** `tenant_id` unique; `registration_number` unique per tenant
  (`UNIQUE (tenant_id, registration_number)` with NULLs allowed) — national uniqueness
  deferred (platform decision).
- **Lifecycle:** none (row lives and dies with the tenant).
- **Audit:** `association_details.update` on any change.
- **Indexes:** PK; `UNIQUE (tenant_id)`; optional `(registration_number)` lookup index.
- **RLS ownership model:** SELECT — tenant staff with `tenant_context:admin`… refined
  to: any active tenant member + platform admin; INSERT/UPDATE — `tenant_context:admin`
  permission holders only, via Edge Function; DELETE — none. Details in document 29.

### 6.2 `residents`

- **Purpose:** association-scoped resident record (D-01) — the canonical "resident".
- **Tenant ownership:** `tenant_id uuid NOT NULL REFERENCES tenants ON DELETE CASCADE`.
- **Columns (proposed):** `profile_id uuid NOT NULL REFERENCES profiles ON DELETE
  RESTRICT`, `registration_code text`, `status resident_status NOT NULL DEFAULT
  'pending'`, `approved_by_profile_id uuid REFERENCES profiles`,
  `approved_at timestamptz`, `status_reason text`, `notes text`,
  `joined_at timestamptz`, `left_at timestamptz`.
- **Uniqueness:** `UNIQUE (tenant_id, profile_id)`; `UNIQUE (tenant_id,
  registration_code) WHERE registration_code IS NOT NULL`.
- **Lifecycle:** `status` transitions per §8; `joined_at` set on first `active`;
  `left_at` on `former`/`deceased`.
- **Audit:** `resident.create`, `resident.approve`, `resident.status_change`,
  `resident.update`.
- **Indexes:** `(tenant_id, status)`, `(profile_id)`, partial active index
  `(tenant_id, profile_id) WHERE status = 'active'` if query plans need it (Wave 2.6).
- **RLS ownership model:** self-read; staff read/write via permission
  `residents:read` / `residents:write` (new `tenant_permission` values, D-07 note);
  platform admin read. Details in document 29.
- **Invariant:** zero identity columns (R-01 contract).

### 6.3 `household_members`

- **Purpose:** non-platform persons of a household (D-03): minors, dependents without
  login, other occupants.
- **Tenant ownership:** `tenant_id uuid NOT NULL REFERENCES tenants ON DELETE CASCADE`
  (denormalized, Sprint 1 pattern).
- **Columns (proposed):** `property_id uuid NOT NULL REFERENCES properties ON DELETE
  CASCADE`, `responsible_profile_id uuid NOT NULL REFERENCES profiles ON DELETE
  RESTRICT`, `full_name text NOT NULL`, `birth_date date`,
  `relationship household_relationship NOT NULL`, `status household_member_status NOT
  NULL DEFAULT 'active'` (`active | inactive | former`), `start_date date`,
  `end_date date`, `notes text`.
- **Uniqueness:** no natural unique (names repeat); duplicates prevented
  application-side + reviewed in audit.
- **Lifecycle:** `active → inactive → former`; hard DELETE allowed only while
  pre-approval (D-10) — Sprint 2 has no approval flow for household members, so DELETE
  is allowed to the responsible resident and staff, always audited.
- **Audit:** `household_member.create/update/remove`.
- **Indexes:** `(property_id, status)`, `(responsible_profile_id, status)`,
  `(tenant_id, status)`.
- **RLS ownership model:** responsible resident self-manages within own property;
  household co-members read; staff read/write via `residences:read`/`residences:write`;
  platform admin read. Details in document 29.

### 6.4 `residence_payers`

- **Purpose:** responsible-payer relationship with period history (D-04) — billing
  anchor for Sprint 3+.
- **Tenant ownership:** `tenant_id uuid NOT NULL` (denormalized) + `property_id uuid
  NOT NULL REFERENCES properties ON DELETE CASCADE`.
- **Columns (proposed):** `profile_id uuid NOT NULL REFERENCES profiles ON DELETE
  RESTRICT`, `status payer_status NOT NULL DEFAULT 'active'` (`active | ended`),
  `start_date date NOT NULL`, `end_date date`, `end_reason text` (free text in v1 —
  enum candidate deferred), `source text NOT NULL DEFAULT 'association'` (who set it:
  `association | migration_import`), CHECK period valid (end ≥ start).
- **Uniqueness:** `UNIQUE (property_id) WHERE status = 'active'` — one active payer per
  property (D-04; relaxable later for split payment without redesign).
- **Lifecycle:** close = `status → 'ended'` + `end_date` (+reason); new responsibility
  = new row.
- **Audit:** `residence_payer.assign`, `residence_payer.end`.
- **Indexes:** `(property_id, status)`, `(profile_id, status)`, `(tenant_id, status)`.
- **RLS ownership model:** payer self-read; household active members read (so occupants
  see who is responsible); staff read/write via `residences:read`/`residences:write`;
  platform admin read. Details in document 29.
- **Invariant:** `profile_id` must have a `residents` row in the same tenant with
  status in (`active`, `inactive`) at assignment time — enforced in the Edge Function +
  validated by SQL gate (DB-level cross-table assertion via trigger evaluated in Wave
  2.3; if too costly, EF-only with a periodic integrity test).

### 6.5 `residence_invitations`

- **Purpose:** resident onboarding (D-11) — invite a person to a property with a
  proposed role.
- **Tenant ownership:** `tenant_id uuid NOT NULL` + `property_id uuid NOT NULL
  REFERENCES properties ON DELETE CASCADE`.
- **Columns (proposed):** `inviter_profile_id uuid NOT NULL REFERENCES profiles`,
  `inviter_type text NOT NULL DEFAULT 'association'` (`association | resident`),
  `invitee_contact_type contact_type NOT NULL`, `invitee_contact_value text NOT NULL`
  (normalized), `proposed_role residence_role NOT NULL`, `token_hash text NOT NULL
  UNIQUE`, `status invitation_status NOT NULL DEFAULT 'pending'` (`pending | accepted |
  declined | expired | revoked`), `expires_at timestamptz NOT NULL`,
  `accepted_profile_id uuid REFERENCES profiles`, `accepted_at timestamptz`.
- **Uniqueness:** `token_hash` unique; partial unique `UNIQUE (property_id,
  invitee_contact_type, invitee_contact_value) WHERE status = 'pending'` (no duplicate
  open invitations).
- **Lifecycle:** pending → accepted/declined/expired/revoked; expiry swept lazily (on
  read) — no cron in Sprint 2.
- **Audit:** `invitation.create`, `invitation.accept`, `invitation.revoke`,
  `invitation.expire`.
- **Indexes:** `(token_hash)` unique, `(property_id, status)`, `(tenant_id, status)`.
- **RLS ownership model:** no direct `authenticated` SELECT on tokens; staff list via
  permission; invitee never reads rows directly (accept flow is token-based through the
  Edge Function). Details in document 29.

### 6.6 `residence_members` extension (D-05)

- `end_reason residence_membership_end_reason NULL` (new column).
- Constraint evolution per §5.
- New partial unique: one active primary per profile —
  `UNIQUE (profile_id) WHERE status = 'active' AND is_primary` (new index
  `idx_residence_members_one_primary_active`).
- **Protected after closure:** application rule + optional trigger
  `residence_members_closed_immutable` (evaluated Wave 2.4) blocking updates to rows
  with `status = 'revoked'` except via staff Edge Function corrections — decision
  recorded in Wave 2.4 report.

## 7. New enums (D-07)

| Enum | Values |
|---|---|
| `resident_status` | `pending`, `active`, `inactive`, `former`, `deceased`, `blocked` |
| `residence_membership_end_reason` | `moved_out`, `ownership_transferred`, `tenancy_ended`, `evicted`, `deceased`, `blocked`, `administrative` |
| `household_relationship` | `spouse`, `child`, `parent`, `relative`, `dependent`, `legal_charge`, `other` |
| `household_member_status` | `active`, `inactive`, `former` |
| `payer_status` | `active`, `ended` |
| `invitation_status` | `pending`, `accepted`, `declined`, `expired`, `revoked` |
| `tenant_role` (extension) | + `association_collector` |
| `tenant_permission` (extension) | + `residents:read`, `residents:write`, `residence_payers:read`, `residence_payers:write`, `household:read`, `household:write`, `invitations:read`, `invitations:write`, `association_details:read`, `association_details:write`, `audit:read_association` |

Permission-to-role matrix additions follow the certified hardcoded style of
`has_tenant_permission()` (document 29 §3).

## 8. Status models, transitions, prohibited states

### 8.1 `residents.status`

```
pending ──approve──▶ active ──▶ inactive ──▶ active
   │                   │            │
   │                   ├──────────▶ blocked ──▶ active (staff unblocks)
   │                   ├──────────▶ former (terminal)
   │                   └──────────▶ deceased (terminal)
   └──revoke──▶ (row kept, status → former with status_reason='invitation_revoked'
                 or row deleted pre-approval per D-10 — fixed in Wave 2.2)
```

Prohibited: `former|deceased → active` (new resident record required — but
`UNIQUE(tenant_id, profile_id)` then blocks re-entry; Wave 2.2 decision: either allow
status `former → pending` re-activation keeping one row, or evolve the unique
constraint like D-05. **Recommendation:** allow `former → pending` (simpler, preserves
history in one row); recorded as decision point D-01a in the Wave 2.2 report.

### 8.2 Cross-entity consistency (R-10)

- Closing the last active `residence_members` row of a profile does **not** change
  `residents.status` automatically (resident may remain associated without a current
  unit). Staff decision, audited.
- `residents.status = 'blocked'` blocks *new* memberships/payer assignments (Edge
  Function guard) but does not cascade-close existing active rows (staff resolves
  explicitly).
- `residents.status = 'deceased'` requires staff to close memberships/payer rows in the
  same workflow (Edge Function orchestrates; each step audited).
- A `household_members` row is prohibited for a person who has an active
  `residence_members` row in the same property (R-01 invariant — checked in the Edge
  Function; SQL gate asserts).
- Active `residence_payers` on an `inactive` property is allowed (debt continuity) but
  flagged in the list endpoint; not a violation.

### 8.3 `residence_members` transition rules

- `pending → active` (staff approval) | `pending → revoked` (declined/cancelled, with
  `end_reason='administrative'`).
- `active → revoked` only with `end_date` + `end_reason`.
- No `revoked → *` transition; new period = new row.

## 9. Invariants summary (machine-checkable)

1. Every new table row carries `tenant_id` equal to its parent chain's tenant
   (asserted by SQL gates with forged-tenant fixtures).
2. At most one active `residence_members` per (property, profile).
3. At most one active primary residence per profile.
4. At most one active `residence_payers` per property.
5. No identity field stored outside `profiles`/`profile_contacts`.
6. No `household_members` row duplicates an active user membership (same property,
   same person).
7. Closed periods always carry `end_date`; memberships also `end_reason`.
8. `residents` never appears in `tenant_members`; staff never in `residents` by virtue
   of staff role alone (a staff member may separately be a resident).
9. Invitation tokens stored only as `token_hash`; plaintext never persisted.
10. Every mutation above emits exactly one `audit_events` row via `log_audit_event()`.

## 10. Expected indexes (consolidated)

Per table in §6 plus:

- `residents`: `(tenant_id, status)`, `(profile_id)`.
- `household_members`: `(property_id, status)`, `(responsible_profile_id, status)`,
  `(tenant_id, status)`.
- `residence_payers`: unique partial `(property_id) WHERE status='active'`;
  `(profile_id, status)`; `(tenant_id, status)`.
- `residence_invitations`: unique `(token_hash)`; unique partial pending per
  property+contact; `(tenant_id, status)`.
- `residence_members`: `UNIQUE (profile_id) WHERE status='active' AND is_primary`;
  replacement partial unique `(property_id, profile_id) WHERE status='active'`.
- `association_details`: unique `(tenant_id)`.

All index choices validated by EXPLAIN (ANALYZE, BUFFERS) gates in Wave 2.6
(PERF2-*) at the scale defined in document 31 §5.

## 11. Forward constraints for future modules (documented only — not built)

- **Water meters / connections:** will anchor `meters.property_id → properties.id`.
  Multiple meters per property and shared meters across properties are both compatible
  (meter table owns the sharing graph; nothing in Sprint 2 pre-assumes 1:1).
- **Billing party:** active `residence_payers` row of the property at billing time;
  historical invoices keep the payer snapshot (Sprint 3 concern).
- **Tickets/support:** will reference `residents.id` / `properties.id`; ADR-09 Option B
  ownership projection already anticipates `tenant_id/property_id/resident_profile_id`.
- **Collector workflows:** read routes via `has_tenant_role(t,
  'association_collector')` with `residences:read` permission only.
- **Module gating:** future modules check `association_details.enabled_modules`.

Nothing in this section creates tables, columns or code in Sprint 2.

## 12. Changes to Sprint 1 certified objects (complete list)

| Object | Change | Decision | Risk |
|---|---|---|---|
| `residence_members` | drop `UNIQUE(property_id, profile_id)`; add partial unique on active; add `end_reason`; add one-active-primary partial unique | D-05 | R-19 (HIGH, gated) |
| `tenant_role` | `ADD VALUE 'association_collector'` | D-07 | R-18 (LOW) |
| `tenant_permission` | add 11 values (§7) | D-07 | R-18 (LOW) |
| `has_tenant_permission()` | extend role→permission matrix (function body is Sprint 1 code; the extension is additive: new permission keys only) | D-07 | reviewed in Wave 2.4 audit |
| everything else | **unchanged** | — | — |

No other Sprint 1 table, policy, trigger, function, grant, test or Edge Function is
modified by this plan.
