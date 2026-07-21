// Admin Finance API Contracts
// EPF-01 Financial Domain Foundation
//
// Typed request/response shapes for admin-specific finance operations.
// These contracts define the shape of the admin Edge Function API.

import type {
  InvoiceRecord,
  InvoiceItemRecord,
  PaymentTransactionRecord,
  PaymentReceiptRecord,
  FinancialAdjustmentRecord,
  FinancialAuditEntry,
  LedgerEntryRecord,
  BillingAccountData,
  BillingCycleData,
  BillingCycleStatus,
  InvoiceStatus,
  PaymentStatus,
  AdjustmentCategory,
} from '../types';
import type { ResponseEnvelope } from '../api-contracts';

// ============================================================================
// Admin Financial Dashboard
// ============================================================================

export interface AdminDashboardResponse {
  tenantId: string;
  period: string;
  // Ledger-driven (Consideration 10)
  totalRevenue: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  totalWrittenOff: number;
  // Counts
  openInvoicesCount: number;
  overdueInvoicesCount: number;
  paidInvoicesCount: number;
  // Trends
  collectionRate: number; // percentage
  overdueRate: number; // percentage
  // Period-over-period
  previousPeriodRevenue: number;
  revenueChangePercent: number;
}

// ============================================================================
// Admin Operations
// ============================================================================

export interface AdminCreateInvoiceRequest {
  billingAccountId: string;
  billingCycleId?: string;
  dueDate: string;
  items: AdminInvoiceItemInput[];
  metadata?: Record<string, unknown>;
}

export interface AdminInvoiceItemInput {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder?: number;
}

export interface AdminCreateInvoiceResponse {
  invoice: InvoiceRecord;
  items: InvoiceItemRecord[];
}

export interface AdminCancelInvoiceRequest {
  invoiceId: string;
  reason?: string;
}

export interface AdminCancelInvoiceResponse {
  invoice: InvoiceRecord;
  previousStatus: InvoiceStatus;
}

export interface AdminReplaceInvoiceRequest {
  invoiceId: string;
  items: AdminInvoiceItemInput[];
  dueDate?: string;
}

export interface AdminReplaceInvoiceResponse {
  replacedInvoice: InvoiceRecord;
  newInvoice: InvoiceRecord;
  items: InvoiceItemRecord[];
}

export interface AdminUpdateBillingCycleRequest {
  billingCycleId: string;
  status: BillingCycleStatus;
}

export interface AdminUpdateBillingCycleResponse {
  billingCycle: BillingCycleData;
}

// ============================================================================
// Financial Reports
// ============================================================================

export interface InvoiceSummaryReport {
  tenantId: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  summary: {
    totalIssued: number;
    totalAmount: number;
    totalPaid: number;
    totalOverdue: number;
    totalCancelled: number;
    totalWrittenOff: number;
    collectedAmount: number;
    outstandingAmount: number;
  };
  byStatus: Record<InvoiceStatus, { count: number; amount: number }>;
  byCategory: Record<string, { count: number; amount: number }>;
}

export interface CollectionReport {
  tenantId: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  totalCollected: number;
  totalExpected: number;
  collectionRate: number;
  byPaymentMethod: Record<string, { count: number; amount: number }>;
  monthlyBreakdown: Array<{
    month: string;
    collected: number;
    expected: number;
    rate: number;
  }>;
}

export interface AgingReport {
  tenantId: string;
  generatedAt: string;
  asOf: string;
  buckets: Array<{
    label: string;       // '0-30', '31-60', '61-90', '90+'
    minDays: number;
    maxDays: number | null;
    invoiceCount: number;
    totalAmount: number;
  }>;
  totalOverdue: number;
  totalOverdueCount: number;
}
