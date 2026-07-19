# Sprint 1 Identity — EXPLAIN (ANALYZE, BUFFERS) Performance Evidence

> Generated: 2026-07-19T19:07:03.264209Z against local Supabase CLI stack with representative seed data.

## Fixture Scale

| Entity | Rows |
|---|---|
| tenants | 51 |
| properties | 502 |
| profiles | 3257 |
| tenant_memberships | 252 |
| residence_memberships | 3004 |
| profile_contacts | 8872 |
| audit_events | 10008 |

Seed duration: ~15.0 seconds.

## Summary Table

| Query | Index Used | Method | Planning (ms) | Execution (ms) | Buffers | Verdict |
|---|---|---|---|---|---|---|
| PERF-01 Profile lookup by authenticated user | idx_profiles_user_id | Index Scan using idx_profiles_user_id on | 0.296 | 0.083 | 95 | OPTIMAL |
| PERF-02 Active tenant memberships for current pr | — | Hash Join | 2.134 | 0.107 | 276 | ACCEPTABLE |
| PERF-03 Active residence memberships for current | idx_residence_members_profile_active | Nested Loop | 0.43 | 0.165 | 217 | OPTIMAL |
| PERF-04 Tenant-scoped residence listing | idx_properties_tenant_status | Limit | 0.053 | 0.037 | 21 | OPTIMAL |
| PERF-05 Authorized association profile lookup (A | properties_pkey | Limit | 0.255 | 30.615 | 8837 | ACCEPTABLE |
| PERF-06 Cross-tenant denial (wild tenant_id not  | idx_tenant_members_tenant_status | Result | 0.05 | 0.014 | 2 | OPTIMAL |
| PERF-07 Profile contacts lookup by profile and t | idx_profile_contacts_profile_active | Sort | 0.225 | 0.061 | 131 | OPTIMAL |
| PERF-08 Normalized contact lookup | idx_profile_contacts_normalized_active | Index Scan using idx_profile_contacts_no | 0.097 | 0.03 | 2 | OPTIMAL |
| PERF-09 Tenant permission check helper | — | Result | 0.007 | 0.326 | — | OPTIMAL |
| PERF-10 Residence access helper | — | Result | 0.024 | 0.883 | 212 | OPTIMAL |
| PERF-11 Audit event lookup by tenant and time | idx_audit_events_tenant_created | Limit | 2.814 | 0.036 | 98 | OPTIMAL |
| PERF-12 Audit event lookup by actor | idx_audit_events_actor_created | Limit | 0.101 | 0.266 | 88 | OPTIMAL |

## Accepted Sequential Scans / Notes

### PERF-02
Sequential scan present; acceptable at current fixture scale for this path.

### PERF-05
Sequential scan present; acceptable at current fixture scale for this path.

## Interpretation

All 12 identity and authorization query paths produce acceptable plans under the representative fixture.
No blocking performance condition remains for Sprint 1 certification.
Raw EXPLAIN capture retained in auditor execution logs (`/tmp/perf-explain.log` during audit run).

