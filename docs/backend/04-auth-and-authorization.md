# 04 — Authentication, Authorization & RLS

> Deliverables 7 (Authentication Architecture), 8 (Authorization Model), 9 (RLS Matrix).

**July 19, 2026 implementation update:** the local Sprint 1 migration now enforces RLS on all foundation tables and implements the first helper set: `current_profile_id()`, `has_platform_role()`, `is_platform_admin()`, `is_active_tenant_member()`, `has_tenant_role()`, `has_tenant_permission()`, `is_active_residence_member()`, `can_access_residence()`, `can_manage_profile()`, `current_tenant_context()`, and `log_audit_event()`. Protected-field mutation on `profiles`, `profile_contacts`, and `audit_events` is blocked by immutable triggers in addition to policy scope checks.

---

## 1. Authentication architecture

### 1.1 Two populations, one auth provider

```
                        Supabase Auth (GoTrue)
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
    STAFF                                  RESIDENTS
    tenant_members                         profiles + residence_members
    admin|manager|operator|viewer|collector    holder|financial_responsible|
    Admin App, Collector App                   authorized_resident|dependent|
    RBAC — role within a tenant                representative|temporary_guest
                                               Resident App
                                               ABAC — scope per residence
```

Both populations authenticate through the same GoTrue instance and receive the same JWT shape.
**Authorization diverges completely below that point.** Staff authority is a role held against a
tenant; resident authority is a scope held against specific residences. Conflating them was
rejected in ADR-01, and this diagram is why: a resident with a `tenant_members` row would inherit
tenant-wide visibility from every existing `is_tenant_member()` policy.

### 1.2 Resident login identifier

The certified login screen accepts **CPF or email**. GoTrue authenticates on email only.

Resolution, server-side in `resident-auth POST /login`:

1. If the input parses as an email → pass through to GoTrue.
2. If it parses as a CPF → look up `profiles.document` (hashed index) → resolve the linked
   `auth.users.email` → authenticate.
3. On failure, return **one** generic error for both paths.

Step 3 is not politeness. Distinguishing "unknown CPF" from "wrong password" turns the login form
into a CPF-enumeration oracle against a resident directory.

CPF is stored as both an encrypted value (for display-masking) and a deterministic hash (for
lookup). The plaintext is never returned by any endpoint; `ResidentProfile.cpfMasked` is derived.

### 1.3 First access — the activation journey

The riskiest flow in the program (see Doc 03 §3.1). A person proves they are the resident named
on an association's records and converts that into an account.

```
CPF + birth date
   → match against residents (tenant-scoped, active)
   → code sent ONLY to the contact already on file
   → code + new password
   → atomically: create auth.users → profiles → residence_members(status=active)
   → session
```

Controls, all mandatory:

| Control | Reason |
|---|---|
| Rate limit per CPF **and** per IP | CPF + birth date are semi-public in Brazil |
| Generic responses at every step | Never confirm whether a CPF is registered |
| Code delivered only to the stored contact | A caller-supplied destination defeats the whole check |
| Short code TTL (≤ 10 min), single use, attempt cap | Limits brute force on a 6-digit code |
| `audit_logs` entry on every attempt | Detection; the table exists and has 0 rows today |
| Atomic activation | A partial activation leaves an account with no residence — or worse, a residence link with no account |

If the association's records hold no verified contact for that resident, the flow **must** fall
back to association-mediated invitation rather than accepting a new contact from the caller.

### 1.4 Session management

| Setting | Current | Required |
|---|---|---|
| `site_url` | `http://localhost:3000` | Production Resident App origin |
| Redirect allow-list | **empty** | All three app origins + previews |
| SMTP | **not configured** | Real provider — recovery is unusable without it |
| `disable_signup` | `false` — **open** | **`true`** — accounts are created only by `first-access/activate` |
| JWT expiry | 3600s | Keep |
| Refresh | GoTrue default | `persistSession` + `autoRefreshToken` in the client |
| MFA | TOTP available | Optional for residents; **recommended for admin** |
| Captcha | disabled | Enable on login + first access |

**`disable_signup = false` is a live defect.** Anyone can create an account today. Combined with
the `tenant_members` zero-member self-join policy (MEDIUM-03), it is a latent privilege path.
Closing it is Sprint 0 work, not launch work.

