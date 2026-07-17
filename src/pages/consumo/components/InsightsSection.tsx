import type { ConsumptionInsight } from '@/fixtures/types';
import Card from '@/components/base/Card';

interface InsightsSectionProps {
  insights: ConsumptionInsight[];
  unavailable?: boolean;
}

export default function InsightsSection({ insights, unavailable = false }: InsightsSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground-800 font-heading mb-3">Entenda seu consumo</h3>

      {unavailable && (
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-information-line text-amber-600" />
            </div>
            <p className="text-xs text-foreground-500">As análises deste período estão temporariamente indisponíveis.</p>
          </div>
        </Card>
      )}

      {!unavailable && insights.length === 0 && (
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-background-200 flex items-center justify-center flex-shrink-0">
              <i className="ri-information-line text-foreground-400" />
            </div>
            <p className="text-xs text-foreground-500">Não há análises disponíveis para este período.</p>
          </div>
        </Card>
      )}

      {!unavailable && insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight) => (
            <Card key={insight.id}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-lightbulb-line text-accent-600 text-sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground-800">{insight.title}</p>
                  <p className="text-xs text-foreground-500 mt-1 leading-relaxed">{insight.description}</p>
                  {insight.recommendation && (
                    <p className="text-xs text-primary-600 mt-1.5 italic">{insight.recommendation}</p>
                  )}
                  {insight.action && (
                    <a
                      href={insight.action.path || '#'}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 cursor-pointer"
                    >
                      {insight.action.label}
                      <i className="ri-arrow-right-line" />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}