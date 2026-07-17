import type {
  ConsumptionScenarioKey,
  ConsumptionOverview,
  CurrentPeriodSummary,
  MeterReadingContext,
  HistoricalDataPoint,
  ConsumptionInsight,
  ConsumptionAlert,
  EducationCard,
  DivergenceReasonOption,
  DivergenceConfirmation,
} from '@/fixtures/types';

// ─── Scenario Management ─────────────────────────────────────────────

export const consumptionScenarios: ConsumptionScenarioKey[] = [
  'normal',
  'below_usual',
  'gradual_increase',
  'unusual_peak',
  'no_reading',
  'estimated_reading',
  'under_review',
  'inconsistency',
  'replaced_meter',
  'no_history',
  'partial_error',
];

export const consumptionScenarioLabels: Record<ConsumptionScenarioKey, string> = {
  normal: 'Consumo normal',
  below_usual: 'Abaixo do habitual',
  gradual_increase: 'Aumento gradual',
  unusual_peak: 'Pico incomum',
  no_reading: 'Sem leitura atual',
  estimated_reading: 'Leitura estimada',
  under_review: 'Em revisão',
  inconsistency: 'Possível inconsistência',
  replaced_meter: 'Hidrômetro trocado',
  no_history: 'Sem histórico',
  partial_error: 'Erro parcial',
};

export let activeConsumptionScenario: ConsumptionScenarioKey = 'normal';

export function setConsumptionScenario(key: ConsumptionScenarioKey) {
  activeConsumptionScenario = key;
}

export function getConsumptionScenario(): ConsumptionScenarioKey {
  return activeConsumptionScenario;
}

// ─── Shared Education Cards ───────────────────────────────────────────

const defaultEducationCards: EducationCard[] = [
  {
    id: 'edu-1',
    title: 'Observe vazamentos silenciosos',
    description: 'Uma torneira pingando pode desperdiçar até 40 litros por dia. Faça o teste do hidrômetro: feche todos os registros e veja se ele continua girando.',
    icon: 'ri-drop-line',
  },
  {
    id: 'edu-2',
    title: 'Verifique as caixas de descarga',
    description: 'Descargas com defeito são uma das maiores causas de consumo elevado. Um sistema com vazamento pode gastar até 30 m³ por mês.',
    icon: 'ri-tools-line',
  },
  {
    id: 'edu-3',
    title: 'Atenção a períodos com visitas',
    description: 'É comum o consumo aumentar com mais pessoas em casa. Compare seus hábitos com o período para entender melhor as variações.',
    icon: 'ri-user-heart-line',
  },
];

// ─── Meter Reading Contexts ───────────────────────────────────────────

const defaultMeter: MeterReadingContext = {
  meterId: 'HID-2024-0891',
  meterLabel: 'Hidrômetro principal',
  installationLocation: 'Área de serviço — Bloco 3, Apto 201',
  latestReading: 2284,
  previousReading: 2262,
  readingDate: '2026-07-15',
  readingMethod: 'Leitura presencial',
  nextReadingWindow: '10 a 15 de agosto de 2026',
  status: 'active',
  statusLabel: 'Ativo',
};

const estimatedMeter: MeterReadingContext = {
  ...defaultMeter,
  latestReading: 2280,
  previousReading: 2262,
  readingMethod: 'Leitura estimada (média dos últimos 6 meses)',
  status: 'estimated',
  statusLabel: 'Estimado',
};

const noReadingMeter: MeterReadingContext = {
  ...defaultMeter,
  latestReading: 2262,
  previousReading: 2240,
  readingDate: '2026-06-15',
  readingMethod: '—',
  nextReadingWindow: 'Indisponível',
  status: 'pending',
  statusLabel: 'Pendente',
};

const replacedMeterCtx: MeterReadingContext = {
  meterId: 'HID-2026-1204',
  meterLabel: 'Hidrômetro principal (novo)',
  installationLocation: 'Área de serviço — Bloco 3, Apto 201',
  latestReading: 32,
  previousReading: 0,
  readingDate: '2026-07-15',
  readingMethod: 'Leitura presencial — primeiro registro após troca',
  nextReadingWindow: '10 a 15 de agosto de 2026',
  status: 'active',
  statusLabel: 'Ativo — Hidrômetro substituído em 01/07',
};

// ─── Historical Data Builders ─────────────────────────────────────────

