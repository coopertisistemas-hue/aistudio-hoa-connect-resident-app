# Changelog

All notable changes to HOA Connect Resident App will be documented in this file.

---

## Sprint 1 — Foundation & Identity (2026-07-19)

### Core Identity & Tenancy

- Created `resident` schema with full namespace isolation
- **Enums:** `platform_role`, `platform_assignment_status`, `profile_status`, `contact_type`, `verification_state`, `tenant_status`, `property_status`, `tenant_role`, `tenant_membership_status`, `residence_role`, `residence_membership_status`, `tenant_permission`
- **Tables:** `tenants`, `properties`, `profiles`, `profile_contacts` (soft-delete), `platform_role_assignments`, `tenant_members`, `residence_members`, `profile_preferences`, `profile_devices`, `audit_events` (immutable)
- **RLS:** Full Row Level Security with SECURITY DEFINER helper functions, RBAC permission matrix, revoke-first posture
- **Helper Functions:** `current_profile_id()`, `has_platform_role()`, `is_platform_admin()`, `is_active_tenant_member()`, `has_tenant_role()`, `has_tenant_permission()`, `is_active_residence_member()`, `can_access_residence()`, `can_manage_profile()`, `current_tenant_context()`, `log_audit_event()`
- **Triggers:** `touch_updated_at` on all updatable tables, immutable field protections, audit event immutability
- **Edge Functions:** `auth-bootstrap`, `resident-auth`, `profile-get`, `profile-update`, `profile-contact-upsert`, `profile-contact-delete`, `profile-contacts-list`, `auth-context`, `tenant-context-list`, `tenant-context-select`
- **Certification:** Sprint 1 certified at tag `hoa-connect-sprint-01-foundation-certified-v1.0.0`
- **Audits:** Claude independent audit, OpenCode Go technical audit, primary technical certification audit

---

## Sprint 2 — Domain Extensions

### Wave 2.1 — Association Domain (2026-07-20)

- Extended `tenant_role` enum with `association_collector`
- Extended `tenant_permission` enum with 12 new permissions: `residents:read`, `residents:write`, `residence_payers:read`, `residence_payers:write`, `household:read`, `household:write`, `invitations:read`, `invitations:write`, `association_details:read`, `association_details:write`, `audit:read_association`, `residences:read_routes`
- Updated `has_tenant_permission()` with extended RBAC matrix
- **Tables:** `association_details` (public association info with JSONB validation), `association_settings_private` (internal-only settings)
- Added JSONB validation helpers: `check_association_details_settings()`, `check_association_details_enabled_modules()`
- Auto-seeding trigger `handle_tenant_created()` for new tenants
- RLS: restricted SELECT on `association_settings_private` to `association_details:write` + platform admin

### Wave 2.2 — Resident Domain (2026-07-20)

- Created `resident_status` enum: `pending`, `active`, `inactive`, `former`, `deceased`, `blocked`
- **Tables:** `residents` (tenant-scoped resident registry with unique (tenant_id, profile_id)), `resident_staff_notes` (append-only staff notes)
- **Helper Function:** `is_active_resident(target_tenant_id)`
- **Triggers:** Protected field immutability, resident status transition state machine (deceased=terminal, pending→active/former, active→inactive/blocked/former/deceased, etc.), staff notes append-only (no UPDATE/DELETE)
- RLS: Self-access + `residents:read`/`residents:write` + platform admin
- Strict mutation-boundary posture: SELECT only grants

### Wave 2.3 — Residence & Household (2026-07-20)

- Created enums: `residence_membership_end_reason`, `household_relationship`, `household_member_status`
- Enabled `btree_gist` extension for EXCLUDE constraints
- Evolved `residence_members` table: added `end_reason`, `requested_end_date`, `moveout_requested_at`, composite FK support, partial unique constraints, EXCLUDE constraint on overlapping date ranges
- **Tables:** `household_members` (non-platform household persons)
- **Helper Function:** `is_household_responsible(target_id)`
- Cross-table invariant: `prevent_platform_user_household_duplicate()` — a profile cannot be both active residence_member and active household_member for the same property
- RLS: co-household access, `household:read`/`household:write`, platform admin

### Wave 2.3.1 — SPA Deep Routes & Vercel Deployment (2026-07-21)

- Added `vercel.json` with SPA rewrite rules for deep route support
- All non-asset paths route to `/index.html` for client-side routing
- Corrected Wave 2.3 evidence documentation

---

## EPF-01 — Financial Domain Foundation (2026-07-21)

### Database

- Created financial domain schema: 12 tables, 5 enums, comprehensive RLS
- **Enums:** `invoice_status`, `payment_status`, `payment_method_type`, `financial_event_type`, `adjustment_category`
- **Tables:** `billing_accounts`, `billing_cycles`, `invoices`, `invoice_items`, `payment_intents`, `payment_methods`, `payment_transactions`, `payment_receipts`, `payment_provider_events`, `ledger_entries`, `financial_adjustments`, `financial_audit_log`
- **Helper Function:** `is_billing_account_owner(target_billing_account_id)`
- Ledger-first architecture: every financial event generates immutable ledger entries
- CNAB-ready: nullable bank reference fields on invoices
- Idempotency-ready: unique constraint on `provider_payment_intent_id`

### Payment Provider Abstraction

- Defined `PaymentProvider` interface with provider-agnostic operations
- Created adapter stubs for: Stripe, Asaas, Efí, Sicoob, Sicredi, Banco do Brasil, Caixa, CNAB
- Provider registry for runtime adapter resolution

### Frontend

- Financial types: `BillingAccountData`, `BillingCycleData`, `InvoiceRecord`, `PaymentIntentRecord`, etc.
- Finance repository layer between demo services and real Supabase
- API contracts for future edge functions
- Admin finance routes with role guards (hidden, protected)
