// Banco do Brasil Payment Provider Adapter
// EPF-01 Financial Domain Foundation
//
// DO NOT IMPLEMENT — this is a stub for future EPF integration.

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

class BBAdapter implements PaymentProvider {
  readonly providerId = 'bb' as const;
  readonly displayName = 'Banco do Brasil';

  async createPix(_input: CreatePixInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Banco do Brasil', 'createPix');
  }

  async createBankSlip(_input: CreateBankSlipInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Banco do Brasil', 'createBankSlip');
  }

  async cancel(_paymentIntentId: string): Promise<CancelResult> {
    throw new NotImplementedError('Banco do Brasil', 'cancel');
  }

  async refreshStatus(_paymentIntentId: string): Promise<RefreshStatusResult> {
    throw new NotImplementedError('Banco do Brasil', 'refreshStatus');
  }

  async confirmPayment(_paymentIntentId: string): Promise<ConfirmPaymentResult> {
    throw new NotImplementedError('Banco do Brasil', 'confirmPayment');
  }

  async generateReceipt(_transactionId: string): Promise<ReceiptResult> {
    throw new NotImplementedError('Banco do Brasil', 'generateReceipt');
  }

  async downloadBankSlip(_paymentIntentId: string): Promise<BankSlipDownloadResult> {
    throw new NotImplementedError('Banco do Brasil', 'downloadBankSlip');
  }

  async copyBarcode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Banco do Brasil', 'copyBarcode');
  }

  async copyPixCode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Banco do Brasil', 'copyPixCode');
  }

  async receiveWebhook(_payload: unknown): Promise<WebhookResult> {
    throw new NotImplementedError('Banco do Brasil', 'receiveWebhook');
  }
}

export const bbAdapter = new BBAdapter();
