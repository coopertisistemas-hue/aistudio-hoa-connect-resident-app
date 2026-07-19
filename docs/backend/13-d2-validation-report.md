# 13 — D2 Validation Report

> Backend Integration Program — D2 Validation Gate Wave  
> Runtime validation of ADR-09, ADR-10 and ADR-11 after the architecture remediation wave

---

## 1. Environment

| Field | Value |
|---|---|
| Repository | `aistudio-hoa-connect-resident-app` |
| Branch | `d2-validation-wave` |
| Validation date | **July 19, 2026** |
| Baseline frontend commit | `c245c6c1506fdf70a04ad0bd3b0d278178fbf0a5` |
| Supabase project reference | local CLI project `aistudio-hoa-connect-resident-app` |
| Environment type | Local Supabase CLI stack |
| API URL | `http://127.0.0.1:54331` |
| DB URL | local container on `127.0.0.1:54332` |
| Environment classification | Non-production, disposable, branch-local |
| Production connection used | **No** |

Proof of non-production classification:

- the stack was started from repo-local [supabase/config.toml](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/supabase/config.toml);
- `project_id = "aistudio-hoa-connect-resident-app"` is a local CLI identifier, not a hosted project ref;
- all endpoints were loopback (`127.0.0.1`) rather than hosted Supabase URLs;
- no production API keys, database passwords, or remote project refs were used in the validation evidence.

---

## 2. Baseline And Method

Validation artifacts:

- [validation/d2_setup.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/d2_setup.sql)
- [validation/adr09_adr10_sql_tests.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_sql_tests.sql)
- [validation/adr09_adr10_runtime_probe.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_runtime_probe.mjs)
- [validation/adr11_finance_compatibility.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr11_finance_compatibility.mjs)

Method summary:

1. Reset the isolated schema with `validation/d2_setup.sql`.
2. Inspect grants, policies, RLS force status, and indexed query paths with `validation/adr09_adr10_sql_tests.sql`.
3. Probe actual Realtime delivery and negative observation windows with `validation/adr09_adr10_runtime_probe.mjs`.
4. Execute deterministic finance compatibility vectors against the certified hook/service behavior with `validation/adr11_finance_compatibility.mjs`.
5. Reset the isolated schema between runs to avoid polluted evidence.

Cleanup performed:

- the local schema was reset repeatedly with `validation/d2_setup.sql`;
- all runtime inserts used fixed validation IDs inside the disposable local environment only;
- no production data or production services were modified.

---

## 3. ADR-09 Results

### 3.1 Grants And RLS

Validated SQL state:

- `authenticated` had `SELECT` on `notifications` and `support_messages` only.
- `authenticated` had no `INSERT`, `UPDATE`, or `DELETE` on those tables.
- `profiles`, `profile_contacts`, `support_requests`, `tenant_members`, and `tenants` remained unreadable to `authenticated`.
- RLS was both enabled and forced on `notifications`, `support_messages`, `profiles`, `profile_contacts`, `support_requests`, `residence_members`, and `tenant_members`.

### 3.2 Runtime Realtime Cases

Observation timestamp for runtime probe: **2026-07-19T09:53:37Z**

| Case | Result | Evidence |
|---|---|---|
| RT-01 Authorized notification | PASS | `notifications` event delivered once with payload at `2026-07-19T09:53:37.862Z` |
| RT-02 Cross-tenant notification denial | PASS | no failure recorded during the 2000 ms observation window |
| RT-03 Unauthorized authenticated user | PASS | zero delivered events during the 2000 ms observation window |
| RT-04 Authorized support message | CONDITIONALLY FAILING | event envelope arrived, but payload was empty with `errors: ["Error 401: Unauthorized"]` |
| RT-05 Foreign support conversation | **FAIL** | foreign `support_messages` event envelope was delivered during the resident subscription, again with `errors: ["Error 401: Unauthorized"]` |
| RT-06 Direct table-read boundary | PASS | direct reads returned only allowed `notifications` and owned `support_messages`; `profiles` returned `403` at PostgREST |
| RT-07 Subscription health | FAIL for support messages | actual delivery occurred, but not safely isolated; `SUBSCRIBED` was not accepted as proof |

Critical runtime evidence:

```text
RT-05 failed: Resident A received a foreign support message
```

Runtime payload shape for the leaked foreign support-message event:

```json
{
  "schema": "public",
  "table": "support_messages",
  "commit_timestamp": null,
  "eventType": "INSERT",
  "new": {},
  "old": {},
  "errors": ["Error 401: Unauthorized"]
}
```

Interpretation:

- `notifications` validated under Option A.
- `support_messages` did **not** validate under Option A.
- The resident subscriber still received an event envelope for a foreign conversation, which violates the required outcome `no event delivered`.

### 3.3 ADR-09 Verdict

```text
FAIL — VALIDATION CONDITION UNRESOLVED
```

Architectural implication:

- The selected `postgres_changes` + narrow `SELECT` + join-based RLS model is not sufficient for `support_messages`.

Smallest required remediation:

- Keep Option A for `notifications`.
- Replace `support_messages` realtime with private broadcast authorization, or denormalize ownership onto `support_messages` so authorization can be expressed as a direct row predicate and revalidated.

