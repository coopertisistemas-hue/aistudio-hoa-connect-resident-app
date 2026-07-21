# Financial Domain Entity Relationships

## Domain Chain

```
Tenant (Association)
    ↓
Residence (Property)
    ↓
Resident (Profile linked via residence_members)
    ↓
Billing Account (Financial identity of residence)
    ↓
Billing Cycle (Period: monthly, bimonthly, custom)
    ↓
Invoice (Core financial document)
    ├── Invoice Items (Line items — water, maintenance, fees)
    │   └── Category: generic, no hardcoded assumptions
    ├── Payment Intent (Provider-agnostic PIX/Boleto/Card)
    │   └── Payment Method (Saved payment methods)
    ├── Payment Transaction (Actual payment event)
    │   └── Payment Receipt (Immutable)
    └── Financial Adjustments (Discounts, interest, fines)
```

## Payment Provider Flow (Consideration 04)

```
                          ┌─────────────┐
                          │   Provider   │  (Stripe, Asaas, etc.)
                          └──────┬──────┘
                                 │ Webhook
                                 ↓
                    ┌─────────────────────────┐
                    │  Payment Provider Event  │  (Immutable log)
                    └───────────┬─────────────┘
                                │ Validation
                                ↓
                    ┌─────────────────────────┐
                    │    Financial Domain      │
                    │  (Business rules)        │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ↓           ↓           ↓
              Invoice      Ledger      Financial
              Status       Entry       Audit Log

Providers NEVER modify business entities directly.
The Financial Domain is the single source of truth.
```

## Ledger-First Architecture (Consideration 03)

```
Any Financial Event
        │
        ↓
┌───────────────────┐
│   Ledger Entry    │  ← Immutable, double-entry
│   (source of     │
│    truth)         │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Dashboard       │  ← Consumes ledger, NOT invoice aggregates
│   Reports         │
│   Reconciliation   │
└───────────────────┘

No balance is ever calculated exclusively from invoices.
```

## Invoice Lifecycle State Machine (Consideration 06)

```
                    ┌──────────┐
                    │  Draft   │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ↓          ↓          ↓
        ┌─────────┐  ┌─────────┐  ┌───────────┐
        │ Issued  │  │Cancelled│  │ Replaced  │
        └────┬────┘  └─────────┘  └───────────┘
             │
             ↓
        ┌─────────┐
        │  Open   │
        └────┬────┘
             │
      ┌──────┼──────┐
      │      │      │
      ↓      ↓      ↓
┌──────────┐ ┌──────────┐ ┌───────────┐
│ Payment  │ │ Overdue  │ │Cancelled  │
│ Pending  │ └─────┬────┘ └───────────┘
└─────┬────┘       │
      │      ┌─────┼──────┐
      │      │     │      │
      ↓      ↓     ↓      ↓
┌────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐
│  Paid  │ │Renegotiated│ │ Replaced │ │Written Off│
└────────┘ └─────┬─────┘ └───────────┘ └───────────┘
                 │
                 ↓
           ┌─────────┐
           │ Issued  │ (back to start)
           └─────────┘

Terminal states: Cancelled, Written Off, Paid
```

## Foreign Key Relationship Map

```
billing_accounts
  ├── FK → tenants(id)
  └── FK → properties(id)

billing_cycles
  ├── FK → tenants(id)
  └── FK → billing_accounts(id)

invoices
  ├── FK → tenants(id)
  ├── FK → billing_accounts(id)
  ├── FK → billing_cycles(id)          [nullable]
  └── FK → replaced_by_invoice_id      [self-reference]

invoice_items
  ├── FK → tenants(id)
  └── FK → invoices(id) ON DELETE CASCADE

payment_intents
  ├── FK → tenants(id)
  └── FK → invoices(id)

payment_methods
  ├── FK → tenants(id)
  └── FK → billing_accounts(id) ON DELETE CASCADE

payment_transactions
  ├── FK → tenants(id)
  ├── FK → invoices(id)
  └── FK → payment_intents(id) ON DELETE SET NULL

payment_receipts
  ├── FK → tenants(id)
  ├── FK → payment_transactions(id)
  └── FK → invoices(id)

payment_provider_events
  └── FK → tenants(id)

ledger_entries
  └── FK → tenants(id)

financial_adjustments
  ├── FK → tenants(id)
  └── FK → invoices(id) ON DELETE CASCADE

financial_audit_log
  ├── FK → tenants(id)
  └── FK → actor_profile_id → profiles(id) ON DELETE SET NULL
```

## Reserved Fields (Consideration 14 — Future CNAB)

```
invoices
  ├── bank_reference           ← CNAB future
  ├── remittance_number        ← CNAB future
  ├── return_number            ← CNAB future
  ├── nosso_numero             ← CNAB future
  ├── convenio                 ← CNAB future
  └── wallet_code              ← CNAB future
```

## Reserved Notification Hooks (Consideration 09)

```
Future events (not implemented):
  ├── invoice_issued           → Push/email notification
  ├── invoice_due_soon         → Reminder notification
  ├── invoice_overdue          → Escalation notification
  ├── payment_confirmed        → Confirmation notification
  └── receipt_generated        → Receipt available notification

Reserved fields on invoices:
  ├── last_reminder_sent_at
  └── reminder_count
```

## Collector Integration Contract (Consideration 15)

```
Future chain (not implemented in EPF-01):
  Collector App
      ↓
  Meter Reading
      ↓
  Consumption (Water Billing Program)
      ↓
  Billing (creates invoice_items with category = 'water')
      ↓
  Invoice (calculated from readings + tariffs)
      ↓
  Payment (existing EPF-01 infrastructure)
      ↓
  Receipt (existing EPF-01 infrastructure)

No redesign required when collector is integrated.
```

## Tenant Multi-Tenancy

```
Every table contains tenant_id.
RLS enforces tenant isolation.
Billing accounts are tenant-scoped (UNIQUE tenant_id, property_id).
Doc numbers are tenant-scoped (UNIQUE tenant_id, document_number).
All queries are implicitly filtered by tenant.
```
