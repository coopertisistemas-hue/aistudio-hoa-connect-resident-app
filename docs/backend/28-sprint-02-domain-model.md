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
| registration code (matrícula), resident status, approval | `residents` | association staff via RPC |
| **(R1)** association notes, status reasons | `resident_staff_notes` (§6.8, staff-only, append-only) | `residents:write` holders only |
| residence role, period, is_primary | `residence_members` | association staff via RPC |
| dependent data (name, birth date, relationship) | `household_members` | responsible resident (limited) + association staff |
| payer link + period | `residence_payers` | association staff |
| **(R1)** member-visible association config | `association_details.settings` (allow-listed keys) | `association_details:write` (admin) |
| **(R1)** internal association config | `association_settings_private` (§6.7) | `association_details:write` (admin) only; no member read |

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

One of four Sprint 1 schema alterations (complete list: §12):

1. Drop `UNIQUE (property_id, profile_id)` on `residence_members`.
2. Add `UNIQUE (property_id, profile_id) WHERE status IN ('active','pending')`
   (partial). **(R1)** Scoping this to `active` alone — as earlier revisions proposed —
   would have released the certified duplicate guarantee for `pending` rows, allowing
   unlimited duplicate pending memberships for the same pair. The constraint covers
   every non-closed row, which is exactly the certified guarantee, while making
   re-occupancy expressible.
3. Add column `end_reason residence_membership_end_reason NULL`.
4. **(R1)** Add `UNIQUE (tenant_id, profile_id) WHERE status='active' AND is_primary`
   — tenant-scoped, **not** global. A global index would make a person's registration in
   a second association fail on a constraint caused by a row in a tenant the operator
   cannot see: a functional failure in the multi-association scenario this package
   promises, and a cross-tenant existence leak contradicting document 27 §5.
5. **(R1)** Add `UNIQUE (id, tenant_id)` to support composite FKs (D-13).
6. **(R1)** Add `requested_end_date date NULL` and `moveout_requested_at timestamptz
   NULL` so a resident move-out request has queryable state (document 27 §13a item 7).

### 5.1 Closure semantics (R1 — CHECK expression fixed)

The invariant is "a closed membership always records when and why":

```sql
CONSTRAINT residence_members_closure_complete CHECK (
  (status = 'revoked' AND end_date IS NOT NULL AND end_reason IS NOT NULL)
  OR
  (status <> 'revoked' AND end_reason IS NULL)
)
```

`end_date` may be back- or forward-dated relative to `revoked_at`; the existing
certified `residence_members_period_valid` CHECK continues to enforce
`end_date >= start_date`.

### 5.2 Closure vocabulary — authoritative rule (R1, ARB-15)

`residence_members` carries three closure-related columns after this change. Their roles
are fixed and non-overlapping:

| Column | Meaning | Set by |
|---|---|---|
| `end_date` (date) | **business-effective** closure date — the day the occupancy legally ended. Authoritative for history, billing and period reconstruction. | caller-supplied, validated |
| `end_reason` (enum) | why the period closed | caller-supplied |
| `revoked_at` (timestamptz, certified) | **audit timestamp** of the closing transaction — when the system recorded it | `now()` in the closing RPC |

No query answering a business question may use `revoked_at`. It exists for forensic
ordering only. This resolves the ambiguity introduced by adding `end_date` alongside the
certified column.

### 5.3 Rules

- Closing a membership = `status → 'revoked'` + `end_date` + `end_reason`, performed by
  a single RPC in one transaction with its audit event.
- Rows are **never** updated after closure: trigger
  `residence_members_closed_immutable` blocks any UPDATE of a row whose `status` is
  already `revoked` (decision closed — document 27 §13a item 4).
- Re-move-in of the same profile = **new row** (new period).
- Existing certified RLS policies filter on `status = 'active'` via helpers; closed
  rows remain readable to tenant staff for history, and to the member themselves
  (document 29 §6.6).
- The same period+reason pattern applies to `residence_payers` from day one, using the
  **same** enum (§7).

### 5.4 Index reality and the performance argument (R1 — ARB-14/RC-09/RC-10)

**Correction of record.** Earlier revisions of this document and of document 31 stated
that `idx_residence_members_profile_active` and `idx_residence_members_property_active`
are partial indexes filtering `status = 'active'`. **They are not.** Verified at
`supabase/migrations/20260719170000_sprint01_foundation_identity.sql:214-215`:

```sql
CREATE INDEX IF NOT EXISTS idx_residence_members_profile_active
  ON public.residence_members(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_residence_members_property_active
  ON public.residence_members(property_id, status);
```

They are plain composite B-tree indexes. The suffix `_active` in their names describes
intent, not structure.

**Rebuilt argument.** The D-05 conclusion survives, for a different reason than
originally stated: a composite index on `(x, status)` serves an `x = ? AND status =
'active'` lookup by seeking directly to the matching prefix, so adding closed rows does
not force a scan of them. What the original argument got wrong is the *cost model*:
with a plain composite index the closed rows still occupy index pages within each
`x` group, so lookups traverse more index tuples as history accumulates, and the index
grows without bound.

