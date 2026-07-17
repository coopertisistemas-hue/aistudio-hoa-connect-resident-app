import type { MeterReadingContext } from '@/fixtures/types';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';

interface MeterReadingCardProps {
  data: MeterReadingContext;
  onViewDetails?: () => void;
}

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; icon: string }> = {
  active: { variant: 'success', icon: 'ri-check-line' },
  estimated: { variant: 'warning', icon: 'ri-contrast-line' },
  pending: { variant: 'neutral', icon: 'ri-time-line' },
  under_review: { variant: 'neutral', icon: 'ri-search-eye-line' },
};

export default function MeterReadingCard({ data, onViewDetails }: MeterReadingCardProps) {
  const config = statusConfig[data.status] || statusConfig.active;

  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
          <i className="ri-speed-mini-line text-accent-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground-800">{data.meterLabel}</p>
          <div className="flex items-center gap-1.5">
            <Badge variant={config.variant} size="sm">
              <i className={`${config.icon} text-[10px]`} />
              {data.statusLabel}
            </Badge>
            <span className="text-[10px] text-foreground-400 truncate">{data.meterId}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-background-50 rounded-lg p-2.5">
          <p className="text-foreground-400">Leitura atual</p>
          <p className="text-foreground-800 font-semibold text-sm mt-0.5">{data.latestReading}</p>
        </div>
        <div className="bg-background-50 rounded-lg p-2.5">
          <p className="text-foreground-400">Leitura anterior</p>
          <p className="text-foreground-800 font-semibold text-sm mt-0.5">{data.previousReading}</p>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-foreground-500">
        <div className="flex justify-between">
          <span>Método</span>
          <span className="text-foreground-700 text-right max-w-[60%]">{data.readingMethod}</span>
        </div>
        <div className="flex justify-between">
          <span>Próxima leitura</span>
          <span className="text-foreground-700 text-right max-w-[55%]">{data.nextReadingWindow}</span>
        </div>
      </div>

      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className="mt-3 w-full py-2 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors cursor-pointer flex items-center justify-center gap-1"
        >
          Ver detalhes da leitura
          <i className="ri-arrow-right-line" />
        </button>
      )}
    </Card>
  );
}