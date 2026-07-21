import type { ResponseEnvelope } from '../api-contracts';
import type {
  WaterMeter, MeterReading, TariffTable, TariffBand,
  BillingPreview, BillingProcessResult, WaterDashboard,
} from '../types';

export interface AdminWaterDashboardResponse {
  dashboard: WaterDashboard;
  meterCount: number;
  activeMeterCount: number;
  lastBillingCycleStatus: 'pending' | 'in_progress' | 'completed' | 'none';
}

export interface AdminMeterListResponse {
  meters: WaterMeter[];
  total: number;
}

export interface AdminMeterReadingListResponse {
  meterId: string;
  readings: MeterReading[];
  total: number;
}

export interface AdminTariffTableListResponse {
  tables: TariffTable[];
  total: number;
}

export interface AdminTariffBandInput {
  fromConsumption: number;
  toConsumption?: number;
  unitPrice: number;
  flatFee?: number;
  sortOrder?: number;
}

export interface AdminTariffTableUpsertRequest {
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
  bands?: AdminTariffBandInput[];
}

export type AdminTariffTableUpsertResponse = ResponseEnvelope<TariffTable>;

export interface AdminConsumptionReportRequest {
  propertyId: string;
  fromDate: string;
  toDate: string;
}

export interface AdminBillingProcessRequest {
  billingCycleId: string;
  preview?: boolean;
}

export type AdminBillingProcessResponse = ResponseEnvelope<BillingProcessResult>;

export interface AdminBillingPreviewRequest {
  billingCycleId: string;
}

export type AdminBillingPreviewResponse = ResponseEnvelope<BillingPreview>;