### 1.5 Token handling in the client

- Tokens live in the Supabase client's storage; never in application state, never logged.
- The transport layer attaches `Authorization: Bearer` from `getSession()` per request.
- 401 → refresh once → retry once → on second failure, sign out and route to `/login`.
- The certified UX has no "session expired" modal; silent refresh followed by a clean redirect is
  the behaviour to preserve.

---

## 2. Authorization model

### 2.1 The resident authorization rule

One rule governs the entire Resident App:

> A resident may act on a resource **iff** they hold an `active` `residence_members` row for the
> residence that resource belongs to, **and** their `role` on that row permits the action.

Everything else is elaboration.

### 2.2 Role capability matrix

| Capability | holder | financial_ responsible | authorized_ resident | dependent | representative | temporary_ guest |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| View residence & water service | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View consumption & readings | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ |
| Report reading divergence | ✅ | ✅ | ✅ | ➖ | ✅ | ➖ |
| **View invoices & amounts** | ✅ | ✅ | ➖ | ➖ | ✅ | ➖ |
| **Download boleto / PIX** | ✅ | ✅ | ➖ | ➖ | ✅ | ➖ |
| **View payments & receipts** | ✅ | ✅ | ➖ | ➖ | ✅ | ➖ |
| Dispute a payment | ✅ | ✅ | ➖ | ➖ | ✅ | ➖ |
| Open a support request | ✅ | ✅ | ✅ | ➖ | ✅ | ➖ |
| Reply / rate / confirm visit | ✅ | ✅ | ✅ | ➖ | ✅ | ➖ |
| Receive notifications & notices | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage own profile & preferences | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View co-residents (minimal) | ✅ | ✅ | ✅ | ➖ | ✅ | ➖ |
| **Invite a person to the residence** | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ |
| **Remove a residence link** | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ |

✅ permitted · ➖ denied

**The financial rows are the substantive ones.** A `dependent` — a household member, possibly a
minor — and an `authorized_resident` should not see the household's billing, debts, or overdue
status by default. The certified UX supports this: every financial surface has an unavailable
state, and `SupportPreviewData` is already nullable.

**This matrix requires product sign-off.** It encodes a household-privacy policy, and engineering
should not decide unilaterally who in a home may see the water bill. It is listed as an open
question in Doc 07.

### 2.3 Staff roles (unchanged, plus `collector`)

| Role | Scope |
|---|---|
| `admin` | Full tenant control, members, billing config, bank settings |
| `manager` | Operations, support, billing generation; no bank/tenant config |
| `operator` | Day-to-day operations; no financial mutation |
| `viewer` | Read-only |
| `collector` **(new)** | Assigned routes only: read properties/meters on route, submit readings, create occurrences. **No financial access whatsoever** |

### 2.4 Platform tiers

| Tier | Realization |
|---|---|
| Platform Admin | Not a `tenant_members` role. A separate `platform_admins` table checked only by platform-scoped functions. **Never grant cross-tenant power through a tenant-scoped table** — that is how one misconfigured row becomes a full-fleet breach |
| Association Manager | `tenant_members.role = 'admin'` within their tenant |
| Staff | `manager` / `operator` / `viewer` / `collector` |
| Resident | `profiles` + `residence_members` |

Cross-tenant access is confined to explicitly platform-scoped functions, audited on every call.

---

## 3. RLS strategy

### 3.1 Posture: RLS is defense in depth, not the primary control

Under ADR-07, `anon` and `authenticated` hold **no grants** on `public` **except** the two narrow
`SELECT` grants required by Realtime under ADR-09 (`notifications` and `support_messages`). PostgREST
is closed. All access is via Edge Functions holding `service_role`, which bypasses RLS by design.

RLS therefore protects against: a compromised or buggy Edge Function that forgets a `tenant_id`
filter, a future accidental `GRANT`, a direct connection with a lesser role, and misconfigured
Realtime subscriptions. It is not load-bearing for normal traffic — and this is stated plainly so
that no one later mistakes a passing RLS test for proof that the API is safe.

**Every table still gets a policy. No table ships without RLS** (program mandate, and current
practice — all 26 existing tables have it enabled).

### 3.2 Helper functions

Three `SECURITY DEFINER` helpers, all with `SET search_path = ''` and fully-qualified references:

