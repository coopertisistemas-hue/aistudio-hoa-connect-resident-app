// Payment Provider Registry
// EPF-01 Financial Domain Foundation
//
// Maps provider identifiers to adapter instances.
// Adapters throw NotImplementedError by default.
// Integrations are enabled in future EPF waves.

import type { PaymentProvider, PaymentProviderId } from './types';
import { stripeAdapter } from './stripe.adapter';
import { asaasAdapter } from './asaas.adapter';
import { efiAdapter } from './efi.adapter';
import { sicoobAdapter } from './sicoob.adapter';
import { sicrediAdapter } from './sicredi.adapter';
import { bbAdapter } from './bb.adapter';
import { caixaAdapter } from './caixa.adapter';
import { cnabAdapter } from './cnab.adapter';

const providers: Record<PaymentProviderId, PaymentProvider> = {
  stripe: stripeAdapter,
  asaas: asaasAdapter,
  efi: efiAdapter,
  sicoob: sicoobAdapter,
  sicredi: sicrediAdapter,
  bb: bbAdapter,
  caixa: caixaAdapter,
  cnab: cnabAdapter,
};

export function getPaymentProvider(providerId: PaymentProviderId): PaymentProvider {
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Unknown payment provider: ${providerId}`);
  }
  return provider;
}

export function listAvailableProviders(): PaymentProvider[] {
  return Object.values(providers);
}

export { type PaymentProvider, type PaymentProviderId };
