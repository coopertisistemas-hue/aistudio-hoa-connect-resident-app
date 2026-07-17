import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import type { ConsumptionPreviewData } from '@/fixtures/types';

interface Props {
  data: ConsumptionPreviewData;
}

export default function ConsumptionPreviewCard({ data }: Props) {
  const navigate = useNavigate();

  if (!data.available) {
    return (
      <Card onClick={() => navigate('/consumo')}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
            <i className="ri-drop-line text-accent-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground-800">Consumo de água</p>
            <p className="text-xs text-foreground-500">Dados de consumo indisponíveis no momento.</p>
          </div>
          <i className="ri-arrow-right-s-line text-foreground-400 flex-shrink-0" />
        </div>
      </Card>
    );
  }

  const trendIcon = data.trend === 'up' ? 'ri-arrow-up-line' : data.trend === 'down' ? 'ri-arrow-down-line' : 'ri-subtract-line';
  const trendColor = data.trend === 'up' ? 'text-amber-600' : data.trend === 'down' ? 'text-green-600' : 'text-foreground-500';
  const trendBg = data.trend === 'up' ? 'bg-amber-100' : data.trend === 'down' ? 'bg-green-100' : 'bg-background-200';

  const maxConsumption = data.maxConsumption || Math.max(...(data.history?.map(h => h.consumption) || [20]));

  return (
    <Card onClick={() => navigate('/consumo')}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-foreground-500 mb-0.5">Consumo de água</p>
          <p className="text-sm font-medium text-foreground-800">{data.month}</p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${trendBg} ${trendColor}`}>
          <i className={trendIcon} />
          <span>{Math.abs(data.variationPercent || 0)}%</span>
        </div>
      </div>

      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-bold text-foreground-900">{data.consumption}</span>
        <span className="text-sm text-foreground-500">{data.unit}</span>
      </div>

      {data.history && data.history.length > 0 && (
        <div className="flex items-end gap-1 h-12 mb-2">
          {data.history.map((h, i) => {
            const barHeight = Math.max(4, (h.consumption / maxConsumption) * 48);
            const isCurrent = i === data.history!.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-sm transition-all ${isCurrent ? 'bg-primary-500' : 'bg-background-300'}`}
                  style={{ height: `${barHeight}px` }}
                />
                <span className={`text-[9px] ${isCurrent ? 'text-primary-600 font-medium' : 'text-foreground-400'}`}>
                  {h.month.slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-foreground-500">
        <span>Média diária: {data.averageDaily} m³</span>
        <span className="text-foreground-300">·</span>
        <span>Mês anterior: {data.previousConsumption} m³</span>
      </div>
    </Card>
  );
}