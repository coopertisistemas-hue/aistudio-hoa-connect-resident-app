import { useState, useEffect, useCallback } from 'react';
import type { HomeOverview } from '@/fixtures/types';
import { fetchHomeOverview } from '@/demo/homeService';

interface UseHomeDataResult {
  data: HomeOverview | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isOffline: boolean;
  refresh: () => Promise<void>;
}

export function useHomeData(): UseHomeDataResult {
  const [data, setData] = useState<HomeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      setIsOffline(false);

      const result = await fetchHomeOverview();
      setData(result);
    } catch (err) {
      const errorObj = err as Error;
      if (errorObj.message === 'OFFLINE') {
        setIsOffline(true);
        setError('Você está offline. Conecte-se à internet para atualizar.');
      } else {
        setError('Não foi possível carregar as informações. Tente novamente.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { data, loading, refreshing, error, isOffline, refresh };
}