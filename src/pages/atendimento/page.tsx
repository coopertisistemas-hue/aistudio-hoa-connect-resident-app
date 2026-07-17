import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import Button from '@/components/base/Button';
import Skeleton from '@/components/base/Skeleton';
import EmptyState from '@/components/base/EmptyState';
import { useSupportData } from '@/hooks/useSupportData';
import { showToast } from '@/components/base/Toast';
import SupportDemoControls from '@/demo/SupportDemoControls';
import type { SupportRequest } from '@/fixtures/types';

export default function AtendimentoPage() {
  const navigate = useNavigate();
  const [residenceId] = useState('prop-001');
  const { data, loading, error, isOffline, refresh } = useSupportData(residenceId);

  const getStatusTypeConfig = (type: string) => {
    switch (type) {
      case 'no_requests': return { icon: 'ri-check-line', bg: 'bg-green-100', text: 'text-green-700' };
      case 'all_ok': return { icon: 'ri-information-line', bg: 'bg-primary-100', text: 'text-primary-700' };
      case 'attention': return { icon: 'ri-alert-line', bg: 'bg-amber-100', text: 'text-amber-700' };
      case 'action_needed': return { icon: 'ri-chat-1-line', bg: 'bg-accent-100', text: 'text-accent-700' };
      default: return { icon: 'ri-information-line', bg: 'bg-primary-100', text: 'text-primary-700' };
    }
  };

  if (loading && !data) {
    return (
      <AppShell>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-foreground-900 font-heading">Atendimento</h1>
            <Skeleton className="h-3 w-28 mt-1" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-2xl mb-4" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (error && !data) {
    return (
      <AppShell>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Atendimento</h1>
        </div>
        <EmptyState
          icon="ri-error-warning-line"
          title="Erro ao carregar"
          description={isOffline ? 'Você está offline.' : error}
          action={
            <Button variant="secondary" size="sm" onClick={refresh}>
              Tentar novamente
            </Button>
          }
        />
      </AppShell>
    );
  }

  const overview = data!;
  const config = getStatusTypeConfig(overview.statusType);
  const pendingRequests = overview.requests.filter((r) =>
    !['closed', 'canceled'].includes(r.status)
  );
  const closedRequests = overview.requests.filter((r) =>
    ['closed', 'canceled'].includes(r.status)
  );

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Atendimento</h1>
          <p className="text-xs text-foreground-500">
            {residenceId === 'prop-001' ? 'Apto Bloco 3' : 'Casa Centro'} · Associação Residencial Nascentes
          </p>
        </div>
        <button
          onClick={() => navigate('/atendimento/duvidas')}
          className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center cursor-pointer hover:bg-background-200 transition-colors"
          aria-label="Dúvidas frequentes"
        >
          <i className="ri-question-line text-foreground-600" />
        </button>
      </div>

      {/* Status Card */}
      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
            <i className={`${config.icon} ${config.text} text-lg`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground-900 mb-0.5">
              {overview.hasActiveRequests
                ? overview.awaitingResidentCount > 0
                  ? 'Ação necessária'
                  : 'Tudo sob controle'
                : 'Sem pendências'
              }
            </p>
            <p className="text-sm text-foreground-600">{overview.statusMessage}</p>
          </div>
        </div>

        {overview.hasActiveRequests && (
          <div className="flex gap-4 mt-3 pt-3 border-t border-background-200">
            {overview.openCount > 0 && (
              <div>
                <p className="text-lg font-bold text-foreground-900">{overview.openCount}</p>
                <p className="text-xs text-foreground-500">{overview.openCount === 1 ? 'Aberta' : 'Abertas'}</p>
              </div>
            )}
            {overview.awaitingResidentCount > 0 && (
              <div>
                <p className="text-lg font-bold text-accent-600">{overview.awaitingResidentCount}</p>
                <p className="text-xs text-foreground-500">Aguardam você</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Primary Actions */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => navigate('/atendimento/novo')}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary-500 text-white cursor-pointer active:scale-[0.97] transition-transform duration-150"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <i className="ri-add-line text-white text-lg" />
          </div>
          <span className="text-sm font-semibold whitespace-nowrap text-center">Abrir atendimento</span>
        </button>
        <button
          onClick={() => navigate('/atendimento/solicitacoes')}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-background-100 border border-background-200 cursor-pointer active:scale-[0.97] transition-transform duration-150"
        >
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <i className="ri-file-list-3-line text-foreground-600 text-lg" />
          </div>
          <span className="text-sm font-medium text-foreground-700 whitespace-nowrap text-center">Solicitações</span>
        </button>
        <button
          onClick={() => navigate('/atendimento/duvidas')}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-background-100 border border-background-200 cursor-pointer active:scale-[0.97] transition-transform duration-150"
        >
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <i className="ri-question-answer-line text-foreground-600 text-lg" />
          </div>
          <span className="text-sm font-medium text-foreground-700 whitespace-nowrap text-center">Dúvidas</span>
        </button>
        <button
          onClick={() => {
            showToast('Canais de contato disponíveis para demonstração.', 'info');
            navigate('/atendimento', { state: { showContact: true } });
          }}
          className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-background-100 border border-background-200 cursor-pointer active:scale-[0.97] transition-transform duration-150"
        >
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
            <i className="ri-phone-line text-foreground-600 text-lg" />
          </div>
          <span className="text-sm font-medium text-foreground-700 whitespace-nowrap text-center">Contato</span>
        </button>
      </div>

      {/* Pending Requests Preview */}
      {pendingRequests.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground-800">Em andamento</h3>
            {pendingRequests.length > 2 && (
              <button
                onClick={() => navigate('/atendimento/solicitacoes')}
                className="text-xs font-medium text-primary-600 cursor-pointer hover:text-primary-700 transition-colors"
              >
                Ver todas
              </button>
            )}
          </div>
          <div className="space-y-2">
            {pendingRequests.slice(0, 2).map((req) => (
              <RequestPreview key={req.id} request={req} />
            ))}
          </div>
        </div>
      )}

      {/* Recently Closed */}
      {closedRequests.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground-800">Concluídas recentemente</h3>
          </div>
          <div className="space-y-2">
            {closedRequests.slice(0, 1).map((req) => (
              <RequestPreview key={req.id} request={req} />
            ))}
          </div>
        </div>
      )}

      {/* Offline Banner */}
      {isOffline && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
          <i className="ri-wifi-off-line text-amber-600 text-sm" />
          <span className="text-sm text-amber-700">Você pode consultar dados já carregados enquanto estiver offline.</span>
        </div>
      )}

      <SupportDemoControls
        currentResidenceId={residenceId}
        onRefresh={refresh}
      />
    </AppShell>
  );
}

function RequestPreview({ request }: { request: SupportRequest }) {
  const navigate = useNavigate();
  const isClosed = ['closed', 'canceled'].includes(request.status);

  return (
    <button
      onClick={() => navigate(`/atendimento/solicitacoes/${request.id}`)}
      className="w-full text-left bg-white rounded-2xl border border-background-200 p-3.5 cursor-pointer active:scale-[0.98] transition-transform duration-150"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono text-foreground-500 whitespace-nowrap">#{request.protocol}</span>
            {request.hasUnreadMessages && (
              <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm font-medium text-foreground-800 line-clamp-1">{request.subject}</p>
          <p className="text-xs text-foreground-500 mt-0.5">
            {isClosed
              ? `${request.statusLabel} · ${new Date(request.updatedAt).toLocaleDateString('pt-BR')}`
              : `${request.categoryLabel} · Atualizado ${new Date(request.updatedAt).toLocaleDateString('pt-BR')}`
            }
          </p>
        </div>
        <Badge variant={isClosed ? 'neutral' : request.status === 'awaiting_resident' ? 'warning' : 'info'} size="sm">
          {request.statusLabel}
        </Badge>
      </div>
    </button>
  );
}