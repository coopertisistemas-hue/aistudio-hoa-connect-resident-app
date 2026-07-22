#!/usr/bin/env bash
set -euo pipefail

# Type-check all EPF-03 Edge Functions and shared payment modules.
# Requires Deno. If Deno is not available, prints a clear warning and exits
# successfully so that other gates can continue, but documents the limitation
# in the validation report.

if ! command -v deno &> /dev/null; then
  echo "WARNING: Deno runtime not found. Skipping Edge Function type-check."
  echo "Install or provide Deno to enable validation of supabase/functions/*."
  exit 0
fi

echo "Edge Function type-check using $(deno --version | head -n 1)"

FILES=(
  supabase/functions/_shared/auth.ts
  supabase/functions/_shared/http.ts
  supabase/functions/_shared/context.ts
  supabase/functions/_shared/payment/types.ts
  supabase/functions/_shared/payment/capabilities.ts
  supabase/functions/_shared/payment/crypto.ts
  supabase/functions/_shared/payment/mock-provider.ts
  supabase/functions/_shared/payment/stub-provider.ts
  supabase/functions/_shared/payment/registry.ts
  supabase/functions/payment-webhook-receive/index.ts
  supabase/functions/payment-intent-create/index.ts
  supabase/functions/payment-refund/index.ts
  supabase/functions/payment-intent-cancel/index.ts
  supabase/functions/payment-provider-config-upsert/index.ts
  supabase/functions/payment-provider-config-list/index.ts
)

for file in "${FILES[@]}"; do
  echo "deno check $file"
  deno check "$file"
done

echo "Edge Function type-check complete."
