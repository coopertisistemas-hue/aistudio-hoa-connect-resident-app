import type {
  WaterMeter, MeterReading, TariffTable, TariffBand,
  BillingRule, MeterDetail, ConsumptionRecord,
  BillingPreview, BillingProcessResult, WaterDashboard,
} from './types';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'TEMPORARY_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ResponseEnvelope<T> {
  data: T | null;
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  } | null;
  meta: {
    requestId: string;
    generatedAt: string;
  };
}

export interface WaterMeterListRequest {
  tenantId: string;
  propertyId?: string;
}

export type WaterMeterListResponse = ResponseEnvelope<WaterMeter[]>;

export interface WaterMeterGetRequest {
  id: string;
}

export type WaterMeterGetResponse = ResponseEnvelope<MeterDetail>;

export interface WaterMeterUpsertRequest {
  id?: string;
  tenantId: string;
  propertyId: string;
  meterNumber: string;
  installationDate: string;
  initialReading: number;
  location?: string;
  notes?: string;
}

export type WaterMeterUpsertResponse = ResponseEnvelope<WaterMeter>;

export interface WaterMeterDeleteRequest {
  id: string;
}

export type WaterMeterDeleteResponse = ResponseEnvelope<{ deleted: boolean }>;

export interface MeterReadingListRequest {
  meterId: string;
  limit?: number;
}

export type MeterReadingListResponse = ResponseEnvelope<MeterReading[]>;

export interface MeterReadingCreateRequest {
  tenantId: string;
  meterId: string;
  readingDate: string;
  readingValue: number;
  source?: string;
  notes?: string;
}

export type MeterReadingCreateResponse = ResponseEnvelope<MeterReading>;

export interface TariffTableListRequest {
  tenantId: string;
}

export type TariffTableListResponse = ResponseEnvelope<TariffTable[]>;

export interface TariffTableUpsertRequest {
  id?: string;
  tenantId: string;
  name: string;
  description?: string;
  tariffType: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive?: boolean;
  minConsumption?: number;
  minCharge?: number;
}

export type TariffTableUpsertResponse = ResponseEnvelope<TariffTable>;

export interface TariffBandUpsertRequest {
  tariffTableId: string;
  bands: {
    fromConsumption: number;
    toConsumption?: number;
    unitPrice: number;
    flatFee?: number;
    sortOrder?: number;
  }[];
}

export type TariffBandUpsertResponse = ResponseEnvelope<TariffBand[]>;

export interface ConsumptionListRequest {
  propertyId: string;
  fromDate: string;
  toDate: string;
}

export type ConsumptionListResponse = ResponseEnvelope<ConsumptionRecord[]>;

export interface BillingPreviewRequest {
  billingCycleId: string;
}

export type BillingPreviewResponse = ResponseEnvelope<BillingPreview>;

export interface BillingProcessRequest {
  billingCycleId: string;
}

export type BillingProcessResponse = ResponseEnvelope<BillingProcessResult>;

export interface DashboardRequest {
  tenantId: string;
}

export type DashboardResponse = ResponseEnvelope<WaterDashboard>;
