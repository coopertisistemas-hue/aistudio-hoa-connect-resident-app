import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import type { PrimaryStatus } from '@/fixtures/types';

interface Props {
  status: PrimaryStatus;
}

export default function PrimaryStatusCard({ status }: Props) {
  const navigate = useNavigate();

  return (
    <Card variant={status.type === 'invoice_overdue' ? 'filled' : 'default'}>
      <div className={status.type === 'invoice_overdue' ? 'bg-red-50 rounded-xl p-4' : ''}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs text-foreground-500 mb-0.5">{status.title}</p>
            {status.reference && (
              <p className="text-sm font-medium text-foreground-800">{status.reference}</p>
            )}
          </div>
          <Badge variant={status.statusBadge.variant} size="sm">
            {status.statusBadge.label}
          </Badge>
        </div>

        {status.invoiceAmount && (
          <p className="text-2xl font-bold text-foreground-900 mb-1">
            {status.invoiceAmount}
          </p>
        )}

        <p className="text-sm text-foreground-600 leading-relaxed mb-3">
          {status.message}
        </p>

        {status.dueDate && (
          <div className="flex items-center gap-2 text-xs text-foreground-500 mb-3">
            <i className="ri-calendar-line" />
            <span>Vencimento: {new Date(status.dueDate).toLocaleDateString('pt-BR')}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(status.primaryAction.path)}
            className="px-4 py-2.5 text-sm font-medium text-white bg-primary-500 rounded-xl hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
          >
            {status.primaryAction.label}
            <i className="ri-arrow-right-line" />
          </button>
          {status.secondaryAction && (
            <button
              onClick={() => navigate(status.secondaryAction!.path)}
              className="px-4 py-2.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-xl hover:bg-primary-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              {status.secondaryAction.label}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}