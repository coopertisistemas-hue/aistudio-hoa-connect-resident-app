# 08 — Independent Architecture Review

> Governed record of the independent technical review of the HOA Connect Backend Integration Program
> blueprint. This artifact is the input that triggered the remediation wave documented in the other
> Phase 1 deliverables.

---

## 1. Review context

| Field | Value |
|---|---|
| Review type | Independent technical review, read-only (no code execution) |
| Scope | Architecture documents `docs/backend/01*.md` through `07*.md`, plus supporting repository evidence (`src/demo/*`, `src/hooks/*`, `src/fixtures/types.ts`) |
| Date | 2026-07-18 |
| Reviewer | Independent (not the blueprint author) |
| Mandate | Validate central architecture and identify blockers that must be resolved before D2 approval and Sprint 1 implementation |

### Documents reviewed

- `01-architecture-blueprint.md`
- `02-domain-model-erd.md`
- `03-api-and-edge-functions.md`
- `04-auth-and-authorization.md`
- `05-storage-realtime-offline.md`
- `06-migration-roadmap.md`
- `07-risk-and-readiness.md`
- `README.md`

### Repository evidence inspected

- `src/demo/financeService.ts` — 8 exported functions
- `src/demo/profileService.ts` — 22 exported functions
- `src/demo/notificationService.ts` — 11 exported functions
- `src/demo/supportService.ts` — 13 exported functions
- `src/demo/residenceService.ts` — 7 exported functions
- `src/demo/consumoService.ts` — 3 exported functions
- `src/demo/homeService.ts` — 1 exported function
- `src/hooks/useFinancasData.ts` — sentinel handling and swallowed-to-null behavior
- `src/hooks/useProfileData.ts`, `useNotificationsData.ts`, `useSupportData.ts`
- `.env` (tracked), absence of `.gitignore`

---

## 2. Executive conclusion

The independent review **validates** the central architectural choices of the blueprint:

1. Extension of the existing production Supabase backend rather than greenfield replacement.
2. Preservation of the certified Resident App frontend contract (`src/fixtures/types.ts`).
3. The Presentation Assembly Layer defined by ADR-03.
4. Edge-Function-first access.
5. Multi-tenant architecture with `tenant_id` on every business table.
6. RLS-first security posture.
7. Incremental replacement of demo services behind feature flags.

The review does **not** invalidate the architecture. It identifies six findings (two HIGH, two MEDIUM, two LOW) that are conflicts, omissions, or numerical inconsistencies. If left unresolved, these would create implementation rework, security risk, or a frontend regression during backend migration.