function buildStableHistory(): HistoricalDataPoint[] {
  return [
    { id: 'rd-202607', period: 'Jul 2026', consumption: 22, readingDate: '2026-07-15', readingValue: 2284, previousReadingValue: 2262, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202606', period: 'Jun 2026', consumption: 21, readingDate: '2026-06-15', readingValue: 2262, previousReadingValue: 2241, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202605', period: 'Mai 2026', consumption: 19, readingDate: '2026-05-15', readingValue: 2241, previousReadingValue: 2222, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202604', period: 'Abr 2026', consumption: 18, readingDate: '2026-04-15', readingValue: 2222, previousReadingValue: 2204, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-2 m³ vs mês anterior' },
    { id: 'rd-202603', period: 'Mar 2026', consumption: 20, readingDate: '2026-03-15', readingValue: 2204, previousReadingValue: 2184, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202602', period: 'Fev 2026', consumption: 18, readingDate: '2026-02-15', readingValue: 2184, previousReadingValue: 2166, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202601', period: 'Jan 2026', consumption: 19, readingDate: '2026-01-15', readingValue: 2166, previousReadingValue: 2147, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202512', period: 'Dez 2025', consumption: 20, readingDate: '2025-12-15', readingValue: 2147, previousReadingValue: 2127, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202511', period: 'Nov 2025', consumption: 19, readingDate: '2025-11-15', readingValue: 2127, previousReadingValue: 2108, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202510', period: 'Out 2025', consumption: 20, readingDate: '2025-10-15', readingValue: 2108, previousReadingValue: 2088, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202509', period: 'Set 2025', consumption: 18, readingDate: '2025-09-15', readingValue: 2088, previousReadingValue: 2070, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202508', period: 'Ago 2025', consumption: 19, readingDate: '2025-08-15', readingValue: 2070, previousReadingValue: 2051, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
  ];
}

function buildGradualIncreaseHistory(): HistoricalDataPoint[] {
  return [
    { id: 'rd-202607', period: 'Jul 2026', consumption: 28, readingDate: '2026-07-15', readingValue: 2310, previousReadingValue: 2282, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+3 m³ vs mês anterior' },
    { id: 'rd-202606', period: 'Jun 2026', consumption: 25, readingDate: '2026-06-15', readingValue: 2282, previousReadingValue: 2257, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+3 m³ vs mês anterior' },
    { id: 'rd-202605', period: 'Mai 2026', consumption: 22, readingDate: '2026-05-15', readingValue: 2257, previousReadingValue: 2235, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202604', period: 'Abr 2026', consumption: 20, readingDate: '2026-04-15', readingValue: 2235, previousReadingValue: 2215, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202603', period: 'Mar 2026', consumption: 19, readingDate: '2026-03-15', readingValue: 2215, previousReadingValue: 2196, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202602', period: 'Fev 2026', consumption: 19, readingDate: '2026-02-15', readingValue: 2196, previousReadingValue: 2177, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202601', period: 'Jan 2026', consumption: 18, readingDate: '2026-01-15', readingValue: 2177, previousReadingValue: 2159, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202512', period: 'Dez 2025', consumption: 19, readingDate: '2025-12-15', readingValue: 2159, previousReadingValue: 2140, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202511', period: 'Nov 2025', consumption: 19, readingDate: '2025-11-15', readingValue: 2140, previousReadingValue: 2121, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202510', period: 'Out 2025', consumption: 18, readingDate: '2025-10-15', readingValue: 2121, previousReadingValue: 2103, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-2 m³ vs mês anterior' },
    { id: 'rd-202509', period: 'Set 2025', consumption: 20, readingDate: '2025-09-15', readingValue: 2103, previousReadingValue: 2083, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202508', period: 'Ago 2025', consumption: 19, readingDate: '2025-08-15', readingValue: 2083, previousReadingValue: 2064, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
  ];
}

function buildPeakHistory(): HistoricalDataPoint[] {
  return [
    { id: 'rd-202607', period: 'Jul 2026', consumption: 46, readingDate: '2026-07-15', readingValue: 2330, previousReadingValue: 2284, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+24 m³ vs mês anterior', note: 'Consumo atípico — 2,3x acima da média' },
    { id: 'rd-202606', period: 'Jun 2026', consumption: 22, readingDate: '2026-06-15', readingValue: 2284, previousReadingValue: 2262, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202605', period: 'Mai 2026', consumption: 21, readingDate: '2026-05-15', readingValue: 2262, previousReadingValue: 2241, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202604', period: 'Abr 2026', consumption: 19, readingDate: '2026-04-15', readingValue: 2241, previousReadingValue: 2222, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202603', period: 'Mar 2026', consumption: 20, readingDate: '2026-03-15', readingValue: 2222, previousReadingValue: 2202, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202602', period: 'Fev 2026', consumption: 20, readingDate: '2026-02-15', readingValue: 2202, previousReadingValue: 2182, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202601', period: 'Jan 2026', consumption: 19, readingDate: '2026-01-15', readingValue: 2182, previousReadingValue: 2163, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-2 m³ vs mês anterior' },
    { id: 'rd-202512', period: 'Dez 2025', consumption: 21, readingDate: '2025-12-15', readingValue: 2163, previousReadingValue: 2142, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202511', period: 'Nov 2025', consumption: 20, readingDate: '2025-11-15', readingValue: 2142, previousReadingValue: 2122, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202510', period: 'Out 2025', consumption: 20, readingDate: '2025-10-15', readingValue: 2122, previousReadingValue: 2102, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202509', period: 'Set 2025', consumption: 19, readingDate: '2025-09-15', readingValue: 2102, previousReadingValue: 2083, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202508', period: 'Ago 2025', consumption: 20, readingDate: '2025-08-15', readingValue: 2083, previousReadingValue: 2063, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
  ];
}

function buildEstimatedHistory(): HistoricalDataPoint[] {
  return [
    { id: 'rd-202607', period: 'Jul 2026', consumption: 20, readingDate: '2026-07-15', readingValue: 2280, previousReadingValue: 2260, status: 'estimated', statusLabel: 'Estimada', readingOrigin: 'Média 6 meses', comparison: 'Valor estimado', note: 'Leitura estimada — leiturista não teve acesso ao hidrômetro' },
    { id: 'rd-202606', period: 'Jun 2026', consumption: 22, readingDate: '2026-06-15', readingValue: 2260, previousReadingValue: 2238, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202605', period: 'Mai 2026', consumption: 20, readingDate: '2026-05-15', readingValue: 2238, previousReadingValue: 2218, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202604', period: 'Abr 2026', consumption: 19, readingDate: '2026-04-15', readingValue: 2218, previousReadingValue: 2199, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202603', period: 'Mar 2026', consumption: 21, readingDate: '2026-03-15', readingValue: 2199, previousReadingValue: 2178, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202602', period: 'Fev 2026', consumption: 20, readingDate: '2026-02-15', readingValue: 2178, previousReadingValue: 2158, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202601', period: 'Jan 2026', consumption: 19, readingDate: '2026-01-15', readingValue: 2158, previousReadingValue: 2139, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202512', period: 'Dez 2025', consumption: 20, readingDate: '2025-12-15', readingValue: 2139, previousReadingValue: 2119, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202511', period: 'Nov 2025', consumption: 19, readingDate: '2025-11-15', readingValue: 2119, previousReadingValue: 2100, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202510', period: 'Out 2025', consumption: 20, readingDate: '2025-10-15', readingValue: 2100, previousReadingValue: 2080, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202509', period: 'Set 2025', consumption: 20, readingDate: '2025-09-15', readingValue: 2080, previousReadingValue: 2060, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202508', period: 'Ago 2025', consumption: 19, readingDate: '2025-08-15', readingValue: 2060, previousReadingValue: 2041, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
  ];
}

function buildNoReadingHistory(): HistoricalDataPoint[] {
  return [
    { id: 'rd-202607', period: 'Jul 2026', consumption: 0, readingDate: '—', readingValue: 0, previousReadingValue: 0, status: 'not_performed', statusLabel: 'Não realizada', readingOrigin: '—', comparison: '—', note: 'Leitura ainda não disponível para este período' },
    { id: 'rd-202606', period: 'Jun 2026', consumption: 22, readingDate: '2026-06-15', readingValue: 2262, previousReadingValue: 2240, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202605', period: 'Mai 2026', consumption: 21, readingDate: '2026-05-15', readingValue: 2240, previousReadingValue: 2219, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202604', period: 'Abr 2026', consumption: 19, readingDate: '2026-04-15', readingValue: 2219, previousReadingValue: 2200, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202603', period: 'Mar 2026', consumption: 20, readingDate: '2026-03-15', readingValue: 2200, previousReadingValue: 2180, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202602', period: 'Fev 2026', consumption: 20, readingDate: '2026-02-15', readingValue: 2180, previousReadingValue: 2160, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202601', period: 'Jan 2026', consumption: 18, readingDate: '2026-01-15', readingValue: 2160, previousReadingValue: 2142, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202512', period: 'Dez 2025', consumption: 19, readingDate: '2025-12-15', readingValue: 2142, previousReadingValue: 2123, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202511', period: 'Nov 2025', consumption: 19, readingDate: '2025-11-15', readingValue: 2123, previousReadingValue: 2104, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202510', period: 'Out 2025', consumption: 20, readingDate: '2025-10-15', readingValue: 2104, previousReadingValue: 2084, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202509', period: 'Set 2025', consumption: 19, readingDate: '2025-09-15', readingValue: 2084, previousReadingValue: 2065, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202508', period: 'Ago 2025', consumption: 19, readingDate: '2025-08-15', readingValue: 2065, previousReadingValue: 2046, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
  ];
}

function buildInconsistencyHistory(): HistoricalDataPoint[] {
  return [
    { id: 'rd-202607', period: 'Jul 2026', consumption: 36, readingDate: '2026-07-15', readingValue: 2320, previousReadingValue: 2284, status: 'under_review', statusLabel: 'Em análise', readingOrigin: 'Presencial', comparison: '+14 m³ vs mês anterior', note: 'Leitura em análise — divergência identificada entre leitura registrada e consumo habitual', revisionHistory: [{ date: '2026-07-16', type: 'Revisão iniciada', description: 'Associação iniciou verificação da leitura após identificação de possível inconsistência.' }] },
    { id: 'rd-202606', period: 'Jun 2026', consumption: 22, readingDate: '2026-06-15', readingValue: 2284, previousReadingValue: 2262, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202605', period: 'Mai 2026', consumption: 21, readingDate: '2026-05-15', readingValue: 2262, previousReadingValue: 2241, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202604', period: 'Abr 2026', consumption: 19, readingDate: '2026-04-15', readingValue: 2241, previousReadingValue: 2222, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202603', period: 'Mar 2026', consumption: 20, readingDate: '2026-03-15', readingValue: 2222, previousReadingValue: 2202, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202602', period: 'Fev 2026', consumption: 20, readingDate: '2026-02-15', readingValue: 2202, previousReadingValue: 2182, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
  ];
}

function buildNoHistoryData(): HistoricalDataPoint[] {
  return [
    { id: 'rd-202607', period: 'Jul 2026', consumption: 22, readingDate: '2026-07-15', readingValue: 284, previousReadingValue: 262, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Primeiro registro' },
  ];
}

function buildReplacedMeterHistory(): HistoricalDataPoint[] {
  return [
    { id: 'rd-202607', period: 'Jul 2026', consumption: 20, readingDate: '2026-07-15', readingValue: 32, previousReadingValue: 0, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Primeira leitura do novo hidrômetro', note: 'Hidrômetro substituído em 01/07/2026. Leitura anterior: 2262 (hidrômetro antigo — HID-2024-0891)' },
    { id: 'rd-202606', period: 'Jun 2026', consumption: 22, readingDate: '2026-06-15', readingValue: 2262, previousReadingValue: 2240, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202605', period: 'Mai 2026', consumption: 21, readingDate: '2026-05-15', readingValue: 2240, previousReadingValue: 2219, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202604', period: 'Abr 2026', consumption: 19, readingDate: '2026-04-15', readingValue: 2219, previousReadingValue: 2200, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202603', period: 'Mar 2026', consumption: 20, readingDate: '2026-03-15', readingValue: 2200, previousReadingValue: 2180, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202602', period: 'Fev 2026', consumption: 20, readingDate: '2026-02-15', readingValue: 2180, previousReadingValue: 2160, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
    { id: 'rd-202601', period: 'Jan 2026', consumption: 18, readingDate: '2026-01-15', readingValue: 2160, previousReadingValue: 2142, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202512', period: 'Dez 2025', consumption: 19, readingDate: '2025-12-15', readingValue: 2142, previousReadingValue: 2123, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202511', period: 'Nov 2025', consumption: 19, readingDate: '2025-11-15', readingValue: 2123, previousReadingValue: 2104, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
    { id: 'rd-202510', period: 'Out 2025', consumption: 20, readingDate: '2025-10-15', readingValue: 2104, previousReadingValue: 2084, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
    { id: 'rd-202509', period: 'Set 2025', consumption: 19, readingDate: '2025-09-15', readingValue: 2084, previousReadingValue: 2065, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
    { id: 'rd-202508', period: 'Ago 2025', consumption: 19, readingDate: '2025-08-15', readingValue: 2065, previousReadingValue: 2046, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
  ];
}

// ─── Scenario Builders ────────────────────────────────────────────────

function buildNormalScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 22,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 21,
    comparisonLabel: '+1 m³ em relação a junho',
    usualRange: { min: 17, max: 23 },
    interpretation: 'Seu consumo ficou próximo da sua média recente, dentro do esperado para esta época do ano.',
    classification: 'dentro_do_esperado',
    classificationLabel: 'Dentro do esperado',
  };

  const insights: ConsumptionInsight[] = [
    {
      id: 'ins-1',
      title: 'Consumo estável',
      description: 'Seu consumo se manteve dentro da faixa habitual nos últimos 12 meses, variando entre 18 e 22 m³. Isso indica um padrão de uso consistente.',
      recommendation: 'Continue acompanhando mensalmente para identificar qualquer alteração.',
    },
    {
      id: 'ins-2',
      title: 'Pequena variação sazonal',
      description: 'É normal observar pequenas oscilações entre meses mais quentes e frios. Seu consumo atual está alinhado com o esperado para julho.',
    },
    {
      id: 'ins-3',
      title: 'Média diária adequada',
      description: 'Sua média de 0,73 m³ por dia está dentro da faixa recomendada para residências com 3 moradores.',
      action: { label: 'Ver dicas de economia', path: '/consumo' },
    },
  ];

  return {
    scenario: 'normal',
    currentPeriod,
    meterReading: defaultMeter,
    historicalData: buildStableHistory(),
    insights,
    alerts: [],
    educationCards: defaultEducationCards,
  };
}

function buildBelowUsualScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 12,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 21,
    comparisonLabel: '-9 m³ em relação a junho',
    usualRange: { min: 17, max: 23 },
    interpretation: 'Houve uma redução significativa em relação ao mês anterior e à sua média. Seu consumo está abaixo do habitual.',
    classification: 'abaixo_do_habitual',
    classificationLabel: 'Abaixo do habitual',
  };

  const insights: ConsumptionInsight[] = [
    {
      id: 'ins-1',
      title: 'Redução expressiva',
      description: 'Seu consumo caiu 43% em relação ao mês anterior. Isso pode indicar uma mudança positiva nos hábitos ou um período de menor uso do imóvel.',
      recommendation: 'Se a redução foi intencional, continue com as boas práticas!',
    },
    {
      id: 'ins-2',
      title: 'Possível período de ausência',
      description: 'Quedas bruscas são comuns quando há menos pessoas no imóvel ou em períodos de férias. Verifique se isso explica a variação.',
    },
  ];

  const history = buildStableHistory().map((h, i) =>
    i === 0 ? { ...h, consumption: 12, readingValue: 2274, previousReadingValue: 2262, comparison: '-9 m³ vs mês anterior' } : h
  );

  return {
    scenario: 'below_usual',
    currentPeriod,
    meterReading: defaultMeter,
    historicalData: history,
    insights,
    alerts: [],
    educationCards: defaultEducationCards,
  };
}

function buildGradualIncreaseScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 28,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 25,
    comparisonLabel: '+3 m³ em relação a junho',
    usualRange: { min: 17, max: 23 },
    interpretation: 'Seu consumo está acima do habitual e vem aumentando gradualmente nos últimos 4 meses.',
    classification: 'acima_do_habitual',
    classificationLabel: 'Acima do habitual',
  };

  const insights: ConsumptionInsight[] = [
    {
      id: 'ins-1',
      title: 'Tendência de aumento',
      description: 'Seu consumo cresceu de 20 m³ em abril para 28 m³ em julho. Esse aumento gradual merece atenção, mas pode ter causas simples.',
      recommendation: 'Vale conferir torneiras, caixas de descarga e outros pontos de uso.',
    },
    {
      id: 'ins-2',
      title: 'Múltiplos ocupantes podem influenciar',
      description: 'Mudanças na quantidade de pessoas no imóvel impactam diretamente o consumo. Reflita se houve alteração na ocupação recentemente.',
    },
    {
      id: 'ins-3',
      title: 'Caso não reconheça essa variação',
      description: 'Se você não identifica motivo para esse aumento, considere relatar uma possível divergência de leitura.',
      action: { label: 'Ver histórico', path: '/consumo/leituras' },
    },
  ];

  const alerts: ConsumptionAlert[] = [
    {
      id: 'al-1',
      severity: 'warning',
      severityLabel: 'Atenção',
      title: 'Consumo acima da faixa habitual',
      description: 'Seu consumo nos últimos 4 meses está consistentemente acima da sua média histórica. A diferença acumulada é de aproximadamente 20 m³.',
      date: '2026-07-15',
      referencePeriod: 'Julho 2026',
      recommendedAction: 'Verifique possíveis causas como vazamentos, mudanças de hábito ou ocupação.',
      contactAction: true,
    },
  ];

  return {
    scenario: 'gradual_increase',
    currentPeriod,
    meterReading: defaultMeter,
    historicalData: buildGradualIncreaseHistory(),
    insights,
    alerts,
    educationCards: defaultEducationCards,
  };
}

function buildUnusualPeakScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 46,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 22,
    comparisonLabel: '+24 m³ em relação a junho',
    usualRange: { min: 17, max: 23 },
    interpretation: 'Houve um aumento muito expressivo neste período. O consumo está mais que o dobro da sua média habitual.',
    classification: 'atencao_recomendada',
    classificationLabel: 'Atenção recomendada',
  };

  const insights: ConsumptionInsight[] = [
    {
      id: 'ins-1',
      title: 'Pico atípico identificado',
      description: 'Seu consumo deste mês é 2,3 vezes maior que a média dos últimos 12 meses. Esse aumento repentino pode ter diferentes causas.',
      recommendation: 'Esse tipo de variação merece investigação cuidadosa. Confira os pontos abaixo.',
    },
    {
      id: 'ins-2',
      title: 'Possíveis causas',
      description: 'Vazamentos ocultos, problemas em caixas de descarga ou torneiras são causas comuns. Uma torneira mal fechada pode desperdiçar mais de 2 m³ por dia.',
      recommendation: 'Faça o teste do hidrômetro: feche todos os registros e verifique se o relógio continua girando.',
    },
    {
      id: 'ins-3',
      title: 'Caso não reconheça essa variação',
      description: 'Se você tem certeza de que não houve mudança de uso que justifique esse aumento, pode haver divergência na leitura.',
      action: { label: 'Informar divergência', path: '/consumo/leituras/rd-202607' },
    },
  ];

  const alerts: ConsumptionAlert[] = [
    {
      id: 'al-2',
      severity: 'attention',
      severityLabel: 'Atenção importante',
      title: 'Aumento abrupto de consumo detectado',
      description: 'O consumo de julho foi 109% maior que a média dos últimos meses. Recomendamos verificar possíveis vazamentos internos e, se necessário, contatar um profissional.',
      date: '2026-07-15',
      referencePeriod: 'Julho 2026',
      recommendedAction: 'Verifique vazamentos internos, caixas de descarga e torneiras. Se não identificar a causa, entre em contato com a associação.',
      contactAction: true,
    },
  ];

  return {
    scenario: 'unusual_peak',
    currentPeriod,
    meterReading: defaultMeter,
    historicalData: buildPeakHistory(),
    insights,
    alerts,
    educationCards: [
      defaultEducationCards[0],
      defaultEducationCards[1],
      {
        id: 'edu-4',
        title: 'Monitore torneiras externas',
        description: 'Torneiras de jardim e áreas externas são frequentemente esquecidas abertas. Um fluxo contínuo pode consumir centenas de litros em poucas horas.',
        icon: 'ri-plant-line',
      },
    ],
  };
}

function buildNoReadingScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '—',
    consumption: 0,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 22,
    comparisonLabel: 'Leitura não disponível',
    usualRange: { min: 17, max: 23 },
    interpretation: 'A leitura deste período ainda não foi registrada. Você pode consultar os dados já carregados enquanto aguarda.',
    classification: 'leitura_indisponivel',
    classificationLabel: 'Leitura indisponível',
  };

  const insights: ConsumptionInsight[] = [
    {
      id: 'ins-1',
      title: 'Leitura pendente',
      description: 'A leitura do hidrômetro referente a julho ainda não foi lançada. Isso é normal e costuma ocorrer até o dia 20 do mês.',
      recommendation: 'Os dados devem estar disponíveis em breve. Você pode consultar o histórico de meses anteriores enquanto aguarda.',
    },
    {
      id: 'ins-2',
      title: 'Última leitura disponível',
      description: 'A informação mais recente disponível é de junho de 2026, com consumo de 22 m³.',
    },
  ];

  const alerts: ConsumptionAlert[] = [
    {
      id: 'al-3',
      severity: 'info',
      severityLabel: 'Informativo',
      title: 'Leitura de julho ainda não disponível',
      description: 'A leitura deste período ainda não foi registrada pela associação. Os dados devem ser atualizados em breve.',
      date: '2026-07-17',
      referencePeriod: 'Julho 2026',
      recommendedAction: 'Aguarde a atualização. Se a leitura não aparecer em até 5 dias, entre em contato com a associação.',
      contactAction: true,
    },
  ];

  return {
    scenario: 'no_reading',
    currentPeriod,
    meterReading: noReadingMeter,
    historicalData: buildNoReadingHistory(),
    insights,
    alerts,
    educationCards: defaultEducationCards,
  };
}

function buildEstimatedReadingScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 20,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 22,
    comparisonLabel: '-2 m³ em relação a junho (estimado)',
    usualRange: { min: 17, max: 23 },
    interpretation: 'A leitura deste período foi estimada com base na sua média de consumo. O valor real pode ser diferente.',
    classification: 'dados_em_revisao',
    classificationLabel: 'Dados em revisão',
  };

  const insights: ConsumptionInsight[] = [
    {
      id: 'ins-1',
      title: 'Leitura estimada',
      description: 'Quando o leiturista não consegue acessar o hidrômetro, a concessionária utiliza a média dos últimos 6 meses. O valor real será ajustado na próxima leitura presencial.',
    },
    {
      id: 'ins-2',
      title: 'Ajuste na próxima leitura',
      description: 'Na próxima leitura presencial, o valor será corrigido automaticamente. Se a estimativa foi menor que o consumo real, a diferença será compensada.',
    },
  ];

  const alerts: ConsumptionAlert[] = [
    {
      id: 'al-4',
      severity: 'warning',
      severityLabel: 'Atenção',
      title: 'Leitura estimada neste período',
      description: 'A leitura de julho foi estimada porque o leiturista não teve acesso ao hidrômetro. O valor real pode variar.',
      date: '2026-07-15',
      referencePeriod: 'Julho 2026',
      recommendedAction: 'Se você acredita que o valor estimado está incorreto, pode informar uma possível divergência.',
      contactAction: true,
    },
  ];

  return {
    scenario: 'estimated_reading',
    currentPeriod,
    meterReading: estimatedMeter,
    historicalData: buildEstimatedHistory(),
    insights,
    alerts,
    educationCards: [
      {
        id: 'edu-5',
        title: 'Mantenha o acesso ao hidrômetro livre',
        description: 'Certifique-se de que o hidrômetro está em local acessível para o leiturista. Se ele fica dentro do imóvel, combine um horário de visita.',
        icon: 'ri-door-open-line',
      },
      defaultEducationCards[0],
      defaultEducationCards[2],
    ],
  };
}

function buildUnderReviewScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 36,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 22,
    comparisonLabel: '+14 m³ em relação a junho',
    usualRange: { min: 17, max: 23 },
    interpretation: 'Estamos revisando esta informação com a associação. O valor atual pode ser ajustado.',
    classification: 'dados_em_revisao',
    classificationLabel: 'Dados em revisão',
  };

  const insights: ConsumptionInsight[] = [
    {
      id: 'ins-1',
      title: 'Leitura em verificação',
      description: 'A associação identificou uma possível inconsistência nesta leitura e iniciou o processo de revisão. Isso pode levar alguns dias.',
      recommendation: 'Você não precisa fazer nada no momento. Acompanhe a atualização nos próximos dias.',
    },
    {
      id: 'ins-2',
      title: 'O que acontece durante a revisão',
      description: 'Um técnico pode revisitar o hidrômetro para conferir a leitura. O valor será atualizado automaticamente após a verificação.',
    },
  ];

  const alerts: ConsumptionAlert[] = [
    {
      id: 'al-5',
      severity: 'info',
      severityLabel: 'Em andamento',
      title: 'Leitura de julho em processo de revisão',
      description: 'A leitura registrada está sendo verificada pela associação. Nenhuma ação é necessária no momento.',
      date: '2026-07-16',
      referencePeriod: 'Julho 2026',
      recommendedAction: 'Aguarde a conclusão da revisão. Caso não haja atualização em 7 dias, entre em contato.',
      contactAction: true,
    },
  ];

  return {
    scenario: 'under_review',
    currentPeriod,
    meterReading: { ...defaultMeter, latestReading: 2320, readingMethod: 'Leitura presencial — em verificação', status: 'under_review', statusLabel: 'Em verificação' },
    historicalData: buildInconsistencyHistory(),
    insights,
    alerts,
    educationCards: defaultEducationCards,
  };
}

function buildInconsistencyScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 36,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 22,
    comparisonLabel: '+14 m³ em relação a junho',
    usualRange: { min: 17, max: 23 },
    interpretation: 'Detectamos uma possível inconsistência na leitura deste período. Recomendamos que você confira os dados e, se necessário, relate a divergência.',
    classification: 'atencao_recomendada',
    classificationLabel: 'Atenção recomendada',
  };

  const insights: ConsumptionInsight[] = [
    {
      id: 'ins-1',
      title: 'Possível erro de leitura',
      description: 'O valor registrado é significativamente diferente do seu padrão de consumo. Isso pode indicar um erro de digitação ou leitura equivocada do hidrômetro.',
    },
    {
      id: 'ins-2',
      title: 'Verifique seu hidrômetro',
      description: 'Compare o número exibido no seu hidrômetro com o valor registrado. Uma diferença grande pode confirmar o erro.',
      recommendation: 'Se os números não conferem, utilize a opção de informar divergência.',
      action: { label: 'Informar divergência', path: '/consumo/leituras/rd-202607' },
    },
  ];

  const alerts: ConsumptionAlert[] = [
    {
      id: 'al-6',
      severity: 'attention',
      severityLabel: 'Atenção importante',
      title: 'Possível inconsistência na leitura',
      description: 'O valor registrado (36 m³) é 64% maior que sua média. Isso pode ser um erro de leitura. Confira seu hidrômetro e, se necessário, relate a divergência.',
      date: '2026-07-15',
      referencePeriod: 'Julho 2026',
      recommendedAction: 'Compare a leitura do seu hidrômetro com o valor registrado. Se divergirem, informe a associação.',
      contactAction: true,
    },
  ];

  return {
    scenario: 'inconsistency',
    currentPeriod,
    meterReading: { ...defaultMeter, latestReading: 2320, status: 'under_review', statusLabel: 'Em verificação' },
    historicalData: buildInconsistencyHistory(),
    insights,
    alerts,
    educationCards: defaultEducationCards,
  };
}

function buildReplacedMeterScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 20,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 22,
    comparisonLabel: 'Primeira leitura do novo hidrômetro',
    usualRange: { min: 17, max: 23 },
    interpretation: 'O hidrômetro foi substituído em 01/07. Os dados a partir de agora são do novo equipamento.',
    classification: 'dentro_do_esperado',
    classificationLabel: 'Dentro do esperado',
  };

  const insights: ConsumptionInsight[] = [
    {
      id: 'ins-1',
      title: 'Hidrômetro substituído',
      description: 'O equipamento anterior (HID-2024-0891) foi substituído em 01/07/2026. O novo hidrômetro (HID-2026-1204) iniciou a medição a partir de zero.',
      recommendation: 'As leituras do novo hidrômetro serão acumuladas a partir de julho. O consumo deve se manter dentro da sua faixa habitual.',
    },
    {
      id: 'ins-2',
      title: 'Leitura de transição',
      description: 'A última leitura do hidrômetro antigo foi de 2262. O consumo deste mês foi calculado corretamente considerando a troca.',
    },
  ];

  return {
    scenario: 'replaced_meter',
    currentPeriod,
    meterReading: replacedMeterCtx,
    historicalData: buildReplacedMeterHistory(),
    insights,
    alerts: [],
    educationCards: defaultEducationCards,
  };
}

function buildNoHistoryScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 22,
    unit: 'm³',
    previousPeriod: '—',
    previousConsumption: 0,
    comparisonLabel: 'Primeiro registro',
    usualRange: { min: 17, max: 23 },
    interpretation: 'Ainda estamos construindo seu histórico. Os dados ficarão mais completos a cada mês.',
    classification: 'dentro_do_esperado',
    classificationLabel: 'Dentro do esperado',
  };

  return {
    scenario: 'no_history',
    currentPeriod,
    meterReading: defaultMeter,
    historicalData: buildNoHistoryData(),
    insights: [{
      id: 'ins-1',
      title: 'Histórico em construção',
      description: 'Seu histórico de consumo começou a ser registrado recentemente. A cada mês, novos dados serão adicionados e você poderá acompanhar sua evolução.',
    }],
    alerts: [],
    educationCards: defaultEducationCards,
  };
}

function buildPartialErrorScenario(): ConsumptionOverview {
  const currentPeriod: CurrentPeriodSummary = {
    referencePeriod: 'Julho 2026',
    readingDate: '2026-07-15',
    consumption: 22,
    unit: 'm³',
    previousPeriod: 'Junho 2026',
    previousConsumption: 21,
    comparisonLabel: '+1 m³ em relação a junho',
    usualRange: { min: 17, max: 23 },
    interpretation: 'Algumas informações podem estar indisponíveis no momento. Os dados principais permanecem acessíveis.',
    classification: 'dentro_do_esperado',
    classificationLabel: 'Dentro do esperado',
  };

  return {
    scenario: 'partial_error',
    currentPeriod,
    meterReading: defaultMeter,
    historicalData: [...buildStableHistory().slice(0, 4), ...buildStableHistory().slice(4).map((h, i) => i === 0 ? { ...h, status: 'pending' as const, statusLabel: 'Erro ao carregar' } : h)],
    insights: [],
    alerts: [{
      id: 'al-7',
      severity: 'info',
      severityLabel: 'Informativo',
      title: 'Alguns dados estão indisponíveis',
      description: 'Parte do histórico de leituras não pôde ser carregada. As informações do período atual continuam acessíveis.',
      date: '2026-07-17',
      referencePeriod: 'Julho 2026',
      recommendedAction: 'Tente recarregar os dados. Se o problema persistir, entre em contato com a associação.',
      contactAction: true,
    }],
    educationCards: [defaultEducationCards[0], defaultEducationCards[1]],
  };
}

