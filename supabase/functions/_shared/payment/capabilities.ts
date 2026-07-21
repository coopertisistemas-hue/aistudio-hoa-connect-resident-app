// Payment Provider Capability Model
// EPF-03 Payment Processing Platform
//
// Runtime capability discovery and enforcement.

import type { PaymentProvider, PaymentProviderCapability, PaymentProviderId } from './types.ts';

/**
 * All declared capabilities in the platform.
 */
export const ALL_CAPABILITIES: PaymentProviderCapability[] = [
  'pix_generation',
  'dynamic_qrcode',
  'static_qrcode',
  'boleto_generation',
  'webhooks',
  'refund',
  'cancellation',
  'payment_status_lookup',
  'settlement_lookup',
  'cnab_support',
];

/**
 * Maps capabilities to human-readable descriptions.
 */
export const CAPABILITY_DESCRIPTIONS: Record<PaymentProviderCapability, string> = {
  pix_generation: 'Geração de cobrança PIX',
  dynamic_qrcode: 'QR Code dinâmico',
  static_qrcode: 'QR Code estático',
  boleto_generation: 'Geração de boleto bancário',
  webhooks: 'Recebimento de webhooks',
  refund: 'Estorno / reembolso',
  cancellation: 'Cancelamento de cobrança',
  payment_status_lookup: 'Consulta de status de pagamento',
  settlement_lookup: 'Consulta de liquidação',
  cnab_support: 'Suporte CNAB (capacidade declarada apenas)',
};

/**
 * Default capabilities for the mock provider.
 */
export const MOCK_PROVIDER_CAPABILITIES: PaymentProviderCapability[] = [
  'pix_generation',
  'dynamic_qrcode',
  'boleto_generation',
  'webhooks',
  'refund',
  'cancellation',
  'payment_status_lookup',
  'settlement_lookup',
];

/**
 * Ensures the provider supports the requested capability.
 */
export function requireCapability(
  provider: PaymentProvider,
  capability: PaymentProviderCapability,
): void {
  if (!provider.supportsCapability(capability)) {
    throw new CapabilityNotSupportedError(provider.providerId, capability);
  }
}

/**
 * Checks if a method type is compatible with a capability.
 */
export function methodToCapability(methodType: string): PaymentProviderCapability | null {
  switch (methodType) {
    case 'pix':
      return 'pix_generation';
    case 'boleto':
      return 'boleto_generation';
    case 'credit_card':
    case 'debit_card':
      return null; // Card processing is provider-ready only in EPF-03
    case 'bank_transfer':
      return null;
    default:
      return null;
  }
}

/**
 * Builds a capability summary object for a provider.
 */
export function summarizeCapabilities(provider: PaymentProvider): {
  providerId: PaymentProviderId;
  capabilities: PaymentProviderCapability[];
  unsupported: PaymentProviderCapability[];
} {
  const supported = provider.getCapabilities();
  const unsupported = ALL_CAPABILITIES.filter((c) => !supported.includes(c));
  return {
    providerId: provider.providerId,
    capabilities: supported,
    unsupported,
  };
}