**Consequence for Sprint 2.** At the document 31 §5 fixture scale (≥25,000 memberships,
≥30% closed) this is measurable but not severe. Sprint 2 therefore **adds true partial
indexes** alongside the certified ones rather than relying on a false claim:

```sql
CREATE INDEX idx_residence_members_profile_open
  ON public.residence_members(profile_id) WHERE status = 'active';
CREATE INDEX idx_residence_members_property_open
  ON public.residence_members(property_id) WHERE status = 'active';
```

These are additive (new indexes, certified ones untouched). PERF2-02 is rewritten in
document 31 §5 to assert the *new* partial indexes are chosen and to compare plans
against the certified composite indexes, rather than asserting a property the certified
indexes never had.

`residence_membership_end_reason` (proposed enum, shared with payers — see §7):
`moved_out`, `ownership_transferred`, `tenancy_ended`, `evicted`, `deceased`, `blocked`,
`replaced`, `administrative`.

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
  `settings jsonb NOT NULL DEFAULT '{}'` — **(R1) member-readable settings only**,
  restricted to the allow-list below; `enabled_modules jsonb NOT NULL DEFAULT '[]'`.
- **(R1) `settings` allow-list (the only permitted keys):**
  `requires_resident_approval` (bool), `allows_resident_invitations` (bool),
  `allows_self_moveout_request` (bool), `invitation_default_expiry_hours` (int ≤ 720).
  **(R1) `enabled_modules` allow-list:** `residents`, `residences`, `household`,
  `payers`, `invitations`. Any other key or value ⇒ 422. Without these lists F-02's
  promised "422 on bad module name" was unimplementable.
- **(R1) Private settings live in `association_settings_private`** (§6.7), not here.
  This table is member-readable in full, so nothing confidential may be stored in it —
  see D-14. Edge Function projection is **not** a confidentiality control.
- **Uniqueness:** `tenant_id` unique. **(R1)** `registration_number` gains a **global**
  partial unique (`UNIQUE (registration_number) WHERE registration_number IS NOT NULL`).
  The original per-tenant unique was nearly vacuous on a 1:1 table; at 500 associations
  two tenants sharing a CNPJ means the same legal entity onboarded twice, which is a
  billing and legal problem far more expensive to repair than one index.
- **Lifecycle:** none (row lives and dies with the tenant). **(R1)** The row is **seeded
  at tenant creation**; there is no INSERT path for `authenticated` and no INSERT grant.
  F-01 therefore never encounters a missing row.
- **Audit:** `association_details.update` on any change.
- **Indexes:** PK; `UNIQUE (tenant_id)`; `UNIQUE (registration_number)` partial.
- **RLS ownership model:** SELECT — any active tenant member, any active resident of the
  tenant, platform admin. UPDATE — `association_details:write` (admin) via RPC.
  INSERT/DELETE — none. Details in document 29.

### 6.2 `residents`

- **Purpose:** association-scoped resident record (D-01) — the canonical "resident".
- **Tenant ownership:** `tenant_id uuid NOT NULL REFERENCES tenants ON DELETE CASCADE`.
- **Columns (proposed):** `profile_id uuid NOT NULL REFERENCES profiles ON DELETE
  RESTRICT`, `registration_code text`, `status resident_status NOT NULL DEFAULT
  'pending'`, `approved_by_profile_id uuid REFERENCES profiles`,
  `approved_at timestamptz`, `joined_at timestamptz`, `left_at timestamptz`.
- **(R1) `status_reason` and `notes` moved out** to `resident_staff_notes` (§6.8).
  They are staff-internal free text recording why a person was blocked, declared
  deceased or marked former. The original design left them in a row readable by
  co-household members, which no Edge Function projection could prevent (D-14).
- **Uniqueness:** `UNIQUE (tenant_id, profile_id)`. **(R1)** `registration_code` becomes
  **non-reusable** within a tenant: `UNIQUE (tenant_id, registration_code) WHERE
  registration_code IS NOT NULL`, and the closing RPC never clears the code on
  `former`/`deceased`. Reuse would destroy the historical code↔person mapping, which
  appears on historical boletos and is relied upon in disputes.
- **(R1) Composite-FK support:** `UNIQUE (id, tenant_id)` (D-13).
- **Lifecycle:** `status` transitions per §8; `joined_at` set on first `active`;
  `left_at` on `former`/`deceased`.
- **Audit:** `resident.create`, `resident.approve`, `resident.status_change`,
  `resident.update`.
- **Indexes:** `(tenant_id, status)`, `(profile_id)`. **(R1)** plus
  `(tenant_id, registration_code)` unique partial and a trigram index supporting the
  `resident-list` `q` search (`gin_trgm_ops` on `registration_code`) — the search path
  now has its own performance gate (document 31 §5 PERF2-08).
- **RLS ownership model:** self-read (all statuses, own history); staff read/write via
  `residents:read` / `residents:write`; platform admin read. **(R1) The co-household
  read clause is removed** — housemate visibility is served by the property-scoped
  `residence-get` read RPC (document 30 F-09), which both fixes the confidentiality
  problem and eliminates a correlated `EXISTS` OR-ed into a policy, the sprint's worst
  RLS plan shape. Details in document 29.
- **Invariant:** zero identity columns (R-01 contract).

### 6.3 `household_members`

