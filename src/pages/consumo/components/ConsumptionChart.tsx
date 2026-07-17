import { useState } from 'react';
import type { HistoricalDataPoint } from '@/fixtures/types';
import Card from '@/components/base/Card';

interface ConsumptionChartProps {
  data: HistoricalDataPoint[];
  selectedReadingId: string | null;
  onSelectReading: (id: string) => void;
  timeRange: number; // months to show
  error?: boolean;
}

const statusColors: Record<string, string> = {
  registered: '#0d6b6e',
  estimated: '#d97706',
  revised: '#6366f1',
  pending: '#9ca3af',
  not_performed: '#e5e7eb',
  under_review: '#f59e0b',
};

export default function ConsumptionChart({
  data,
  selectedReadingId,
  onSelectReading,
  timeRange,
  error = false,
}: ConsumptionChartProps) {
  const visible = data.slice(0, timeRange).reverse();
  const maxVal = Math.max(...visible.map((d) => d.consumption || 0), 1);
  const [chartTabIndex, setChartTabIndex] = useState(0);

  const chartWidth = 320;
  const chartHeight = 140;
  const padding = { top: 8, bottom: 32, left: 0, right: 4 };
  const barGap = 4;
  const barCount = visible.length;
  const barWidth = Math.max(6, (chartWidth - padding.left - padding.right - barGap * (barCount - 1)) / barCount);

  if (error) {
    return (
      <Card>
        <p className="text-sm font-medium text-foreground-800 mb-1">Histórico de consumo</p>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-2">
            <i className="ri-bar-chart-line text-red-500" />
          </div>
          <p className="text-xs text-red-600">Não conseguimos carregar o histórico agora.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm font-medium text-foreground-800 mb-1">Histórico de consumo</p>
      <p className="text-xs text-foreground-400 mb-4">{data.length} períodos registrados</p>

      <div className="overflow-x-auto -mx-1 pb-1" role="img" aria-label={`Gráfico de barras mostrando consumo de água dos últimos ${timeRange} meses. Valor máximo: ${maxVal} metros cúbicos.`}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + padding.top + padding.bottom}`}
          width={Math.max(chartWidth, barCount * (barWidth + barGap) + 20)}
          height={chartHeight + padding.top + padding.bottom}
          className="mx-auto"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + chartHeight * (1 - ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="0.5"
                  strokeDasharray="3 3"
                />
                {ratio > 0 && (
                  <text x={chartWidth - padding.right} y={y - 4} textAnchor="end" fontSize="8" fill="#9ca3af">
                    {Math.round(maxVal * ratio)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Bars */}
          {visible.map((point, i) => {
            const x = padding.left + i * (barWidth + barGap);
            const barH = point.consumption > 0 ? Math.max(2, (point.consumption / maxVal) * chartHeight) : 2;
            const y = padding.top + chartHeight - barH;
            const isSelected = selectedReadingId === point.id;
            const color = statusColors[point.status] || statusColors.registered;

            return (
              <g
                key={point.id}
                className="cursor-pointer"
                onClick={() => onSelectReading(point.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectReading(point.id); } }}
                tabIndex={chartTabIndex + i}
                role="button"
                aria-label={`${point.period}: ${point.consumption > 0 ? point.consumption + ' m³' : 'Sem dados'}, ${point.statusLabel}`}
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx={1.5}
                  fill={color}
                  opacity={isSelected ? 0.95 : 0.7}
                  stroke={isSelected ? color : 'none'}
                  strokeWidth={isSelected ? 1.5 : 0}
                />
                {isSelected && (
                  <rect
                    x={x - 1}
                    y={y - 2}
                    width={barWidth + 2}
                    height={barH + 4}
                    rx={2.5}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}
                <text
                  x={x + barWidth / 2}
                  y={padding.top + chartHeight + 14}
                  textAnchor="middle"
                  fontSize="8"
                  fill={isSelected ? '#374151' : '#9ca3af'}
                  fontWeight={isSelected ? 600 : 400}
                >
                  {point.period.split(' ')[0].slice(0, 3)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
        {[
          { status: 'registered', label: 'Registrada' },
          { status: 'estimated', label: 'Estimada' },
          { status: 'revised', label: 'Revisada' },
        ].map((s) => (
          <span key={s.status} className="flex items-center gap-1 text-foreground-500">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: statusColors[s.status] }} />
            {s.label}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function ChartSkeleton() {
  return (
    <Card>
      <div className="animate-pulse">
        <div className="h-4 w-32 bg-background-200 rounded mb-1" />
        <div className="h-3 w-24 bg-background-100 rounded mb-4" />
        <div className="h-[140px] bg-background-100 rounded-lg flex items-end justify-around px-4 pb-2 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="bg-background-200 rounded-t-sm w-6"
              style={{ height: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
        <div className="flex justify-around mt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-2 w-6 bg-background-100 rounded" />
          ))}
        </div>
      </div>
    </Card>
  );
}