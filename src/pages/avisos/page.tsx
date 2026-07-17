import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import { SkeletonList } from '@/components/base/Skeleton';
import { showToast } from '@/components/base/Toast';
import { useNotificationsData } from '@/hooks/useNotificationsData';
import type { NoticeFilterKey, NoticeItem } from '@/fixtures/types';

const priorityConfig: Record<string, { badge: 'warning' | 'error' | 'neutral'; icon: string }> = {
  info: { badge: 'neutral', icon: 'ri-information-line' },
  important: { badge: 'warning', icon: 'ri-error-warning-line' },
  urgent: { badge: 'error', icon: 'ri-alert-line' },
};

const categoryIcons: Record<string, string> = {
  maintenance: 'ri-tools-line',
  interruption: 'ri-alert-line',
  general: 'ri-information-line',
  meeting: 'ri-group-line',
  billing: 'ri-money-dollar-circle-line',
  water: 'ri-drop-line',
  emergency: 'ri-alert-line',
};

const filterTabs: { key: NoticeFilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'important', label: 'Importantes' },
  { key: 'maintenance', label: 'Manutenção' },
  { key: 'interruption', label: 'Interrupções' },
  { key: 'community', label: 'Comunidade' },
  { key: 'financial', label: 'Financeiro' },
  { key: 'archived', label: 'Arquivados' },
];

function NoticeCard({ notice }: { notice: NoticeItem }) {
  const navigate = useNavigate();
  const priority = priorityConfig[notice.priority] || priorityConfig.info;

  return (
    <Card
      variant={!notice.read && notice.priority === 'urgent' ? 'filled' : 'default'}
      onClick={() => navigate(`/avisos/${notice.id}`)}
      className={notice.priority === 'urgent' ? 'bg-red-50/40 border-red-200' : ''}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          notice.priority === 'urgent' ? 'bg-red-100' : !notice.read ? 'bg-accent-100' : 'bg-background-200'
        }`}>
          <i className={`${categoryIcons[notice.category] || 'ri-megaphone-line'} text-base ${
            notice.priority === 'urgent' ? 'text-red-600' : !notice.read ? 'text-accent-600' : 'text-foreground-400'
          }`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-[11px] font-medium text-foreground-400 uppercase tracking-wide">
              {notice.categoryLabel}
            </span>
            {notice.priority !== 'info' && (
              <Badge variant={priority.badge} size="sm">
                <i className={`${priority.icon} text-[10px]`} />
                <span>{notice.priorityLabel}</span>
              </Badge>
            )}
            {!notice.read && (
              <span className="w-2 h-2 rounded-full bg-accent-500 flex-shrink-0" aria-label="Não lido" />
            )}
          </div>
          <p className={`text-sm font-medium mb-0.5 ${!notice.read ? 'text-foreground-900' : 'text-foreground-700'}`}>
            {notice.title}
          </p>
          <p className="text-xs text-foreground-500 line-clamp-2 mb-1.5">
            {notice.summary}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-foreground-400">
                {new Date(notice.publishedDate).toLocaleDateString('pt-BR')}
              </span>
              <Badge variant="neutral" size="sm">{notice.audienceLabel}</Badge>
            </div>
            <span className="text-xs font-medium text-primary-600 flex items-center gap-1 whitespace-nowrap">
              Ler aviso
              <i className="ri-arrow-right-line text-xs" />
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AvisosPage() {
  const navigate = useNavigate();
  const { data, loading, error, isOffline, refresh } = useNotificationsData();
  const [activeFilter, setActiveFilter] = useState<NoticeFilterKey>('all');

  const filteredNotices = useMemo(() => {
    if (!data?.notices) return [];

    return data.notices.filter((n) => {
      switch (activeFilter) {
        case 'all': return true;
        case 'important': return n.priority === 'important' || n.priority === 'urgent';
        case 'maintenance': return n.category === 'maintenance';
        case 'interruption': return n.category === 'interruption' || n.category === 'emergency';
        case 'community': return n.category === 'general' || n.category === 'meeting';
        case 'financial': return n.category === 'billing';
        case 'archived': return n.read && n.priority === 'info';
        default: return true;
      }
    });
  }, [data, activeFilter]);

  if (loading && !data) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => navigate('/inicio')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer">
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Avisos</h1>
        </div>
        <SkeletonList count={4} />
      </AppShell>
    );
  }

  if (error && !data && !isOffline) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => navigate('/inicio')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer">
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Avisos</h1>
        </div>
        <EmptyState
          icon="ri-error-warning-line"
          title="Algo deu errado"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={refresh}>
              <i className="ri-refresh-line mr-1" />Tentar novamente
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/inicio')}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer"
            aria-label="Voltar"
          >
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Avisos</h1>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`
                whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-150 cursor-pointer flex-shrink-0
                ${activeFilter === tab.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredNotices.length === 0 ? (
          <EmptyState
            icon="ri-megaphone-line"
            title="Nenhum aviso"
            description="Nenhum aviso encontrado com este filtro."
          />
        ) : (
          <div className="space-y-2">
            {filteredNotices.map((notice) => (
              <NoticeCard key={notice.id} notice={notice} />
            ))}
          </div>
        )}

        {isOffline && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3">
            <div className="flex items-start gap-2">
              <i className="ri-wifi-off-line text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">Modo offline</p>
                <p className="text-[11px] text-amber-600">Você está visualizando dados armazenados localmente.</p>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-foreground-300 pt-2 pb-1">
          {filteredNotices.length} aviso{filteredNotices.length !== 1 ? 's' : ''}
        </p>
      </div>
    </AppShell>
  );
}