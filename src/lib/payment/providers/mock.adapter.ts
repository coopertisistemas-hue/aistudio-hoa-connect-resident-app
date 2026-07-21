// Mock Payment Provider Adapter — Frontend
// EPF-03 Payment Processing Platform
//
// Mirrors the backend mock provider for UI testing and certification.

import {
  NotImplementedError,
  type PaymentProvider,
  type CreatePixInput,
  type CreateBankSlipInput,
  type PaymentIntentResult,
  type CancelResult,
  type RefreshStatusResult,
  type ConfirmPaymentResult,
  type ReceiptResult,
  type BankSlipDownloadResult,
  type WebhookResult,
} from './types';

class MockAdapter implements PaymentProvider {
  readonly providerId = 'mock' as const;
  readonly displayName = 'Mock Provider (Certification)';

  async createPix(input: CreatePixInput): Promise<PaymentIntentResult> {
    const reconciliationId = `rec-${input.invoiceId.slice(0, 8)}-${Date.now().toString(36)}`;
    return {
      id: `mock-pix-${reconciliationId}`,
      providerPaymentIntentId: `mock-pix-${reconciliationId}`,
      status: 'pending',
      pixCode: `0002012633${reconciliationId}520400005303986540${input.amount.toFixed(2)}5802BR59${input.description.length}${input.description}6009CURITIBA62070503${reconciliationId.slice(0, 25)}6304ABCD`,
      pixQrBase64: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgZmlsbD0iYmxhY2siLz48dGV4dCB4PSIxMDAiIHk9IjE4MCIgZm9udC1zaXplPSIxMCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TU9DSyBRUjwvdGV4dD48L3N2Zz4=',
      pixExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      reconciliationId,
      metadata: { provider: 'mock', method: 'pix' },
    };
  }

  async createBankSlip(input: CreateBankSlipInput): Promise<PaymentIntentResult> {
    const reconciliationId = `rec-${input.invoiceId.slice(0, 8)}-${Date.now().toString(36)}`;
    return {
      id: `mock-boleto-${reconciliationId}`,
      providerPaymentIntentId: `mock-boleto-${reconciliationId}`,
      status: 'pending',
      boletoUrl: `https://mock.hoa-connect.local/boleto/${reconciliationId}`,
      boletoBarcode: '81190000000000000000000000000000000000000000',
      boletoDigitableLine: '81190.00009 00000.000009 00000.000000 0 00000000000000',
      boletoExpiresAt: input.dueDate,
      reconciliationId,
      metadata: { provider: 'mock', method: 'boleto' },
    };
  }

  async cancel(paymentIntentId: string): Promise<CancelResult> {
    return { success: true, providerPaymentIntentId: paymentIntentId, status: 'cancelled' };
  }

  async refreshStatus(_paymentIntentId: string): Promise<RefreshStatusResult> {
    return { id: _paymentIntentId, providerPaymentIntentId: _paymentIntentId, status: 'confirmed' };
  }

  async confirmPayment(_paymentIntentId: string): Promise<ConfirmPaymentResult> {
    return { success: true, transactionId: `tx-${Date.now()}`, providerTransactionId: `mock-tx-${Date.now()}`, status: 'confirmed' };
  }

  async generateReceipt(_transactionId: string): Promise<ReceiptResult> {
    return {
      receiptNumber: `REC-${Date.now()}`,
      amount: 0,
      issuedAt: new Date().toISOString(),
    };
  }

  async downloadBankSlip(_paymentIntentId: string): Promise<BankSlipDownloadResult> {
    return {
      pdfUrl: 'https://mock.hoa-connect.local/boleto.pdf',
      barcode: '81190000000000000000000000000000000000000000',
      digitableLine: '81190.00009 00000.000009 00000.000000 0 00000000000000',
    };
  }

  async copyBarcode(_paymentIntentId: string): Promise<string> {
    return '81190000000000000000000000000000000000000000';
  }

  async copyPixCode(_paymentIntentId: string): Promise<string> {
    return `mock-pix-code-${_paymentIntentId}`;
  }

  async receiveWebhook(_payload: unknown): Promise<WebhookResult> {
    return { success: true, eventId: `evt-${Date.now()}`, eventType: 'payment.confirmed', processed: true };
  }
}

export const mockAdapter = new MockAdapter();
