// Admin Finance Hook
// EPF-01 Financial Domain Foundation
//
// Provides admin-level financial data access.
// Currently returns empty/mock data.
// Wires up to Supabase Edge Functions in future EPF waves.

import { useState, useCallback, useEffect } from 'react';
import type {
  AdminDashboardResponse,
  InvoiceSummaryReport,
  CollectionReport,
  AgingReport,
} from '@/lib/finance/admin/api-contracts';

export interface UseAdminFinanceDataResult {
  dashboard: AdminDashboardResponse | null;
  invoiceReport: InvoiceSummaryReport | null;
  collectionReport: CollectionReport | null;
  agingReport: AgingReport | null;
  loading: boolean;
  error: string | null;
  refreshDashboard: () => Promise<void>;
  refreshReports: () => Promise<void>;
}

export function useAdminFinanceData(): UseAdminFinanceDataResult {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [invoiceReport, setInvoiceReport] = useState<InvoiceSummaryReport | null>(null);
  const [collectionReport, setCollectionReport] = useState<CollectionReport | null>(null);
  const [agingReport, setAgingReport] = useState<AgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Future: call admin edge function
      // const result = await fetchAdminDashboard();
      setDashboard(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshReports = useCallback(async () => {
    try {
      // Future: call admin edge functions
      setInvoiceReport(null);
      setCollectionReport(null);
      setAgingReport(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios');
    }
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  return {
    dashboard,
    invoiceReport,
    collectionReport,
    agingReport,
    loading,
    error,
    refreshDashboard,
    refreshReports,
  };
}
