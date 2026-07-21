import type {
  WaterMeter, WaterMeterInput, MeterReading, MeterReadingInput,
  TariffTable, TariffTableInput, TariffBand, TariffBandInput,
  ConsumptionAdjustment, BillingRule, MeterDetail,
  ConsumptionRecord, BillingPreview, BillingProcessResult,
  BillingPreviewItem, TariffCalculationResult, ReadingSource,
  WaterDashboard,
} from './types';

export interface WaterRepository {
  listMeters(tenantId: string, propertyId?: string): Promise<WaterMeter[]>;
  getMeter(id: string): Promise<MeterDetail>;
  createMeter(input: WaterMeterInput): Promise<WaterMeter>;
  updateMeter(id: string, input: Partial<WaterMeterInput>): Promise<WaterMeter>;
  deleteMeter(id: string): Promise<void>;

  listReadings(meterId: string, limit?: number): Promise<MeterReading[]>;
  createReading(input: MeterReadingInput): Promise<MeterReading>;
  updateReading(id: string, input: Partial<MeterReadingInput>): Promise<MeterReading>;

  listTariffTables(tenantId: string): Promise<TariffTable[]>;
  getTariffTable(id: string): Promise<TariffTable>;
  createTariffTable(input: TariffTableInput): Promise<TariffTable>;
  updateTariffTable(id: string, input: Partial<TariffTableInput>): Promise<TariffTable>;
  deleteTariffTable(id: string): Promise<void>;
  upsertTariffBands(tableId: string, bands: TariffBandInput[]): Promise<TariffBand[]>;

  listBillingRules(tenantId: string): Promise<BillingRule[]>;

  getConsumption(meterId: string, fromDate: string, toDate: string): Promise<ConsumptionRecord | null>;
  listConsumption(propertyId: string, fromDate: string, toDate: string): Promise<ConsumptionRecord[]>;

  previewBilling(billingCycleId: string): Promise<BillingPreview>;
  processBilling(billingCycleId: string): Promise<BillingProcessResult>;

  getDashboard(tenantId: string): Promise<WaterDashboard>;
}

