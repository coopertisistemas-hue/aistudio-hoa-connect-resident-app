// Payment API Contracts
// EPF-03 Payment Processing Platform
//
// Request/response shapes for Edge Functions.

import type { PaymentProviderId } from './providers/types';
import type { PaymentIntentRecord, PaymentMethodType } from '../finance/types';

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

export interface CreatePaymentIntentRequest {
  invoiceId: string;
  method: PaymentMethodType;
  amount?: number;
  providerConfigId?: string;
  environment?: 'sandbox' | 'production';
}

export interface CreatePaymentIntentResponse {
  paymentIntent: PaymentIntentRecord;
  providerResponse: {
    providerPaymentIntentId: string;
    status: string;
    amount: number;
    reconciliationId: string;
    pixCode?: string;
    pixQrBase64?: string;
    pixExpiresAt?: string;
    boletoUrl?: string;
    boletoBarcode?: string;
    boletoDigitableLine?: string;
    boletoExpiresAt?: string;
    expiresAt?: string;
    rawProviderResponse?: Record<string, unknown>;
  };
}

export interface CancelPaymentIntentRequest {
  paymentIntentId: string;
}

export interface RefundPaymentRequest {
  transactionId: string;
  amount?: number;
}

export interface WebhookReceiveRequest {
  provider: PaymentProviderId;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signatureHeader?: string;
  replayNonce?: string;
  replayTimestamp?: string;
  tenantId?: string;
  providerConfigId?: string;
}

export interface WebhookReceiveResponse {
  result: Record<string, unknown>;
  validation?: {
    valid: boolean;
    signatureStatus: string;
    replayStatus: string;
    payloadHash?: string;
    expectedSignature?: string;
  };
}

export interface ProviderConfig {
  id: string;
  tenantId: string;
  providerId: PaymentProviderId;
  environment: 'sandbox' | 'production';
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
  metadata?: Record<string, unknown>;
}

export interface UpsertProviderConfigRequest {
  id?: string;
  tenantId: string;
  providerId: PaymentProviderId;
  environment?: 'sandbox' | 'production';
  methodType: PaymentMethodType;
  isActive?: boolean;
  isDefault?: boolean;
  agreementNumber?: string;
  wallet?: string;
  portfolio?: string;
  bankAccount?: Record<string, unknown>;
  pixKeys?: Record<string, unknown>;
  credentials?: string;
  webhookSecret?: string;
  metadata?: Record<string, unknown>;
}

export interface ListProviderConfigsRequest {
  tenantId: string;
  providerId?: PaymentProviderId;
  methodType?: PaymentMethodType;
}

export interface ListProviderConfigsResponse {
  providers: Array<{
    id: string;
    displayName: string;
    isActive: boolean;
    metadata?: Record<string, unknown>;
  }>;
  capabilities: Array<{
    providerId: string;
    capability: PaymentProviderCapability;
  }>;
  configs: ProviderConfig[];
}

export interface CapabilitySummary {
  providerId: PaymentProviderId;
  capabilities: PaymentProviderCapability[];
  unsupported: PaymentProviderCapability[];
}
