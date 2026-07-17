import type { FinancialOverview } from '@/fixtures/types';
import Card from '@/components/base/Card';

interface FinancialSummaryCardProps {
  overview: FinancialOverview;
  onNavigate: (path: string) => void;
}

const statusConfig: Record<string, { icon: string; bg: string; text: string }> = {
  tudo_em_dia: { icon: 'ri-check-double-line', bg: 'bg-green-100 text-green-700', text: 'text-green-700' },
  vencimento_proximo: { icon: 'ri-time-line', bg: 'bg-amber-100 text-amber-700', text: 'text-amber-700' },
  pendente_identificacao: { icon: 'ri-hourglass-line', bg: 'bg-amber-100 text-amber-700', text: 'text-amber-700' },
  fatura_vencida: { icon: 'ri-error-warning-line', bg: 'bg-red-100 text-red-700', text: 'text-red-700' },
  dados_em_revisao: { icon: 'ri-search-eye-line', bg: 'bg-background-200 text-foreground-600', text: 'text-foreground-600' },
  nenhuma_fatura: { icon: 'ri-file-list-3-line', bg: 'bg-background-200 text-foreground-600', text: 'text-foreground-600' },
  servico_indisponivel: { icon: 'ri-cloud-off-line', bg: 'bg-background-200 text-foreground-600', text: 'text-foreground-600' },
};

export default function FinancialSummaryCard({ overview, onNavigate }: FinancialSummaryCardProps) {
  const config = statusConfig[overview.accountStatus] || statusConfig.tudo_em_dia;

  return (
    <Card variant="filled" className="border-l-4 border-l-primary-500">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
          <i className={`${config.icon} text-lg`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.bg}`}>
              {overview.accountStatusLabel}
            </span>
          </div>
          <p className="text-sm text-foreground-700 leading-relaxed">
            {overview.accountStatusMessage}
          </p>
        </div>
      </div>

      {overview.nextDueInvoice && (
        <button
          onClick={() => onNavigate(`/faturas/${overview.nextDueInvoice!.id}`)}
          className="w-full flex items-center justify-between p-3 rounded-lg bg-background-100 hover:bg-background-200 transition-colors cursor-pointer mt-2"
        >
          <div className="text-left">
            <span className="text-xs text-foreground-500 block">Próxima fatura</span>
            <span className="text-sm font-semibold text-foreground-900">
              {overview.nextDueInvoice.reference} — {overview.nextDueInvoice.formattedAmount}
            </span>
          </div>
          <div className="text-right flex items-center gap-1">
            <span className="text-xs text-foreground-500">
              Vence {new Date(overview.nextDueInvoice.dueDate).toLocaleDateString('pt-BR')}
            </span>
            <i className="ri-arrow-right-s-line text-foreground-400" />
          </div>
        </button>
      )}

      {overview.overdueAmount !== null && overview.overdueAmount > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-background-200">
          <span className="text-sm text-foreground-600">Valor vencido</span>
          <span className="text-lg font-bold text-red-600">{overview.overdueFormattedAmount}</span>
        </div>
      )}
    </Card>
  );
}