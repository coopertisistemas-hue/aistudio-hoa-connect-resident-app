import type { FinancialOverview, InvoiceData, BoletoInfo, PixInfo, PaymentRecord, ReceiptData } from '@/fixtures/types';
import { getFinancialOverview, getInvoiceById, getBoletoInfo, getPixInfo, getPaymentsForResidence, getPaymentById, getReceiptData, activeFinanceScenario } from '@/fixtures/financialScenarios';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchFinancialOverview(residenceId: string): Promise<FinancialOverview> {
  await delay(700);
  if (activeFinanceScenario === 'offline') throw new Error('OFFLINE');
  return getFinancialOverview();
}

export async function fetchInvoiceDetail(invoiceId: string): Promise<InvoiceData | null> {
  await delay(400);
  if (activeFinanceScenario === 'offline') throw new Error('OFFLINE');
  if (activeFinanceScenario === 'partial_list_error' && invoiceId === 'inv-2026-04') throw new Error('ITEM_ERROR');
  return getInvoiceById(invoiceId) || null;
}

export async function fetchBoletoInfo(invoiceId: string): Promise<BoletoInfo | null> {
  await delay(500);
  if (activeFinanceScenario === 'offline') throw new Error('OFFLINE');
  if (activeFinanceScenario === 'document_error') throw new Error('DOCUMENT_ERROR');
  return getBoletoInfo(invoiceId);
}

export async function fetchPixInfo(invoiceId: string): Promise<PixInfo | null> {
  await delay(500);
  if (activeFinanceScenario === 'offline') throw new Error('OFFLINE');
  if (activeFinanceScenario === 'document_error') throw new Error('DOCUMENT_ERROR');
  return getPixInfo(invoiceId);
}

export async function fetchPaymentHistory(residenceId: string): Promise<PaymentRecord[]> {
  await delay(500);
  if (activeFinanceScenario === 'offline') throw new Error('OFFLINE');
  return getPaymentsForResidence(residenceId);
}

export async function fetchPaymentDetail(paymentId: string): Promise<PaymentRecord | null> {
  await delay(400);
  if (activeFinanceScenario === 'offline') throw new Error('OFFLINE');
  return getPaymentById(paymentId) || null;
}

export async function fetchReceiptData(paymentId: string): Promise<ReceiptData | null> {
  await delay(400);
  if (activeFinanceScenario === 'offline') throw new Error('OFFLINE');
  return getReceiptData(paymentId);
}