- **Purpose:** non-platform persons of a household (D-03): minors, dependents without
  login, other occupants.
- **Tenant ownership:** `tenant_id uuid NOT NULL REFERENCES tenants ON DELETE CASCADE`
  (denormalized, Sprint 1 pattern).
- **Columns (proposed):** `property_id uuid NOT NULL`, `responsible_profile_id uuid NOT
  NULL REFERENCES profiles ON DELETE RESTRICT`, `full_name text NOT NULL`,
  `birth_date date`, `relationship household_relationship NOT NULL`,
  `status household_member_status NOT NULL DEFAULT 'active'`
  (`active | inactive | former`), `start_date date`, `end_date date`, `notes text`,
  **(R1)** `linked_profile_id uuid NULL REFERENCES profiles ON DELETE RESTRICT`.
- **(R1) `linked_profile_id` rationale.** It does two things the original design could
  not. First, it makes invariant 6 genuinely machine-checkable: "no household row
  duplicates an active user membership" becomes a real SQL predicate instead of a
  name+birth-date heuristic. Second, it provides the **promotion path** — a minor
  reaching adulthood, or any dependent obtaining a login, is a certainty over a
  multi-year product life, and the original package had no way to carry that person's
  household history into `residence_members`. Promotion procedure: set
  `linked_profile_id`, close the household row (`status='former'`, `end_date`), open the
  membership with `start_date` = the household row's `end_date`, all in one RPC, audited
  as `household_member.promote`.
- **(R1) Composite FK:** `(property_id, tenant_id) → properties (id, tenant_id)` (D-13).
- **Uniqueness:** no natural unique (names repeat). **(R1)** Duplicate *linked* persons
  are prevented structurally: `UNIQUE (property_id, linked_profile_id) WHERE
  linked_profile_id IS NOT NULL AND status = 'active'`. Unlinked duplicates remain a
  disclosed heuristic-only risk (document 31 §9).
- **Lifecycle:** `active → inactive → former`. **(R1) Hard DELETE is removed.** The
  original justification (pre-approval cleanup) does not apply, because Sprint 2 has no
  household approval flow — the document said so itself while allowing deletion anyway,
  which contradicted the historical-integrity principle applied everywhere else.
  Correction of a mistaken entry uses `status='former'` with
  `end_reason='administrative'`; the audit snapshot is retained either way.
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
  NOT NULL`, **(R1)** bound by composite FK
  `(property_id, tenant_id) → properties (id, tenant_id)`.
- **Columns (proposed):** `resident_id uuid NOT NULL` **(R1 — replaces `profile_id`)**,
  `status payer_status NOT NULL DEFAULT 'active'` (`active | ended`),
  `start_date date NOT NULL`, `end_date date`,
  **(R1)** `end_reason residence_membership_end_reason NULL` (the shared enum, §7),
  `source text NOT NULL DEFAULT 'association'` (`association | migration_import`),
  CHECK period valid (end ≥ start).
- **(R1) `resident_id` instead of `profile_id`, with composite FK
  `(resident_id, tenant_id) → residents (id, tenant_id)`.** This makes the
  payer-is-a-resident-of-this-tenant invariant **structural**. The original design
  referenced `profiles` directly and enforced the invariant in the Edge Function, with a
  trigger "evaluated in Wave 2.3; if too costly, EF-only with a periodic integrity
  test" — a periodic test detects violations, it does not prevent them. The composite FK
  prevents them at write time, needs no trigger, and closes deferred decision 5.
- **(R1) Temporal integrity — exclusion constraint.** The active-row partial unique
  prevents two *currently* active payers but permits two *closed* rows whose periods
  overlap, so "who was responsible for unit X on date D" — the question water billing
  across an occupant change exists to answer — could return two rows. Added:

  ```sql
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE public.residence_payers ADD CONSTRAINT residence_payers_no_overlap
    EXCLUDE USING gist (
      property_id WITH =,
      daterange(start_date, end_date, '[)') WITH &&
    );
  ```

  Declaring this now costs one index; adding it later requires repairing dirty
  historical data.
- **Uniqueness:** `UNIQUE (property_id) WHERE status = 'active'` — one active payer per
  property (D-04; relaxable later for split payment without redesign, alongside the
  exclusion constraint which would then gain a share dimension).
- **Lifecycle:** close = `status → 'ended'` + `end_date` + `end_reason`; new
  responsibility = new row. `replaced` is the `end_reason` used when a payer is
  substituted (the value exists in the shared enum — the original design emitted the
  literal `'replaced'` into a free-text column, creating a second closure vocabulary
  within one sprint).
- **Audit:** `residence_payer.assign`, `residence_payer.end`.
- **Indexes:** `(property_id, status)`, `(resident_id, status)`, `(tenant_id, status)`.
- **RLS ownership model:** payer self-read (own rows incl. ended history); active
  household members read **the active row only** (R1 — see D-14; history is staff-only
  via `residence_payers:read`); staff read/write via
  `residence_payers:read`/`residence_payers:write`; platform admin read.

### 6.5 `residence_invitations` (R1 — completely re-specified, RC-04)

The Executive Review found the original specification unable to onboard anyone: the
accept path required a verified contact that no user could obtain, and a lost or expired
invitation could never be replaced. This section replaces it in full.

- **Purpose:** resident onboarding (D-11) — invite a person to a property with a
  proposed role.
- **Tenant ownership:** `tenant_id uuid NOT NULL` + `property_id uuid NOT NULL`, bound
  by composite FK `(property_id, tenant_id) → properties (id, tenant_id)` (D-13). The
  tenant of an acceptance is therefore always derived from the invitation row and can
  never be supplied or influenced by the client.
- **Columns:** `inviter_profile_id uuid NOT NULL REFERENCES profiles`,
  `inviter_type text NOT NULL DEFAULT 'association'` (`association | resident`),
  `invitee_contact_type contact_type NOT NULL` (`email | phone | whatsapp` — the
  certified enum), `invitee_contact_value text NOT NULL` (normalized: lowercased email,
  E.164 phone), `proposed_role residence_role NOT NULL`,
  `token_hash text NOT NULL UNIQUE`, `status invitation_status NOT NULL DEFAULT
  'pending'`, `expires_at timestamptz NOT NULL`,
  `accepted_profile_id uuid NULL REFERENCES profiles`, `accepted_at timestamptz NULL`,
  `revoked_at timestamptz NULL`, `superseded_by uuid NULL REFERENCES
  residence_invitations(id)`, `attempt_count integer NOT NULL DEFAULT 0`.

#### 6.5.1 Token lifecycle and hashing

| Property | Specification | Rationale |
|---|---|---|
| Generation | ≥256-bit CSPRNG (`crypto.getRandomValues`, 32 bytes) | brute-force resistance comes from entropy alone |
| Encoding | base64url, no padding | URL-safe for links |
| Storage | unsalted **SHA-256** of the plaintext, in `token_hash` | lookup is by hash, so the hash must be deterministic; salting (bcrypt/argon2) would force a table scan |
| Plaintext persistence | **never** — returned once in the F-19 response, then discarded | SQL gate asserts no column holds plaintext |
| Prohibited | short codes, human-readable codes, sequential values, any token < 128 bits | a deterministic hash over a 6-digit code is trivially enumerable |
| Lookup | `WHERE token_hash = sha256($1)` on the unique index | constant-time index probe; no timing oracle distinguishing existence |

#### 6.5.2 State model

```
                    ┌────────────► revoked      (staff/inviter, terminal)
                    │
 (create) ──► pending ──► accepted               (terminal, single-use)
                    │
                    ├────────────► declined      (invitee, terminal)
                    │
                    └────────────► expired       (expires_at passed, terminal)
                                      │
                                      └──► superseded_by ──► new pending row (reissue)
