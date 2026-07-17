import type { SupportPreviewData } from '@/fixtures/types';

export const openTicket: SupportPreviewData = {
  protocol: '2026-0042',
  category: 'Vazamento',
  status: 'in_progress',
  statusLabel: 'Em andamento',
  lastUpdate: '2026-07-14',
  description: 'Vazamento identificado na área de serviço. Equipe técnica notificada.',
};

export const waitingTicket: SupportPreviewData = {
  protocol: '2026-0038',
  category: 'Solicitação de documento',
  status: 'waiting',
  statusLabel: 'Aguardando associação',
  lastUpdate: '2026-07-05',
  description: 'Declaração de residência solicitada para matrícula escolar.',
};

export const noTicket: null = null;