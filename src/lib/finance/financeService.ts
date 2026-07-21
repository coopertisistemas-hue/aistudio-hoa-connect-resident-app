// Finance Service
// EPF-01 Financial Domain Foundation
//
// Service layer that consumes the Finance Repository.
// This layer adds business logic, validation, and error handling.
// Consideration 11: Demo Services → Finance Repository → Finance Service → React Hooks
//
// Current implementation: delegates to demo services (existing mock layer)
// Future: delegates to Supabase repository

import type { FinancialOverview, InvoiceDetail, PaymentHistory } from './types';
import { getFinanceRepository } from './repository';

export async function getFinancialOverview(residenceId: string): Promise<FinancialOverview> {
  const repo = getFinanceRepository();
  return repo.getFinancialOverview(residenceId);
}

export async function getInvoiceDetail(invoiceId: string): Promise<InvoiceDetail> {
  const repo = getFinanceRepository();
  return repo.getInvoiceDetail(invoiceId);
}

export async function getPaymentHistory(residenceId: string): Promise<PaymentHistory> {
  const repo = getFinanceRepository();
  return repo.getPaymentHistory(residenceId);
}