Validation that must be rerun after remediation:

- RT-04, RT-05, RT-06, and RT-07 for `support_messages`.

---

## 4. ADR-10 Results

### 4.1 Policy Chain

Validated relationship chain:

```text
auth user
→ profiles.user_id
→ residence_members.profile_id
→ properties.property_id
→ tenant_members.tenant_id
```

Platform administration was validated through `platform_admins` plus the governed correction function and audit table.

### 4.2 Identity Matrix

Validated identities in the isolated schema:

- Resident A — Tenant A
- Resident B — Tenant B
- Operator A — Tenant A
- Operator B — Tenant B
- Generic member A — Tenant A viewer role
- Platform administrator
- Unrelated authenticated user

### 4.3 Positive And Negative Results

| Case | Result |
|---|---|
| PR-01 Self read | PASS |
| PR-02 Self update allowed fields | PASS |
| PR-03 Protected self-update fields | PASS |
| PR-04 Cross-profile resident read denial | PASS |
| PR-05 Authorized association operator | PASS |
| PR-06 Cross-tenant operator denial | PASS |
| PR-07 Generic member denial | PASS |
| PR-08 Unrelated authenticated user denial | PASS |
| PR-09 Platform administrator governed correction + audit | PASS |
| PR-10 Enumeration resistance | PASS |
| PR-11 Sensitive-field exposure at direct API surface | PASS |
| PR-12 Contact-record policies | PASS |

Specific evidence:

- self update succeeded only for `preferred_name`;
- protected `document` update was denied;
- generic member and unrelated user could still read only their own profiles, but not resident profiles they were not entitled to enumerate;
- platform admin correction wrote one row into `profile_correction_audit`;
- `profiles` direct PostgREST access returned `403 permission denied for table profiles` for resident, operator, and unrelated user.

### 4.4 Performance Evidence

Validated indexes:

- `profiles(user_id)`
- active `residence_members(profile_id)`
- active `residence_members(property_id)`
- active `tenant_members(tenant_id, user_id, role)`
- `profile_contacts(profile_id)`
- `support_requests(profile_id)`

`EXPLAIN (COSTS OFF)` showed indexed access for:

- association-chain profile lookup;
- support-request lookup by `profile_id`.

### 4.5 ADR-10 Verdict

```text
PASS
```

No unresolved ADR-10 blocker remained after validation.

---

## 5. ADR-11 Results

Executable vector runner:

- [validation/adr11_finance_compatibility.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr11_finance_compatibility.mjs)

Execution summary:

- Total cases: **11**
- Passed: **11**
- Failed: **0**

Validated compatibility behaviors:

- EC-01 normal success: PASS
- EC-02 empty list: PASS
- EC-03 missing invoice detail: PASS
- EC-04 payment document unavailable: PASS
- EC-05 offline list request: PASS
- EC-06 offline finance detail: PASS
- EC-07 item-specific error compatibility: PASS
- EC-08 `DOCUMENT_ERROR` is not a universal hook sentinel: PASS
- EC-09 unknown backend failure does not become misleading success: PASS
- EC-10 malformed/missing upstream input collapses to controlled unavailable state: PASS
- payment history success path: PASS

Preserved inconsistencies intentionally kept outside Sprint 1:

- finance detail hooks still swallow `ITEM_ERROR` to `null` instead of surfacing list state;
- boleto/PIX `DOCUMENT_ERROR` still collapses to unavailable/null semantics through the hook contract.

### ADR-11 Verdict

```text
PASS
```

---

## 6. Files

### Created

- [docs/backend/13-d2-validation-report.md](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/docs/backend/13-d2-validation-report.md)
- [validation/adr09_adr10_runtime_probe.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_runtime_probe.mjs)
- [validation/adr11_finance_compatibility.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr11_finance_compatibility.mjs)

### Modified

- [docs/backend/07-risk-and-readiness.md](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/docs/backend/07-risk-and-readiness.md)
- [docs/backend/08-architecture-review.md](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/docs/backend/08-architecture-review.md)
- [docs/backend/09-adr-realtime-privilege-model.md](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/docs/backend/09-adr-realtime-privilege-model.md)
- [docs/backend/10-adr-platform-profile-authorization.md](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/docs/backend/10-adr-platform-profile-authorization.md)
- [docs/backend/11-adr-frontend-error-compatibility.md](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/docs/backend/11-adr-frontend-error-compatibility.md)
- [docs/backend/12-final-report.md](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/docs/backend/12-final-report.md)
- [validation/d2_setup.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/d2_setup.sql)
- [validation/adr09_adr10_sql_tests.sql](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_sql_tests.sql)

### Removed

- None.

---

## 7. Final D2 Verdict

```text
D2 FAIL — SPRINT 1 BLOCKED
```

Reason:

- ADR-09 failed runtime isolation validation for `support_messages`.
- ADR-10 and ADR-11 passed, but D2 requires all three validations to pass before Sprint 1 authorization.

Sprint 1 authorization status:

```text
BLOCKED
```

---

## 8. Next Authorized Action

Realtime Remediation Wave:

- revise `support_messages` realtime delivery model;
- re-run ADR-09 runtime validation in the same isolated non-production environment;
- if the rerun is green, reissue D2 verdict before opening Sprint 1.