```

Every transition out of `pending` is terminal. There is no path back into `pending`; a
replacement is always a **new row**, linked by `superseded_by`, preserving the full
invitation history.

| Transition | Trigger | Audit action |
|---|---|---|
| — → `pending` | F-19 create | `invitation.create` |
| `pending` → `accepted` | F-20 accept with valid token | `invitation.accept` |
| `pending` → `declined` | F-20 decline | `invitation.decline` |
| `pending` → `revoked` | F-21 revoke (staff or inviter) | `invitation.revoke` |
| `pending` → `expired` | expiry sweep (§6.5.4) | `invitation.expire` |
| any terminal → — | **prohibited** | trigger `residence_invitations_terminal_immutable` |

#### 6.5.3 Duplicate handling and reissue

**Uniqueness (R1, corrected):**

```sql
UNIQUE (property_id, invitee_contact_type, invitee_contact_value)
  WHERE status = 'pending'
```

unchanged in shape, but the *behavior around it* is what was broken. The original F-19
returned `200` with the existing invitation and **no new token**, so once a token was
lost, undelivered or expired, no working token could ever be issued to that person for
that unit again — and the `200` response actively concealed the problem.

**R1 rules:**

1. On create, the RPC first runs the expiry sweep for that (property, contact) pair
   (§6.5.4). An expired row leaves `pending`, releasing the partial unique.
2. If a **live** pending invitation still exists (`expires_at > now()`), the caller's
   intent decides:
   - default (`reissue: false`) ⇒ `409 INVITATION_PENDING`, carrying `invitation_id` and
     `expires_at` so the UI can offer reissue. This replaces the misleading `200`.
   - `reissue: true` (requires `invitations:write`) ⇒ the live row transitions to
     `revoked` with `revoked_at`, a **new row with a new token** is created, and
     `superseded_by` links the old row to the new one. One transaction, two audit
     events (`invitation.revoke` + `invitation.create`).
3. Revoke-then-create remains available explicitly (F-21 then F-19) and is equivalent.
4. Creating an invitation for a contact that already resolves to an **active membership**
   in that property ⇒ `409 ALREADY_MEMBER`; no row is created.

#### 6.5.4 Expiry

Expiry is enforced at three points, so no row is trusted merely because it says
`pending`:

1. **Validation:** the accept RPC treats `expires_at <= now()` as invalid regardless of
   `status` — expiry is never dependent on the sweep having run.
2. **Lazy sweep:** the create and list RPCs transition matching stale rows to `expired`
   (bounded to the rows they touch), emitting `invitation.expire`.
3. **Bounded default:** `expires_at = now() + interval` where the interval is the
   caller's `expires_in_hours` (≤ 720) or the association's
   `settings.invitation_default_expiry_hours`, defaulting to 72 hours.

No cron exists in Sprint 2; point 1 is what makes that safe. The original design relied
on the sweep alone and named no actor who would trigger it.

#### 6.5.5 Acceptance flow (all cases)

Executed entirely inside `accept_residence_invitation(token text)` — one transaction.
Caller must be authenticated; the tenant is derived from the invitation row.

| Step | Behavior |
|---|---|
| 1. Hash and look up | `sha256(token)` against the unique index. No match ⇒ constant-shaped `404`. |
| 2. Record the attempt | `invitation_accept_attempts` row written **before** validation branches (§6.6), so failures are counted even when the token is unknown. |
| 3. Validate state | `status = 'pending'` and `expires_at > now()`; otherwise ⇒ the **same** constant-shaped `404` (unknown / expired / revoked / already-accepted are byte-identical: enumeration resistance, R-17). |
| 4. Bind contact | The invited contact is matched against the caller's `profile_contacts`. **Verification is not required** — see §6.5.6. |
| 5. **User does not exist** | Cannot occur inside this RPC: F-20 requires an authenticated caller, so the account exists by the time the RPC runs. Account creation happens beforehand via GoTrue self-signup (document 27 §7 assumption 9). The invitation gates residency, not signup. |
| 6. **User exists, contact absent** | The contact is inserted for the caller as `verified`, attributed to the invitation (`source='invitation_accept'`). This is the token-as-proof-of-contact rule. |
| 7. **User exists, contact present and unverified** | Transitioned to `verified`, same attribution. This is the case the original design deadlocked on: Sprint 1 forces `unverified` on insert and no verification Edge Function exists. |
| 8. **User exists, contact present and verified** | Left unchanged. |
| 9. **Contact belongs to a different profile** | ⇒ `409 CONTACT_CONFLICT`. The contact is not reassigned; staff must resolve. |
| 10. Resident record | If a `residents` row exists for (tenant, profile): reused, and a `former` row is re-entered as `pending` (document 27 §13a item 3). Otherwise created as `pending`. If `settings.requires_resident_approval` is false ⇒ `active` with `joined_at`. |
| 11. Membership | `residence_members` row created with `proposed_role`, `start_date = current_date`, status `pending` or `active` per the same setting. An existing **active** membership for the pair ⇒ `409 ALREADY_MEMBER` (the invitation is still consumed and marked `accepted`, to prevent replay). |
| 12. Consume | Invitation ⇒ `accepted`, `accepted_profile_id`, `accepted_at`. Single-use is enforced by the terminal-state trigger, not by application logic. |
| 13. Audit | `invitation.accept` + `resident.create`/`resident.status_change` + `residence_member.assign` + `profile_contact.verify_by_invitation`, all in the same transaction. |

**Replay:** a consumed token hashes to a row in a terminal state ⇒ step 3 ⇒ constant
`404`. Identical to an unknown token from the caller's perspective.

#### 6.5.6 Trust model (R1 — token-as-proof-of-contact)

The original rule ("caller must hold a *verified* contact matching the invitee") was
unsatisfiable: contacts are forced `unverified` at insert
(`…foundation_identity.sql`, certified spoof guard) and the only verification path is
the staff `profile_contacts:verify` permission, which staff cannot exercise on someone
who is not yet a resident. Onboarding deadlocked on its first execution.

**Replacement rule:** possession of a ≥256-bit single-use token delivered to the invited
contact **is** the verification event; acceptance marks that contact `verified`.

Residual risk, disclosed: with no notification transport in Sprint 2 the token is handed
to the inviter to relay out of band, so possession proves control of the *invitation*
rather than provably of the *contact*. This is accepted for Sprint 2 (document 27 §7
assumption 8) and removed by the Sprint 3 OTP flow (D-15), which supersedes this rule.

- **Indexes:** `(token_hash)` unique; `(property_id, status)`; `(tenant_id, status)`;
  `(expires_at) WHERE status = 'pending'` (sweep); the pending partial unique above.
- **RLS ownership model:** `token_hash` is never selectable by `authenticated`
  (column-level grant exclusion); staff list via `invitations:read`; the invitee never
  reads the row directly — acceptance is token-based through the RPC. Details in
  document 29 §6.5.

### 6.6 `invitation_accept_attempts` (R1, new — brute-force substrate)

The original F-20 promised `RATE_LIMITED` "via audit lookup". That mechanism did not
exist: the audit catalog contained only `invitation.accept` (successes), and
`authenticated` holds no read grant on `audit_events` (verified,
`…foundation_identity.sql:742-749`). There was nothing to count.

- **Purpose:** count failed acceptance attempts so F-20 can throttle.
- **Columns:** `id uuid PK`, `attempted_by_profile_id uuid NULL REFERENCES profiles`
  (NULL when the JWT resolves to no active profile), `token_hash_prefix text NOT NULL`
  (first 8 hex chars only — enough to correlate retries of one token, useless for
  reconstructing it), `outcome text NOT NULL` (`success | invalid | expired |
  contact_conflict | already_member`), `created_at timestamptz NOT NULL DEFAULT now()`.
- **Note:** deliberately **not** tenant-scoped — an attempt against an unknown token has
  no tenant, and requiring one would make failures unrecordable.
- **Throttle rule:** > 10 failures per profile per hour, or > 20 per
  `token_hash_prefix` per hour ⇒ `429 RATE_LIMITED`. Evaluated inside the RPC before
  validation branches.
- **Retention:** rows older than 30 days are deletable — this table is operational, not
  an audit record, so the append-only rule does not apply to it.
- **Audit:** failures additionally emit `invitation.accept_failed` (new action, §6.5.2)
  with the outcome class in metadata; successes emit `invitation.accept`.
- **RLS:** no `authenticated` grant of any kind. Written only by the definer accept RPC;
  read only by platform admin.

### 6.7 `association_settings_private` (R1, new — D-14)

- **Purpose:** association configuration that members must **not** read. Created because
  `association_details` is member-readable in full, so an Edge Function allow-list could
  never have protected anything stored there.
- **Tenant ownership:** `tenant_id uuid NOT NULL UNIQUE REFERENCES tenants ON DELETE
  CASCADE` — strict 1:1, seeded with the tenant.
- **Columns:** `settings jsonb NOT NULL DEFAULT '{}'` (internal operational
  configuration; future integration credentials, thresholds, billing parameters),
  `updated_by_profile_id uuid NULL REFERENCES profiles`.
- **RLS:** SELECT and UPDATE gated on `association_details:write` (admin only). No
  resident, member, collector or platform-support access. Platform admin read only.
- **Audit:** `association_settings_private.update` (changed **keys** only, never values).

### 6.8 `resident_staff_notes` (R1, new — D-14)

- **Purpose:** staff-internal free text about a resident — the `notes` and
  `status_reason` originally held on `residents`, which co-household members would have
  been able to read in full regardless of any Edge Function projection.
- **Tenant ownership:** `tenant_id uuid NOT NULL`; `resident_id uuid NOT NULL` with
  composite FK `(resident_id, tenant_id) → residents (id, tenant_id)`.
- **Columns:** `note text NOT NULL`, `note_kind text NOT NULL DEFAULT 'general'`
  (`general | status_reason`), `author_profile_id uuid NOT NULL REFERENCES profiles`,
  `created_at`. Append-only: no UPDATE, no DELETE.
- **RLS:** SELECT and INSERT gated on `residents:write` (admin, operator). Support and
  finance do **not** read staff notes. Platform admin read.
- **Audit:** `resident_staff_note.create`.
- **Note:** append-only shape means a status transition's reason is permanently
  attributable, which the mutable `status_reason` column was not.

### 6.9 `residence_members` extension (D-05)

- `end_reason residence_membership_end_reason NULL` (new column, shared enum).
- Constraint evolution per §5, including the corrected
  `WHERE status IN ('active','pending')` partial unique.
- **(R1)** One active primary per profile **per tenant** —
  `UNIQUE (tenant_id, profile_id) WHERE status = 'active' AND is_primary`
  (`idx_residence_members_one_primary_active`). Tenant-scoped, not global (§5 item 4).
- **(R1)** `UNIQUE (id, tenant_id)` for composite-FK support; additive composite FK
  `(property_id, tenant_id) → properties (id, tenant_id)`.
- **(R1)** `requested_end_date date NULL`, `moveout_requested_at timestamptz NULL` —
  queryable state for the resident move-out request (F-22), replacing the original
  audit-stream-only design, which gave staff no way to list open requests or mark one
  handled.
- **(R1) Protected after closure — decision closed, the trigger ships.** Trigger
  `residence_members_closed_immutable` blocks **any** UPDATE of a row whose `status` is
  already `revoked`. Corrections create a new period row; they never rewrite history.
- **(R1) Start date.** `start_date` remains nullable (the certified column cannot be
  tightened without touching existing rows), but every Sprint-2-created membership
  **must** set it. Gate SPR2-HIST-05 asserts no Sprint 2 row has a NULL `start_date`.
  Without this, a period has no reconstructable beginning.
- **(R1) Temporal integrity.** Exclusion constraint mirroring `residence_payers`:

  ```sql
  ALTER TABLE public.residence_members ADD CONSTRAINT residence_members_no_overlap
    EXCLUDE USING gist (
      property_id WITH =, profile_id WITH =,
      daterange(start_date, end_date, '[)') WITH &&
    ) WHERE (start_date IS NOT NULL);
  ```

  The `WHERE` clause exempts certified legacy rows with NULL `start_date`, so the
  constraint is additive and cannot fail on the existing baseline.

## 7. New enums (D-07)

| Enum | Values |
|---|---|
| `resident_status` | `pending`, `active`, `inactive`, `former`, `deceased`, `blocked` |
| `residence_membership_end_reason` | `moved_out`, `ownership_transferred`, `tenancy_ended`, `evicted`, `deceased`, `blocked`, **`replaced`**, `administrative` |
| `household_relationship` | `spouse`, `child`, `parent`, `relative`, `dependent`, `legal_charge`, `other` |
| `household_member_status` | `active`, `inactive`, `former` |
| `payer_status` | `active`, `ended` |
| `invitation_status` | `pending`, `accepted`, `declined`, `expired`, `revoked` |
| `tenant_role` (extension) | + `association_collector` |
| `tenant_permission` (extension) | + `residents:read`, `residents:write`, `residence_payers:read`, `residence_payers:write`, `household:read`, `household:write`, `invitations:read`, `invitations:write`, `association_details:read`, `association_details:write`, `audit:read_association`, **`residences:read_routes`** (12 values) |

**(R1) `residence_membership_end_reason` is the single closure vocabulary**, shared by
`residence_members` and `residence_payers`. `replaced` was added so payer substitution
stops emitting a free-text literal absent from the enum. Two closure vocabularies within
one sprint was the duplication the Executive Review flagged (ARB-21).

**(R1) `residences:read_routes`** is new rather than reusing `residences:read` for the
collector. Verified reason: `residence_members_select_tenant_policy`
(`…foundation_identity.sql:686`) maps `residences:read` to **every membership row in the
tenant**, so granting it to a collector would have contradicted the stated collector
boundary while a test asserting "no PII in the F-08 response" still passed. No existing
permission changes its role set, which keeps the baseline immutability proof meaningful.

### 7.1 `association_collector` — binding definition (R1)

*A field agent who performs on-site collection of data (meter readings) and/or payments,
scoped to residence identification only.* The role holds **no** access to resident
personal data in Sprint 2 and no write capability anywhere. Because the definition — not
the label — governs the permission set, the "meter reader vs payment collector" question
does not change any Sprint 2 authority: both jobs are this role. Fixing the meaning here
prevents the name from drifting once the enum value exists (renaming an enum value later
is materially harder than naming it now).

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

**(R1) Re-entry decision closed (formerly "D-01a", deferred to Wave 2.2).**
`former → pending` re-entry is **APPROVED** and is the only re-entry path:
`UNIQUE (tenant_id, profile_id)` is retained, the row is reused, and `left_at` is
cleared while `joined_at` keeps the original first-join date. `deceased → *` remains
prohibited (terminal). Direct `former|deceased → active` remains prohibited: re-entry
always passes through `pending`, so the association re-approves the person explicitly.

Rationale for reusing the row rather than adding period rows: a resident record is a
**registry**, not an occupancy. Periods belong to memberships and payer relationships,
which already model them (D-05). Status history is preserved in `audit_events` and in
the append-only `resident_staff_notes`, so nothing is lost by keeping one row —
`registration_code` continuity in particular is preserved, which a second row would have
broken (§6.2 non-reusable code rule).

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

**(R1)** Each invariant now names its enforcement mechanism. "Machine-checkable" means a
SQL predicate can evaluate it — the original list included one that could not (old #6).

| # | Invariant | Enforced by |
|---|---|---|
| 1 | Every new table row carries `tenant_id` equal to its parent chain's tenant | **structural** — composite FKs (D-13); gates use forged-tenant fixtures as regression only |
| 2 | At most one **open** (`active` or `pending`) `residence_members` per (property, profile) | partial unique (§5 item 2) |
| 3 | At most one active primary residence per profile **per tenant** | partial unique (§6.9) |
| 4 | At most one active `residence_payers` per property | partial unique (§6.4) |
| 5 | **(R1, restated)** No identity field **of a platform user** stored outside `profiles`/`profile_contacts` | grep gate + review. The original wording was false: `household_members` legitimately stores `full_name`/`birth_date` for persons who have no platform identity, which is the entire purpose of the table |
| 6 | **(R1, now checkable)** No `household_members` row duplicates an active user membership for the same property | partial unique on `(property_id, linked_profile_id) WHERE linked_profile_id IS NOT NULL AND status='active'` (§6.3). Unlinked rows remain heuristic-only and are disclosed in document 31 §9 |
| 7 | Closed periods always carry `end_date`; memberships and payers also `end_reason` | CHECK `residence_members_closure_complete` (§5.1) and its payer equivalent |
| 8 | **(R1, new)** Historical periods never overlap for the same (property, profile) or (property) payer | EXCLUDE constraints (§6.4, §6.9) |
| 9 | **(R1, new)** Every Sprint-2-created membership and payer row has a non-NULL `start_date` | gate SPR2-HIST-05 |
| 10 | Residents never appear in `tenant_members` by virtue of being residents; staff never in `residents` by virtue of staff role alone | design rule + gate |
| 11 | Invitation tokens stored only as `token_hash`; plaintext never persisted | SQL gate over column contents |
| 12 | **(R1, strengthened)** Every mutation emits exactly one `audit_events` row **in the same transaction** | structural — D-12 RPC boundary; gate asserts an injected failure leaves zero rows **and** zero audit events |
| 13 | **(R1, new)** `authenticated` holds no INSERT/UPDATE/DELETE grant on any table | catalog gate SPR2-GRANT-01 |
| 14 | **(R1, new)** No confidential field is readable by an actor the contract excludes | D-14 table separation; gate reads each table directly as each actor, not through the Edge Function |

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
- **(R1) `audit_events` partitioning key — chosen now, implemented later (D-15).**
  Monthly `RANGE` partitioning on `created_at`, with `tenant_id` leading in every index.
  At 500 associations this table becomes the largest in the system by an order of
  magnitude and can never be pruned under the append-only rule. Converting a large
  unpartitioned table later requires a maintenance window this product does not want to
  schedule; choosing the key now costs nothing and constrains Sprint 3/4 to a shape that
  works. **No partitioning is created in Sprint 2.**
- **(R1) Billing inputs not yet modeled.** The payer anchor is `residence_payers`
  (§6.4). Two further billing inputs have no home yet and must not be improvised into
  jsonb: the unit participation quota (fração ideal / rateio weight), which belongs as a
  typed column on `properties` in Sprint 3, and the payer identity **snapshot** carried
  by historical invoices. Recorded so Sprint 3 does not discover them late.
- **(R1) Meter/period alignment.** Consumption billing across an occupant change joins
  meter readings to payer periods. That join is only unambiguous because of the EXCLUDE
  constraints added in §6.4/§6.9 — the metering module depends on them.

Nothing in this section creates tables, columns or code in Sprint 2.

## 12. Changes to Sprint 1 certified objects (complete list)

**(R1) This list is FROZEN.** It is the approved set against which the Wave 2.7 baseline
immutability proof diffs the catalog. The Executive Review found the previous version
incomplete — it declared itself complete while document 30 F-10 disclosed a `properties`
grant as an "amendment" elsewhere, and the `profiles` read-path change was not
identified at all. A structural diff run against an incomplete list either flags
legitimate changes as blockers, or gets edited during Wave 2.7 to match what was built,
which would hollow out the proof entirely.

**Any addition to this list requires a new executive authorization, not a document
edit.** Wave 2.1 may not begin until this list is signed off.

| # | Object | Change | Decision | Risk |
|---|---|---|---|---|
| 1 | `residence_members` | drop `UNIQUE(property_id, profile_id)`; add partial unique on `status IN ('active','pending')`; add `end_reason`; add tenant-scoped one-active-primary partial unique; add `UNIQUE (id, tenant_id)`; add composite FK to `properties`; add `requested_end_date`, `moveout_requested_at`; add EXCLUDE no-overlap; add trigger `residence_members_closed_immutable`; add two partial indexes (§5.4) | D-05, D-13 | R-19 (HIGH, gated) |
| 2 | `properties` | add `UNIQUE (id, tenant_id)` (composite-FK parent). **No INSERT/UPDATE grant** — writes go through RPCs (D-12), so the grant disclosed in the original document 30 F-10 is **withdrawn** | D-12, D-13 | LOW |
| 3 | `profiles` | extend `profiles_select_association_policy` so a profile is readable by tenant staff holding `profiles:read_association` when it has **either** an active `residence_members` row **or** a `residents` row in that tenant (any status) | D-01 | HIGH (gated: Sprint 1 profile-visibility gates must pass unchanged) |
| 4 | `tenant_role` | `ADD VALUE 'association_collector'` | D-07 | R-18 (LOW) |
| 5 | `tenant_permission` | add 12 values (§7) | D-07 | R-18 (LOW) |
| 6 | `has_tenant_permission()` | extend role→permission matrix — additive: new permission keys only; **no existing permission changes its role set** | D-07 | reviewed in Wave 2.4 audit |
| 7 | extensions | `CREATE EXTENSION IF NOT EXISTS btree_gist` (EXCLUDE constraints), `pg_trgm` (resident search index) | D-04, D-10 | LOW |
| — | everything else | **unchanged** | — | — |

**Item 3 rationale (R1, ARB-07).** Verified at
`supabase/migrations/20260719170000_sprint01_foundation_identity.sql:591-604`, the
certified policy requires an **active** `residence_members` row. Four Sprint 2
populations do not have one: residents in `pending` (F-05 necessarily creates the
resident before any membership, since F-12 refuses to auto-create residents), residents
in `former`/`deceased` (memberships closed), off-site owner payers (the flagship R-04
scenario, deliberately without occupancy), and residents whose only membership is still
`pending`. For all four, `resident-list` and `resident-get` would return records with no
name. The change is unavoidable if the resident domain is to have a usable staff UI; it
is scoped to widen an existing predicate by one alternative, and it grants no access to
any actor who did not already hold `profiles:read_association` in that tenant.

No other Sprint 1 table, policy, trigger, function, grant, test or Edge Function is
modified by this plan.

## 13. Verification record (R1 — CF-05 §14.1)

Baseline claims in this document were verified against
`supabase/migrations/20260719170000_sprint01_foundation_identity.sql` at HEAD `1e6e4bb`:
`residence_members` definition incl. `revoked_at`, nullable `start_date` and
`UNIQUE (property_id, profile_id)` (L150–165); membership indexes are plain composite,
not partial (L214–215); `profiles_select_association_policy` requires an active
membership (L591–604); `residence_members_select_tenant_policy` keyed on
`residences:read` (L686); `tenant_permission` 9 certified values (L42–52);
`has_tenant_permission()` matrix (L304–333); `contact_type` = email|phone|whatsapp
(L18); `verification_state` includes `unverified` (L21); grants to `authenticated` are
SELECT-only on the four structural tables (L742–749). Absence of a contact-verification
Edge Function verified by listing `supabase/functions/` (10 functions + `_shared/`).