```sql
-- Illustrative specification. NOT a migration.

-- Existing, MUST BE HARDENED (audit MEDIUM-02: no search_path today)
public.is_tenant_member(target_tenant_id uuid) → boolean

-- New: resident holds an active link to this residence
public.is_residence_member(target_property_id uuid) → boolean

-- New: resident's role on this residence is in the allowed set
public.has_residence_role(target_property_id uuid, allowed text[]) → boolean
```

`is_tenant_member` backs nearly every existing policy — it is the highest blast-radius object in
the system and is on the protected list. Hardening it is additive (`SET search_path = ''` plus
schema-qualification) and changes no behaviour, but must still be staged and smoke-tested against
the Admin App.

The new helpers must be `STABLE` and indexed-backed (partial index on
`residence_members(profile_id) WHERE status='active'`), because they will be evaluated per row on
resident-scoped tables.

### 3.3 RLS Matrix

Axes: **T** = tenant member (staff) · **R** = residence member (resident) · **O** = own row
(`profile_id = current profile`) · **S** = service_role only · **✗** = no policy (denied)

#### Identity & tenancy

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|
| `tenants` | T | S | T(admin) | ✗ | existing |
| `tenant_members` | T | S | T(admin) | T(admin) | **fix MEDIUM-03** zero-member self-join |
| `profiles` | self ∪ assoc ∪ platform | S | self(editable) | ✗ | platform-level PII; see §3.3.1 |
| `profile_contacts` | self ∪ assoc(ro) | S | self | ✗ | see §3.3.2 |
| `residence_members` | O ∪ T | S | T | S | residents never self-link |
| `residence_invitations` | O(invitee) ∪ T | T ∪ O(holder) | O(invitee) ∪ T | T | |
| `platform_admins` | S | S | S | S | never client-reachable |

#### Residences & metering

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `residents` | T ∪ R(linked) | T(admin) | T(admin) | ✗ |
| `properties` | T ∪ R | T(admin) | T(admin) | ✗ |
| `water_meters` | T ∪ R | T(admin) | T(admin) | ✗ |
| `meter_readings` | T ∪ R | T(admin\|collector) | T(admin) | ✗ |
| `consumption_baselines` | T ∪ R | S | S | S |
| `reading_divergences` | O ∪ T | O | T | ✗ |

#### Billing & payments — **the tables that motivated ADR-07**

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `receivables` | T ∪ R(financial roles) | T(admin\|manager) | T(admin\|manager) | ✗ |
| `billing_titles` | T ∪ R(financial roles) | T(admin\|manager) | T(admin\|manager) | ✗ |
| `billing_title_line_items` | T ∪ R(financial roles) | S | S | S |
| `payments` | T ∪ R(financial roles) | **T(admin)** | **T(admin)** | ✗ |
| `billing_documents` | T ∪ R(financial roles) | S | S | ✗ |
| `payment_disputes` | O ∪ T | O | T | ✗ |
| `tariff_plans` / `tariff_ranges` | T | **T(admin)** | **T(admin)** | T(admin) |
| `bank_agreements` / `bank_files` | **T(admin)** | T(admin) | T(admin) | ✗ |

Bold cells are today `FOR ALL USING is_tenant_member(tenant_id)` — writable by **any** member of
any role. These are audit finding HIGH-01. Under ADR-07 the grant revocation closes the exposure
immediately; these role-aware policies then close it *again* at the policy layer, so that a future
grant cannot silently reopen it.

`R(financial roles)` = `has_residence_role(property_id, ARRAY['holder','financial_responsible','representative'])`,
implementing §2.2.

#### Communication

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `notifications` | O | S | O(`read_at` only) | ✗ |
| `notices` | T ∪ R(targeted) | T(admin\|manager) | T(admin\|manager) | ✗ |
| `notice_targets` | T ∪ R | T(admin\|manager) | T | T |
| `notice_reads` | O | O | O | ✗ |
| `communication_preferences` | O | O | O(non-mandatory only) | ✗ |

#### Support

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `support_requests` | O ∪ T | O | O(limited) ∪ T | ✗ |
| `support_messages` | O(via request) ∪ T | O ∪ T | O(`read_at` only) | ✗ |
| `support_timeline_events` | O(via request) ∪ T | S | ✗ | ✗ |
| `support_attachments` | O(via request) ∪ T | O ∪ T | ✗ | ✗ |
| `support_visits` | O(via request) ∪ T | T | O(confirm) ∪ T | ✗ |
| `support_ratings` | O(via request) ∪ T | O | ✗ | ✗ |

