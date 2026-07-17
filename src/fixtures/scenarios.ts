export type ScenarioKey =
  | 'default'
  | 'overdue'
  | 'noPending'
  | 'noConsumption'
  | 'urgentNotice'
  | 'openTicket'
  | 'multiResidence'
  | 'offline'
  | 'partialError';

export const scenarios: ScenarioKey[] = [
  'default',
  'overdue',
  'noPending',
  'noConsumption',
  'urgentNotice',
  'openTicket',
  'multiResidence',
  'offline',
  'partialError',
];

export const scenarioLabels: Record<ScenarioKey, string> = {
  default: 'Situação normal',
  overdue: 'Fatura vencida',
  noPending: 'Sem pendências',
  noConsumption: 'Sem dados de consumo',
  urgentNotice: 'Aviso urgente',
  openTicket: 'Chamado aberto',
  multiResidence: 'Múltiplas residências',
  offline: 'Modo offline',
  partialError: 'Erro parcial',
};

export let activeScenario: ScenarioKey = 'default';

export function setScenario(scenario: ScenarioKey) {
  activeScenario = scenario;
}

export function getScenario(): ScenarioKey {
  return activeScenario;
}