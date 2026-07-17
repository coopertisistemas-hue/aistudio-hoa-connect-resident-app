import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import Button from '@/components/base/Button';
import EmptyState from '@/components/base/EmptyState';
import { SkeletonCard } from '@/components/base/Skeleton';
import { fetchNoticeDetail } from '@/demo/notificationService';
import type { NoticeItem } from '@/fixtures/types';

const priorityConfig: Record<string, { bg: string; badge: 'warning' | 'error' | 'neutral'; icon: string; textColor: string }> = {
  info: { bg: 'bg-background-50', badge: 'neutral', icon: 'ri-information-line', textColor: 'text-foreground-700' },
  important: { bg: 'bg-amber-50', badge: 'warning', icon: 'ri-error-warning-line', textColor: 'text-amber-700' },
  urgent: { bg: 'bg-red-50', badge: 'error', icon: 'ri-alert-line', textColor: 'text-red-700' },
};

const attachmentIcons: Record<string, string> = {
  comunicado: 'ri-file-text-line',
  calendario: 'ri-calendar-line',
  regulamento: 'ri-scales-line',
  orientacao: 'ri-guide-line',
  meeting_document: 'ri-article-line',
};

export default function NoticeDetailPage() {
  const navigate = useNavigate();
  const { noticeId } = useParams<{ noticeId: string }>();
  const [notice, setNotice] = useState<NoticeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!noticeId) return;
    setLoading(true);
    setError(null);
    fetchNoticeDetail(noticeId)
      .then((result) => {
        setNotice(result);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message === 'OFFLINE'
          ? 'Você está offline.'
          : 'Não foi possível carregar este aviso.');
        setLoading(false);
      });
  }, [noticeId]);

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

  if (error || !notice) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer">
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Aviso</h1>
        </div>
        <EmptyState
          icon="ri-error-warning-line"
          title="Indisponível"
          description={error || 'Aviso não encontrado.'}
          action={
            <Button variant="primary" size="sm" onClick={() => navigate(-1)}>
              <i className="ri-arrow-left-line mr-1" />Voltar
            </Button>
          }
        />
      </AppShell>
    );
  }

  const priority = priorityConfig[notice.priority] || priorityConfig.info;

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
          <h1 className="text-lg font-bold text-foreground-900 font-heading truncate">{notice.title}</h1>
        </div>

        {/* Priority header */}
        <div className={`rounded-2xl p-5 ${priority.bg}`}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={priority.badge} size="sm">
              <i className={`${priority.icon} text-xs`} />
              <span>{notice.priorityLabel}</span>
            </Badge>
            <Badge variant="neutral" size="sm">{notice.categoryLabel}</Badge>
            <Badge variant="neutral" size="sm">{notice.audienceLabel}</Badge>
          </div>
          <h2 className="text-base font-semibold text-foreground-800 mb-2">{notice.title}</h2>
          <p className="text-xs text-foreground-500">
            Publicado em {new Date(notice.publishedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            {notice.validityEnd && ` · Válido até ${new Date(notice.validityEnd).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`}
          </p>
          <p className="text-xs text-foreground-400 mt-1">
            {notice.associationName}
          </p>
        </div>

        {/* Content */}
        <Card>
          <div className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">
            {notice.content}
          </div>
        </Card>

        {/* Attachments */}
        {notice.attachments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground-800 mb-2">Anexos</h3>
            <div className="space-y-2">
              {notice.attachments.map((att) => (
                <Card
                  key={att.id}
                  variant="filled"
                  className="cursor-default"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background-200 flex items-center justify-center flex-shrink-0">
                      <i className={`${attachmentIcons[att.type] || 'ri-file-line'} text-lg text-foreground-500`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground-800">{att.label}</p>
                      <p className="text-xs text-foreground-500">{att.description}</p>
                    </div>
                    {att.isDemo && (
                      <Badge variant="neutral" size="sm">Demo</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        {(notice.contactPhone || notice.contactEmail) && (
          <Card variant="filled">
            <h3 className="text-sm font-semibold text-foreground-800 mb-2">Contato</h3>
            {notice.contactPhone && (
              <p className="text-sm text-foreground-600 flex items-center gap-2">
                <i className="ri-phone-line text-foreground-400" />
                {notice.contactPhone}
              </p>
            )}
            {notice.contactEmail && (
              <p className="text-sm text-foreground-600 flex items-center gap-2 mt-1">
                <i className="ri-mail-line text-foreground-400" />
                {notice.contactEmail}
              </p>
            )}
          </Card>
        )}

        {/* Related residences */}
        {notice.audience !== 'all_residences' && notice.relatedResidenceLabels.length > 0 && (
          <div className="rounded-2xl bg-accent-50 border border-accent-200 p-4">
            <h3 className="text-xs font-semibold text-foreground-600 mb-1.5">
              Residências relacionadas
            </h3>
            <ul className="space-y-1">
              {notice.relatedResidenceLabels.map((label, i) => (
                <li key={i} className="text-sm text-foreground-700 flex items-center gap-2">
                  <i className="ri-home-line text-accent-500 text-xs" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-[10px] text-foreground-300 pt-2 pb-1">
          HOA Connect · Demonstração local
        </p>
      </div>
    </AppShell>
  );
}