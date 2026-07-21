import { getWaterRepository } from './repository';
import type {
  WaterMeter, WaterMeterInput, MeterReading, MeterReadingInput,
  TariffTable, TariffTableInput, TariffBandInput,
  BillingRule, MeterDetail,
  ConsumptionRecord, BillingPreview, BillingProcessResult,
  WaterDashboard,
} from './types';

export async function getDashboard(tenantId: string): Promise<WaterDashboard> {
  const repo = getWaterRepository();
  return repo.getDashboard(tenantId);
}

export async function listMeters(tenantId: string, propertyId?: string): Promise<WaterMeter[]> {
  const repo = getWaterRepository();
  return repo.listMeters(tenantId, propertyId);
}

export async function getMeter(id: string): Promise<MeterDetail> {
  const repo = getWaterRepository();
  return repo.getMeter(id);
}

export async function createMeter(input: WaterMeterInput): Promise<WaterMeter> {
  const repo = getWaterRepository();
  return repo.createMeter(input);
}

export async function updateMeter(id: string, input: Partial<WaterMeterInput>): Promise<WaterMeter> {
  const repo = getWaterRepository();
  return repo.updateMeter(id, input);
}

export async function deleteMeter(id: string): Promise<void> {
  const repo = getWaterRepository();
  return repo.deleteMeter(id);
}

export async function listReadings(meterId: string, limit?: number): Promise<MeterReading[]> {
  const repo = getWaterRepository();
  return repo.listReadings(meterId, limit);
}

export async function createReading(input: MeterReadingInput): Promise<MeterReading> {
  const repo = getWaterRepository();
  return repo.createReading(input);
}

export async function listTariffTables(tenantId: string): Promise<TariffTable[]> {
  const repo = getWaterRepository();
  return repo.listTariffTables(tenantId);
}

export async function getTariffTable(id: string): Promise<TariffTable> {
  const repo = getWaterRepository();
  return repo.getTariffTable(id);
}

export async function createTariffTable(input: TariffTableInput): Promise<TariffTable> {
  const repo = getWaterRepository();
  return repo.createTariffTable(input);
}

export async function updateTariffTable(id: string, input: Partial<TariffTableInput>): Promise<TariffTable> {
  const repo = getWaterRepository();
  return repo.updateTariffTable(id, input);
}

export async function deleteTariffTable(id: string): Promise<void> {
  const repo = getWaterRepository();
  return repo.deleteTariffTable(id);
}

export async function upsertTariffBands(tableId: string, bands: TariffBandInput[]): Promise<void> {
  const repo = getWaterRepository();
  await repo.upsertTariffBands(tableId, bands);
}

export async function listBillingRules(tenantId: string): Promise<BillingRule[]> {
  const repo = getWaterRepository();
  return repo.listBillingRules(tenantId);
}

export async function getConsumption(meterId: string, fromDate: string, toDate: string): Promise<ConsumptionRecord | null> {
  const repo = getWaterRepository();
  return repo.getConsumption(meterId, fromDate, toDate);
}

export async function listConsumption(propertyId: string, fromDate: string, toDate: string): Promise<ConsumptionRecord[]> {
  const repo = getWaterRepository();
  return repo.listConsumption(propertyId, fromDate, toDate);
}

export async function previewBilling(billingCycleId: string): Promise<BillingPreview> {
  const repo = getWaterRepository();
  return repo.previewBilling(billingCycleId);
}

export async function processBilling(billingCycleId: string): Promise<BillingProcessResult> {
  const repo = getWaterRepository();
  return repo.processBilling(billingCycleId);
}
