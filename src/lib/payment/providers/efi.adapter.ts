// Efí Payment Provider Adapter
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

class EfiAdapter implements PaymentProvider {
  readonly providerId = 'efi' as const;
  readonly displayName = 'Efí';

  async createPix(_input: CreatePixInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Efí', 'createPix');
  }

  async createBankSlip(_input: CreateBankSlipInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Efí', 'createBankSlip');
  }

  async cancel(_paymentIntentId: string): Promise<CancelResult> {
    throw new NotImplementedError('Efí', 'cancel');
  }

  async refreshStatus(_paymentIntentId: string): Promise<RefreshStatusResult> {
    throw new NotImplementedError('Efí', 'refreshStatus');
  }

  async confirmPayment(_paymentIntentId: string): Promise<ConfirmPaymentResult> {
    throw new NotImplementedError('Efí', 'confirmPayment');
  }

  async generateReceipt(_transactionId: string): Promise<ReceiptResult> {
    throw new NotImplementedError('Efí', 'generateReceipt');
  }

  async downloadBankSlip(_paymentIntentId: string): Promise<BankSlipDownloadResult> {
    throw new NotImplementedError('Efí', 'downloadBankSlip');
  }

  async copyBarcode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Efí', 'copyBarcode');
  }

  async copyPixCode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Efí', 'copyPixCode');
  }

  async receiveWebhook(_payload: unknown): Promise<WebhookResult> {
    throw new NotImplementedError('Efí', 'receiveWebhook');
  }
}

export const efiAdapter = new EfiAdapter();
