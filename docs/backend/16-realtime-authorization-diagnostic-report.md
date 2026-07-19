# 16 — Realtime Authorization Diagnostic Report

> HOA CONNECT — Backend Integration Program  
> ADR-09 Realtime Authorization Diagnostic Wave  
> Date: July 19, 2026

---

## 1. Current failure

The earlier Wave B Option B rerun failed with:

```json
{
  "schema": "public",
  "table": "support_messages",
  "eventType": "INSERT",
  "new": {},
  "old": {},
  "errors": ["Error 401: Unauthorized"]
}
```

That failure is preserved in:

- [14-realtime-remediation-report.md](14-realtime-remediation-report.md)
- [15-realtime-option-b-validation-report.md](15-realtime-option-b-validation-report.md)

This diagnostic wave traced the mismatch end to end and reran the full suite after the minimal correction.

---

## 2. Identity trace

Authorized Resident A validation identity:

- auth user UUID: `10000000-0000-0000-0000-000000000001`
- resident profile UUID: `20000000-0000-0000-0000-000000000001`
- support row `resident_user_id`: `10000000-0000-0000-0000-000000000001`
- database `auth.uid()`: `10000000-0000-0000-0000-000000000001`

Evidence:

- [validation/evidence/adr09_realtime_authorization_trace.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_realtime_authorization_trace.json)

Observed under the authenticated RPC probe:

- `auth.uid()` matched Resident A
- `auth.role()` returned `authenticated`
- `current_user` returned `authenticated`
- `current_profile_id()` returned Resident A profile
- `current_tenant_ids()` returned Tenant A only

The local harness uses a synthetic JWT signed with the local project `SUPABASE_JWT_SECRET`; there is no GoTrue sign-in flow in this isolated validation stack. That limitation was recorded, but it was not the root cause of the final mismatch because the same token authorized direct reads and the corrected Realtime rerun.

---

## 3. JWT trace

Resident A token evidence recorded only non-secret fields:

- header fields: `alg`, `typ`
- claims: `aud`, `exp`, `iat`, `iss`, `role`, `sub`
- `sub = 10000000-0000-0000-0000-000000000001`
- `role = authenticated`
- `aud = authenticated`
- issuer: `supabase-demo`

The probe also recorded a token fingerprint instead of the raw token.

---

## 4. Realtime token propagation

The decisive mismatch was in the local validation harness sequence, not in SQL or policy logic.

Observed bad path:

```text
reset
create one long-lived client
setAuth(token) once
reuse that client across notifications + multiple support channels
later support subscriptions receive unauthorized envelopes
```

Corrected path:

```text
reset
create final authenticated token
call setAuth(token) before every channel subscribe
use fresh authenticated clients for independent runtime scenarios
subscribe
wait for SUBSCRIBED
insert row
observe payload
```

After that correction, the full RT suite passed on the original Option B policy shape.

---

## 5. Database identity probe

Authenticated probe results:

- `auth.uid() = 10000000-0000-0000-0000-000000000001`
- `auth.role() = authenticated`
- `current_user = authenticated`
- `current_profile_id() = 20000000-0000-0000-0000-000000000001`
- `current_tenant_ids() = {11111111-1111-1111-1111-111111111111}`

Direct authenticated `support_messages` read returned only authorized rows.

Implication:

```text
identity propagation into PostgREST and RLS was correct
```

The failure therefore did not originate from the row-ownership predicate itself.

---

## 6. Policy bisect

Machine-readable bisect evidence:

- [validation/evidence/adr09_policy_bisect.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_policy_bisect.json)

Key results:

- `P1_authenticated_true`: authorized payloads delivered; foreign and unrelated cases proved the policy was intentionally broad
- `P2_authenticated_uid`: authorized payload delivered; foreign and unrelated cases silent
- `P2_public_uid`: authorized payload delivered; foreign and unrelated cases silent
- `P3_public_uid_revoked`: authorized payload delivered; foreign and unrelated cases silent
- `P4_public_profile`: authorized payload delivered; foreign and unrelated cases silent
- `P5_public_tenant`: authorized payload delivered; foreign and unrelated cases silent
- `P6_final_public`: authorized payload delivered; foreign and unrelated cases silent

Conclusion:

```text
the direct ownership predicate and the original role-targeted resident policy were both Realtime-compatible in isolation
```

The failing layer was therefore outside the predicate itself.

---

## 7. Publication and replica identity

Recorded in the trace artifact:

