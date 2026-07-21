// Finance Repository
// EPF-01 Financial Domain Foundation
//
// Abstract repository layer between the demo/mock services and Supabase.
// When Supabase becomes available, replace the demo imports with Supabase queries.
// Everything above this layer (services, hooks, pages) remains untouched.
// Consideration 11: Demo Services → Finance Repository → Finance Service → React Hooks

import type {
  InvoiceRecord,
  InvoiceItemRecord,
  InvoiceDetail,
  FinancialOverview,
  PaymentTransactionRecord,
  PaymentReceiptRecord,
  PaymentHistory,
  FinancialAdjustmentRecord,
  BillingAccountData,
  BillingCycleData,
} from './types';

// ============================================================================
// Repository Interface
// ============================================================================

export interface FinanceRepository {
  getFinancialOverview(residenceId: string): Promise<FinancialOverview>;
  getInvoiceDetail(invoiceId: string): Promise<InvoiceDetail>;
  getPaymentHistory(residenceId: string): Promise<PaymentHistory>;
  getBillingAccount(residenceId: string): Promise<BillingAccountData | null>;
  getActiveBillingCycle(billingAccountId: string): Promise<BillingCycleData | null>;
  getInvoices(billingAccountId: string): Promise<InvoiceRecord[]>;
  getInvoiceItems(invoiceId: string): Promise<InvoiceItemRecord[]>;
  getPaymentTransactions(invoiceId: string): Promise<PaymentTransactionRecord[]>;
  getPaymentReceipts(invoiceId: string): Promise<PaymentReceiptRecord[]>;
  getFinancialAdjustments(invoiceId: string): Promise<FinancialAdjustmentRecord[]>;
}

// ============================================================================
// Demo Repository (current mock — to be replaced when Supabase is ready)
// ============================================================================

import { fetchFinancialOverview } from '@/demo/financeService';

class DemoFinanceRepository implements FinanceRepository {
  async getFinancialOverview(residenceId: string): Promise<FinancialOverview> {
    const demoOverview = await fetchFinancialOverview(residenceId);
    return demoOverview as unknown as FinancialOverview;
  }

  async getInvoiceDetail(_invoiceId: string): Promise<InvoiceDetail> {
    throw new Error('DemoFinanceRepository.getInvoiceDetail is not implemented — use feature flag to enable Supabase');
  }

  async getPaymentHistory(_residenceId: string): Promise<PaymentHistory> {
    throw new Error('DemoFinanceRepository.getPaymentHistory is not implemented — use feature flag to enable Supabase');
  }

  async getBillingAccount(_residenceId: string): Promise<BillingAccountData | null> {
    throw new Error('DemoFinanceRepository.getBillingAccount is not implemented — use feature flag to enable Supabase');
  }

  async getActiveBillingCycle(_billingAccountId: string): Promise<BillingCycleData | null> {
    throw new Error('DemoFinanceRepository.getActiveBillingCycle is not implemented — use feature flag to enable Supabase');
  }

  async getInvoices(_billingAccountId: string): Promise<InvoiceRecord[]> {
    throw new Error('DemoFinanceRepository.getInvoices is not implemented — use feature flag to enable Supabase');
  }

  async getInvoiceItems(_invoiceId: string): Promise<InvoiceItemRecord[]> {
    throw new Error('DemoFinanceRepository.getInvoiceItems is not implemented — use feature flag to enable Supabase');
  }

  async getPaymentTransactions(_invoiceId: string): Promise<PaymentTransactionRecord[]> {
    throw new Error('DemoFinanceRepository.getPaymentTransactions is not implemented — use feature flag to enable Supabase');
  }

  async getPaymentReceipts(_invoiceId: string): Promise<PaymentReceiptRecord[]> {
    throw new Error('DemoFinanceRepository.getPaymentReceipts is not implemented — use feature flag to enable Supabase');
  }

  async getFinancialAdjustments(_invoiceId: string): Promise<FinancialAdjustmentRecord[]> {
    throw new Error('DemoFinanceRepository.getFinancialAdjustments is not implemented — use feature flag to enable Supabase');
  }
}

// ============================================================================
// Factory — returns the appropriate repository based on environment
// ============================================================================

let currentRepository: FinanceRepository = new DemoFinanceRepository();

export function getFinanceRepository(): FinanceRepository {
  return currentRepository;
}

export function setFinanceRepository(repo: FinanceRepository): void {
  currentRepository = repo;
}
