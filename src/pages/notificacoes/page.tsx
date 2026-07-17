import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import AppShell from '@/components/feature/AppShell';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import { SkeletonList } from '@/components/base/Skeleton';
import { showToast } from '@/components/base/Toast';
import { useNotificationsData } from '@/hooks/useNotificationsData';
import NotificationItemCard from '@/pages/notificacoes/components/NotificationItemCard';
import NotificationFilterBar from '@/pages/notificacoes/components/NotificationFilterBar';
import NotificationDemoControls from '@/demo/NotificationDemoControls';
import type { NotificationFilterKey, NotificationGroupKey, NotificationItem } from '@/fixtures/types';

const groupLabels: Record<NotificationGroupKey, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  last_7_days: 'Últimos 7 dias',
  older: 'Anteriores',
};

export default function NotificacoesPage() {
  const navigate = useNavigate();
  const { data, loading, error, isOffline, markAsRead, markAllAsRead, refresh, setScenario } = useNotificationsData();
  const [activeFilter, setActiveFilter] = useState<NotificationFilterKey>('all');

  const groupedAndFiltered = useMemo(() => {
    if (!data) return [];

    const now = Date.now();
    const dayMs = 86400000;

    const filteredItems = data.notifications.filter((n) => {
      switch (activeFilter) {
        case 'unread': return n.unread;
        case 'invoice': return n.category === 'invoice';
        case 'payment': return n.category === 'payment';
        case 'consumption': return n.category === 'consumption';
        case 'support': return n.category === 'support';
        case 'notice': return n.category === 'notice';
        case 'all':
        default: return true;
      }
    });

    const groups: { key: NotificationGroupKey; label: string; items: NotificationItem[] }[] = [];

    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const last7Days: NotificationItem[] = [];
    const older: NotificationItem[] = [];

    filteredItems.forEach((n) => {
      const diff = now - n.timestamp;
      if (diff < dayMs) today.push(n);
      else if (diff < dayMs * 2) yesterday.push(n);
      else if (diff < dayMs * 7) last7Days.push(n);
      else older.push(n);
    });

    if (today.length) groups.push({ key: 'today', label: groupLabels.today, items: today });
    if (yesterday.length) groups.push({ key: 'yesterday', label: groupLabels.yesterday, items: yesterday });
    if (last7Days.length) groups.push({ key: 'last_7_days', label: groupLabels.last_7_days, items: last7Days });
    if (older.length) groups.push({ key: 'older', label: groupLabels.older, items: older });

    return groups;
  }, [data, activeFilter]);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    showToast('Todas as notificações foram marcadas como lidas.', 'success');
  };

  if (loading && !data) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => navigate('/inicio')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer">
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Notificações</h1>
        </div>
        <SkeletonList count={5} />
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
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Notificações</h1>
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

  const unreadCount = data?.unreadCount || 0;
  const hasFilteredItems = groupedAndFiltered.length > 0;
  const filteredCount = groupedAndFiltered.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/inicio')}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer"
              aria-label="Voltar"
            >
              <i className="ri-arrow-left-line text-foreground-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground-900 font-heading">Notificações</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-foreground-500">
                  {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors cursor-pointer px-2 py-1"
              >
                <i className="ri-check-double-line" />
                <span className="whitespace-nowrap">Marcar todas</span>
              </button>
            )}
            <button
              onClick={() => navigate('/notificacoes/preferencias')}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer"
              aria-label="Preferências"
            >
              <i className="ri-settings-3-line text-foreground-500" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <NotificationFilterBar
          activeFilter={activeFilter}
          onChange={setActiveFilter}
          unreadCount={unreadCount}
        />

        {/* Notifications */}
        {!hasFilteredItems ? (
          <EmptyState
            icon={activeFilter === 'unread' ? 'ri-check-double-line' : 'ri-notification-off-line'}
            title={activeFilter === 'unread' ? 'Todas lidas' : 'Nenhuma notificação'}
            description={
              activeFilter === 'unread'
                ? 'Você já leu todas as notificações.'
                : 'Nenhuma notificação encontrada com este filtro.'
            }
          />
        ) : (
          <div className="space-y-4">
            {groupedAndFiltered.map((group) => (
              <div key={group.key}>
                <h3 className="text-xs font-semibold text-foreground-400 uppercase tracking-wider mb-2 px-1">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <NotificationItemCard
                      key={item.id}
                      item={item}
                      onMarkRead={markAsRead}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {isOffline && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3">
            <div className="flex items-start gap-2">
              <i className="ri-wifi-off-line text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">Modo offline</p>
                <p className="text-[11px] text-amber-600">
                  Você está visualizando dados armazenados localmente.
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-foreground-300 pt-2 pb-1">
          {filteredCount} notificação{filteredCount !== 1 ? 'ões' : ''}
        </p>
      </div>

      <NotificationDemoControls
        onScenarioChange={(scenario) => {
          setScenario(scenario);
        }}
        onSimulateEvent={() => {
          showToast('Nova notificação disponível para demonstração.', 'info');
        }}
      />
    </AppShell>
  );
}