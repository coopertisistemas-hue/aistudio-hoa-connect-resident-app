#!/usr/bin/env bash
set -euo pipefail

# WARNING: validation/d2_setup.sql DROPs and recreates foundation tables with the
# D2-shaped schema. This intentionally replaces the Sprint 1 migration schema.
# After this suite, run `npm run supabase:reset` before Sprint 1 SQL/edge/perf tests.
# Do not interleave D2 setup with Sprint 1 edge-function authorization tests.

docker exec -i supabase_db_aistudio-hoa-connect-resident-app \
  psql -U postgres -d postgres < validation/d2_setup.sql

docker exec -i supabase_db_aistudio-hoa-connect-resident-app \
  psql -U postgres -d postgres < validation/adr09_adr10_sql_tests.sql

eval "$(supabase status -o env)"

export SUPABASE_URL="${API_URL}"
export SUPABASE_ANON_KEY="${ANON_KEY}"
export SUPABASE_JWT_SECRET="${JWT_SECRET}"
export SUPABASE_DB_URL="${DB_URL}"

node validation/adr09_adr10_runtime_probe.mjs
