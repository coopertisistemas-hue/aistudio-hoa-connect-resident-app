import { useNavigate } from 'react-router-dom';
import type { ConsumptionAlert } from '@/fixtures/types';
import Card from '@/components/base/Card';

interface AlertsSectionProps {
  alerts: ConsumptionAlert[];
}

const severityConfig: Record<string, { bg: string; text: string; border: string; icon: string; iconBg: string }> = {
  attention: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: 'ri-alert-fill',
    iconBg: 'bg-red-100 text-red-600',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: 'ri-error-warning-fill',
    iconBg: 'bg-amber-100 text-amber-600',
  },
  info: {
    bg: 'bg-primary-50',
    text: 'text-primary-800',
    border: 'border-primary-200',
    icon: 'ri-information-fill',
    iconBg: 'bg-primary-100 text-primary-600',
  },
};

export default function AlertsSection({ alerts }: AlertsSectionProps) {
  const navigate = useNavigate();

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const config = severityConfig[alert.severity] || severityConfig.info;
        return (
          <Card key={alert.id} className={`${config.bg} ${config.border}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.iconBg}`}>
                <i className={`${config.icon} text-sm`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.text}`}>
                    {alert.severityLabel}
                  </span>
                  <span className="text-[10px] text-foreground-400">{alert.date}</span>
                </div>
                <p className={`text-sm font-semibold ${config.text}`}>{alert.title}</p>
                <p className={`text-xs mt-1 leading-relaxed ${config.text} opacity-80`}>{alert.description}</p>
                <p className="text-xs mt-2 font-medium text-foreground-700">{alert.recommendedAction}</p>
                {alert.contactAction && (
                  <button
                    onClick={() => navigate('/atendimento')}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 bg-white/60 rounded-full px-3 py-1.5 hover:bg-white/90 transition-colors cursor-pointer"
                  >
                    <i className="ri-customer-service-line" />
                    Falar com a associação
                  </button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}