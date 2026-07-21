// Mock Payment Provider
// EPF-03 Payment Processing Platform
//
// Production-quality mock provider for certification and local testing.
// Supports PIX, Boleto, cancellation, status lookup, refund, and webhook simulation.
// No external API calls. Deterministic success/failure scenarios.

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
import { MOCK_PROVIDER_CAPABILITIES } from './capabilities.ts';
import { computeHmacSha256, computeSha256 } from './crypto.ts';

export class MockProvider implements PaymentProvider {
  readonly providerId = 'mock' as const;
  readonly displayName = 'Mock Provider (Certification)';

  private config: TenantProviderConfig | null = null;

  initialize(config: TenantProviderConfig): void {
    this.config = config;
  }

  getCapabilities(): PaymentProviderCapability[] {
    return MOCK_PROVIDER_CAPABILITIES;
  }

  supportsCapability(capability: PaymentProviderCapability): boolean {
    return this.getCapabilities().includes(capability);
  }

  async createPix(input: CreatePixInput): Promise<PaymentIntentResult> {
    const reconciliationId = input.reconciliationId ?? this.generateReconciliationId(input.invoiceId);
    const providerPaymentIntentId = `mock-pix-${reconciliationId}`;
    const pixCode = this.generatePixCopyPaste(input, reconciliationId);
    const pixQrBase64 = this.generatePixQrBase64(pixCode);
    const expiresInMinutes = input.expiresInMinutes ?? 30;
    const expiresAt = this.addMinutes(new Date(), expiresInMinutes).toISOString();

    return {
      providerPaymentIntentId,
      status: 'pending',
      amount: input.amount,
      reconciliationId,
      pixCode,
      pixQrBase64,
      pixExpiresAt: expiresAt,
      expiresAt,
      rawProviderResponse: {
        provider: this.providerId,
        method: 'pix',
        reconciliationId,
        expiresInMinutes,
      },
    };
  }

  async createBoleto(input: CreateBoletoInput): Promise<PaymentIntentResult> {
    const reconciliationId = input.reconciliationId ?? this.generateReconciliationId(input.invoiceId);
    const providerPaymentIntentId = `mock-boleto-${reconciliationId}`;
    const { barcode, digitableLine } = this.generateBoleto(input, reconciliationId);
    const boletoUrl = `https://mock.hoa-connect.local/boleto/${reconciliationId}`;
    const boletoExpiresAt = input.dueDate;

    return {
      providerPaymentIntentId,
      status: 'pending',
      amount: input.amount,
      reconciliationId,
      boletoUrl,
      boletoBarcode: barcode,
      boletoDigitableLine: digitableLine,
      boletoExpiresAt,
      expiresAt: boletoExpiresAt,
      rawProviderResponse: {
        provider: this.providerId,
        method: 'boleto',
        reconciliationId,
      },
    };
  }