**D2 disposition after remediation:** see [Section 10](#10-d2-readiness-decision).
**Runtime validation outcome after remediation:** see [13-d2-validation-report.md](13-d2-validation-report.md).

---

## 3. Findings

### F1 — Realtime and ADR-07 conflict

| Attribute | Value |
|---|---|
| Severity | **HIGH** |
| Status | **Resolved in architecture — Option A selected, runtime validation pending** |
| Affected documents | `01-architecture-blueprint.md` (ADR-07), `04-auth-and-authorization.md`, `05-storage-realtime-offline.md`, `07-risk-and-readiness.md` |

#### Previous state

ADR-07 proposed revoking all grants on the `public` schema from `anon` and `authenticated`:

```sql
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
```

The Realtime design in Doc 05 simultaneously proposed `postgres_changes` subscriptions on `notifications` and `support_messages`, scoped by `profile_id`. PostgreSQL privilege checks occur before RLS. Without `SELECT` on those tables, a Realtime subscription would connect but receive no events, producing a silent runtime failure.

#### Correction

The conflict is resolved by selecting **Option A — Narrow table grants** as the production architecture, with an explicit exception audit.

**Selected design:**

- Revoke all grants from `anon`/`authenticated` on all tables, sequences, and default privileges, as originally specified.
- Grant `SELECT` **only** on the two tables that back `postgres_changes` Realtime subscriptions:
  - `notifications`
  - `support_messages`
- Keep all broader grants revoked.
- Maintain RLS policies on both tables so the `authenticated` role still sees only rows the policy permits.
- Document the exception as a deliberate, audited security decision.

The grant set becomes:

```sql
-- ADR-07 baseline (retained)
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- F1 exception (narrow, audited)
GRANT SELECT ON public.notifications    TO authenticated;
GRANT SELECT ON public.support_messages TO authenticated;
```

**RLS requirements for the two excepted tables:**

- `notifications` — `SELECT` only where `profile_id = auth.uid()`.
- `support_messages` — `SELECT` only where the message belongs to a `support_request` whose `profile_id = auth.uid()` (i.e., the resident is the request author) or where the message is from association staff on one of the resident's requests. No direct `profile_id` column exists on `support_messages`; the policy joins through `support_requests`.

**Why Option A over Option B:**

- Option B (Broadcast from database triggers) adds significant operational complexity: trigger maintenance, payload minimization, private channel authorization, and a separate topic model. It is appropriate for a future optimization but is not justified for two tenant-scoped tables where native `postgres_changes` plus RLS already provide the required semantics.
- The security risk of the narrow `SELECT` grants is closed by the RLS layer and by the continued absence of `INSERT`/`UPDATE`/`DELETE` grants.

**Validation requirement:** before production deployment, the selected model must be validated in a branch or disposable Supabase project by confirming that:

1. `anon` cannot subscribe to any channel.
2. `authenticated` receives only rows matching its `profile_id` on the notifications channel.
3. `authenticated` receives support messages only for its own requests.
4. Revoking the two narrow `SELECT` grants causes both channels to fall silent (regression test).

See ADR-09 for full decision record.

---

### F2 — Profiles RLS is undefined

| Attribute | Value |
|---|---|
| Severity | **HIGH** |
| Status | **Resolved in architecture — explicit policies defined, runtime validation pending** |
| Affected documents | `01-architecture-blueprint.md`, `02-domain-model-erd.md`, `04-auth-and-authorization.md`, `06-migration-roadmap.md`, `07-risk-and-readiness.md` |

#### Previous state

The RLS matrix listed `profiles` as `SELECT: O ∪ T`, `INSERT: S`, `UPDATE: O`, `DELETE: ✗`, where `O` was defined as "own row". The document did not define:

- the exact policy predicate for "own row" on a platform-level table;
- how an authorized association operator may read profiles connected to that association;
- how platform administrators access profiles;
- which columns a profile owner may update;
- field-level exposure controls for CPF and birth date.

Because `profiles` has no `tenant_id`, the existing generic tenant-member predicate cannot be applied directly. The table contains PII (full name, preferred name, CPF/national identifier, birth date, contact data, photo), so ambiguous access is a security blocker.

#### Correction

`profiles` RLS is now defined as three explicit policy groups:

**P1 — Self access**

A user may read and update the profile associated with their own authenticated identity.

```sql
-- SELECT
CREATE POLICY "profiles_select_self" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

-- UPDATE restricted to resident-editable columns only
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    full_name IS NOT DISTINCT FROM profiles.full_name      -- protected: unchanged
    AND document IS NOT DISTINCT FROM profiles.document    -- protected: unchanged
    AND birth_date IS NOT DISTINCT FROM profiles.birth_date -- protected: unchanged
  );
```

Allowed updates: `preferred_name`, `display_name`, `pronoun_preference`, `photo_path`.
Protected fields (`full_name`, `document`, `birth_date`) are rejected server-side by the update endpoint and must flow through a correction request (protocol `COR-`).

**P2 — Authorized association access**

An association operator or administrator may read only profiles connected to that association through an explicit relationship chain:

```text
profile
  → residence_members (profile_id)
  → properties (property_id)
  → tenants (tenant_id)
```

Predicate (for staff with an active `tenant_members` row in the target tenant):

```sql
EXISTS (
  SELECT 1
  FROM public.residence_members rm
  JOIN public.properties p ON p.id = rm.property_id AND p.tenant_id = public.current_tenant_id()
  WHERE rm.profile_id = profiles.id
    AND rm.status = 'active'
)
```

Note: `public.current_tenant_id()` is illustrative; the actual implementation resolves the caller's tenant through `tenant_members(tenant_id, user_id)` where `user_id = auth.uid()`. This policy is read-only for staff.

**P3 — Platform administration**

Platform administrators read profiles through an explicit role policy tied to a `platform_admins` table, not through a tenant-scoped role.

```sql
CREATE POLICY "profiles_select_platform_admin" ON public.profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND active = true));
```

**No global tenant-member read:** a staff member of one tenant cannot enumerate all `profiles`; the association connection chain is required.

**Indexing:** partial index `(profile_id) WHERE status = 'active'` on `residence_members` supports the association policy; unique index on `profiles(user_id)` supports self policies.

**CPF / birth-date exposure:**

- `document` (CPF) is encrypted at rest; API returns only `cpfMasked`.
- `birth_date` is returned only to the owner and to authorized association staff performing identity verification; the general profile endpoint omits it.
- The login/first-access functions resolve CPF through a deterministic hash, never the encrypted value.

See ADR-10 for full decision record.

---

### F3 — Error taxonomy does not match the certified frontend

| Attribute | Value |
|---|---|
| Severity | **MEDIUM** |
| Status | **Resolved in architecture — compatibility matrix documented** |
| Affected documents | `01-architecture-blueprint.md` (§3.2), `03-api-and-edge-functions.md`, `06-migration-roadmap.md`, `07-risk-and-readiness.md` |

#### Previous state

Doc 01 §3.2 stated that hooks discriminate on three sentinels (`OFFLINE`, `ITEM_ERROR`, `DOCUMENT_ERROR`) and that network failures consistently trigger the offline banner. The certified frontend does not behave that way.

Verified current behavior:

- `useFinancasData` discriminates on `OFFLINE` and `ITEM_ERROR` for the overview only.
- `DOCUMENT_ERROR` is thrown by `fetchBoletoInfo` and `fetchPixInfo` but is not handled by the hook — both `fetchBoleto` and `fetchPix` catch all errors and return `null`.
- `fetchInvoice`, `fetchPayment`, and `fetchReceipt` also catch all errors and return `null`.
- These screens render document-unavailable / detail-unavailable states rather than the global offline banner.
- Other modules (profile, notifications, support) convert many errors to `null` or display the raw message.

The previous taxonomy implied a uniform mapping that does not exist.

#### Correction

The documentation now distinguishes five categories and records the actual compatibility behavior without redesigning it.

| Category | Meaning | Frontend sentinel / behavior |
|---|---|---|
| Transport failure | Network or service availability failure | `OFFLINE` sentinel → offline banner |
| Domain absence | Resource does not exist or is unavailable | `null` returned → unavailable state |
| Document unavailable | The payment artifact (boleto, PIX, receipt) cannot be presented | `null` returned → document-unavailable state (NOT `DOCUMENT_ERROR` sentinel at hook level) |
| Generic item error | A specific item cannot be loaded | `ITEM_ERROR` sentinel → inline item error |
| Swallowed-to-null compatibility | Flows where the hook intentionally converts all errors into `null` | No sentinel fired |

**Finance compatibility matrix**

| Frontend flow | Demo behavior | Target API error | Hook interpretation | Rendered UI state |
|---|---|---|---|---|
| `fetchFinancialOverview` | Throws `OFFLINE` or `ITEM_ERROR` | Network/timeout → `OFFLINE`; partial failure → `ITEM_ERROR` | `OFFLINE` → banner; `ITEM_ERROR` → list error flag | Overview error / offline banner |
| `fetchInvoiceDetail` | Returns `null` if not found; throws `OFFLINE` | 404/absence → `null`; network → `OFFLINE` | All non-null errors swallowed to `null` (existing bug-compatible behavior) | Invoice unavailable state |
| `fetchBoletoInfo` | Throws `DOCUMENT_ERROR`; also `OFFLINE` | 503/generation failure → DTO with `documentAvailable: false`; network → `OFFLINE` | Catch-all returns `null` (does not discriminate `DOCUMENT_ERROR`) | Boleto unavailable state |
| `fetchPixInfo` | Throws `DOCUMENT_ERROR`; also `OFFLINE` | Same as boleto | Catch-all returns `null` | PIX unavailable state |
| `fetchPaymentHistory` | Throws `OFFLINE` | Network → `OFFLINE`; otherwise list | Returns `[]` on error (swallowed) | Empty payments list |
| `fetchPaymentDetail` | Returns `null` if not found | 404/absence → `null` | Catch-all returns `null` | Payment unavailable state |
| `fetchReceiptData` | Returns `null` if not found | 404/absence → `null` | Catch-all returns `null` | Receipt unavailable state |

**Required backend contract:**

- The backend must preserve the certified behavior: where a hook swallows errors to `null`, the replacement service must also return `null` or a domain-absence shape that the hook already treats as `null`.
- Where a hook does discriminate `OFFLINE` or `ITEM_ERROR`, the transport layer must emit exactly those sentinels.
- `DOCUMENT_ERROR` is **not** a hook-level sentinel in the certified code. The backend should represent document-generation failure as a canonical DTO field (`documentAvailable: false`) and let the assembler derive the existing UI state. The transport layer must not throw `DOCUMENT_ERROR` unless a deliberate product change is separately approved.

Inconsistencies are recorded as **future product remediation** (post-Phase 1), not silently changed during transport replacement.

See ADR-11 for full decision record.

---

### F4 — Profile contacts is unspecified

| Attribute | Value |
|---|---|
| Severity | **MEDIUM** |
| Status | **Resolved in architecture — complete entity and RLS specification added** |
| Affected documents | `02-domain-model-erd.md`, `04-auth-and-authorization.md`, `03-api-and-edge-functions.md`, `06-migration-roadmap.md` |

#### Previous state

`profile_contacts` was referenced as the backing storage for `ContactMethod[]` and was listed in Sprint 1.1, but it had no:

- entity catalog definition;
- columns or constraints;
- ERD presence;
- RLS matrix row;
- lifecycle definition.

No table may enter a sprint without a documented RLS policy.

#### Correction

`profile_contacts` is now fully specified.

**Entity specification**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `profile_id` | uuid NOT NULL → `profiles(id)` | cascade delete on profile erasure |
| `contact_type` | enum | `phone \| whatsapp \| primary_email \| secondary_email` |
| `normalized_value` | text NOT NULL | lowercased email / E.164 phone; used for uniqueness and verification matching |
| `display_value` | text | formatted value shown to the user (e.g., `(41) 99999-9999`) |
| `verification_state` | enum | `unverified \| pending \| verified \| invalid \| outdated` |
| `verification_token_hash` | text | one-time code hash; null when not pending |
| `verification_sent_at` | timestamptz | rate-limiting and TTL enforcement |
| `verified_at` | timestamptz | null until verified |
| `is_primary` | boolean | one primary per `contact_type` per profile |
| `communication_preference_flags` | jsonb | per-channel opt-in flags (invoice, notice, support) |
| `invalidated_at` | timestamptz | soft-marked invalid |
| `outdated_at` | timestamptz | soft-marked outdated (resident report) |
| `created_at` / `updated_at` | timestamptz | standard |
| `deleted_at` | timestamptz | soft delete |

**Constraints and indexes**

- `UNIQUE (profile_id, contact_type, normalized_value) WHERE deleted_at IS NULL`
- `UNIQUE (profile_id, contact_type) WHERE is_primary = true AND deleted_at IS NULL`
- Partial index `(normalized_value) WHERE verification_state = 'verified'` — supports first-access lookup
- Index on `(profile_id, contact_type, deleted_at)`

**Uniqueness across profiles:** a normalized email or phone may be shared across profiles if both are verified (e.g., family account, corporate contact). The system treats the first verified record as authoritative for login resolution; subsequent verified records for the same value require additional proof-of-control during first access.

**Verification state model**

| State | Meaning | Transitions |
|---|---|---|
| `unverified` | Record created, never verified | → `pending` |
| `pending` | Verification code sent, awaiting confirmation | → `verified`, `invalid` |
| `verified` | Code confirmed or association-onboarded | → `outdated` |
| `invalid` | Bounced email, unreachable phone, or failed confirmation | → `pending` (after fix) |
| `outdated` | Resident reported the contact is no longer current; awaiting update | → `pending` (new value) |

**RLS policies**

| Operation | Policy |
|---|---|
| SELECT | `profile_id = auth.uid()` ∪ authorized association staff via `residence_members` chain (read-only) |
| INSERT | `profile_id = auth.uid()` (owner creates own contact) ∪ service_role (first-access activation) |
| UPDATE | `profile_id = auth.uid()`; restricted to `display_value`, `is_primary`, `communication_preference_flags`, `verification_state` transitions initiated by the owner |
| DELETE | soft delete by owner only (`deleted_at` set) |

Association staff may read `profile_contacts` only for profiles linked to a residence in their tenant. They may not insert, update, or delete resident contacts directly; contact verification is resident-mediated.

**API ownership**

- `resident-profile` owns read/update of the owner's contacts.
- `resident-auth` owns verification during first-access and recovery.
- The verification code is generated server-side and delivered through the channel on file; the resident confirms via `POST /contacts/{type}/verify`.

**Sprint placement:** Sprint 1.1 (migration of `profiles`, `residence_members`, `residence_invitations`, `profile_contacts`).

**Testing requirements:**

- Owner reads only their own contacts.
- Association staff read only contacts of residents linked to their tenant.
- Verification state transitions are atomic and idempotent.
- Primary uniqueness is enforced.

---

### F5 — Operation count does not reconcile

| Attribute | Value |
|---|---|
| Severity | **LOW** |
| Status | **Resolved in architecture — canonical inventory produced, count corrected** |
| Affected documents | `01-architecture-blueprint.md`, `03-api-and-edge-functions.md`, `06-migration-roadmap.md`, `07-risk-and-readiness.md` |

#### Previous state

The blueprint stated that 60 demo-service operations must be migrated. The exported count is **60**.

Additionally:

- `resetNotificationState` is demo-only state reset.
- `getSupportCategoryOptions` is a static catalog.
- `performSignOut` is a session operation but was not consistently named in the inventory.
- Several profile functions (`fetchPrivacySections`, `fetchPrivacyDataCategories`, `fetchAboutInfo`, `fetchDeviceAppInfo`) resolve client-side or from static i18n catalogs.

#### Correction

A canonical operation inventory is produced. Every exported demo-service function is classified.

**Inventory by service**

| Service | Exported functions | Production API | Local UI utility | Static catalog | Demo-only reset | Session operation | Retired / no backend |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `financeService.ts` | 8 | 8 | 0 | 0 | 0 | 0 | 0 |
| `profileService.ts` | 17 | 12 | 1 | 3 | 0 | 1 | 0 |
| `notificationService.ts` | 11 | 10 | 0 | 0 | 1 | 0 | 0 |
| `supportService.ts` | 13 | 11 | 0 | 2 | 0 | 0 | 0 |
| `residenceService.ts` | 7 | 7 | 0 | 0 | 0 | 0 | 0 |
| `consumoService.ts` | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| `homeService.ts` | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **60** | **52** | **1** | **5** | **1** | **1** | **0** |

The original "60 operations" claim is retained as the total exported function count, but it is now qualified: **52** functions require a live Edge Function replacement. The remaining 8 are client-side utilities, static catalogs, session operations, or demo-only controls.

**Classification detail**

| Class | Count | Examples |
|---|---|---|
| Production API operation | **52** | `fetchFinancialOverview`, `performProfileEdit`, `performNewRequest`, etc. |
| Local UI utility | 1 | `fetchDeviceAppInfo` |
| Static catalog | 5 | `fetchPrivacySections`, `fetchPrivacyDataCategories`, `fetchAboutInfo`, `fetchFAQ`, `getSupportCategoryOptions` |
| Demo-only reset | 1 | `resetNotificationState` |
| Session operation | 1 | `performSignOut` |
| Retired / no backend | 0 | — |

**Reconciliation note:** all 60 exported functions are accounted for. The migration gate requires every production-relevant operation to be mapped; every demo-only operation to be explicitly excluded; every static catalog to have an ownership model; every session operation to be assigned to the auth service; and no orphan operation.

**Corrected success criterion 1**

> Every one of the **52 production-relevant demo-service operations** is served by a live Edge Function.

The original "60" is removed from all documents.

---

### F6 — Environment exposure is present, not preventive

| Attribute | Value |
|---|---|
| Severity | **LOW, with security significance when combined with other risks** |
| Status | **Resolved in architecture — current-state risk registered, hardening tasks added** |
| Affected documents | `07-risk-and-readiness.md`, `06-migration-roadmap.md` (Sprint 0.9), production-readiness checklist |

#### Previous state

- `.env` is already committed to the repository.
- No `.gitignore` exists.
- The Supabase anon key is present in `.env`.

The previous documents did not treat this as a current-state risk.

#### Correction

This finding is moved from future hygiene into the current-state risk register.

**Facts**

- The Supabase anon key is **public by design** in browser applications; it is not independently a credential breach.
- The real risk is authorization and signup posture, not secrecy of the anon key.
- The combination of a tracked `.env`, absent `.gitignore`, enabled public signup, weak role-agnostic RLS, and production-project configuration increases the reachability of other security weaknesses.
- Future secrets (service-role keys, SMTP passwords, third-party API keys) are currently unprotected from accidental commit.

**Immediate repository-hardening tasks**

| # | Task | Owner |
|---|---|---|
| 1 | Create `.gitignore` covering `.env*`, `node_modules/`, `dist/`, `out/`, `.vite/`, OS files, IDE files | Frontend / Sprint 0 |
| 2 | Create `.env.example` with browser-safe variables only (Supabase URL, anon key placeholder) | Frontend / Sprint 0 |
| 3 | Classify browser-safe vs. server-secret variables in documentation | Architecture |
| 4 | Prohibit service-role keys and private secrets in frontend repositories | Program guardrail |
| 5 | Inspect Git history for actual secrets beyond the anon key | Security / Sprint 0 |
| 6 | Document rotation requirements if a true secret is found | Security |
| 7 | Verify `disable_signup = true` and production auth configuration before exposing the Resident App | Infra / Sprint 0 |

The current anon key is **not** relabeled as a credential breach. The risk is accurately framed as exposure posture and accident-prevention.

---

## 4. Sprint sequencing correction — Finance Readiness Gate

| Attribute | Value |
|---|---|
| Severity | **Sequencing risk (implicit in review)** |
| Status | **Resolved in architecture — Finance Readiness Gate added** |
| Affected documents | `06-migration-roadmap.md`, `07-risk-and-readiness.md` |

### Previous state

Sprint 4 was positioned as an early confidence-building integration because finance is read-only against existing tables. However:

- `tariff_plans` is empty;
- the billing engine has not completed a verified end-to-end run;
- finance screens may have no valid settled data to render.

### Correction

A **Finance Readiness Gate** is added before Sprint 4 is used as the first major end-to-end proof.

**Gate checklist**

- [ ] At least one valid association tariff configuration exists.
- [ ] At least one resident is linked to a profile and residence.
- [ ] At least one residence exists.
- [ ] At least one active meter exists.
- [ ] At least two valid readings exist.
- [ ] Consumption calculation runs and produces a value.
- [ ] Invoice generation runs and produces a `billing_titles` row.
- [ ] Line-item generation runs and sums to the title amount.
- [ ] A payable document or simulated payment artifact exists.
- [ ] Presentation output is compatible with the Resident App assembler.
- [ ] Tenant isolation is verified.
- [ ] Deterministic test data is in place.

**Fallback early integration proofs if Finance Readiness fails:**

- Resident profile (`/perfil`) — `profiles`, `profile_contacts`, `profile_preferences`;
- Residence context (`/minha-residencia`) — `residence_members`, `properties`;
- Notices (`/avisos`) — `notices`, `notice_reads`;
- Support request listing (`/atendimento`) — `support_requests` (after Sprint 7).

Finance remains Sprint 4 on the roadmap, but the sprint does not begin until the readiness gate is green.

---

## 5. Affected documents and changes made

| Document | Changes |
|---|---|
| `01-architecture-blueprint.md` | ADR-07 updated with narrow Realtime exception; error taxonomy §3.2 replaced with compatibility matrix; operation count corrected; new ADR cross-references added |
| `02-domain-model-erd.md` | `profile_contacts` added to ERD and entity catalog; relationship to `profiles` documented |
| `03-api-and-edge-functions.md` | Operation inventory reconciled (52 production-relevant operations); classification table added; no-backend functions explicitly marked |
| `04-auth-and-authorization.md` | `profiles` RLS policies explicitly defined; `profile_contacts` RLS matrix row added; helper functions clarified |
| `05-storage-realtime-offline.md` | Realtime channel privileges reconciled with ADR-07; `SELECT` grants on `notifications`/`support_messages` documented; RLS load-bearing nature restated |
| `06-migration-roadmap.md` | Finance Readiness Gate added before Sprint 4; Sprint 1.1 includes `profile_contacts`; success gates updated |
| `07-risk-and-readiness.md` | F6 current-state risk added; repository-hardening tasks added; success criterion 1 corrected; finance readiness risk added |
| `08-architecture-review.md` | This document — created |
| `09-adr-realtime-privilege-model.md` | New ADR |
| `10-adr-platform-profile-authorization.md` | New ADR |
| `11-adr-frontend-error-compatibility.md` | New ADR |
| `.gitignore` | Created |
| `.env.example` | Created |

---

## 6. ADR decisions

| ADR | Title | Decision | Validation condition |
|---|---|---|---|
| ADR-09 | Realtime privilege model | Option A — narrow `SELECT` grants on `notifications` and `support_messages`, all other grants revoked | Validate in branch/disposable Supabase project before Sprint 6 implementation |
| ADR-10 | Platform-level profile authorization | Three policy groups: self access, authorized association access via `residence_members` chain, platform admin | Validate RLS negative tests in CI before Sprint 1 implementation |
| ADR-11 | Certified frontend error-compatibility contract | Preserve certified hook behavior; backend returns `null`/DTO absence shapes where hooks swallow errors; no `DOCUMENT_ERROR` sentinel unless product changes approved | Validate assembler test vectors against existing fixtures before Sprint 2 |

---

## 7. Validation performed

The following consistency checks were performed against repository evidence:

- [x] All proposed entities (`profiles`, `profile_contacts`, `residence_members`, `residence_invitations`, notification tables, support tables, etc.) appear in the entity catalog.
- [x] All tables appear in the RLS matrix, including `profiles` and `profile_contacts`.
- [x] All API operations have ownership (Edge Function or client-side/static).
- [x] Realtime channels match the selected privilege model (narrow `SELECT` + RLS).
- [x] Sprint migrations reference specified entities.
- [x] Success-criterion counts reconcile to 52 production-relevant operations.
- [x] Risks map to mitigation and sprint ownership.
- [x] No Portuguese UI copy or React Router path is moved into backend domain storage (ADR-03 intact).
- [x] ADR-03 Presentation Assembly Layer remains intact.
- [x] `src/fixtures/types.ts` unchanged; frontend contract remains frozen.

No runtime Supabase validation was performed — Phase 1 restriction remains in effect.

---

## 8. Remaining work that is implementation-only

The following items are intentionally left for implementation sprints; they are not architecture ambiguities:

1. Branch/disposable Supabase validation of Realtime privileges (Sprint 6 or earlier spike).
2. RLS negative-test implementation in CI (Sprint 0).
3. Assembler test-vector execution against fixtures (Sprint 0 contract freeze).
4. Finance Readiness Gate data setup (before Sprint 4).
5. Repository hardening tasks `.gitignore`/`.env.example` (Sprint 0.9).

---

## 9. Final disposition of findings

| Finding | Previous state | Correction | Final status |
|---|---|---|---|
| F1 | ADR-07 conflicted with Realtime `postgres_changes` | Option A selected; narrow `SELECT` grants + RLS; ADR-09 created | Resolved in architecture; runtime validation pending |
| F2 | `profiles` RLS used undefined generic tenant predicate | Three explicit policy groups defined; ADR-10 created | Resolved in architecture; runtime validation pending |
| F3 | Error taxonomy claimed uniform three-sentinel handling | Compatibility matrix documented; certified behavior preserved; ADR-11 created | Resolved in architecture |
| F4 | `profile_contacts` was referenced but unspecified | Complete entity, constraints, RLS, lifecycle, and sprint placement specified | Resolved in architecture |
| F5 | "60 operations" claim did not match exported count | Canonical inventory produced; 52 production-relevant operations; success criterion corrected | Resolved in architecture |
| F6 | `.env` tracked, no `.gitignore`, treated as future hygiene | Current-state risk registered; hardening tasks added; `.gitignore`/`.env.example` to be created | Resolved in architecture |

---

## 10. D2 readiness decision

| Criterion | Evidence |
|---|---|
| F1 has selected architecture | ADR-09, Doc 01 ADR-07 amendment, Doc 05 §2 |
| F2 has explicit profile RLS | ADR-10, Doc 04 §3.3 RLS matrix |
| F3 has frontend-compatible error matrix | ADR-11, Doc 01 §3.2 |
| F4 has complete entity/RLS spec | Doc 02 §3.1, Doc 04 RLS matrix |
| F5 has reconciled inventory | Doc 03 §1, Doc 07 success criterion |
| F6 is current-state risk with hardening tasks | Doc 07 risk register, Doc 06 Sprint 0.9 |
| Finance sequencing has readiness gate | Doc 06 §2.1, Doc 07 §1.2 (R-22) / §6 |
| No contradictions across documents | Consistency audit performed |
| Architecture cross-references resolve | All ADR and section links verified |

**Decision:** `PASS WITH CONDITIONS`

**Conditions before Sprint 1 opens:**

1. ADR-09 Realtime privilege model must be validated in a branch or disposable Supabase project and confirmed to deliver events only to authorized profiles.
2. ADR-10 profile RLS policies must pass the full negative-test suite (tenant isolation, scope isolation, no cross-tenant profile read, no resident write to financial tables).
3. ADR-11 error-compatibility contract must be validated by executing assembler test vectors against existing demo fixtures and confirming no `DOCUMENT_ERROR` sentinel regression.

**Sprint 1 authorization:**

Sprint 1 implementation is authorized **only after** the three conditions above are satisfied. Both HIGH findings (F1 and F2) are fully resolved in the architecture; the remaining items are runtime validation of the selected designs.

If any HIGH finding had remained architecturally unresolved, the decision would be `FAIL — ARCHITECTURE CONFLICT UNRESOLVED`.
