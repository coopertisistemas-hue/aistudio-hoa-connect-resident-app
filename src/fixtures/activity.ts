import type { ActivityItem } from '@/fixtures/types';

export const recentActivities: ActivityItem[] = [
  {
    id: 'act-001',
    type: 'invoice_issued',
    label: 'Fatura emitida',
    description: 'Fatura de Julho 2026 foi emitida no valor de R$ 347,50',
    date: '2026-07-01',
    icon: 'ri-bill-line',
  },
  {
    id: 'act-002',
    type: 'payment_received',
    label: 'Pagamento identificado',
    description: 'Pagamento da fatura de Junho 2026 foi confirmado',
    date: '2026-06-18',
    icon: 'ri-check-double-line',
  },
  {
    id: 'act-003',
    type: 'reading_recorded',
    label: 'Leitura registrada',
    description: 'Leitura do hidrômetro registrada: 22 m³',
    date: '2026-07-15',
    icon: 'ri-drop-line',
  },
  {
    id: 'act-004',
    type: 'notice_published',
    label: 'Aviso publicado',
    description: 'Manutenção programada na rede de água para 22/07',
    date: '2026-07-16',
    icon: 'ri-information-line',
  },
  {
    id: 'act-005',
    type: 'ticket_updated',
    label: 'Chamado atualizado',
    description: 'Seu chamado #2026-0042 foi atualizado pela associação',
    date: '2026-07-14',
    icon: 'ri-customer-service-line',
  },
];

export const emptyActivity: ActivityItem[] = [];