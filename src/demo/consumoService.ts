import type { ConsumptionOverview, HistoricalDataPoint } from '@/fixtures/types';
import { getConsumptionOverview, getHistoricalData, getReadingById, buildCasaCentroOverview } from '@/fixtures/consumptionScenarios';

export async function fetchConsumptionOverview(residenceId: string): Promise<ConsumptionOverview> {
  await new Promise((r) => setTimeout(r, 700));

  if (residenceId === 'prop-002') {
    return buildCasaCentroOverview();
  }

  return getConsumptionOverview();
}

export async function fetchReadingHistory(residenceId: string): Promise<HistoricalDataPoint[]> {
  await new Promise((r) => setTimeout(r, 500));

  if (residenceId === 'prop-002') {
    return buildCasaCentroOverview().historicalData;
  }

  return getHistoricalData();
}

export async function fetchReadingDetail(readingId: string, residenceId: string): Promise<HistoricalDataPoint | null> {
  await new Promise((r) => setTimeout(r, 400));

  if (residenceId === 'prop-002') {
    const data = buildCasaCentroOverview().historicalData;
    return data.find((r) => r.id === readingId) || null;
  }

  return getReadingById(readingId) || null;
}