# 17 — Sprint 1 Foundation, Identity and Tenant Security Report

> Backend Integration Program  
> Sprint 1 — Supabase baseline, authentication foundation, profiles, tenant context, RLS baseline

---

## 1. Repository

| Field | Value |
|---|---|
| Branch before Sprint 1 work | `d2-validation-wave` |
| Sprint 1 branch | `sprint-01-foundation-identity` |
| Certified D2 commit | `75993bd0d7b69aaa3641a7b43185c8c4862da8e3` |
| Current branch head during validation | local working tree after Sprint 1 implementation, not yet committed |
| Push status | not pushed |
| Working tree | dirty by Sprint 1 files plus pre-existing untracked repo files |
| Unrelated files | left untouched and not to be staged with Sprint 1 certification |

Recorded baseline before work:

```text
git status --short
git branch --show-current
git rev-parse HEAD
git log -5 --oneline
git remote -v
```

Result summary:

- certified D2 commit `75993bd` was present locally;
- work was moved to `sprint-01-foundation-identity`;
- no D2 history was rewritten;
- no production deployment or push was performed.

---

## 2. Environment

| Field | Value |
|---|---|
| Validation date | July 19, 2026 |
| Validation target | local disposable Supabase CLI stack only |
| Production touched | no |
| Supabase CLI | `v2.107.0` |
| Database engine | local Supabase Postgres container |
| Realtime regression basis | certified D2 runtime probe and evidence artifacts rerun locally |
| Hosted deployment status | no hosted deployment in this sprint |

Proof of non-production validation:

- `npm run supabase:reset`
- `npm run supabase:test:sprint1`
- `npm run supabase:test:d2`
- `npm run supabase:types`

The D2 runner reused the local evidence harness and regenerated `validation/evidence/adr09_realtime_authorization_trace.json` on July 19, 2026 with `"failures": []`.

---

## 3. Schema

Implemented foundation migration:

- [20260719170000_sprint01_foundation_identity.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/supabase/migrations/20260719170000_sprint01_foundation_identity.sql)

Created foundation tables:

- `tenants`
- `properties`
- `profiles`
- `profile_contacts`
- `platform_role_assignments`
- `tenant_members`
- `residence_members`
- `profile_preferences`
- `profile_devices`
- `audit_events`

Created enums:

- `platform_role`
- `platform_assignment_status`
- `profile_status`
- `contact_type`
- `verification_state`
- `tenant_status`
- `property_status`
- `tenant_role`
- `tenant_membership_status`
- `residence_role`
- `residence_membership_status`
- `tenant_permission`

Created helper functions:

- `touch_updated_at()`
- `current_profile_id()`
- `has_platform_role()`
- `is_platform_admin()`
- `is_active_tenant_member()`
- `has_tenant_role()`
- `has_tenant_permission()`
- `is_active_residence_member()`
- `can_access_residence()`
- `can_manage_profile()`
- `current_tenant_context()`
- `log_audit_event()`

Created immutability and lifecycle triggers:

- `touch_*_updated_at`
- `profiles_protected_fields_immutable`
- `profile_contacts_protected_fields_immutable`
- `audit_events_immutable`

Created indexes for:

- profile lookup by `user_id`
- active contact lookup by `profile_id`
- normalized contact lookup
- tenant membership lookups
- residence membership lookups
- property lookup by tenant
- audit search by tenant and actor

Audit model:

- `audit_events` stores actor, tenant, entity, request correlation, source, and safe metadata;
- residents do not receive mutation privileges;
- update and delete attempts are rejected by trigger.

---

## 4. Authentication

Selected foundation strategy:

- direct session handling remains a Supabase client concern;
- profile bootstrap is modeled through `auth-bootstrap` and supporting helper functions;
- profile identity is platform-level through `profiles.user_id`;
- tenant and residence scope derives from `tenant_members` and `residence_members`, not from client metadata;
- missing-profile recovery is handled through `auth-bootstrap` and `auth-context` rather than silent partial initialization.

Current validated behavior:

- `current_profile_id()` resolves the authenticated resident profile under JWT-backed SQL tests;
- revoked residence membership blocks residence-scoped access;
- operator and platform-admin paths remain explicit;
- no-tenant and multi-tenant context are represented in helper output and Edge Function scaffolding.

Not fully validated in this sprint:

- live GoTrue sign-in / refresh / sign-out execution tests in this repository;
- hosted disabled-user behavior;
- end-to-end tenant selection across a deployed Edge Function runtime.

---

## 5. Authorization

Role model implemented in schema:

- platform: `platform_admin`, `platform_support`
- tenant: `association_admin`, `association_operator`, `association_finance`, `association_support`, `association_viewer`
- residence: `resident`, `owner`, `tenant`, `dependent`, `authorized_contact`, `primary_resident`

Permission model:

- explicit `tenant_permission` enum;
- helper-based resolution via `has_tenant_permission()` and related membership checks;
- resident access derives from `residence_members`, not broad tenant membership.

RLS inventory implemented on every Sprint 1 application table:

- `tenants`
- `properties`
- `profiles`
- `profile_contacts`
- `platform_role_assignments`
- `tenant_members`
- `residence_members`
- `profile_preferences`
- `profile_devices`
- `audit_events`

Key protections validated by SQL tests:

- self profile read passes;
- approved self update passes;
- protected legal-name mutation is denied;
- forged contact verification mutation is denied;
- profile enumeration by ordinary residents is blocked;
- cross-tenant access is denied;
- platform-admin read path is explicit;
- audit log mutation is denied.

Security-definer inventory:

- none added in the Sprint 1 migration; helper functions run with invoker rights.

Negative-test summary:

- resident cross-profile read denied;
- unauthorized residence access denied;
- generic member enumeration denied;
- operator cross-tenant access denied;
- audit-log mutation denied;
- contact verification spoofing denied.

---

## 6. Edge Functions

Implemented functions:

| Function | Purpose | Input | Output | Authorization | Audit | Test status |
|---|---|---|---|---|---|---|
| `auth-bootstrap` | ensure profile/bootstrap context exists | bearer JWT | standard envelope with bootstrap data | authenticated user required | ready for later event hooks | code implemented, not executed in automated function test |
| `auth-context` | return user/profile/tenant/residence context | bearer JWT | auth context envelope | authenticated user required | not required on read | code implemented, not executed in automated function test |
| `profile-get` | read current profile | bearer JWT | profile envelope | current profile only | no mutation | code implemented, not executed in automated function test |
| `profile-update` | update allowed profile fields | JSON body | updated profile envelope | current profile only | prepared for protected updates | code implemented, not executed in automated function test |
| `profile-contacts-list` | list contacts | bearer JWT | contact list envelope | current profile only | no mutation | code implemented, not executed in automated function test |
| `profile-contact-upsert` | create or update contact | JSON body | contact envelope | current profile only | intended for contact changes | code implemented, not executed in automated function test |
| `profile-contact-delete` | soft-delete contact | identifier body | success envelope | current profile only | intended for contact changes | code implemented, not executed in automated function test |
| `tenant-context-list` | list available tenant context | bearer JWT | tenant summary envelope | authenticated user required | no mutation | code implemented, not executed in automated function test |
| `tenant-context-select` | validate selected tenant context | JSON body | selected context envelope | authenticated user required | intended for context changes | code implemented, not executed in automated function test |
| `resident-auth` | identity/session boundary scaffold | request body varies | consistent error envelope | bearer JWT or auth request context | endpoint-dependent | code implemented, not executed in automated function test |

Shared utilities created:

- `supabase/functions/_shared/http.ts`
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/context.ts`
- `supabase/functions/_shared/validation.ts`

Assessment:

- the API boundary and error envelope are now present;
- authorization intent is encoded in shared helpers and function entry points;
- executable function-level tests are still missing, so this sprint does not claim function-runtime certification.

---

## 7. Tests

Executed tests:

| Suite | Result |
|---|---|
| `npm run supabase:reset` | PASS |
| `npm run supabase:test:sprint1` | PASS |
| `npm run supabase:test:d2` | PASS |
| `npm run supabase:types` | PASS |
| `pnpm run typecheck` | BLOCKED by package-manager environment, not by a confirmed TS contract failure |

Schema and RLS assertions covered in `supabase/tests/sprint01_foundation.sql`:

- helper identity resolution;
- residence access helper behavior;
- tenant and residence listing boundaries;
- profile enumeration resistance;
- protected profile update denial;
- contact verification spoofing denial;
- operator scoped read path;
- platform-admin tenant read path;
- audit event immutability.

D2 regression status:

- DB-01 through DB-10 remained green;
- RT-04 through RT-14 remained green in regenerated evidence;
- notifications Realtime remained green;
- ADR-10 and ADR-11 regression expectations remained green.

Unmet test target in this sprint:

- no executable Edge Function integration suite was added.

---

## 8. Performance

Representative current evidence:

- support-message D2 regression plans still use the certified direct indexes from the Option B path;
- Sprint 1 foundation tables now include lookup indexes for the expected auth and membership joins;
- local validation volume is small, so small-table sequential scans were not treated as a failure by themselves.

Performance work completed:

- added direct lookup indexes on `profiles.user_id`;
- added active lookup indexes on `profile_contacts`, `tenant_members`, and `residence_members`;
- added tenant and actor indexes on `audit_events`.

Remaining concerns:

- no realistic high-volume fixture set was generated for Sprint 1 foundation tables;
- no `EXPLAIN (ANALYZE, BUFFERS)` evidence was captured yet for the new Edge Function query paths.

This is a certification-quality gap, but not a proven security regression.

---

## 9. Files

Created or materially added in this sprint:

- `supabase/migrations/20260719170000_sprint01_foundation_identity.sql`
- `supabase/seed.sql`
- `supabase/tests/sprint01_foundation.sql`
- `supabase/README.md`
- `supabase/functions/_shared/http.ts`
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/context.ts`
- `supabase/functions/_shared/validation.ts`
- `supabase/functions/auth-bootstrap/index.ts`
- `supabase/functions/auth-context/index.ts`
- `supabase/functions/profile-get/index.ts`
- `supabase/functions/profile-update/index.ts`
- `supabase/functions/profile-contacts-list/index.ts`
- `supabase/functions/profile-contact-upsert/index.ts`
- `supabase/functions/profile-contact-delete/index.ts`
- `supabase/functions/tenant-context-list/index.ts`
- `supabase/functions/tenant-context-select/index.ts`
- `supabase/functions/resident-auth/index.ts`
- `src/lib/supabase/contracts.ts`
- `src/lib/supabase/database.types.ts`
- `validation/run_d2_regression.sh`
- this report and related doc updates

