import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import type { NoticePreviewData } from '@/fixtures/types';

interface Props {
  notice: NoticePreviewData;
}

const priorityConfig: Record<string, { bg: string; text: string; icon: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', icon: 'ri-error-warning-line' },
  normal: { bg: 'bg-accent-100', text: 'text-accent-700', icon: 'ri-information-line' },
  low: { bg: 'bg-background-200', text: 'text-foreground-600', icon: 'ri-information-line' },
};

const typeConfig: Record<string, string> = {
  maintenance: 'ri-tools-line',
  urgent: 'ri-alert-line',
  meeting: 'ri-group-line',
  info: 'ri-information-line',
  billing: 'ri-bill-line',
  general: 'ri-megaphone-line',
};

export default function NoticePreviewCard({ notice }: Props) {
  const navigate = useNavigate();
  const priority = priorityConfig[notice.priority] || priorityConfig.normal;
  const typeIcon = typeConfig[notice.type] || 'ri-information-line';

  return (
    <Card
      variant={notice.priority === 'high' ? 'filled' : 'default'}
      onClick={() => navigate(`/avisos/${notice.id}`)}
    >
      <div className={notice.priority === 'high' ? 'bg-red-50 rounded-xl p-3' : ''}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${notice.priority === 'high' ? 'bg-red-100' : 'bg-accent-100'}`}>
            <i className={`${notice.priority === 'high' ? 'ri-alert-line text-red-600' : `${typeIcon} text-accent-600`}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge variant={notice.priority === 'high' ? 'error' : 'neutral'} size="sm">
                {notice.category}
              </Badge>
              {notice.isNew && (
                <Badge variant="info" size="sm">Novo</Badge>
              )}
            </div>
            <p className="text-sm font-medium text-foreground-800 mt-1">{notice.title}</p>
            <p className="text-xs text-foreground-500 mt-0.5 line-clamp-2">{notice.summary}</p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-foreground-400">
                {new Date(notice.date).toLocaleDateString('pt-BR')}
              </p>
              <span className="text-xs font-medium text-primary-600 flex items-center gap-1">
                Ler aviso
                <i className="ri-arrow-right-line text-xs" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}