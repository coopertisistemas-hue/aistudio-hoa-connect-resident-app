import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import { SkeletonCard } from '@/components/base/Skeleton';
import { useConsumoData } from '@/hooks/useConsumoData';

type FilterType = 'todas' | 'registradas' | 'estimadas' | 'pendentes';

const filterLabels: Record<FilterType, string> = {
  todas: 'Todas',
  registradas: 'Registradas',
  estimadas: 'Estimadas',
  pendentes: 'Pendentes',
};

const statusBadgeConfig: Record<string, { variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; icon: string }> = {
  registered: { variant: 'success', icon: 'ri-check-line' },
  estimated: { variant: 'warning', icon: 'ri-contrast-line' },
  revised: { variant: 'info', icon: 'ri-loop-left-line' },
  pending: { variant: 'neutral', icon: 'ri-time-line' },
  not_performed: { variant: 'neutral', icon: 'ri-close-circle-line' },
  under_review: { variant: 'warning', icon: 'ri-search-eye-line' },
};

export default function LeiturasPage() {
  const navigate = useNavigate();
  const { history, loading, error, residenceId } = useConsumoData();
  const [filter, setFilter] = useState<FilterType>('todas');

  const filteredHistory = history.filter((r) => {
    if (filter === 'todas') return true;
    if (filter === 'registradas') return r.status === 'registered' || r.status === 'revised';
    if (filter === 'estimadas') return r.status === 'estimated';
    if (filter === 'pendentes') return r.status === 'pending' || r.status === 'not_performed' || r.status === 'under_review';
    return true;
  });

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <EmptyState
          icon="ri-error-warning-line"
          title="Não foi possível carregar"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/consumo')}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background-100 cursor-pointer flex-shrink-0"
          >
            <i className="ri-arrow-left-line text-foreground-500" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground-900 font-heading">Histórico de leituras</h1>
            <p className="text-xs text-foreground-500">{residenceId === 'prop-002' ? 'Casa Centro' : 'Apto Bloco 3'}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-background-200 rounded-full p-1">
          {(Object.entries(filterLabels) as [FilterType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`
                flex-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap
                ${filter === key
                  ? 'bg-white text-foreground-900 shadow-sm'
                  : 'text-foreground-500 hover:text-foreground-700'}
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Reading list */}
        {filteredHistory.length === 0 ? (
          <EmptyState
            icon="ri-file-list-3-line"
            title="Nenhuma leitura encontrada"
            description="Não há leituras correspondentes ao filtro selecionado."
          />
        ) : (
          <div className="space-y-2">
            {filteredHistory.map((reading) => {
              const config = statusBadgeConfig[reading.status] || statusBadgeConfig.registered;
              return (
                <Card
                  key={reading.id}
                  onClick={() => navigate(`/consumo/leituras/${reading.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
                        <i className="ri-calendar-check-line text-accent-600 text-sm" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground-800">{reading.period}</p>
                        <p className="text-[10px] text-foreground-400">{reading.readingDate}</p>
                      </div>
                    </div>
                    <Badge variant={config.variant} size="sm">
                      <i className={`${config.icon} text-[10px]`} />
                      {reading.statusLabel}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background-50 rounded-lg p-2">
                      <p className="text-foreground-400">Leitura</p>
                      <p className="text-foreground-800 font-semibold mt-0.5">
                        {reading.readingValue > 0 ? reading.readingValue : '—'}
                      </p>
                    </div>
                    <div className="bg-background-50 rounded-lg p-2">
                      <p className="text-foreground-400">Consumo</p>
                      <p className="text-foreground-800 font-semibold mt-0.5">
                        {reading.consumption > 0 ? `${reading.consumption} m³` : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-foreground-400 flex items-center gap-1">
                    <span>{reading.readingOrigin}</span>
                    {reading.comparison && (
                      <>
                        <span>·</span>
                        <span>{reading.comparison}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-primary-600">
                    <span>Ver detalhes</span>
                    <i className="ri-arrow-right-s-line" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="h-4" />
      </div>
    </AppShell>
  );
}