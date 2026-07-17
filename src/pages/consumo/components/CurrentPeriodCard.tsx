import type { CurrentPeriodSummary, ConsumptionClassification } from '@/fixtures/types';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';

interface CurrentPeriodCardProps {
  data: CurrentPeriodSummary;
}

const classificationConfig: Record<ConsumptionClassification, { variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; icon: string }> = {
  dentro_do_esperado: { variant: 'success', icon: 'ri-check-line' },
  abaixo_do_habitual: { variant: 'info', icon: 'ri-arrow-down-line' },
  acima_do_habitual: { variant: 'warning', icon: 'ri-arrow-up-line' },
  atencao_recomendada: { variant: 'error', icon: 'ri-alert-line' },
  leitura_indisponivel: { variant: 'neutral', icon: 'ri-time-line' },
  dados_em_revisao: { variant: 'neutral', icon: 'ri-search-eye-line' },
};

export default function CurrentPeriodCard({ data }: CurrentPeriodCardProps) {
  const config = classificationConfig[data.classification];

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-foreground-500 font-medium uppercase tracking-wider">Período atual</p>
          <p className="text-sm font-semibold text-foreground-800 mt-0.5">{data.referencePeriod}</p>
        </div>
        <Badge variant={config.variant} size="sm">
          <i className={`${config.icon} text-[10px]`} />
          {data.classificationLabel}
        </Badge>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-4xl font-bold text-foreground-900 font-heading">
          {data.consumption > 0 ? data.consumption : '—'}
        </span>
        {data.consumption > 0 && (
          <span className="text-sm text-foreground-500">{data.unit}</span>
        )}
      </div>

      <p className="text-xs text-foreground-500 mb-3">
        {data.comparisonLabel}
      </p>

      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-background-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-500"
            style={{ width: `${Math.min((data.consumption / (data.usualRange.max * 1.5)) * 100, 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-foreground-400 whitespace-nowrap">
          Faixa: {data.usualRange.min}–{data.usualRange.max} m³
        </span>
      </div>

      <div className="bg-background-50 rounded-xl p-3">
        <p className="text-xs text-foreground-600 leading-relaxed">
          {data.interpretation}
        </p>
        {data.readingDate && data.readingDate !== '—' && (
          <p className="text-[10px] text-foreground-400 mt-2">
            Leitura realizada em {new Date(data.readingDate).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>
    </Card>
  );
}