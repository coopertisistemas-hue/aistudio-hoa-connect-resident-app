import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import type { NotificationItem } from '@/fixtures/types';

interface NotificationItemCardProps {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
}

const categoryIcons: Record<string, string> = {
  invoice: 'ri-bill-line',
  payment: 'ri-check-double-line',
  consumption: 'ri-drop-line',
  support: 'ri-customer-service-line',
  notice: 'ri-megaphone-line',
  profile: 'ri-user-line',
  document: 'ri-file-text-line',
};

const priorityBadge: Record<string, { variant: 'warning' | 'error' | 'neutral'; icon: string }> = {
  info: { variant: 'neutral', icon: '' },
  important: { variant: 'warning', icon: 'ri-error-warning-line' },
  urgent: { variant: 'error', icon: 'ri-alert-line' },
};

export default function NotificationItemCard({ item, onMarkRead }: NotificationItemCardProps) {
  const navigate = useNavigate();
  const priority = priorityBadge[item.priority] || priorityBadge.info;

  const handleClick = () => {
    if (item.unread) {
      onMarkRead(item.id);
    }
    navigate(item.destination.path);
  };

  const formattedDate = (() => {
    const now = new Date();
    const date = new Date(item.dateTime);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    return date.toLocaleDateString('pt-BR');
  })();

  return (
    <Card
      variant={item.unread ? 'filled' : 'default'}
      onClick={handleClick}
      className={item.unread ? 'bg-accent-50/40 border-accent-200' : ''}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          item.unread ? 'bg-accent-200' : 'bg-background-200'
        }`}>
          <i className={`${categoryIcons[item.category] || 'ri-notification-line'} text-base ${
            item.unread ? 'text-accent-700' : 'text-foreground-400'
          }`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[11px] font-medium text-foreground-400 uppercase tracking-wide">
              {item.categoryLabel}
            </span>
            {item.priority !== 'info' && (
              <span className="flex items-center gap-0.5">
                {priority.icon && <i className={`${priority.icon} text-[10px] ${item.priority === 'urgent' ? 'text-red-500' : 'text-amber-500'}`} />}
              </span>
            )}
            {item.unread && (
              <span className="w-2 h-2 rounded-full bg-accent-500 flex-shrink-0" aria-label="Não lida" />
            )}
          </div>

          <p className={`text-sm font-medium mb-0.5 ${item.unread ? 'text-foreground-900' : 'text-foreground-700'}`}>
            {item.title}
          </p>

          <p className="text-xs text-foreground-500 line-clamp-2 mb-1.5">
            {item.description}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-foreground-400">{formattedDate}</span>
              {item.relatedResidenceNickname && (
                <Badge variant="neutral" size="sm">{item.relatedResidenceNickname}</Badge>
              )}
            </div>
            <span className="text-xs font-medium text-primary-600 flex items-center gap-1 whitespace-nowrap">
              {item.destination.label}
              <i className="ri-arrow-right-line text-xs" />
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}