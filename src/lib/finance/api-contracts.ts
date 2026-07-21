// Finance API Contracts
// EPF-01 Financial Domain Foundation
//
// Typed request/response shapes for future Edge Functions.
// Not yet implemented — these are contracts for the Supabase Edge Function layer.

import type {
  InvoiceRecord,
  InvoiceItemRecord,
  InvoiceDetail,
  PaymentIntentRecord,
  PaymentTransactionRecord,
  PaymentReceiptRecord,
  FinancialAdjustmentRecord,
  FinancialAuditEntry,
  LedgerEntryRecord,
  BillingAccountData,
  BillingCycleData,
  FinancialOverview,
  PaymentHistory,
  InvoiceStatus,
  PaymentStatus,
} from './types';

// ============================================================================
// Response Envelope (follows _shared/http.ts pattern)
// ============================================================================

export interface ResponseEnvelope<T> {
  data: T | null;
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  } | null;
  meta: {
    requestId: string;
    generatedAt: string;
  };
}

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'TEMPORARY_UNAVAILABLE'
  | 'INTERNAL_ERROR';

// ============================================================================
// Resident Financial Endpoints (GET)
// ============================================================================

export interface InvoiceListRequest {
  residenceId: string;
  status?: InvoiceStatus;
  page?: number;
  limit?: number;
}

export interface InvoiceListResponse {
  invoices: InvoiceRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface InvoiceDetailResponse {
  invoice: InvoiceRecord;
  items: InvoiceItemRecord[];
  adjustments: FinancialAdjustmentRecord[];
}

export interface PaymentHistoryResponse {
  transactions: PaymentTransactionRecord[];
  receipts: PaymentReceiptRecord[];
  total: number;
}

export interface ReceiptResponse {
  receipt: PaymentReceiptRecord;
  transaction: PaymentTransactionRecord;
  invoice: InvoiceRecord;
}

export interface FinancialOverviewResponse {
  overview: FinancialOverview;
}

// ============================================================================
// Payment Intent Endpoints (POST)
// ============================================================================

export interface CreatePaymentIntentRequest {
  invoiceId: string;
  method: 'pix' | 'boleto' | 'credit_card';
  amount?: number; // defaults to invoice amount
}

export interface CreatePaymentIntentResponse {
  paymentIntent: PaymentIntentRecord;
}

export interface PaymentIntentDetailResponse {
  paymentIntent: PaymentIntentRecord;
  invoice: InvoiceRecord;
}

// ============================================================================
// Webhook Endpoints (POST)
// ============================================================================

export interface WebhookRequest {
  provider: string;
  payload: unknown;
}

export interface WebhookResponse {
  success: boolean;
  eventId: string;
  processed: boolean;
}

// ============================================================================
// Admin Endpoints
// ============================================================================

export interface AdminInvoiceListRequest {
  tenantId: string;
  status?: InvoiceStatus;
  billingAccountId?: string;
  billingCycleId?: string;
  page?: number;
  limit?: number;
}

export interface AdminInvoiceListResponse {
  invoices: InvoiceRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface ManualSettlementRequest {
  invoiceId: string;
  amount: number;
  paymentMethodType: string;
  notes?: string;
}

export interface ManualSettlementResponse {
  transaction: PaymentTransactionRecord;
  invoice: InvoiceRecord;
}

export interface CreateAdjustmentRequest {
  invoiceId: string;
  category: 'discount' | 'interest' | 'fine' | 'credit' | 'debit' | 'correction' | 'other';
  description: string;
  amount: number;
  percentage?: number;
}

export interface CreateAdjustmentResponse {
  adjustment: FinancialAdjustmentRecord;
  invoice: InvoiceRecord;
}

export interface CreateBillingCycleRequest {
  tenantId: string;
  cycleStart: string;
  cycleEnd: string;
  dueDate: string;
  referencePeriod: string;
}

export interface CreateBillingCycleResponse {
  billingCycle: BillingCycleData;
}

export interface LedgerReportRequest {
  tenantId: string;
  startDate: string;
  endDate: string;
}

export interface LedgerReportResponse {
  entries: LedgerEntryRecord[];
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
}

export interface AuditLogRequest {
  tenantId: string;
  entityType?: string;
  entityId?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  entries: FinancialAuditEntry[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// Billing Account Management
// ============================================================================

export interface CreateBillingAccountRequest {
  tenantId: string;
  propertyId: string;
  externalReference?: string;
}

export interface CreateBillingAccountResponse {
  billingAccount: BillingAccountData;
}

export interface UpdateBillingAccountRequest {
  status?: string;
  externalReference?: string;
}
