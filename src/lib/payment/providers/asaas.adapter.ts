// Asaas Payment Provider Adapter
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

class AsaasAdapter implements PaymentProvider {
  readonly providerId = 'asaas' as const;
  readonly displayName = 'Asaas';

  async createPix(_input: CreatePixInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Asaas', 'createPix');
  }

  async createBankSlip(_input: CreateBankSlipInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Asaas', 'createBankSlip');
  }

  async cancel(_paymentIntentId: string): Promise<CancelResult> {
    throw new NotImplementedError('Asaas', 'cancel');
  }

  async refreshStatus(_paymentIntentId: string): Promise<RefreshStatusResult> {
    throw new NotImplementedError('Asaas', 'refreshStatus');
  }

  async confirmPayment(_paymentIntentId: string): Promise<ConfirmPaymentResult> {
    throw new NotImplementedError('Asaas', 'confirmPayment');
  }

  async generateReceipt(_transactionId: string): Promise<ReceiptResult> {
    throw new NotImplementedError('Asaas', 'generateReceipt');
  }

  async downloadBankSlip(_paymentIntentId: string): Promise<BankSlipDownloadResult> {
    throw new NotImplementedError('Asaas', 'downloadBankSlip');
  }

  async copyBarcode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Asaas', 'copyBarcode');
  }

  async copyPixCode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Asaas', 'copyPixCode');
  }

  async receiveWebhook(_payload: unknown): Promise<WebhookResult> {
    throw new NotImplementedError('Asaas', 'receiveWebhook');
  }
}

export const asaasAdapter = new AsaasAdapter();
