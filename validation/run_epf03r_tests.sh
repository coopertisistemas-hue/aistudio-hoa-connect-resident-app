#!/usr/bin/env bash
set -euo pipefail

# EPF-03R validation suite orchestration.
# Runs the logically separated SQL test files in order.

DB_CONTAINER="supabase_db_aistudio-hoa-connect-resident-app"

run_sql() {
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$1"
}

run_sql "validation/epf03r_privilege_tests.sql"
run_sql "validation/epf03r_tenant_isolation_tests.sql"
run_sql "validation/epf03r_webhook_tests.sql"
run_sql "validation/epf03r_refund_tests.sql"
run_sql "validation/epf03r_state_machine_tests.sql"
run_sql "validation/epf03r_regression_tests.sql"

echo "EPF-03R validation suite complete."
