import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Button from '@/components/base/Button';
import Skeleton from '@/components/base/Skeleton';
import EmptyState from '@/components/base/EmptyState';
import OfflineBanner from '@/components/base/OfflineBanner';
import { useRequestList } from '@/hooks/useSupportData';
import RequestItemCard from '@/pages/atendimento/components/RequestItemCard';
import RequestFilterBar from '@/pages/atendimento/components/RequestFilterBar';

type FilterKey = 'all' | 'open' | 'awaiting_resident' | 'closed' | 'canceled';

const filterOptions: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'open', label: 'Abertas' },
  { key: 'awaiting_resident', label: 'Aguardando' },
  { key: 'closed', label: 'Concluídas' },
  { key: 'canceled', label: 'Canceladas' },
];

export default function SolicitacoesPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const { requests, loading, error, isOffline, refresh } = useRequestList('prop-001');

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'open':
        return requests.filter((r) => !['closed', 'canceled'].includes(r.status));
      case 'awaiting_resident':
        return requests.filter((r) => r.status === 'awaiting_resident');
      case 'closed':
        return requests.filter((r) => r.status === 'closed');
      case 'canceled':
        return requests.filter((r) => r.status === 'canceled');
      default:
        return requests;
    }
  }, [requests, activeFilter]);

  const filterWithCounts = filterOptions.map((f) => ({
    ...f,
    count: (() => {
      switch (f.key) {
        case 'all': return requests.length;
        case 'open': return requests.filter((r) => !['closed', 'canceled'].includes(r.status)).length;
        case 'awaiting_resident': return requests.filter((r) => r.status === 'awaiting_resident').length;
        case 'closed': return requests.filter((r) => r.status === 'closed').length;
        case 'canceled': return requests.filter((r) => r.status === 'canceled').length;
      }
    })(),
  }));

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center cursor-pointer">
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Solicitações</h1>
        </div>
        <Skeleton className="h-10 w-full rounded-full mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (error && requests.length === 0) {
    return (
      <AppShell>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center cursor-pointer">
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Solicitações</h1>
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

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center cursor-pointer hover:bg-background-200 transition-colors flex-shrink-0"
        >
          <i className="ri-arrow-left-line text-foreground-600" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Solicitações</h1>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-4">
        <RequestFilterBar
          options={filterWithCounts}
          activeKey={activeFilter}
          onChange={(k) => setActiveFilter(k as FilterKey)}
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="ri-inbox-line"
          title={activeFilter === 'all' ? 'Nenhuma solicitação' : 'Nenhum resultado'}
          description={
            activeFilter === 'all'
              ? 'Você ainda não abriu nenhum atendimento.'
              : `Nenhuma solicitação encontrada no filtro "${filterOptions.find((f) => f.key === activeFilter)?.label}".`
          }
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/atendimento/novo')}>
              Abrir atendimento
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {error && (
            <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 mb-3 flex items-center gap-2">
              <i className="ri-alert-line text-amber-600" />
              Algumas solicitações podem não estar atualizadas.
            </div>
          )}
          {filtered.map((req) => (
            <RequestItemCard key={req.id} request={req} />
          ))}
        </div>
      )}

      {isOffline && <OfflineBanner />}
    </AppShell>
  );
}