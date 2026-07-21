// Payment Service
// EPF-03 Payment Processing Platform
//
// Frontend service layer for payment orchestration Edge Functions.

import { supabase } from '../supabase/client';
import type {
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  CancelPaymentIntentRequest,
  RefundPaymentRequest,
  WebhookReceiveRequest,
  WebhookReceiveResponse,
  UpsertProviderConfigRequest,
  ListProviderConfigsRequest,
  ListProviderConfigsResponse,
} from './api-contracts';

const FUNCTIONS = {
  createIntent: 'payment-intent-create',
  cancelIntent: 'payment-intent-cancel',
  refund: 'payment-refund',
  receiveWebhook: 'payment-webhook-receive',
  upsertConfig: 'payment-provider-config-upsert',
  listConfigs: 'payment-provider-config-list',
};

async function invoke<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke<{ data: T }>(name, {
    body,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Empty response from Edge Function');
  }

  return data.data;
}

export async function createPaymentIntent(
  request: CreatePaymentIntentRequest,
): Promise<CreatePaymentIntentResponse> {
  return invoke<CreatePaymentIntentResponse>(FUNCTIONS.createIntent, request);
}

export async function cancelPaymentIntent(
  request: CancelPaymentIntentRequest,
): Promise<{ paymentIntent: unknown }> {
  return invoke<{ paymentIntent: unknown }>(FUNCTIONS.cancelIntent, request);
}

export async function refundPayment(
  request: RefundPaymentRequest,
): Promise<{ transaction: unknown; refundAmount: number }> {
  return invoke<{ transaction: unknown; refundAmount: number }>(FUNCTIONS.refund, request);
}

export async function receiveWebhook(
  request: WebhookReceiveRequest,
): Promise<WebhookReceiveResponse> {
  return invoke<WebhookReceiveResponse>(FUNCTIONS.receiveWebhook, request);
}

export async function upsertProviderConfig(
  request: UpsertProviderConfigRequest,
): Promise<{ config: unknown }> {
  return invoke<{ config: unknown }>(FUNCTIONS.upsertConfig, request);
}

export async function listProviderConfigs(
  request: ListProviderConfigsRequest,
): Promise<ListProviderConfigsResponse> {
  return invoke<ListProviderConfigsResponse>(FUNCTIONS.listConfigs, request);
}

// Re-export provider registry and types for UI consumption
export { getPaymentProvider, listAvailableProviders } from './providers/registry';
export type {
  PaymentProvider,
  PaymentProviderId,
  PaymentIntentResult,
  CreatePixInput,
  CreateBankSlipInput,
} from './providers/types';