class DemoWaterRepository implements WaterRepository {
  private meters: WaterMeter[] = [];
  private readings: MeterReading[] = [];
  private tariffs: TariffTable[] = [];
  private tariffBands: TariffBand[] = [];

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData(): void {
    const now = new Date();
    const meterId1 = 'demo-meter-001';
    const meterId2 = 'demo-meter-002';
    const tariffTableId = 'demo-tariff-001';

    this.meters = [
      {
        id: meterId1,
        tenantId: 'demo-tenant-001',
        propertyId: 'demo-property-001',
        meterNumber: 'HIDRO-001',
        installationDate: '2026-01-15',
        initialReading: 0,
        status: 'active',
        location: 'Caixa de entrada — térreo',
        notes: 'Hidrômetro principal',
        metadata: { brand: 'LAO', model: 'LXS-15', serialNumber: 'SN-001' },
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: now.toISOString(),
      },
      {
        id: meterId2,
        tenantId: 'demo-tenant-001',
        propertyId: 'demo-property-001',
        meterNumber: 'HIDRO-002',
        installationDate: '2026-03-01',
        initialReading: 150,
        status: 'active',
        location: 'Jardim — irrigação',
        notes: 'Hidrômetro secundário para irrigação',
        metadata: { brand: 'LAO', model: 'LXS-15', serialNumber: 'SN-002' },
        createdAt: '2026-03-01T00:00:00Z',
        updatedAt: now.toISOString(),
      },
    ];

    const readingDates = [
      '2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15',
      '2026-05-15', '2026-06-15', '2026-07-15', '2026-07-21',
    ];

    this.readings = [
      ...readingDates.map((date, i) => ({
        id: `demo-reading-1-${i + 1}`,
        tenantId: 'demo-tenant-001',
        meterId: meterId1,
        readingDate: date,
        readingValue: i === 0 ? 0 : 100 * i + (i === readingDates.length - 1 ? 15 : 0),
        source: (i === 0 ? 'initial' : 'manual') as ReadingSource,
        isEstimated: false,
        readByProfileId: 'demo-profile-001',
        metadata: {},
        createdAt: `${date}T12:00:00Z`,
        updatedAt: `${date}T12:00:00Z`,
      })),
      ...readingDates.map((date, i) => ({
        id: `demo-reading-2-${i + 1}`,
        tenantId: 'demo-tenant-001',
        meterId: meterId2,
        readingDate: date,
        readingValue: 150 + 50 * i + (i === readingDates.length - 1 ? 10 : 0),
        source: (i === 0 ? 'initial' : 'manual') as ReadingSource,
        isEstimated: false,
        readByProfileId: 'demo-profile-001',
        metadata: {},
        createdAt: `${date}T12:00:00Z`,
        updatedAt: `${date}T12:00:00Z`,
      })),
    ];

    this.tariffBands = [
      {
        id: 'demo-band-001',
        tariffTableId,
        fromConsumption: 0,
        toConsumption: 10,
        unitPrice: 5.00,
        flatFee: 0,
        sortOrder: 1,
        metadata: { label: 'Faixa 1 — Consumo Essencial' },
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'demo-band-002',
        tariffTableId,
        fromConsumption: 10,
        toConsumption: 20,
        unitPrice: 7.50,
        flatFee: 0,
        sortOrder: 2,
        metadata: { label: 'Faixa 2 — Consumo Intermediário' },
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'demo-band-003',
        tariffTableId,
        fromConsumption: 20,
        toConsumption: 30,
        unitPrice: 10.00,
        flatFee: 0,
        sortOrder: 3,
        metadata: { label: 'Faixa 3 — Consumo Elevado' },
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'demo-band-004',
        tariffTableId,
        fromConsumption: 30,
        toConsumption: undefined,
        unitPrice: 15.00,
        flatFee: 0,
        sortOrder: 4,
        metadata: { label: 'Faixa 4 — Consumo Excedente' },
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    this.tariffs = [
      {
        id: tariffTableId,
        tenantId: 'demo-tenant-001',
        name: 'Tarifa Residencial Padrão (SANASA)',
        description: 'Tabela tarifária progressiva para consumo residencial de água — referência SANASA 2026',
        tariffType: 'progressive',
        currency: 'BRL',
        effectiveFrom: '2026-01-01',
        isActive: true,
        minConsumption: 5,
        minCharge: 25.00,
        metadata: { reference: 'SANASA 2026' },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: now.toISOString(),
        bands: this.tariffBands,
      },
    ];
  }

  async listMeters(tenantId: string, propertyId?: string): Promise<WaterMeter[]> {
    let result = this.meters.filter(m => m.tenantId === tenantId);
    if (propertyId) result = result.filter(m => m.propertyId === propertyId);
    return result;
  }

  async getMeter(id: string): Promise<MeterDetail> {
    const meter = this.meters.find(m => m.id === id);
    if (!meter) throw new Error('Meter not found');
    const readings = this.readings.filter(r => r.meterId === id).sort((a, b) =>
      b.readingDate.localeCompare(a.readingDate)
    );
    const lastConsumption = readings.length >= 2
      ? {
        meterId: id,
        meterNumber: meter.meterNumber,
        propertyId: meter.propertyId,
        previousReading: readings[1].readingValue,
        currentReading: readings[0].readingValue,
        consumption: readings[0].readingValue - readings[1].readingValue,
        readingDate: readings[0].readingDate,
        previousReadingDate: readings[1].readingDate,
        status: 'calculated' as const,
      }
      : undefined;
    return { meter, readings, lastConsumption };
  }

  async createMeter(input: WaterMeterInput): Promise<WaterMeter> {
    const meter: WaterMeter = {
      id: `demo-meter-${Date.now()}`,
      ...input,
      status: 'active',
      metadata: input.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.meters.push(meter);
    return meter;
  }

  async updateMeter(id: string, input: Partial<WaterMeterInput>): Promise<WaterMeter> {
    const index = this.meters.findIndex(m => m.id === id);
    if (index === -1) throw new Error('Meter not found');
    this.meters[index] = { ...this.meters[index], ...input, updatedAt: new Date().toISOString() };
    return this.meters[index];
  }

  async deleteMeter(id: string): Promise<void> {
    const index = this.meters.findIndex(m => m.id === id);
    if (index === -1) throw new Error('Meter not found');
    this.meters[index].deletedAt = new Date().toISOString();
    this.meters[index].status = 'removed';
  }

  async listReadings(meterId: string, limit = 12): Promise<MeterReading[]> {
    return this.readings
      .filter(r => r.meterId === meterId)
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate))
      .slice(0, limit);
  }

  async createReading(input: MeterReadingInput): Promise<MeterReading> {
    const reading: MeterReading = {
      id: `demo-reading-${Date.now()}`,
      ...input,
      source: input.source || 'manual',
      isEstimated: input.source === 'estimated',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.readings.push(reading);
    return reading;
  }

  async updateReading(id: string, input: Partial<MeterReadingInput>): Promise<MeterReading> {
    const index = this.readings.findIndex(r => r.id === id);
    if (index === -1) throw new Error('Reading not found');
    this.readings[index] = { ...this.readings[index], ...input, updatedAt: new Date().toISOString() };
    return this.readings[index];
  }

  async listTariffTables(tenantId: string): Promise<TariffTable[]> {
    return this.tariffs.filter(t => t.tenantId === tenantId);
  }

  async getTariffTable(id: string): Promise<TariffTable> {
    const tariff = this.tariffs.find(t => t.id === id);
    if (!tariff) throw new Error('Tariff table not found');
    return tariff;
  }

  async createTariffTable(input: TariffTableInput): Promise<TariffTable> {
    const tariff: TariffTable = {
      id: `demo-tariff-${Date.now()}`,
      ...input,
      tariffType: input.tariffType || 'progressive',
      currency: 'BRL',
      effectiveFrom: input.effectiveFrom || new Date().toISOString().split('T')[0],
      isActive: input.isActive !== false,
      minConsumption: input.minConsumption || 0,
      minCharge: input.minCharge || 0,
      metadata: input.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      bands: [],
    };
    this.tariffs.push(tariff);
    return tariff;
  }

  async updateTariffTable(id: string, input: Partial<TariffTableInput>): Promise<TariffTable> {
    const index = this.tariffs.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Tariff table not found');
    this.tariffs[index] = { ...this.tariffs[index], ...input, updatedAt: new Date().toISOString() };
    return this.tariffs[index];
  }

  async deleteTariffTable(id: string): Promise<void> {
    const index = this.tariffs.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Tariff table not found');
    this.tariffs[index].deletedAt = new Date().toISOString();
    this.tariffs[index].isActive = false;
  }

  async upsertTariffBands(tableId: string, bands: TariffBandInput[]): Promise<TariffBand[]> {
    this.tariffBands = this.tariffBands.filter(b => b.tariffTableId !== tableId);
    const newBands = bands.map((b, i) => ({
      id: `demo-band-${Date.now()}-${i}`,
      tariffTableId: tableId,
      fromConsumption: b.fromConsumption,
      toConsumption: b.toConsumption,
      unitPrice: b.unitPrice,
      flatFee: b.flatFee || 0,
      sortOrder: b.sortOrder || i + 1,
      metadata: {},
      createdAt: new Date().toISOString(),
    }));
    this.tariffBands.push(...newBands);
    return newBands;
  }

  async listBillingRules(tenantId: string): Promise<BillingRule[]> {
    return [
      {
        id: 'demo-rule-001',
        tenantId,
        name: 'Consumo Mínimo',
        description: 'Aplica tarifa mínima para consumo abaixo do limite',
        ruleType: 'minimum_consumption',
        ruleConfig: { minConsumption: 5, minCharge: 25.00 },
        isActive: true,
        sortOrder: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'demo-rule-002',
        tenantId,
        name: 'Arredondamento',
        description: 'Arredonda consumo para duas casas decimais',
        ruleType: 'rounding',
        ruleConfig: { decimals: 2, method: 'half_up' },
        isActive: true,
        sortOrder: 2,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
  }

  async getConsumption(meterId: string, fromDate: string, toDate: string): Promise<ConsumptionRecord | null> {
    const meter = this.meters.find(m => m.id === meterId);
    if (!meter) return null;

    const readings = this.readings
      .filter(r => r.meterId === meterId)
      .sort((a, b) => a.readingDate.localeCompare(b.readingDate));

    const previousReading = readings
      .filter(r => r.readingDate <= fromDate)
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];

    const currentReading = readings
      .filter(r => r.readingDate <= toDate)
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];

    if (!previousReading || !currentReading) {
      return {
        meterId,
        meterNumber: meter.meterNumber,
        propertyId: meter.propertyId,
        previousReading: previousReading?.readingValue || 0,
        currentReading: currentReading?.readingValue || 0,
        consumption: 0,
        readingDate: toDate,
        previousReadingDate: fromDate,
        status: 'no_data',
        note: 'Dados insuficientes para cálculo de consumo',
      };
    }

    const consumption = currentReading.readingValue - previousReading.readingValue;
    return {
      meterId,
      meterNumber: meter.meterNumber,
      propertyId: meter.propertyId,
      previousReading: previousReading.readingValue,
      currentReading: currentReading.readingValue,
      consumption,
      readingDate: currentReading.readingDate,
      previousReadingDate: previousReading.readingDate,
      status: consumption >= 0 ? 'calculated' : 'error',
    };
  }

  async listConsumption(propertyId: string, fromDate: string, toDate: string): Promise<ConsumptionRecord[]> {
    const meters = this.meters.filter(m => m.propertyId === propertyId && m.status === 'active' && !m.deletedAt);
    const results = await Promise.all(
      meters.map(m => this.getConsumption(m.id, fromDate, toDate))
    );
    return results.filter(Boolean) as ConsumptionRecord[];
  }

  async previewBilling(billingCycleId: string): Promise<BillingPreview> {
    const meter1 = this.meters[0];
    const meter2 = this.meters[1];
    const tariff = this.tariffs[0];

    const cons1 = await this.getConsumption(meter1.id, '2026-07-01', '2026-07-21');
    const cons2 = await this.getConsumption(meter2.id, '2026-07-01', '2026-07-21');

    const tariffResult1 = cons1 && cons1.consumption > 0
      ? this.calculateDemoTariff(cons1.consumption, tariff.id)
      : null;

    const tariffResult2 = cons2 && cons2.consumption > 0
      ? this.calculateDemoTariff(cons2.consumption, tariff.id)
      : null;

    const items: BillingPreviewItem[] = [];
    if (tariffResult1 && cons1) {
      items.push({ meterId: meter1.id, meterNumber: meter1.meterNumber, consumption: cons1.consumption, tariffResult: tariffResult1 });
    }
    if (tariffResult2 && cons2) {
      items.push({ meterId: meter2.id, meterNumber: meter2.meterNumber, consumption: cons2.consumption, tariffResult: tariffResult2 });
    }

    return {
      billingCycleId,
      billingAccountId: 'demo-billing-account-001',
      propertyId: 'demo-property-001',
      cycleStart: '2026-07-01',
      cycleEnd: '2026-07-31',
      dueDate: '2026-08-15',
      referencePeriod: '07/2026',
      items,
      totalWaterAmount: items.reduce((sum, item) => sum + item.tariffResult.totalAmount, 0),
      errorCount: 0,
      errors: [],
    };
  }

  async processBilling(billingCycleId: string): Promise<BillingProcessResult> {
    const preview = await this.previewBilling(billingCycleId);
    const invoiceIds = preview.items.map(() => `demo-invoice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    return {
      success: true,
      billingCycleId,
      invoicesGenerated: preview.items.length,
      totalAmount: preview.totalWaterAmount,
      invoiceIds,
      errors: [],
    };
  }

  async getDashboard(tenantId: string): Promise<WaterDashboard> {
    const activeMeters = this.meters.filter(m => m.tenantId === tenantId && m.status === 'active' && !m.deletedAt);
    const recentReadings = this.readings
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate))
      .slice(0, 5);

    return {
      activeMeterCount: activeMeters.length,
      readingsThisMonth: recentReadings.length,
      lastBillingCycle: {
        id: 'demo-cycle-001',
        referencePeriod: '07/2026',
        invoiceCount: 1,
        totalAmount: 165.00,
      },
      recentReadings,
    };
  }

  private calculateDemoTariff(consumption: number, tariffTableId: string): import('./types').TariffCalculationResult {
    const tariff = this.tariffs.find(t => t.id === tariffTableId);
    const bands = this.tariffBands.filter(b => b.tariffTableId === tariffTableId).sort((a, b) => a.sortOrder - b.sortOrder);

    if (!tariff) throw new Error('Tariff not found');

    if (consumption <= tariff.minConsumption && tariff.minCharge > 0) {
      return {
        totalAmount: tariff.minCharge,
        bands: [],
        minChargeApplied: true,
        minConsumption: tariff.minConsumption,
        minCharge: tariff.minCharge,
        calculatedConsumption: consumption,
        tariffTableId,
        tariffType: tariff.tariffType,
        currency: tariff.currency,
      };
    }

    let remaining = consumption;
    let total = 0;
    const bandResults: import('./types').TariffBandResult[] = [];

    for (const band of bands) {
      if (remaining <= 0) break;

      const bandRange = band.toConsumption != null
        ? band.toConsumption - band.fromConsumption
        : remaining;

      const bandConsumption = Math.min(remaining, Math.max(0, bandRange));

      if (bandConsumption <= 0) continue;

      const charge = Math.round((bandConsumption * band.unitPrice + band.flatFee) * 100) / 100;
      total += charge;
      remaining -= bandConsumption;

      bandResults.push({
        bandId: band.id,
        fromConsumption: band.fromConsumption,
        toConsumption: band.toConsumption || null,
        consumption: bandConsumption,
        unitPrice: band.unitPrice,
        flatFee: band.flatFee,
        charge,
      });
    }

    return {
      totalAmount: Math.round(total * 100) / 100,
      bands: bandResults,
      minChargeApplied: false,
      minConsumption: tariff.minConsumption,
      minCharge: tariff.minCharge,
      calculatedConsumption: consumption,
      tariffTableId,
      tariffType: tariff.tariffType,
      currency: tariff.currency,
    };
  }
}

let currentRepository: WaterRepository = new DemoWaterRepository();

export function getWaterRepository(): WaterRepository {
  return currentRepository;
}

export function setWaterRepository(repo: WaterRepository): void {
  currentRepository = repo;
}
