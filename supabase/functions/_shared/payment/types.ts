// Payment Provider Abstraction — Edge Function Types
// EPF-03 Payment Processing Platform
//
// Provider-agnostic interface and shared domain types.
// No bank-specific logic is implemented here.

// ============================================================================
// Provider Identifiers
// ============================================================================

export type PaymentProviderId =
  | 'mock'
  | 'stripe'
  | 'asaas'
  | 'efi'
  | 'sicoob'
  | 'sicredi'
  | 'bb'
  | 'caixa'
  | 'cnab';

export type PaymentMethodType =
  | 'pix'
  | 'boleto'
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'cash'
  | 'manual'
  | 'other';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'partially_confirmed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'under_review'
  | 'not_reconciled'
  | 'cancelled';

export type PaymentProviderEnvironment = 'sandbox' | 'production';

export type PaymentProviderCapability =
  | 'pix_generation'
  | 'dynamic_qrcode'
  | 'static_qrcode'
  | 'boleto_generation'
  | 'webhooks'
  | 'refund'
  | 'cancellation'
  | 'payment_status_lookup'
  | 'settlement_lookup'
  | 'cnab_support';

// ============================================================================
// Provider Configuration
// ============================================================================

export interface TenantProviderConfig {
  id: string;
  tenantId: string;
  providerId: PaymentProviderId;
  environment: PaymentProviderEnvironment;
  methodType: PaymentMethodType;
  isActive: boolean;
  isDefault: boolean;
  agreementNumber?: string;
  wallet?: string;
  portfolio?: string;
  bankAccount?: Record<string, unknown>;
  pixKeys?: Record<string, unknown>;
  credentialsSecretId?: string;
  webhookSecretId?: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Input / Output Contracts
// ============================================================================

export interface CreatePixInput {
  invoiceId: string;
  amount: number;
  description: string;
  expiresInMinutes?: number;
  reconciliationId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateBoletoInput {
  invoiceId: string;
  amount: number;
  description: string;
  dueDate: string;
  reconciliationId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentIntentResult {
  providerPaymentIntentId: string;
  status: PaymentStatus;
  amount: number;
  reconciliationId: string;
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
  rawProviderResponse?: Record<string, unknown>;
}

export interface CancelResult {
  success: boolean;
  providerPaymentIntentId: string;
  status: 'cancelled';
}

export interface RefundInput {
  transactionId: string;
  providerTransactionId: string;
  amount?: number; // partial refund if less than original
  metadata?: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  providerRefundId: string;
  status: 'refunded' | 'partially_refunded';
  amount: number;
}

export interface StatusLookupResult {
  providerPaymentIntentId?: string;
  providerTransactionId?: string;
  status: PaymentStatus;
  amount?: number;
  paidAt?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookPayload {
  eventId: string;
  eventType: string;
  provider: PaymentProviderId;
  reconciliationId?: string;
  providerPaymentIntentId?: string;
  providerTransactionId?: string;
  status?: PaymentStatus;
  amount?: number;
  timestamp: string;
  nonce?: string;
  raw: Record<string, unknown>;
}

export interface WebhookValidationInput {
  payload: string;
  signatureHeader?: string;
  secret: string;
  nonce?: string;
  timestamp?: string;
}

export interface WebhookValidationResult {
  valid: boolean;
  signatureStatus: 'valid' | 'invalid' | 'missing' | 'not_applicable';
  replayStatus: 'accepted' | 'duplicate' | 'expired' | 'not_applicable';
  payloadHash?: string;
  expectedSignature?: string;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface PaymentProvider {
  readonly providerId: PaymentProviderId;
  readonly displayName: string;

  initialize(config: TenantProviderConfig): Promise<void> | void;

  getCapabilities(): PaymentProviderCapability[];

  supportsCapability(capability: PaymentProviderCapability): boolean;

  createPix(input: CreatePixInput): Promise<PaymentIntentResult>;

  createBoleto(input: CreateBoletoInput): Promise<PaymentIntentResult>;

  cancel(paymentIntentId: string): Promise<CancelResult>;

  refund(input: RefundInput): Promise<RefundResult>;

  lookupStatus(params: {
    providerPaymentIntentId?: string;
    providerTransactionId?: string;
    reconciliationId?: string;
  }): Promise<StatusLookupResult>;

  validateWebhook(input: WebhookValidationInput): Promise<WebhookValidationResult>;

  buildWebhookPayload(rawBody: unknown): WebhookPayload;
}

// ============================================================================
// Errors
// ============================================================================

export class PaymentProviderError extends Error {
  constructor(
    providerId: PaymentProviderId,
    public readonly code: string,
    message: string,
  ) {
    super(`${providerId}: ${code}: ${message}`);
    this.name = 'PaymentProviderError';
  }
}

export class CapabilityNotSupportedError extends PaymentProviderError {
  constructor(providerId: PaymentProviderId, capability: PaymentProviderCapability) {
    super(providerId, 'CAPABILITY_NOT_SUPPORTED', `Provider does not support capability: ${capability}`);
  }
}

export class NotImplementedError extends PaymentProviderError {
  constructor(providerId: PaymentProviderId, methodName: string) {
    super(providerId, 'NOT_IMPLEMENTED', `${methodName} is not implemented for this provider`);
  }
}
