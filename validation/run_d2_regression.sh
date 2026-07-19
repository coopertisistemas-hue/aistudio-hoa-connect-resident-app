#!/usr/bin/env bash
set -euo pipefail

# NOTE: the D2 suite is fully isolated via d2_-prefixed tables, functions, and
# indexes. It no longer drops or recreates Sprint 1 foundation objects, so it can
# run in any order relative to the Sprint 1 suites with no `supabase db reset`
# required afterwards.

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
