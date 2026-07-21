// Stub Payment Provider
// EPF-03 Payment Processing Platform
//
// Provider-ready adapter for real banking/fintech integrations.
// All operations throw NotImplementedError.

import type {
  CancelResult,
  CreateBoletoInput,
  CreatePixInput,
  PaymentIntentResult,
  PaymentProvider,
  PaymentProviderCapability,
  RefundInput,
  RefundResult,
  StatusLookupResult,
  TenantProviderConfig,
  WebhookPayload,
  WebhookValidationInput,
  WebhookValidationResult,
} from './types.ts';
import { PaymentProviderError } from './types.ts';

export class NotImplementedError extends PaymentProviderError {
  constructor(providerId: string, methodName: string) {
    super(providerId as never, 'NOT_IMPLEMENTED', `${methodName} is not implemented for provider ${providerId}`);
  }
}

export class StubProvider implements PaymentProvider {
  readonly providerId: string;
  readonly displayName: string;

  private capabilities: PaymentProviderCapability[];

  constructor(
    providerId: string,
    displayName: string,
    capabilities: PaymentProviderCapability[] = [],
  ) {
    this.providerId = providerId;
    this.displayName = displayName;
    this.capabilities = capabilities;
  }

  initialize(_config: TenantProviderConfig): void {
    // Stub does not need configuration
  }

  getCapabilities(): PaymentProviderCapability[] {
    return this.capabilities;
  }

  supportsCapability(capability: PaymentProviderCapability): boolean {
    return this.capabilities.includes(capability);
  }

  createPix(_input: CreatePixInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError(this.providerId, 'createPix');
  }

  createBoleto(_input: CreateBoletoInput): Promise<PaymentIntentResult> {
    throw new NotImplementedError(this.providerId, 'createBoleto');
  }

  cancel(_paymentIntentId: string): Promise<CancelResult> {
    throw new NotImplementedError(this.providerId, 'cancel');
  }

  refund(_input: RefundInput): Promise<RefundResult> {
    throw new NotImplementedError(this.providerId, 'refund');
  }

  lookupStatus(_params: {
    providerPaymentIntentId?: string;
    providerTransactionId?: string;
    reconciliationId?: string;
  }): Promise<StatusLookupResult> {
    throw new NotImplementedError(this.providerId, 'lookupStatus');
  }

  validateWebhook(_input: WebhookValidationInput): Promise<WebhookValidationResult> {
    throw new NotImplementedError(this.providerId, 'validateWebhook');
  }

  buildWebhookPayload(rawBody: unknown): WebhookPayload {
    const body = rawBody as Record<string, unknown>;
    return {
      eventId: String(body.event_id ?? body.eventId ?? `stub-${crypto.randomUUID()}`),
      eventType: String(body.event_type ?? body.eventType ?? 'unknown'),
      provider: this.providerId as never,
      timestamp: String(body.timestamp ?? new Date().toISOString()),
      raw: body,
    };
  }
}