- `notifications` in `supabase_realtime`
- `support_messages` in `supabase_realtime`
- `realtime_owner_probe` in `supabase_realtime`
- `relreplident = d` for all three tables during the successful rerun

Implication:

```text
REPLICA IDENTITY FULL was not required to fix the authorized subscriber path
```

---

## 8. Subscription-filter tests

Authorized filter variants tested:

- no filter
- `support_request_id`
- `resident_user_id`
- `tenant_id`
- production-intended request filter

Results:

- all authorized filter variants delivered approved payloads after the harness correction
- no unauthorized envelope was required for authorization

---

## 9. Notifications comparison

`notifications` stayed green throughout.

Material comparison:

- same publication
- same default replica identity
- same narrow `SELECT` grant model
- both protected by RLS

Important difference in the failing runs:

- `notifications` was first on the long-lived reused client and continued to work
- later `support_messages` channels on that reused client diverged until auth was refreshed and the scenarios were isolated

This is why the stack was not generally broken while `notifications` remained green.

---

## 10. Control-table result

Control artifact:

- [validation/evidence/adr09_control_table_probe.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_control_table_probe.json)

Result:

- authorized owner payload delivered
- foreign owner insert produced the same unauthorized-envelope behavior on broad subscriptions
- unrelated user remained silent on unrelated subscription

Interpretation:

```text
the local stack could authorize direct ownership when the client/token flow was correct;
the remaining mismatch was reproducible as a harness/client behavior, not as a support_messages-only schema defect
```

---

## 11. Local version and log analysis

Version trace:

- [validation/evidence/adr09_realtime_version_trace.md](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_realtime_version_trace.md)

Recorded versions:

- Supabase CLI `2.107.0`
- Realtime `public.ecr.aws/supabase/realtime:v2.107.5`
- PostgREST `v14.13`
- GoTrue `v2.190.0`
- Postgres `17.6.1.136`

Realtime logs did not emit a useful explicit `401` line for the failing socket payloads; the decisive evidence remained the channel payloads plus the successful rerun after token-refresh and client isolation.

---

## 12. Root cause

Exact failing layer:

```text
local validation harness
→ Realtime token propagation on reused clients/channels
→ stale or not-reapplied auth state on later support subscriptions
```

Why SQL passed while Realtime failed:

- SQL and direct PostgREST reads executed under the correct Resident A identity
- isolated fresh-client Realtime probes also passed under the same identity
- only the long-lived reused-client runtime harness produced the unauthorized envelopes

That is why the authorized Resident A row was readable and authorizable in SQL while the earlier reused-client runtime path still failed.

---

## 13. Correction applied

Smallest proven correction:

- refresh Realtime auth with the final token before every channel subscribe
- use fresh authenticated clients for independent runtime scenarios in the validation harness
- keep the original Option B policy shape

Files changed:

- [validation/adr09_adr10_runtime_probe.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_adr10_runtime_probe.mjs)
- [validation/adr09_realtime_authorization_diagnostic.mjs](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/adr09_realtime_authorization_diagnostic.mjs)

No production system was touched.

---

## 14. Performance results

`validation/adr09_adr10_sql_tests.sql` now reports indexed plans for the validated local paths:

- tenant + resident read: index-only scan on `idx_support_messages_tenant_resident_created`
- request ordering read: bitmap index scan on `idx_support_messages_request_created`
- cross-tenant denial probe: index-only scan on `idx_support_messages_tenant_resident_created`

Representative evidence is embedded in:

- [validation/evidence/adr09_realtime_authorization_trace.json](/home/ubuntu/projects/connect/03-products/hoa-connect/aistudio-hoa-connect-resident-app/validation/evidence/adr09_realtime_authorization_trace.json)

Remaining concern:

- local validation volume is still modest; future scale tests should keep verifying plan stability

---

## 15. Runtime results

Final full-suite rerun result:

- RT-04 through RT-14: PASS
- DB-01 through DB-10: PASS
- `notifications`: PASS
- ADR-10 SQL validation: PASS

Final authorized path:

```text
RT-04 = exactly one approved support-message payload
no 401 envelope
```

Final foreign path:

```text
RT-05 = no payload
no envelope
```

Final unrelated user path:

```text
RT-06 = no event
```

Direct read:

```text
RT-08 = authorized rows only
```

---

## 16. D2 verdict

```text
D2 PASS — SPRINT 1 AUTHORIZED
```

---

## 17. Next authorized action

```text
Begin Sprint 1 — Foundation, Identity and Tenant Security.
```
