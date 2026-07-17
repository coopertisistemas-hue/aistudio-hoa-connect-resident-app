import { useState, useEffect, useCallback } from 'react';
import type { FinancialOverview, InvoiceData, BoletoInfo, PixInfo, PaymentRecord, ReceiptData } from '@/fixtures/types';
import { activeFinanceScenario, setFinanceResidence, activeFinanceResidenceId } from '@/fixtures/financialScenarios';
import {
  fetchFinancialOverview,
  fetchInvoiceDetail,
  fetchBoletoInfo,
  fetchPixInfo,
  fetchPaymentHistory,
  fetchPaymentDetail,
  fetchReceiptData,
} from '@/demo/financeService';

interface UseFinancasDataResult {
  overview: FinancialOverview | null;
  loading: boolean;
  refreshing: boolean;
  residenceId: string;
  error: string | null;
  listError: boolean;
  isOffline: boolean;
  setResidenceId: (id: string) => void;
  refresh: () => Promise<void>;
  fetchInvoice: (invoiceId: string) => Promise<InvoiceData | null>;
  fetchBoleto: (invoiceId: string) => Promise<BoletoInfo | null>;
  fetchPix: (invoiceId: string) => Promise<PixInfo | null>;
  fetchPayments: () => Promise<PaymentRecord[]>;
  fetchPayment: (paymentId: string) => Promise<PaymentRecord | null>;
  fetchReceipt: (paymentId: string) => Promise<ReceiptData | null>;
}

export function useFinancasData(initialResidenceId = 'prop-001'): UseFinancasDataResult {
  const [overview, setOverview] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [residenceId, setResidenceIdState] = useState(initialResidenceId);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async (resId: string, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      setIsOffline(false);
      setListError(false);

      setFinanceResidence(resId);
      const result = await fetchFinancialOverview(resId);
      setOverview(result);
    } catch (err) {
      const errorObj = err as Error;
      if (errorObj.message === 'OFFLINE') {
        setIsOffline(true);
        setError('Você está offline. Conecte-se à internet para atualizar.');
      } else if (errorObj.message === 'ITEM_ERROR') {
        setListError(true);
      } else {
        setError('Não foi possível carregar as informações financeiras. Tente novamente.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(residenceId);
  }, [residenceId, load, activeFinanceScenario]);

  const setResidenceId = useCallback((id: string) => {
    setResidenceIdState(id);
  }, []);

  const refresh = useCallback(async () => {
    await load(residenceId, true);
  }, [load, residenceId]);

  const fetchInvoice = useCallback(async (invoiceId: string) => {
    try { return await fetchInvoiceDetail(invoiceId); }
    catch { return null; }
  }, []);

  const fetchBoleto = useCallback(async (invoiceId: string) => {
    try { return await fetchBoletoInfo(invoiceId); }
    catch { return null; }
  }, []);

  const fetchPix = useCallback(async (invoiceId: string) => {
    try { return await fetchPixInfo(invoiceId); }
    catch { return null; }
  }, []);

  const fetchPayments = useCallback(async () => {
    try { return await fetchPaymentHistory(residenceId); }
    catch { return []; }
  }, [residenceId]);

  const fetchPayment = useCallback(async (paymentId: string) => {
    try { return await fetchPaymentDetail(paymentId); }
    catch { return null; }
  }, []);

  const fetchReceipt = useCallback(async (paymentId: string) => {
    try { return await fetchReceiptData(paymentId); }
    catch { return null; }
  }, []);

  return {
    overview, loading, refreshing, residenceId, error, listError, isOffline,
    setResidenceId, refresh,
    fetchInvoice, fetchBoleto, fetchPix,
    fetchPayments, fetchPayment, fetchReceipt,
  };
}