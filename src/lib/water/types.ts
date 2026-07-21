export type MeterStatus = 'active' | 'inactive' | 'damaged' | 'removed';

export type ReadingSource = 'manual' | 'estimated' | 'corrected' | 'initial';

export type TariffType = 'fixed' | 'progressive' | 'minimum_charge';

export type AdjustmentType = 'manual_correction' | 'meter_replacement' | 'estimated_correction';

export type BillingRuleType = 'minimum_consumption' | 'rounding' | 'estimated_reading';

export interface WaterMeter {
  id: string;
  tenantId: string;
  propertyId: string;
  meterNumber: string;
  installationDate: string;
  initialReading: number;
  status: MeterStatus;
  location?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WaterMeterInput {
  tenantId: string;
  propertyId: string;
  meterNumber: string;
  installationDate: string;
  initialReading: number;
  location?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface MeterReading {
  id: string;
  tenantId: string;
  meterId: string;
  readingDate: string;
  readingValue: number;
  source: ReadingSource;
  isEstimated: boolean;
  notes?: string;
  readByProfileId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MeterReadingInput {
  tenantId: string;
  meterId: string;
  readingDate: string;
  readingValue: number;
  source?: ReadingSource;
  notes?: string;
  readByProfileId?: string;
}

export interface TariffTable {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  tariffType: TariffType;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  minConsumption: number;
  minCharge: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  bands?: TariffBand[];
}

export interface TariffTableInput {
  tenantId: string;
  name: string;
  description?: string;
  tariffType: TariffType;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive?: boolean;
  minConsumption?: number;
  minCharge?: number;
  metadata?: Record<string, unknown>;
}

export interface TariffBand {
  id: string;
  tariffTableId: string;
  fromConsumption: number;
  toConsumption?: number;
  unitPrice: number;
  flatFee: number;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TariffBandInput {
  fromConsumption: number;
  toConsumption?: number;
  unitPrice: number;
  flatFee?: number;
  sortOrder?: number;
}

export interface ConsumptionAdjustment {
  id: string;
  tenantId: string;
  readingId: string;
  adjustmentType: AdjustmentType;
  previousValue: number;
  adjustedValue: number;
  reason: string;
  adjustedByProfileId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ConsumptionAdjustmentInput {
  tenantId: string;
  readingId: string;
  adjustmentType: AdjustmentType;
  previousValue: number;
  adjustedValue: number;
  reason: string;
  adjustedByProfileId?: string;
}

export interface BillingRule {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  ruleType: BillingRuleType;
  ruleConfig: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingRuleInput {
  tenantId: string;
  name: string;
  description?: string;
  ruleType: BillingRuleType;
  ruleConfig?: Record<string, unknown>;
  isActive?: boolean;
  sortOrder?: number;
}

export interface TariffBandResult {
  bandId: string;
  fromConsumption: number;
  toConsumption: number | null;
  consumption: number;
  unitPrice: number;
  flatFee: number;
  charge: number;
}

export interface TariffCalculationResult {
  totalAmount: number;
  bands: TariffBandResult[];
  minChargeApplied: boolean;
  minConsumption: number;
  minCharge: number;
  calculatedConsumption: number;
  tariffTableId: string;
  tariffType: TariffType;
  currency: string;
}

export interface ConsumptionRecord {
  meterId: string;
  meterNumber: string;
  propertyId: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  readingDate: string;
  previousReadingDate: string;
  status: 'calculated' | 'estimated' | 'no_data' | 'error';
  note?: string;
}

export interface BillingPreviewItem {
  meterId: string;
  meterNumber: string;
  consumption: number;
  tariffResult: TariffCalculationResult;
}

export interface BillingPreview {
  billingCycleId: string;
  billingAccountId: string;
  propertyId: string;
  cycleStart: string;
  cycleEnd: string;
  dueDate: string;
  referencePeriod: string;
  items: BillingPreviewItem[];
  totalWaterAmount: number;
  errorCount: number;
  errors: BillingError[];
}

export interface BillingProcessResult {
  success: boolean;
  billingCycleId: string;
  invoicesGenerated: number;
  totalAmount: number;
  invoiceIds: string[];
  errors: BillingError[];
}

export interface BillingError {
  meterId: string;
  meterNumber: string;
  error: string;
}

export interface MeterDetail {
  meter: WaterMeter;
  readings: MeterReading[];
  lastConsumption?: ConsumptionRecord;
}

export interface WaterDashboard {
  activeMeterCount: number;
  readingsThisMonth: number;
  lastBillingCycle?: {
    id: string;
    referencePeriod: string;
    invoiceCount: number;
    totalAmount: number;
  };
  recentReadings: MeterReading[];
}
