import { useNavigate } from 'react-router-dom';
import Badge from '@/components/base/Badge';
import type { SupportRequest } from '@/fixtures/types';

interface Props {
  request: SupportRequest;
}

const statusVariant: Record<string, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  'Em triagem': 'info',
  'Em análise': 'warning',
  'Em andamento': 'warning',
  'Enviada': 'info',
  'Recebida': 'info',
  'Aguardando morador': 'warning',
  'Aguardando associação': 'info',
  'Visita agendada': 'info',
  'Visita confirmada': 'success',
  'Resolvida': 'success',
  'Concluída': 'success',
  'Cancelada': 'neutral',
  'Reaberta': 'warning',
};

export default function RequestItemCard({ request }: Props) {
  const navigate = useNavigate();

  const variant = statusVariant[request.statusLabel] || 'info';

  return (
    <button
      onClick={() => navigate(`/atendimento/solicitacoes/${request.id}`)}
      className="w-full text-left bg-white rounded-2xl border border-background-200 p-4 cursor-pointer active:scale-[0.98] transition-transform duration-150 hover:bg-background-50"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-foreground-500 whitespace-nowrap">
              #{request.protocol}
            </span>
            {request.priority === 'urgent' && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm font-semibold text-foreground-900 line-clamp-1 mb-0.5">
            {request.subject}
          </p>
          <p className="text-xs text-foreground-500 line-clamp-1">
            {request.categoryLabel}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <Badge variant={variant} size="sm">{request.statusLabel}</Badge>
          {request.hasUnreadMessages && (
            <span className="w-2.5 h-2.5 rounded-full bg-primary-500" aria-label="Mensagem não lida" />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-400">
            Atualizado em {new Date(request.updatedAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
        <span className="text-xs text-foreground-500">
          {request.residenceNickname}
        </span>
      </div>
    </button>
  );
}