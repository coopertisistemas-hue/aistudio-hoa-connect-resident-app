-- Sprint 1 Performance EXPLAIN Evidence
-- Run AFTER performance seed. Uses realistic parameters matching identity authorization paths.
-- Execute each block and capture the EXPLAIN output.

\pset pager off
\set ON_ERROR_STOP off

\echo '========================================'
\echo 'PERF-01: Profile lookup by authenticated user'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT p.id, p.user_id, p.full_name, p.preferred_name, p.status
FROM public.profiles AS p
WHERE p.user_id = '10000000-0000-0000-0000-000000000001'
  AND p.status = 'active';

\echo ''
\echo '========================================'
\echo 'PERF-02: Active tenant memberships for current profile'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT t.id, t.display_name, t.slug, tm.role::text AS role, 'staff'::text AS membership_kind
FROM public.tenant_members AS tm
JOIN public.tenants AS t ON t.id = tm.tenant_id
WHERE tm.profile_id = '20000000-0000-0000-0000-000000000001'
  AND tm.status = 'active';

\echo ''
\echo '========================================'
\echo 'PERF-03: Active residence memberships for current profile'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT p.id, p.tenant_id, p.label, p.nickname, p.unit_identifier, p.block_identifier,
       rm.role::text AS role, rm.is_primary
FROM public.residence_members AS rm
JOIN public.properties AS p ON p.id = rm.property_id
WHERE rm.profile_id = '20000000-0000-0000-0000-000000000001'
  AND rm.status = 'active';

\echo ''
\echo '========================================'
\echo 'PERF-04: Tenant-scoped residence listing'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, label, nickname, unit_identifier, block_identifier, status
FROM public.properties
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND status = 'active'
ORDER BY block_identifier, unit_identifier
LIMIT 50;

\echo ''
\echo '========================================'
\echo 'PERF-05: Authorized association profile lookup (ADR-10)'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT profiles.id, profiles.user_id, profiles.full_name, profiles.preferred_name, profiles.status
FROM public.profiles
JOIN public.residence_members AS rm ON rm.profile_id = profiles.id
JOIN public.properties AS p ON p.id = rm.property_id
WHERE rm.status = 'active'
  AND public.has_tenant_permission(p.tenant_id, 'profiles:read_association'::public.tenant_permission)
LIMIT 100;

\echo ''
\echo '========================================'
\echo 'PERF-06: Cross-tenant denial (wild tenant_id not in memberships)'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT EXISTS (
  SELECT 1
  FROM public.tenant_members AS tm
  WHERE tm.tenant_id = '99999999-9999-9999-9999-000000000999'::uuid
    AND tm.profile_id = '20000000-0000-0000-0000-000000000001'
    AND tm.status = 'active'
);

\echo ''
\echo '========================================'
\echo 'PERF-07: Profile contacts lookup by profile and type'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, contact_type, normalized_value, display_value, verification_state, is_primary
FROM public.profile_contacts
WHERE profile_id = '20000000-0000-0000-0000-000000000001'
  AND contact_type = 'email'
  AND deleted_at IS NULL
ORDER BY is_primary DESC;

\echo ''
\echo '========================================'
\echo 'PERF-08: Normalized contact lookup'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, profile_id, contact_type, normalized_value, verification_state
FROM public.profile_contacts
WHERE normalized_value = 'contact-1-1-1@test.com'
  AND deleted_at IS NULL;

\echo ''
\echo '========================================'
\echo 'PERF-09: Tenant permission check helper'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT public.has_tenant_permission('11111111-1111-1111-1111-111111111111', 'profiles:read_association'::public.tenant_permission);

\echo ''
\echo '========================================'
\echo 'PERF-10: Residence access helper'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT public.can_access_residence('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

\echo ''
\echo '========================================'
\echo 'PERF-11: Audit event lookup by tenant and time'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, action, entity_type, created_at
FROM public.audit_events
WHERE tenant_id = '11111111-1111-1111-1111-111111111111'
  AND created_at >= now() - interval '30 days'
ORDER BY created_at DESC
LIMIT 50;

\echo ''
\echo '========================================'
\echo 'PERF-12: Audit event lookup by actor'
\echo '========================================'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, action, entity_type, created_at
FROM public.audit_events
WHERE actor_profile_id = '20000000-0000-0000-0000-000000000001'
  AND created_at >= now() - interval '90 days'
ORDER BY created_at DESC
LIMIT 50;

\echo ''
\echo '=== All EXPLAIN queries complete ==='