// ─── Main Scenario Map ────────────────────────────────────────────────

const scenarioBuilders: Record<ConsumptionScenarioKey, () => ConsumptionOverview> = {
  normal: buildNormalScenario,
  below_usual: buildBelowUsualScenario,
  gradual_increase: buildGradualIncreaseScenario,
  unusual_peak: buildUnusualPeakScenario,
  no_reading: buildNoReadingScenario,
  estimated_reading: buildEstimatedReadingScenario,
  under_review: buildUnderReviewScenario,
  inconsistency: buildInconsistencyScenario,
  replaced_meter: buildReplacedMeterScenario,
  no_history: buildNoHistoryScenario,
  partial_error: buildPartialErrorScenario,
};

// Multi-residence alternative data (Casa Centro)
const casaCentroHistory: HistoricalDataPoint[] = [
  { id: 'cc-202607', period: 'Jul 2026', consumption: 35, readingDate: '2026-07-15', readingValue: 5120, previousReadingValue: 5085, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+3 m³ vs mês anterior' },
  { id: 'cc-202606', period: 'Jun 2026', consumption: 32, readingDate: '2026-06-15', readingValue: 5085, previousReadingValue: 5053, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
  { id: 'cc-202605', period: 'Mai 2026', consumption: 33, readingDate: '2026-05-15', readingValue: 5053, previousReadingValue: 5020, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+2 m³ vs mês anterior' },
  { id: 'cc-202604', period: 'Abr 2026', consumption: 31, readingDate: '2026-04-15', readingValue: 5020, previousReadingValue: 4989, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
  { id: 'cc-202603', period: 'Mar 2026', consumption: 32, readingDate: '2026-03-15', readingValue: 4989, previousReadingValue: 4957, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-2 m³ vs mês anterior' },
  { id: 'cc-202602', period: 'Fev 2026', consumption: 34, readingDate: '2026-02-15', readingValue: 4957, previousReadingValue: 4923, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
  { id: 'cc-202601', period: 'Jan 2026', consumption: 33, readingDate: '2026-01-15', readingValue: 4923, previousReadingValue: 4890, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+3 m³ vs mês anterior' },
  { id: 'cc-202512', period: 'Dez 2025', consumption: 30, readingDate: '2025-12-15', readingValue: 4890, previousReadingValue: 4860, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-2 m³ vs mês anterior' },
  { id: 'cc-202511', period: 'Nov 2025', consumption: 32, readingDate: '2025-11-15', readingValue: 4860, previousReadingValue: 4828, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
  { id: 'cc-202510', period: 'Out 2025', consumption: 32, readingDate: '2025-10-15', readingValue: 4828, previousReadingValue: 4796, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '+1 m³ vs mês anterior' },
  { id: 'cc-202509', period: 'Set 2025', consumption: 31, readingDate: '2025-09-15', readingValue: 4796, previousReadingValue: 4765, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: '-1 m³ vs mês anterior' },
  { id: 'cc-202508', period: 'Ago 2025', consumption: 32, readingDate: '2025-08-15', readingValue: 4765, previousReadingValue: 4733, status: 'registered', statusLabel: 'Registrada', readingOrigin: 'Presencial', comparison: 'Estável' },
];

export function buildCasaCentroOverview(): ConsumptionOverview {
  return {
    scenario: 'normal',
    currentPeriod: {
      referencePeriod: 'Julho 2026',
      readingDate: '2026-07-15',
      consumption: 35,
      unit: 'm³',
      previousPeriod: 'Junho 2026',
      previousConsumption: 32,
      comparisonLabel: '+3 m³ em relação a junho',
      usualRange: { min: 28, max: 37 },
      interpretation: 'Seu consumo está dentro da faixa esperada para esta residência, que naturalmente tem um consumo maior por ter mais moradores e área externa.',
      classification: 'dentro_do_esperado',
      classificationLabel: 'Dentro do esperado',
    },
    meterReading: {
      meterId: 'HID-2023-0621',
      meterLabel: 'Hidrômetro principal',
      installationLocation: 'Garagem — Casa 7',
      latestReading: 5120,
      previousReading: 5085,
      readingDate: '2026-07-15',
      readingMethod: 'Leitura presencial',
      nextReadingWindow: '10 a 15 de agosto de 2026',
      status: 'active',
      statusLabel: 'Ativo',
    },
    historicalData: casaCentroHistory,
    insights: [
      {
        id: 'ins-cc1',
        title: 'Consumo estável para o perfil',
        description: 'Esta residência tem um consumo naturalmente maior por contar com 4 quartos, área externa e mais moradores. Seu padrão está estável.',
      },
      {
        id: 'ins-cc2',
        title: 'Consumo de área externa',
        description: 'Casas com jardim e área externa costumam ter consumo adicional para irrigação e limpeza. Isso é normal e esperado.',
      },
    ],
    alerts: [],
    educationCards: [
      defaultEducationCards[0],
      {
        id: 'edu-cc',
        title: 'Irrigação consciente',
        description: 'Regue o jardim nas primeiras horas da manhã ou no final da tarde para reduzir a evaporação. Use regadores ou mangueiras com bico regulador.',
        icon: 'ri-plant-line',
      },
      defaultEducationCards[2],
    ],
  };
}

export function getConsumptionOverview(): ConsumptionOverview {
  return scenarioBuilders[activeConsumptionScenario]();
}

export function getHistoricalData(): HistoricalDataPoint[] {
  return scenarioBuilders[activeConsumptionScenario]().historicalData;
}

export function getReadingById(readingId: string): HistoricalDataPoint | undefined {
  const allData = scenarioBuilders[activeConsumptionScenario]().historicalData;
  return allData.find((r) => r.id === readingId);
}

// ─── Divergence Report Data ───────────────────────────────────────────

export const divergenceReasons: DivergenceReasonOption[] = [
  { value: 'nao_reconheco_consumo', label: 'Não reconheço esse consumo', description: 'O valor de consumo está muito diferente do que eu esperava' },
  { value: 'leitura_diferente', label: 'Leitura diferente do hidrômetro', description: 'O número no hidrômetro é diferente do registrado' },
  { value: 'hidrometro_sem_acesso', label: 'Hidrômetro sem acesso no período', description: 'O leiturista não conseguiu acessar o hidrômetro' },
  { value: 'imovel_desocupado', label: 'Imóvel ficou desocupado', description: 'O imóvel estava vazio durante parte ou todo o período' },
  { value: 'possivel_problema_hidrometro', label: 'Possível problema no hidrômetro', description: 'Acredito que o hidrômetro possa estar com defeito' },
  { value: 'outro', label: 'Outro motivo', description: 'Outra razão não listada acima' },
];

export function submitSimulatedDivergence(): DivergenceConfirmation {
  return {
    protocol: `DIV-${Date.now().toString(36).toUpperCase().slice(-8)}`,
    submittedDate: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    expectedStep: 'A associação analisará sua solicitação em até 5 dias úteis. Você receberá uma notificação quando houver atualização.',
  };
}