  async cancel(paymentIntentId: string): Promise<CancelResult> {
    return {
      success: true,
      providerPaymentIntentId: paymentIntentId,
      status: 'cancelled',
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const status: RefundResult['status'] = input.amount ? 'partially_refunded' : 'refunded';
    return {
      success: true,
      providerRefundId: `mock-refund-${input.transactionId}`,
      status,
      amount: input.amount ?? 0,
    };
  }

  async lookupStatus(params: {
    providerPaymentIntentId?: string;
    providerTransactionId?: string;
    reconciliationId?: string;
  }): Promise<StatusLookupResult> {
    const reconciliationId = params.reconciliationId ?? params.providerPaymentIntentId ?? params.providerTransactionId ?? '';
    const status = this.determineStatus(reconciliationId);

    return {
      providerPaymentIntentId: params.providerPaymentIntentId,
      providerTransactionId: params.providerTransactionId,
      status,
      amount: 0,
      metadata: {
        reconciliationId,
        simulated: true,
      },
    };
  }

  async validateWebhook(input: WebhookValidationInput): Promise<WebhookValidationResult> {
    const result: WebhookValidationResult = {
      valid: true,
      signatureStatus: 'not_applicable',
      replayStatus: 'not_applicable',
    };

    if (!input.signatureHeader || input.signatureHeader === '') {
      result.signatureStatus = 'missing';
      result.valid = false;
      return result;
    }

    const payloadHash = await computeSha256(input.payload);
    const expectedSignature = await computeHmacSha256(payloadHash, input.secret);

    result.payloadHash = payloadHash;
    result.expectedSignature = expectedSignature;

    if (expectedSignature === input.signatureHeader.toLowerCase()) {
      result.signatureStatus = 'valid';
    } else {
      result.signatureStatus = 'invalid';
      result.valid = false;
    }

    if (input.nonce) {
      result.replayStatus = 'accepted';
      if (input.timestamp) {
        const ts = new Date(input.timestamp);
        const now = new Date();
        if (now.getTime() - ts.getTime() > 5 * 60 * 1000) {
          result.replayStatus = 'expired';
          result.valid = false;
        }
      }
    }

    return result;
  }

  buildWebhookPayload(rawBody: unknown): WebhookPayload {
    const body = rawBody as Record<string, unknown>;

    return {
      eventId: String(body.event_id ?? body.eventId ?? `mock-${crypto.randomUUID()}`),
      eventType: String(body.event_type ?? body.eventType ?? 'payment.confirmed'),
      provider: 'mock',
      reconciliationId: body.reconciliation_id ? String(body.reconciliation_id) : undefined,
      providerPaymentIntentId: body.provider_payment_intent_id ? String(body.provider_payment_intent_id) : undefined,
      providerTransactionId: body.provider_transaction_id ? String(body.provider_transaction_id) : undefined,
      status: this.normalizeStatus(body.status),
      amount: body.amount ? Number(body.amount) : undefined,
      timestamp: String(body.timestamp ?? new Date().toISOString()),
      nonce: body.nonce ? String(body.nonce) : undefined,
      raw: body,
    };
  }

  // ==========================================================================
  // Internal helpers
  // ==========================================================================

  private generateReconciliationId(invoiceId: string): string {
    return `rec-${invoiceId.slice(0, 8)}-${Date.now().toString(36)}`;
  }

  private generatePixCopyPaste(input: CreatePixInput, reconciliationId: string): string {
    // Simplified EMV QR-MPS structure for certification mock.
    const amount = input.amount.toFixed(2);
    const name = 'HOA CONNECT';
    const city = 'CURITIBA';
    const txid = reconciliationId.slice(0, 25);

    const payloadFormat = '000201';
    const merchantAccount = this.buildMerchantAccountInfo(reconciliationId);
    const merchantCategory = '52040000';
    const transactionCurrency = '5303986';
    const transactionAmount = `54${amount.length.toString().padStart(2, '0')}${amount}`;
    const countryCode = '5802BR';
    const merchantName = `59${name.length.toString().padStart(2, '0')}${name}`;
    const merchantCity = `60${city.length.toString().padStart(2, '0')}${city}`;
    const additionalData = `62070503${txid}`;

    const payloadWithoutCrc =
      payloadFormat +
      merchantAccount +
      merchantCategory +
      transactionCurrency +
      transactionAmount +
      countryCode +
      merchantName +
      merchantCity +
      additionalData +
      '6304';

    const crc = this.computeCrc16(payloadWithoutCrc);
    return payloadWithoutCrc + crc;
  }

  private buildMerchantAccountInfo(reconciliationId: string): string {
    const pixKey = `mock-pix-key-${reconciliationId.slice(0, 8)}`;
    const gui = '0014br.gov.bcb.pix';
    const key = `01${pixKey.length.toString().padStart(2, '0')}${pixKey}`;
    const content = gui + key;
    const tag = '26';
    return `${tag}${content.length.toString().padStart(2, '0')}${content}`;
  }

  private generatePixQrBase64(pixCode: string): string {
    // Generate a simple SVG data URI representing a QR placeholder.
    // In a real implementation, this would render an actual QR code.
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="white"/>
        <rect x="20" y="20" width="50" height="50" fill="black"/>
        <rect x="130" y="20" width="50" height="50" fill="black"/>
        <rect x="20" y="130" width="50" height="50" fill="black"/>
        <rect x="80" y="80" width="40" height="40" fill="black"/>
        <text x="100" y="180" font-size="10" text-anchor="middle">MOCK QR</text>
      </svg>
    `.trim();
    const base64 = btoa(svg);
    return `data:image/svg+xml;base64,${base64}`;
  }

  private generateBoleto(input: CreateBoletoInput, reconciliationId: string): { barcode: string; digitableLine: string } {
    // Simplified boleto barcode for certification mock.
    // Real boleto uses fator vencimento, valor, identificacao produto, etc.
    const productId = '8'; // Arrecadação
    const segmentId = '1';
    const realOrReference = '2'; // Valor referência
    const value = input.amount.toFixed(2).replace(/[^0-9]/g, '').padStart(11, '0');
    const companyId = '12345';
    const companyDoc = '12345678901';
    const dueDate = input.dueDate.replace(/-/g, '').slice(2);
    const reference = reconciliationId.slice(0, 25).replace(/-/g, '').padEnd(25, '0');

    const barcode =
      productId +
      segmentId +
      realOrReference +
      value +
      companyId.padEnd(8, '0') +
      companyDoc.padEnd(14, '0') +
      dueDate +
      reference;

    // Trim/pad to 44 positions
    const normalizedBarcode = barcode.slice(0, 44).padEnd(44, '0');
    const digitableLine = this.barcodeToDigitableLine(normalizedBarcode);

    return { barcode: normalizedBarcode, digitableLine };
  }

  private barcodeToDigitableLine(barcode: string): string {
    // Simplified digitable line generation for mock.
    // Real implementation uses modulo 10/modulo 11 with specific field lengths.
    const fields = [
      barcode.slice(0, 11),
      barcode.slice(11, 22),
      barcode.slice(22, 33),
      barcode.slice(33, 44),
    ];
    return fields.join(' ');
  }

  private determineStatus(reconciliationId: string): StatusLookupResult['status'] {
    const lower = reconciliationId.toLowerCase();
    if (lower.includes('fail') || lower.includes('rejected')) return 'failed';
    if (lower.includes('partial')) return 'partially_confirmed';
    if (lower.includes('refund')) return 'refunded';
    if (lower.includes('cancel')) return 'cancelled';
    if (lower.includes('review')) return 'under_review';
    if (lower.includes('pending')) return 'pending';
    return 'confirmed';
  }

  private normalizeStatus(status: unknown): StatusLookupResult['status'] {
    const s = String(status).toLowerCase();
    const valid: StatusLookupResult['status'][] = [
      'pending',
      'processing',
      'confirmed',
      'partially_confirmed',
      'failed',
      'refunded',
      'partially_refunded',
      'under_review',
      'not_reconciled',
      'cancelled',
    ];
    if (valid.includes(s as StatusLookupResult['status'])) {
      return s as StatusLookupResult['status'];
    }
    return 'confirmed';
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  private computeCrc16(payload: string): string {
    // CRC-16/CCITT-FALSE implementation
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc = crc << 1;
        }
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
}

export const mockProvider = new MockProvider();
