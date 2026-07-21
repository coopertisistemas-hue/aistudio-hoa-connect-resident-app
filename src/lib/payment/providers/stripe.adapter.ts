// Stripe Payment Provider Adapter
// EPF-01 Financial Domain Foundation
//
// DO NOT IMPLEMENT — this is a stub for future EPF integration.
// No Stripe SDK integration. No API calls. No payment processing.

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

class StripeAdapter implements PaymentProvider {
  readonly providerId = 'stripe' as const;
  readonly displayName = 'Stripe';

  async createPix(_input: CreatePixInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Stripe', 'createPix');
  }

  async createBankSlip(_input: CreateBankSlipInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError('Stripe', 'createBankSlip');
  }

  async cancel(_paymentIntentId: string): Promise<CancelResult> {
    throw new NotImplementedError('Stripe', 'cancel');
  }

  async refreshStatus(_paymentIntentId: string): Promise<RefreshStatusResult> {
    throw new NotImplementedError('Stripe', 'refreshStatus');
  }

  async confirmPayment(_paymentIntentId: string): Promise<ConfirmPaymentResult> {
    throw new NotImplementedError('Stripe', 'confirmPayment');
  }

  async generateReceipt(_transactionId: string): Promise<ReceiptResult> {
    throw new NotImplementedError('Stripe', 'generateReceipt');
  }

  async downloadBankSlip(_paymentIntentId: string): Promise<BankSlipDownloadResult> {
    throw new NotImplementedError('Stripe', 'downloadBankSlip');
  }

  async copyBarcode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Stripe', 'copyBarcode');
  }

  async copyPixCode(_paymentIntentId: string): Promise<string> {
    throw new NotImplementedError('Stripe', 'copyPixCode');
  }

  async receiveWebhook(_payload: unknown): Promise<WebhookResult> {
    throw new NotImplementedError('Stripe', 'receiveWebhook');
  }
}

export const stripeAdapter = new StripeAdapter();