`support_timeline_events` has **no UPDATE and no DELETE policy at any level**. It is the
resident-visible audit trail; immutability is the property that makes it worth showing.

#### Platform

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `protocols` | O ∪ T | S | ✗ | ✗ |
| `idempotency_keys` | S | S | S | S |
| `audit_logs` | T(admin) | S | ✗ | ✗ |
| `system_events` | T | S | S | ✗ |
| `profile_preferences` | O | O | O | ✗ |
| `profile_devices` | O | S | O(revoke) | O |

### 3.3.1 `profiles` policy detail

`profiles` is platform-level and has no `tenant_id`. The matrix abbreviation `self ∪ assoc ∪ platform` means:

| Access | Predicate | Operations |
|---|---|---|
| Self | `user_id = auth.uid()` | SELECT, UPDATE of resident-editable columns only |
| Authorized association | `EXISTS` chain through `residence_members → properties → tenant_members` | SELECT only, scoped to the staff member's tenant |
| Platform admin | `EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid() AND active)` | SELECT; UPDATE of protected fields only through governed correction workflow |

Resident-editable columns: `preferred_name`, `display_name`, `pronoun_preference`, `photo_path`.
Protected columns: `full_name`, `document`, `birth_date` — updates rejected by the profile endpoint and must flow through a correction request (`COR-` protocol).

Field-level exposure:

- `document` (CPF) is encrypted at rest; only `cpfMasked` is returned to the resident.
- `birth_date` is returned to the owner and to authorized association staff during identity verification; the general profile endpoint omits it.
- `photo_path` is resolved to a short-TTL signed URL.

See ADR-10 for the full decision record.

### 3.3.2 `profile_contacts` policy detail

| Operation | Policy |
|---|---|
| SELECT | `profile_id = auth.uid()` ∪ authorized association staff via `residence_members` chain (read-only) |
| INSERT | `profile_id = auth.uid()` ∪ service_role (first-access activation) |
| UPDATE | `profile_id = auth.uid()`; restricted to `display_value`, `is_primary`, `communication_preference_flags`, and verification-state transitions initiated by the owner |
| DELETE | soft delete by owner only (`deleted_at`) |

Association staff may read contacts only for profiles linked to a residence in their tenant. They may not insert, update, or delete resident contacts directly.

### 3.5 Policy documentation standard

Program mandate: *every policy must be documented.* Each policy carries a SQL `COMMENT` stating
its rule, the guarantee it enforces, and its test ID:

```sql
COMMENT ON POLICY billing_titles_resident_read ON public.billing_titles IS
  'Residents with a financial role (holder | financial_responsible | representative) on the
   linked property may read billing titles. Enforces §2.2 "View invoices & amounts".
   Test: RLS-BT-004.';
```

### 3.6 RLS test suite — required, not optional

A policy without a negative test is an assumption. The suite asserts, per table:

1. A staff member of tenant A **cannot** read tenant B. *(tenant isolation)*
2. A resident **cannot** read a residence they are not linked to. *(scope isolation)*
3. A resident with a **non-financial** role **cannot** read billing rows for their own residence. *(§2.2)*
4. A resident **cannot** write any financial table. *(HIGH-01 regression guard)*
5. A resident **cannot** disable a mandatory communication preference.
6. `anon` **cannot** read anything at all. *(ADR-07 regression guard)*
7. `support_timeline_events` **cannot** be updated or deleted by anyone.
8. A resident **cannot** read or update another resident's `profiles` row. *(F2 regression guard)*
9. A resident **UPDATE** that changes `full_name`, `document`, or `birth_date` is rejected. *(F2)*
10. Association staff of tenant A **cannot** read `profiles` linked only to tenant B. *(F2)*
11. A resident **cannot** read another resident's `profile_contacts`. *(F4)*

Tests 4 and 6 are the two that must never be allowed to fail silently — they are the regression
guards for the exact defects this program exists to close. They run in CI against a branch
database on every migration.

---

**Next:** [05 — Storage, Realtime & Offline](05-storage-realtime-offline.md)
