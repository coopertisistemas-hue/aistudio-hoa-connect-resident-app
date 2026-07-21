// Financial Domain TypeScript Types
// EPF-01 Financial Domain Foundation
//
// Mirrors the database schema in resident.financial_* tables.
// All types are provider-agnostic and multi-tenant ready.

// ============================================================================
// Enums
// ============================================================================

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'open'
  | 'payment_pending'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'replaced'
  | 'renegotiated'
  | 'written_off';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'partially_confirmed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'under_review'
  | 'not_reconciled'
  | 'cancelled';

export type PaymentMethodType =
  | 'pix'
  | 'boleto'
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'cash'
  | 'manual'
  | 'other';

export type FinancialEventType =
  | 'invoice_created'
  | 'invoice_issued'
  | 'invoice_sent'
  | 'invoice_cancelled'
  | 'invoice_replaced'
  | 'invoice_renegotiated'
  | 'invoice_written_off'
  | 'reminder_sent'
  | 'payment_started'
  | 'payment_processing'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'payment_refunded'
  | 'payment_partially_refunded'
  | 'webhook_received'
  | 'adjustment_applied'
  | 'discount_applied'
  | 'interest_applied'
  | 'fine_applied'
  | 'credit_applied'
  | 'receipt_generated'
  | 'status_updated'
  | 'manual_settlement'
  | 'billing_cycle_opened'
  | 'billing_cycle_closed';

export type AdjustmentCategory =
  | 'discount'
  | 'interest'
  | 'fine'
  | 'credit'
  | 'debit'
  | 'correction'
  | 'other';

export type BillingAccountStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'closed';

export type BillingCycleStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'cancelled';

export type InvoiceItemCategory =
  | 'water'
  | 'association_fee'
  | 'maintenance'
  | 'reserve_fund'
  | 'penalty'
  | 'adjustment'
  | 'donation'
  | 'other_services';

// ============================================================================
// Domain Entities
// ============================================================================

export interface BillingAccountData {
  id: string;
  tenantId: string;
  propertyId: string;
  status: BillingAccountStatus;
  externalReference?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface BillingCycleData {
  id: string;
  tenantId: string;
  billingAccountId: string;
  cycleStart: string;
  cycleEnd: string;
  dueDate: string;
  referencePeriod: string;
  status: BillingCycleStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  updatedByProfileId?: string;
}

export interface InvoiceRecord {
  id: string;
  tenantId: string;
  billingAccountId: string;
  billingCycleId?: string;
  documentNumber: string;
  amount: number;
  dueDate: string;
  issuedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  status: InvoiceStatus;
  replacedByInvoiceId?: string;
  renegotiationReference?: string;
  writtenOffReason?: string;
  // CNAB reserved
  bankReference?: string;
  remittanceNumber?: string;
  returnNumber?: string;
  nossoNumero?: string;
  convenio?: string;
  walletCode?: string;
  // Notifications
  lastReminderSentAt?: string;
  reminderCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  updatedByProfileId?: string;
  deletedAt?: string;
}

export interface InvoiceItemRecord {
  id: string;
  tenantId: string;
  invoiceId: string;
  description: string;
  category: InvoiceItemCategory;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PaymentIntentRecord {
  id: string;
  tenantId: string;
  invoiceId: string;
  amount: number;
  status: PaymentStatus;
  provider: string;
  methodType: PaymentMethodType;
  providerPaymentIntentId?: string;
  providerCheckoutUrl?: string;
  // PIX
  providerPixCode?: string;
  providerPixQrBase64?: string;
  // Boleto
  providerBoletoUrl?: string;
  providerBoletoBarcode?: string;
  providerBoletoDigitableLine?: string;
  // Provider configuration and reconciliation
  providerConfigId?: string;
  reconciliationId?: string;
  rawProviderResponse?: Record<string, unknown>;
  // Lifecycle
  expiresAt?: string;
  failureReason?: string;
  attemptCount: number;
  lastAttemptAt?: string;
  idempotencyKey?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  updatedByProfileId?: string;
}

export interface PaymentMethodRecord {
  id: string;
  tenantId: string;
  billingAccountId: string;
  provider: string;
  providerPaymentMethodId?: string;
  methodType: PaymentMethodType;
  displayName: string;
  isDefault: boolean;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PaymentTransactionRecord {
  id: string;
  tenantId: string;
  invoiceId: string;
  paymentIntentId?: string;
  amount: number;
  status: PaymentStatus;
  provider: string;
  providerConfigId?: string;
  providerTransactionId?: string;
  paymentMethodType: PaymentMethodType;
  paidAt?: string;
  settlementDate?: string;
  reconciliationId?: string;
  rawProviderResponse?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  updatedByProfileId?: string;
}

export interface PaymentReceiptRecord {
  id: string;
  tenantId: string;
  paymentTransactionId: string;
  invoiceId: string;
  receiptNumber: string;
  amountPaid: number;
  issuedAt: string;
  pdfUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PaymentProviderEventRecord {
  id: string;
  tenantId: string;
  provider: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
  processedAt?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LedgerEntryRecord {
  id: string;
  tenantId: string;
  entryDate: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  entityType?: string;
  entityId?: string;
  referenceDocument?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FinancialAdjustmentRecord {
  id: string;
  tenantId: string;
  invoiceId: string;
  category: AdjustmentCategory;
  description: string;
  amount: number;
  percentage?: number;
  appliedByProfileId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialAuditEntry {
  id: string;
  tenantId: string;
  actorProfileId?: string;
  action: FinancialEventType;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ============================================================================
// Aggregated Views (for frontend consumption)
// ============================================================================

export interface FinancialOverview {
  accountStatus: AccountStatus;
  nextDueInvoice: InvoiceRecord | null;
  overdueAmount: number;
  openInvoicesCount: number;
  paidThisYear: number;
  billingAccount: BillingAccountData;
  activeBillingCycle: BillingCycleData | null;
}

export type AccountStatus =
  | 'tudo_em_dia'
  | 'vencimento_proximo'
  | 'pendente'
  | 'atrasado'
  | 'sob_analise'
  | 'sem_faturas';

export interface InvoiceDetail {
  invoice: InvoiceRecord;
  items: InvoiceItemRecord[];
  adjustments: FinancialAdjustmentRecord[];
  paymentIntents: PaymentIntentRecord[];
  transactions: PaymentTransactionRecord[];
  receipts: PaymentReceiptRecord[];
}

export interface PaymentHistory {
  transactions: PaymentTransactionRecord[];
  receipts: PaymentReceiptRecord[];
}
