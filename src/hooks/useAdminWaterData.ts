import { useState, useEffect, useCallback } from 'react';
import * as waterService from '@/lib/water/waterService';
import type {
  WaterMeter, WaterMeterInput, MeterReading, MeterReadingInput,
  TariffTable, TariffTableInput, TariffBandInput,
  BillingRule, MeterDetail, ConsumptionRecord,
  BillingPreview, BillingProcessResult, WaterDashboard,
} from '@/lib/water/types';

interface UseAdminWaterDataResult {
  dashboard: WaterDashboard | null;
  meters: WaterMeter[];
  selectedMeter: MeterDetail | null;
  tariffs: TariffTable[];
  selectedTariff: TariffTable | null;
  rules: BillingRule[];
  consumption: ConsumptionRecord[];
  billingPreview: BillingPreview | null;
  billingResult: BillingProcessResult | null;
  loading: boolean;
  error: string | null;

  loadDashboard: (tenantId: string) => Promise<void>;
  loadMeters: (tenantId: string, propertyId?: string) => Promise<void>;
  loadMeter: (id: string) => Promise<void>;
  addMeter: (input: WaterMeterInput) => Promise<WaterMeter | null>;
  editMeter: (id: string, input: Partial<WaterMeterInput>) => Promise<void>;
  removeMeter: (id: string) => Promise<void>;

  loadReadings: (meterId: string) => Promise<void>;
  addReading: (input: MeterReadingInput) => Promise<MeterReading | null>;

  loadTariffs: (tenantId: string) => Promise<void>;
  loadTariff: (id: string) => Promise<void>;
  addTariffTable: (input: TariffTableInput) => Promise<TariffTable | null>;
  editTariffTable: (id: string, input: Partial<TariffTableInput>) => Promise<void>;
  removeTariffTable: (id: string) => Promise<void>;
  updateTariffBands: (tableId: string, bands: TariffBandInput[]) => Promise<void>;

  loadBillingRules: (tenantId: string) => Promise<void>;

  loadConsumption: (propertyId: string, fromDate: string, toDate: string) => Promise<void>;

  loadBillingPreview: (billingCycleId: string) => Promise<BillingPreview | null>;
  executeBilling: (billingCycleId: string) => Promise<BillingProcessResult | null>;
}

export function useAdminWaterData(): UseAdminWaterDataResult {
  const [dashboard, setDashboard] = useState<WaterDashboard | null>(null);
  const [meters, setMeters] = useState<WaterMeter[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<MeterDetail | null>(null);
  const [tariffs, setTariffs] = useState<TariffTable[]>([]);
  const [selectedTariff, setSelectedTariff] = useState<TariffTable | null>(null);
  const [rules, setRules] = useState<BillingRule[]>([]);
  const [consumption, setConsumption] = useState<ConsumptionRecord[]>([]);
  const [billingPreview, setBillingPreview] = useState<BillingPreview | null>(null);
  const [billingResult, setBillingResult] = useState<BillingProcessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (tenantId: string) => {
    setLoading(true);
    try {
      const data = await waterService.getDashboard(tenantId);
      setDashboard(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMeters = useCallback(async (tenantId: string, propertyId?: string) => {
    setLoading(true);
    try {
      const data = await waterService.listMeters(tenantId, propertyId);
      setMeters(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar hidrômetros');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMeter = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await waterService.getMeter(id);
      setSelectedMeter(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar hidrômetro');
    } finally {
      setLoading(false);
    }
  }, []);

  const addMeter = useCallback(async (input: WaterMeterInput): Promise<WaterMeter | null> => {
    try {
      const data = await waterService.createMeter(input);
      setMeters(prev => [...prev, data]);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar hidrômetro');
      return null;
    }
  }, []);

  const editMeter = useCallback(async (id: string, input: Partial<WaterMeterInput>) => {
    try {
      await waterService.updateMeter(id, input);
      setMeters(prev => prev.map(m => m.id === id ? { ...m, ...input, updatedAt: new Date().toISOString() } : m));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar hidrômetro');
    }
  }, []);

  const removeMeter = useCallback(async (id: string) => {
    try {
      await waterService.deleteMeter(id);
      setMeters(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao remover hidrômetro');
    }
  }, []);

  const loadReadings = useCallback(async (meterId: string) => {
    setLoading(true);
    try {
      const data = await waterService.listReadings(meterId);
      if (selectedMeter?.meter.id === meterId) {
        setSelectedMeter(prev => prev ? { ...prev, readings: data } : null);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar leituras');
    } finally {
      setLoading(false);
    }
  }, [selectedMeter?.meter.id]);

  const addReading = useCallback(async (input: MeterReadingInput): Promise<MeterReading | null> => {
    try {
      const data = await waterService.createReading(input);
      setSelectedMeter(prev => prev ? { ...prev, readings: [data, ...prev.readings] } : null);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registrar leitura');
      return null;
    }
  }, []);

  const loadTariffs = useCallback(async (tenantId: string) => {
    setLoading(true);
    try {
      const data = await waterService.listTariffTables(tenantId);
      setTariffs(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar tarifas');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTariff = useCallback(async (id: string) => {
    try {
      const data = await waterService.getTariffTable(id);
      setSelectedTariff(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar tabela tarifária');
    }
  }, []);

  const addTariffTable = useCallback(async (input: TariffTableInput): Promise<TariffTable | null> => {
    try {
      const data = await waterService.createTariffTable(input);
      setTariffs(prev => [...prev, data]);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar tabela tarifária');
      return null;
    }
  }, []);

  const editTariffTable = useCallback(async (id: string, input: Partial<TariffTableInput>) => {
    try {
      await waterService.updateTariffTable(id, input);
      setTariffs(prev => prev.map(t => t.id === id ? { ...t, ...input, updatedAt: new Date().toISOString() } : t));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar tabela tarifária');
    }
  }, []);

  const removeTariffTable = useCallback(async (id: string) => {
    try {
      await waterService.deleteTariffTable(id);
      setTariffs(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao remover tabela tarifária');
    }
  }, []);

  const updateTariffBands = useCallback(async (tableId: string, bands: TariffBandInput[]) => {
    try {
      await waterService.upsertTariffBands(tableId, bands);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar faixas tarifárias');
    }
  }, []);

  const loadBillingRules = useCallback(async (tenantId: string) => {
    try {
      const data = await waterService.listBillingRules(tenantId);
      setRules(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar regras de faturamento');
    }
  }, []);

  const loadConsumption = useCallback(async (propertyId: string, fromDate: string, toDate: string) => {
    setLoading(true);
    try {
      const data = await waterService.listConsumption(propertyId, fromDate, toDate);
      setConsumption(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar consumo');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBillingPreview = useCallback(async (billingCycleId: string): Promise<BillingPreview | null> => {
    setLoading(true);
    try {
      const data = await waterService.previewBilling(billingCycleId);
      setBillingPreview(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar prévia de faturamento');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const executeBilling = useCallback(async (billingCycleId: string): Promise<BillingProcessResult | null> => {
    setLoading(true);
    try {
      const data = await waterService.processBilling(billingCycleId);
      setBillingResult(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar faturamento');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    dashboard, meters, selectedMeter, tariffs, selectedTariff,
    rules, consumption, billingPreview, billingResult,
    loading, error,
    loadDashboard, loadMeters, loadMeter, addMeter, editMeter, removeMeter,
    loadReadings, addReading,
    loadTariffs, loadTariff, addTariffTable, editTariffTable, removeTariffTable, updateTariffBands,
    loadBillingRules,
    loadConsumption,
    loadBillingPreview, executeBilling,
  };
}
