import { useState, useEffect, useCallback } from 'react';
import type { ConsumptionOverview, HistoricalDataPoint } from '@/fixtures/types';
import { activeConsumptionScenario } from '@/fixtures/consumptionScenarios';
import { fetchConsumptionOverview, fetchReadingHistory, fetchReadingDetail } from '@/demo/consumoService';

interface UseConsumoDataResult {
  overview: ConsumptionOverview | null;
  history: HistoricalDataPoint[];
  loading: boolean;
  refreshing: boolean;
  residenceId: string;
  error: string | null;
  chartError: boolean;
  insightsUnavailable: boolean;
  isOffline: boolean;
  setResidenceId: (id: string) => void;
  refresh: () => Promise<void>;
  fetchDetail: (readingId: string) => Promise<HistoricalDataPoint | null>;
}

export function useConsumoData(initialResidenceId = 'prop-001'): UseConsumoDataResult {
  const [overview, setOverview] = useState<ConsumptionOverview | null>(null);
  const [history, setHistory] = useState<HistoricalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [residenceId, setResidenceIdState] = useState(initialResidenceId);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState(false);
  const [insightsUnavailable, setInsightsUnavailable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async (resId: string, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      setIsOffline(false);
      setChartError(false);
      setInsightsUnavailable(false);

      const [overviewResult, historyResult] = await Promise.allSettled([
        fetchConsumptionOverview(resId),
        fetchReadingHistory(resId),
      ]);

      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value);
      } else {
        setChartError(true);
        setInsightsUnavailable(true);
      }

      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value);
      } else {
        setChartError(true);
      }
    } catch {
      setError('Não foi possível carregar as informações de consumo. Tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(residenceId);
  }, [residenceId, load, activeConsumptionScenario]);

  const setResidenceId = useCallback((id: string) => {
    setResidenceIdState(id);
  }, []);

  const refresh = useCallback(async () => {
    await load(residenceId, true);
  }, [load, residenceId]);

  const fetchDetail = useCallback(async (readingId: string): Promise<HistoricalDataPoint | null> => {
    try {
      return await fetchReadingDetail(readingId, residenceId);
    } catch {
      return null;
    }
  }, [residenceId]);

  return {
    overview,
    history,
    loading,
    refreshing,
    residenceId,
    error,
    chartError,
    insightsUnavailable,
    isOffline,
    setResidenceId,
    refresh,
    fetchDetail,
  };
}