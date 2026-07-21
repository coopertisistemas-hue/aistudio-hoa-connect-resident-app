// Payment Provider Registry and Factory
// EPF-03 Payment Processing Platform
//
// Maps provider identifiers to adapter instances.
// Database records may describe providers and tenant configuration, but only
// adapters explicitly registered here may be instantiated. No dynamic code
// execution based on database values.

import type { PaymentProvider, PaymentProviderId, TenantProviderConfig } from './types.ts';
import { MockProvider } from './mock-provider.ts';
import { StubProvider } from './stub-provider.ts';

const providerFactories: Record<PaymentProviderId, () => PaymentProvider> = {
  mock: () => new MockProvider(),
  stripe: () => new StubProvider('stripe', 'Stripe', ['webhooks', 'refund', 'cancellation', 'payment_status_lookup']),
  asaas: () => new StubProvider('asaas', 'Asaas', ['pix_generation', 'boleto_generation', 'webhooks', 'refund', 'cancellation', 'payment_status_lookup']),
  efi: () => new StubProvider('efi', 'Efí', ['pix_generation', 'dynamic_qrcode', 'static_qrcode', 'boleto_generation', 'webhooks', 'refund', 'cancellation', 'payment_status_lookup', 'settlement_lookup']),
  sicoob: () => new StubProvider('sicoob', 'Sicoob', ['pix_generation', 'dynamic_qrcode', 'boleto_generation', 'webhooks', 'refund', 'cancellation', 'payment_status_lookup', 'settlement_lookup', 'cnab_support']),
  sicredi: () => new StubProvider('sicredi', 'Sicredi', ['pix_generation', 'dynamic_qrcode', 'boleto_generation', 'webhooks', 'refund', 'cancellation', 'payment_status_lookup', 'settlement_lookup', 'cnab_support']),
  bb: () => new StubProvider('bb', 'Banco do Brasil', ['pix_generation', 'dynamic_qrcode', 'boleto_generation', 'webhooks', 'refund', 'cancellation', 'payment_status_lookup', 'settlement_lookup', 'cnab_support']),
  caixa: () => new StubProvider('caixa', 'Caixa Econômica Federal', ['pix_generation', 'dynamic_qrcode', 'boleto_generation', 'webhooks', 'refund', 'cancellation', 'payment_status_lookup', 'settlement_lookup', 'cnab_support']),
  cnab: () => new StubProvider('cnab', 'CNAB File Integration', ['cnab_support', 'boleto_generation', 'settlement_lookup']),
};

/**
 * Returns the provider adapter instance for the given provider id.
 * Throws if the provider is not registered in code.
 */
export function getPaymentProvider(providerId: PaymentProviderId): PaymentProvider {
  const factory = providerFactories[providerId];
  if (!factory) {
    throw new Error(`Unknown payment provider: ${providerId}`);
  }
  return factory();
}

/**
 * Creates a provider adapter initialized with tenant configuration.
 */
export function createConfiguredProvider(config: TenantProviderConfig): PaymentProvider {
  const provider = getPaymentProvider(config.providerId);
  provider.initialize(config);
  return provider;
}

/**
 * Lists all registered provider ids.
 */
export function listRegisteredProviderIds(): PaymentProviderId[] {
  return Object.keys(providerFactories) as PaymentProviderId[];
}

/**
 * Checks if a provider id is registered in code.
 */
export function isProviderRegistered(providerId: string): providerId is PaymentProviderId {
  return providerId in providerFactories;
}
