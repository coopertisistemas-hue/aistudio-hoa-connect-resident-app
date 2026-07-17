import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import type { SupportPreviewData } from '@/fixtures/types';

interface Props {
  support: SupportPreviewData | null;
}

const statusConfig: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'error' }> = {
  open: { label: 'Aberto', variant: 'info' },
  in_progress: { label: 'Em andamento', variant: 'warning' },
  waiting: { label: 'Aguardando', variant: 'warning' },
  resolved: { label: 'Resolvido', variant: 'success' },
};

export default function SupportPreviewCard({ support }: Props) {
  const navigate = useNavigate();

  if (!support) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
            <i className="ri-customer-service-line text-secondary-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground-800">Precisa de ajuda?</p>
            <p className="text-xs text-foreground-500">Entre em contato com a associação para abrir um chamado.</p>
          </div>
          <button
            onClick={() => navigate('/atendimento')}
            className="px-3 py-2 text-xs font-medium text-secondary-700 bg-secondary-100 rounded-lg hover:bg-secondary-200 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
          >
            Abrir
          </button>
        </div>
      </Card>
    );
  }

  const sc = statusConfig[support.status] || statusConfig.open;

  return (
    <Card onClick={() => navigate('/atendimento')}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
            <i className="ri-customer-service-line text-secondary-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-foreground-500">Chamado em andamento</p>
            <p className="text-sm font-medium text-foreground-800">
              Protocolo #{support.protocol}
            </p>
          </div>
        </div>
        <Badge variant={sc.variant as any} size="sm">{sc.label}</Badge>
      </div>
      <div className="ml-11">
        <p className="text-xs text-foreground-700 mb-0.5">{support.category}</p>
        <p className="text-xs text-foreground-500 line-clamp-1">{support.description}</p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-foreground-400">
            Atualizado em {new Date(support.lastUpdate).toLocaleDateString('pt-BR')}
          </p>
          <span className="text-xs font-medium text-primary-600 flex items-center gap-1">
            Acompanhar
            <i className="ri-arrow-right-line text-xs" />
          </span>
        </div>
      </div>
    </Card>
  );
}