Modified:

- `package.json`

Intentionally excluded from Sprint 1 staging:

- unrelated untracked workspace files;
- production environment secrets;
- any hosted deployment artifacts.

Removed:

- none.

Generated:

- `src/lib/supabase/database.types.ts`

---

## 10. Risks

Mitigated:

- platform identity foundation now exists locally;
- tenant and residence authorization primitives now exist locally;
- profile and contact protected-field escalation is blocked in SQL;
- D2-certified Realtime architecture remains intact after the Sprint 1 schema layer.

Open:

- Edge Function runtime authorization remains unproven by executable function tests;
- repository-wide typecheck was not completed because `pnpm` required install/build approval in this workspace;
- no hosted branch or staging deployment was exercised.

Blocking for full certification:

- function-level execution tests;
- clean typecheck in the intended package-manager state;
- broader performance evidence for new identity paths.

Non-blocking:

- absence of hosted deployment in this sprint, because production touch was explicitly out of scope.

No unresolved HIGH security finding was discovered in the validated local SQL/RLS layer.

---

## 11. Sprint verdict

```text
SPRINT 1 PASS WITH CONDITIONS — FOUNDATION USABLE
```

Reason:

- the clean-reset schema, RLS baseline, audit immutability, identity helpers, generated database types, and D2 regressions are validated locally;
- the remaining gaps are verification and deployment gaps, not a proven tenant-isolation or privilege-escalation failure in the local foundation schema;
- the branch does not yet justify `SPRINT 1 PASS — FOUNDATION CERTIFIED` because Edge Function runtime tests and clean repository typecheck evidence are missing.

---

## 13. Conditions Closure — July 19, 2026

The three outstanding conditions from §12 have been resolved:

### Condition 1: Edge Function Authorization Tests

Executable test harness created at `supabase/tests/sprint01_edge_function_auth.test.mjs`. Results: **38/38 passed**. All 15 test categories (EF-AUTH-01 through EF-AUTH-15) exercised at the actual Edge Function boundary using self-signed JWTs against the local Supabase edge runtime.

Evidence: `validation/evidence/sprint01_edge_function_authorization.json`

### Condition 2: Package Manager Reconciliation

Canonical package manager established as **npm 10.9.8**. Added `packageManager` field to `package.json`. Removed competing lockfile artifacts (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). Clean install, typecheck, and build all pass.

Evidence: `package.json` (packageManager field), clean `npm ci` output.

### Condition 3: Performance Evidence

Representative dataset seeded (50 tenants, 501 properties, 3,253 profiles, 3,001 residence memberships, 8,859 contacts, 10,000 audit events). All 12 identity query paths captured with `EXPLAIN (ANALYZE, BUFFERS)`. 10 of 12 use appropriate indexes. 2 sequential scans are acceptable at current scale.

Evidence: `validation/evidence/sprint01_identity_explain_evidence.md`, `validation/evidence/sprint01_identity_explain_summary.json`

### Updated Verdict (superseded by independent audit chain)

The three original conditions are **CLOSED** after re-execution (see report 18).  
Independent audits and Agy governance (reports 19–21) retain:

```text
SPRINT 1 PASS WITH CONDITIONS — FOUNDATION USABLE
```

Residual condition: D2 validation setup remains destructive to the Sprint 1 schema and must run in the documented order (`COND-OPS-01` in report 21). Full `FOUNDATION CERTIFIED` is withheld until that operational gap is closed.

Full closure / audit chain:

- `docs/backend/18-sprint-01-conditions-closure-report.md`
- `docs/backend/19-sprint-01-opencode-go-technical-audit.md`
- `docs/backend/20-sprint-01-claude-independent-audit.md`
- `docs/backend/21-sprint-01-final-certification.md`

### Next Authorized Action

```text
Sprint 2 may be planned but must not be implemented until product authorizes the next wave.
```
