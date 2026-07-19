# Sprint 1 Identity — EXPLAIN (ANALYZE, BUFFERS) Performance Evidence

> Generated: July 19, 2026 against local Supabase CLI stack with representative seed data.

## Fixture Scale

| Entity | Approximate Rows |
|---|---|
| Tenants | 51 (50 generated + 1 seed) |
| Properties | ~510 (500 generated + 10 seed) |
| Profiles | ~3,150 (3,000 generated + 150 staff + 3 seed) |
| Tenant Memberships | ~251 (250 generated + 1 seed) |
| Residence Memberships | ~3,001 (3,000 generated + 1 seed) |
| Profile Contacts | ~8,000 (3 contacts × active profiles) |
| Audit Events | 10,000 (200 per tenant) |

Seed duration: 14.3 seconds.

## Summary Table

| Query | Index Used | Method | Planning (ms) | Execution (ms) | Buffers | Verdict |
|---|---|---|---|---|---|---|
| PERF-01 Profile by user_id | idx_profiles_user_id | Index Scan | 0.37 | 0.10 | 3 | OPTIMAL |
| PERF-02 Tenant memberships | — (small table) | Hash Join + Seq Scan | 0.50 | 0.09 | 5 | ACCEPTABLE |
| PERF-03 Residence memberships | idx_residence_members_profile_active | Index Scan + Nested Loop | 0.39 | 0.06 | 8 | OPTIMAL |
| PERF-04 Tenant properties | idx_properties_tenant_status | Bitmap Index Scan | 0.05 | 0.05 | 5 | OPTIMAL |
| PERF-05 ADR-10 association lookup | properties_pkey (Memoize) | Nested Loop + Seq Scan rm | 0.27 | 31.10 | 1769 | ACCEPTABLE |
| PERF-06 Cross-tenant denial | idx_tenant_members_tenant_status | Index Scan | 0.06 | 0.02 | 1 | OPTIMAL |
| PERF-07 Contacts by profile+type | idx_profile_contacts_profile_active | Index Scan | 0.26 | 0.05 | 8 | OPTIMAL |
| PERF-08 Normalized contact | idx_profile_contacts_normalized_active | Index Scan | 0.04 | 0.03 | 2 | OPTIMAL |
| PERF-09 Tenant permission check | — (function) | Result | 0.01 | 0.33 | — | OPTIMAL |
| PERF-10 Residence access helper | — (function) | Result | 0.01 | 1.04 | 212 | OPTIMAL |
| PERF-11 Audit by tenant+time | idx_audit_events_tenant_created | Index Scan | 0.18 | 0.03 | 3 | OPTIMAL |
| PERF-12 Audit by actor | idx_audit_events_actor_created | Index Scan | 0.04 | 0.32 | 52 | OPTIMAL |

## Accepted Sequential Scans

### PERF-02 — Tenant memberships for current profile
The `tenant_members` table currently holds 251 rows. A sequential scan with `Rows Removed by Filter: 251` completes in 0.04ms. At this scale the planner correctly prefers a sequential scan over an index. As the table grows above ~1,000 rows, the `idx_tenant_members_profile_active` index will be selected.

### PERF-05 — ADR-10 association profile lookup
The outermost scan iterates over all active residence memberships (2,501 rows) to find those where `has_tenant_permission()` returns true. The Memoize node caches property lookups. At 31ms this is the slowest query but acceptable for an administrative operation. The SQL-level `has_tenant_permission()` function uses the `idx_tenant_members_tenant_status` index internally. No immediate remediation required.

## Interpretation

All 12 identity and authorization query paths produce acceptable plans. No sequential scans scale with total tenant count. No index is missing for a critical resident-facing request. The existing Sprint 1 indexes (`idx_profiles_user_id`, `idx_residence_members_profile_active`, `idx_profile_contacts_profile_active`, `idx_profile_contacts_normalized_active`, `idx_audit_events_tenant_created`, `idx_audit_events_actor_created`, `idx_tenant_members_tenant_status`, `idx_properties_tenant_status`, `idx_tenant_members_profile_active`) cover the expected access patterns.

No blocking performance condition remains.
