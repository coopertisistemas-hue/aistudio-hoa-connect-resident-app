# HOA Connect — Resident App

## 1. Project Description
A mobile-only resident application for people served by neighborhood and community associations (HOAs). The app provides a calm, trustworthy, and community-oriented experience for residents to access water consumption, invoices, payments, notices, support, and residence information.

Target users: Residents of communities managed by homeowner associations.
Core value: Simple, accessible self-service for all association-related needs in one place.

## 2. Page Structure
### Entry (unauthenticated)
- `/splash` — Splash screen with brand and loading
- `/welcome` — Welcome screen introducing the app
- `/login` — Login with CPF/email and password
- `/password-recovery` — Multi-step password recovery flow
- `/first-access` — Multi-step first-time activation
- `/access-success` — Confirmation after login or activation

### Authenticated
- `/inicio` — Home with summary cards and bottom nav
- `/consumo` — Water consumption (placeholder)
- `/faturas` — Invoices (placeholder)
- `/atendimento` — Support (placeholder)
- `/perfil` — Profile and preferences (placeholder)

## 3. Core Features (Wave 1)
- [x] Visual foundation and design system
- [x] Splash screen with brand animation
- [x] Welcome screen
- [x] Login with simulated validation
- [x] Password recovery multi-step flow
- [x] First access / activation multi-step flow
- [x] Access success confirmation
- [x] Authenticated app shell with bottom navigation
- [x] Temporary home foundation
- [x] Placeholder screens for undeveloped modules
- [x] All interaction states (loading, error, offline, success, empty)
- [x] Demo state preview mechanism

## 4. Data Model Design
No database changes in Wave 1. All data uses local fixtures.

Existing Supabase tables (not modified):
- tenants, tenant_members, residents, properties, water_meters, meter_readings
- tariff_plans, tariff_ranges, receivable_origins, receivables
- banks, bank_agreements, billing_titles, bank_files, bank_return_events
- payments, installment_agreements, installment_items, billing_documents
- system_events, tickets, ticket_comments, audit_logs
- expense_categories, expenses, bank_file_logs

## 5. Backend / Third-party Integration Plan
- Supabase: Connected (xcuxcqbctfjgccsdqwgl.supabase.co). No real integration in Wave 1.
- No Shopify, Stripe, or other integrations needed.

## 6. Development Phase Plan

### Wave 1: Visual Foundation and Entry Experience (current)
- Goal: Premium visual foundation and complete simulated entry journey
- Deliverable: All entry screens, authenticated shell, reusable components, fixtures

### Wave 2: Home Module
- Goal: Complete home dashboard with real data display
- Deliverable: Full home screen with consumption charts, invoice list, notices

### Wave 3: Consumption Module
- Goal: Water consumption history and visualization
- Deliverable: Consumption charts, history, meter reading display

### Wave 4: Invoices and Payments
- Goal: Invoice management and payment documents
- Deliverable: Invoice list, detail, payment documents, receipts

### Wave 5: Support and Profile
- Goal: Tickets, profile management, preferences
- Deliverable: Support ticket system, profile editing, app preferences