import type { HomeOverview, PrimaryStatus } from '@/fixtures/types';
import { activeScenario } from '@/fixtures/scenarios';
import { currentConsumption } from '@/fixtures/consumption';
import { currentInvoice } from '@/fixtures/invoice';
import { latestNotice } from '@/fixtures/notice';
import { openTicket, noTicket } from '@/fixtures/support';
import { recentActivities, emptyActivity } from '@/fixtures/activity';

function buildPrimaryStatus(): PrimaryStatus {
  switch (activeScenario as string) {
    case 'overdue':
      return {
        type: 'invoice_overdue',
        title: 'Fatura vencida',
        message: 'Sua fatura de Junho está vencida. Regularize para evitar suspensão dos serviços.',
        invoiceAmount: 'R$ 332,80',
        dueDate: '2026-06-20',
        dueDays: -27,
        reference: 'Junho 2026',
        statusBadge: { label: 'Vencida', variant: 'error' },
        primaryAction: { label: 'Ver fatura', path: '/faturas' },
        secondaryAction: { label: 'Emitir 2ª via', path: '/faturas' },
      };

    case 'noPending':
      return {
        type: 'no_pending',
        title: 'Sem pendências',
        message: 'Você está em dia com a associação. Nenhuma fatura pendente no momento.',
        statusBadge: { label: 'Em dia', variant: 'success' },
        primaryAction: { label: 'Ver histórico', path: '/faturas' },
      };

    case 'service_unavailable':
      return {
        type: 'service_unavailable',
        title: 'Serviço indisponível',
        message: 'Não foi possível consultar suas faturas agora. Tente novamente em alguns instantes.',
        statusBadge: { label: 'Indisponível', variant: 'neutral' },
        primaryAction: { label: 'Tentar novamente', path: '/inicio' },
      };

    case 'default':
    case 'urgentNotice':
    case 'openTicket':
    case 'multiResidence':
    default: {
      const daysUntilDue = currentInvoice.daysUntilDue;
      const isDueSoon = daysUntilDue <= 5 && daysUntilDue > 0;
      const isToday = daysUntilDue === 0;

      let title = 'Próxima fatura';
      let message: string;
      let badgeLabel: string;
      let badgeVariant: PrimaryStatus['statusBadge']['variant'] = 'info';

      if (isToday) {
        message = 'Sua fatura de Julho vence hoje. Efetue o pagamento para manter os serviços em dia.';
        badgeLabel = 'Vence hoje';
        badgeVariant = 'warning';
      } else if (isDueSoon) {
        const daysText = daysUntilDue === 1 ? 'amanhã' : `em ${daysUntilDue} dias`;
        message = `Sua fatura de Julho vence ${daysText}. Não deixe para a última hora!`;
        badgeLabel = `Vence em ${daysUntilDue} dias`;
        badgeVariant = 'warning';
      } else {
        message = 'Tudo certo com sua fatura. O vencimento ainda está longe.';
        badgeLabel = 'A vencer';
      }

      return {
        type: 'invoice_pending',
        title,
        message,
        invoiceAmount: currentInvoice.formattedAmount,
        dueDate: currentInvoice.dueDate,
        dueDays: daysUntilDue,
        reference: currentInvoice.reference,
        statusBadge: { label: badgeLabel, variant: badgeVariant },
        primaryAction: { label: 'Ver fatura', path: '/faturas' },
        secondaryAction: daysUntilDue <= 5 ? { label: 'Emitir 2ª via', path: '/faturas' } : undefined,
      };
    }
  }
}

function getConsumptionPreview() {
  if (activeScenario === 'noConsumption') {
    return {
      available: false,
    } as const;
  }

  return {
    available: true,
    month: currentConsumption.month,
    consumption: currentConsumption.consumption,
    unit: currentConsumption.unit,
    previousConsumption: currentConsumption.previousConsumption,
    variationPercent: currentConsumption.variationPercent,
    trend: currentConsumption.trend as 'up' | 'down' | 'stable',
    averageDaily: currentConsumption.averageDaily,
    history: currentConsumption.history,
    readingDate: currentConsumption.readingDate,
    nextReadingEstimate: currentConsumption.nextReadingEstimate,
    maxConsumption: Math.max(...currentConsumption.history.map(h => h.consumption)),
  };
}

function getNoticePreview() {
  if (activeScenario === 'urgentNotice') {
    return {
      id: 'notice-urgent-001',
      title: 'URGENTE: Interrupção de água — Amanhã',
      summary: 'A Sanepar informou interrupção emergencial no fornecimento de água amanhã, dia 18, das 6h às 18h. Abasteça seus reservatórios.',
      date: '2026-07-17',
      type: 'urgent' as const,
      priority: 'high' as const,
      isNew: true,
      category: 'Interrupção',
      fullContent: `⚠️ AVISO URGENTE\n\nA Sanepar informou que haverá interrupção emergencial no fornecimento de água amanhã, dia 18 de julho de 2026, das 6h às 18h, devido a reparos na rede principal da Rua das Nascentes.\n\nRecomendamos:\n- Abastecer reservatórios e caixas d'água ainda hoje\n- Economizar água durante o dia de hoje\n- Evitar uso de máquinas de lavar durante a interrupção\n\nA previsão de retorno é às 18h, mas pode haver variação.\n\nDúvidas: (41) 3333-4444`,
    };
  }

  return {
    id: latestNotice.id,
    title: latestNotice.title,
    summary: latestNotice.summary,
    date: latestNotice.date,
    type: latestNotice.type as 'maintenance' | 'meeting' | 'info',
    priority: latestNotice.priority as 'high' | 'normal' | 'low',
    isNew: latestNotice.isNew,
    category: latestNotice.type === 'maintenance' ? 'Manutenção' : latestNotice.type === 'meeting' ? 'Assembleia' : 'Informativo',
    fullContent: `${latestNotice.title}\n\n${latestNotice.summary}\n\nPublicado em: ${new Date(latestNotice.date).toLocaleDateString('pt-BR')}\n\nPara mais informações, entre em contato com a associação.`,
  };
}

function getSupportPreview() {
  if (activeScenario === 'openTicket') return openTicket;
  return noTicket;
}

function getActivity() {
  if (activeScenario === 'partialError') return emptyActivity;
  return recentActivities.slice(0, 3);
}

export function fetchHomeOverview(): Promise<HomeOverview> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (activeScenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (activeScenario === 'partialError') {
        resolve({
          scenario: activeScenario,
          primaryStatus: buildPrimaryStatus(),
          consumptionPreview: getConsumptionPreview(),
          noticePreview: getNoticePreview(),
          supportPreview: getSupportPreview(),
          recentActivity: getActivity(),
        });
        return;
      }

      resolve({
        scenario: activeScenario,
        primaryStatus: buildPrimaryStatus(),
        consumptionPreview: getConsumptionPreview(),
        noticePreview: getNoticePreview(),
        supportPreview: getSupportPreview(),
        recentActivity: getActivity(),
      });
    }, 800);
  });
}