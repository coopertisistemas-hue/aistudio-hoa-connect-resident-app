# Supabase Backend Baseline

Sprint 1 establishes the canonical local structure:

```text
supabase/
  config.toml
  functions/
  migrations/
  seed.sql
  tests/
```

## Local workflow

- Start services: `npm run supabase:start`
- Reset from clean state: `npm run supabase:reset`
- Run Sprint 1 SQL checks: `npm run supabase:test:sprint1`
- Run Sprint 1 + D2 regressions: `npm run supabase:test:all`
- Generate local database types: `npm run supabase:types`

## Edge Functions

- Serve locally: `supabase functions serve`
- Function conventions:
  - shared auth/context utilities in `supabase/functions/_shared`
  - authenticated response envelope with request correlation id
  - no direct table proxy behavior
  - authorization resolved in backend before any tenant or residence context is returned

## Migration governance

- New work is additive and lives in `supabase/migrations/`
- Migrations apply in filename order
- Reset always uses:
  1. migrations
  2. `supabase/seed.sql`
  3. SQL tests
  4. D2 regression suite

## Deployment process

- Validate locally with `npm run supabase:test:all`
- Generate current DB types with `npm run supabase:types`
- Deploy functions with `supabase functions deploy <name>`
- Apply migrations with `supabase db push` only after explicit approval

## Rollback

- Local rollback: `npm run supabase:reset`
- Hosted rollback: apply a new forward migration that reverses the approved additive change; never edit an applied migration in place
