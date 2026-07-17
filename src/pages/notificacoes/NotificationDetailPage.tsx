import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import Button from '@/components/base/Button';
import EmptyState from '@/components/base/EmptyState';
import { SkeletonCard } from '@/components/base/Skeleton';
import { fetchNotificationDetail } from '@/demo/notificationService';
import type { NotificationItem } from '@/fixtures/types';

const priorityConfig: Record<string, { bg: string; badge: 'warning' | 'error' | 'neutral'; icon: string }> = {
  info: { bg: 'bg-background-50', badge: 'neutral', icon: 'ri-information-line' },
  important: { bg: 'bg-amber-50', badge: 'warning', icon: 'ri-error-warning-line' },
  urgent: { bg: 'bg-red-50', badge: 'error', icon: 'ri-alert-line' },
};

export default function NotificationDetailPage() {
  const navigate = useNavigate();
  const { notificationId } = useParams<{ notificationId: string }>();
  const [item, setItem] = useState<NotificationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!notificationId) return;
    setLoading(true);
    setError(null);
    fetchNotificationDetail(notificationId)
      .then((result) => {
        setItem(result);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message === 'OFFLINE'
          ? 'Você está offline.'
          : 'Não foi possível carregar esta notificação.');
        setLoading(false);
      });
  }, [notificationId]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-background-300 animate-pulse" />
          <div className="h-6 w-32 bg-background-300 rounded animate-pulse" />
        </div>
        <SkeletonCard />
        <div className="mt-4">
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  if (error || !item) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer">
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Notificação</h1>
        </div>
        <EmptyState
          icon="ri-error-warning-line"
          title="Indisponível"
          description={error || 'Notificação não encontrada.'}
          action={
            <Button variant="primary" size="sm" onClick={() => navigate(-1)}>
              <i className="ri-arrow-left-line mr-1" />Voltar
            </Button>
          }
        />
      </AppShell>
    );
  }

  const priority = priorityConfig[item.priority] || priorityConfig.info;
  const formattedDate = new Date(item.dateTime).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer"
            aria-label="Voltar"
          >
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-lg font-bold text-foreground-900 font-heading truncate">{item.title}</h1>
        </div>

        <div className={`rounded-2xl p-5 ${priority.bg}`}>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={priority.badge} size="sm">
              <i className={`${priority.icon} text-xs`} />
              <span>{item.priorityLabel}</span>
            </Badge>
            <Badge variant="neutral" size="sm">{item.categoryLabel}</Badge>
            {item.relatedResidenceNickname && (
              <Badge variant="neutral" size="sm">{item.relatedResidenceNickname}</Badge>
            )}
          </div>
          <h2 className="text-base font-semibold text-foreground-800 mb-2">{item.title}</h2>
          <p className="text-xs text-foreground-500">{formattedDate}</p>
        </div>

        <Card>
          <div className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">
            {item.description}
          </div>
        </Card>

        {item.destination && (
          <Button
            variant="primary"
            fullWidth
            size="md"
            onClick={() => navigate(item.destination.path)}
          >
            {item.destination.label}
            <i className="ri-arrow-right-line ml-1" />
          </Button>
        )}

        <p className="text-center text-[10px] text-foreground-300 pt-2">
          HOA Connect · Demonstração local
        </p>
      </div>
    </AppShell>
  );
}