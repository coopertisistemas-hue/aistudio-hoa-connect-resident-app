#!/usr/bin/env bash
set -euo pipefail

# CF-03 — `d2_` namespace ownership guard (static).
# CF-04 — test-role freeze assertion (static).
#
# Established by Wave 2.0. See docs/backend/34-wave-20-foundation-report.md and
# docs/backend/35-wave-20-engineering-conventions.md §4.
#
# This is a convention guard, not a business test. It runs entirely on the
# checked-in source tree — no database connection, no fixtures, no runtime state
# — so it is safe to chain into `supabase:test:all` in any position and cannot
# perturb the certified baseline.
#
# Rules enforced:
#   R1  The `d2_` prefix is owned exclusively by the D2 validation suite.
#       No object under supabase/ (migrations, functions, tests) may define or
#       reference a `d2_`-prefixed identifier.
#   R2  No product object may be named `d2_*`. R1 covers this structurally,
#       since all product objects live under supabase/.
#   R3  The four unprefixed cluster-global test roles are frozen at exactly the
#       set dispositioned by CF-04. A new unprefixed test role, or the loss of
#       one of the four, fails the guard until CF-04 is scheduled and executed.
#
# Exit 0 = conventions hold. Exit 1 = violation, with the offending lines shown.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

violations=0

echo "=== CF-03/CF-04 namespace ownership guard ==="

# --- R1/R2: `d2_` must not appear anywhere under supabase/ --------------------
echo "--- R1/R2: d2_ prefix confined to validation/ ---"
if leaked="$(grep -rn "d2_" supabase/ 2>/dev/null)"; then
  echo "VIOLATION (R1/R2): 'd2_' identifiers found outside validation/:"
  echo "$leaked"
  violations=$((violations + 1))
else
  echo "OK: no d2_ identifier appears under supabase/"
fi

# --- R3: CF-04 frozen test-role set ------------------------------------------
echo "--- R3: CF-04 unprefixed test-role freeze ---"
expected_roles="operator_contact_test
platform_admin_test
profile_read_test
profile_self_update_test"

actual_roles="$(grep -rhoE "CREATE ROLE [a-z0-9_]+" validation/ supabase/ 2>/dev/null \
  | awk '{print $3}' \
  | grep -v '^d2_' \
  | sort -u || true)"

if [ "$actual_roles" = "$expected_roles" ]; then
  echo "OK: exactly the four CF-04 roles are unprefixed:"
  echo "$actual_roles" | sed 's/^/      /'
else
  echo "VIOLATION (R3): unprefixed test-role set drifted from the CF-04 disposition."
  echo "  expected:"
  echo "$expected_roles" | sed 's/^/      /'
  echo "  actual:"
  echo "${actual_roles:-<none>}" | sed 's/^/      /'
  echo "  CF-04 defers renaming to the next D2 suite revision (Sprint 3 at the"
  echo "  latest). Until then this set is frozen; adding a role here requires"
  echo "  executing CF-04, not editing this guard."
  violations=$((violations + 1))
fi

# --- Result -------------------------------------------------------------------
if [ "$violations" -eq 0 ]; then
  echo "=== namespace guard PASS ==="
  exit 0
fi

echo "=== namespace guard FAIL ($violations violation(s)) ==="
exit 1
