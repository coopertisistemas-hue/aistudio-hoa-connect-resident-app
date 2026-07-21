// Sicoob Payment Provider Adapter
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

class SicoobAdapter implements PaymentProvider {
  readonly providerId = 'sicoob' as const;
  readonly displayName = 'Sicoob';

  async createPix(_input: CreatePixInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Sicoob', 'createPix');
  }

  async createBankSlip(_input: CreateBankSlipInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Sicoob', 'createBankSlip');
  }

  async cancel(_paymentIntentId: string): Promise<CancelResult> {
    throw new NotImplementedError('Sicoob', 'cancel');
  }

  async refreshStatus(_paymentIntentId: string): Promise<RefreshStatusResult> {
    throw new NotImplementedError('Sicoob', 'refreshStatus');
  }

  async confirmPayment(_paymentIntentId: string): Promise<ConfirmPaymentResult> {
    throw new NotImplementedError('Sicoob', 'confirmPayment');
  }

  async generateReceipt(_transactionId: string): Promise<ReceiptResult> {
    throw new NotImplementedError('Sicoob', 'generateReceipt');
  }

  async downloadBankSlip(_paymentIntentId: string): Promise<BankSlipDownloadResult> {
    throw new NotImplementedError('Sicoob', 'downloadBankSlip');
  }

  async copyBarcode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Sicoob', 'copyBarcode');
  }

  async copyPixCode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Sicoob', 'copyPixCode');
  }

  async receiveWebhook(_payload: unknown): Promise<WebhookResult> {
    throw new NotImplementedError('Sicoob', 'receiveWebhook');
  }
}

export const sicoobAdapter = new SicoobAdapter();
