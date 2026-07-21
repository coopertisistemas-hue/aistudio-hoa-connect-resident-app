// Payment Provider Abstraction — Types
// EPF-01 Financial Domain Foundation
//
// Provider-agnostic interface and shared types.
// No bank-specific logic is implemented here.
// Adapters throw NotImplementedError by default.

// ============================================================================
// Shared Domain Types
// ============================================================================

export type PaymentProviderId =
  | 'stripe'
  | 'asaas'
  | 'efi'
  | 'sicoob'
  | 'sicredi'
  | 'bb'
  | 'caixa'
  | 'cnab';

export interface CreatePixInput {
  invoiceId: string;
  amount: number;
  description: string;
  expiresInMinutes?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateBankSlipInput {
  invoiceId: string;
  amount: number;
  description: string;
  dueDate: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentIntentResult {
  id: string;
  providerPaymentIntentId: string;
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  // PIX
  pixCode?: string;
  pixQrBase64?: string;
  pixExpiresAt?: string;
  // Boleto
  boletoUrl?: string;
  boletoBarcode?: string;
  boletoDigitableLine?: string;
  boletoExpiresAt?: string;
  // Common
  checkoutUrl?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CancelResult {
  success: boolean;
  providerPaymentIntentId: string;
  status: 'cancelled';
}

export interface RefreshStatusResult {
  id: string;
  providerPaymentIntentId: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface ConfirmPaymentResult {
  success: boolean;
  transactionId: string;
  providerTransactionId: string;
  status: 'confirmed' | 'failed';
  failureReason?: string;
}

export interface ReceiptResult {
  receiptNumber: string;
  pdfUrl?: string;
  amount: number;
  issuedAt: string;
}

export interface BankSlipDownloadResult {
  pdfUrl: string;
  barcode: string;
  digitableLine: string;
}

export interface WebhookResult {
  success: boolean;
  eventId: string;
  eventType: string;
  processed: boolean;
  error?: string;
}

// ============================================================================
// Payment Provider Interface
// ============================================================================

export interface PaymentProvider {
  readonly providerId: PaymentProviderId;
  readonly displayName: string;

  createPix(input: CreatePixInput): Promise<PaymentIntentResult>;
  createBankSlip(input: CreateBankSlipInput): Promise<PaymentIntentResult>;

  cancel(paymentIntentId: string): Promise<CancelResult>;
  refreshStatus(paymentIntentId: string): Promise<RefreshStatusResult>;
  confirmPayment(paymentIntentId: string): Promise<ConfirmPaymentResult>;

  generateReceipt(transactionId: string): Promise<ReceiptResult>;

  downloadBankSlip(paymentIntentId: string): Promise<BankSlipDownloadResult>;
  copyBarcode(paymentIntentId: string): Promise<string>;
  copyPixCode(paymentIntentId: string): Promise<string>;

  receiveWebhook(payload: unknown): Promise<WebhookResult>;
}

// ============================================================================
// NotImplemented Error
// ============================================================================

export class NotImplementedError extends Error {
  constructor(providerName: string, methodName: string) {
    super(`${providerName}: ${methodName} is not implemented in EPF-01`);
    this.name = 'NotImplementedError';
  }
}
