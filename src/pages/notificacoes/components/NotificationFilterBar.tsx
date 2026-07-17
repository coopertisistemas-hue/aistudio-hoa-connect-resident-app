import type { NotificationFilterKey, NotificationFilterOption } from '@/fixtures/types';

const filterOptions: NotificationFilterOption[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'invoice', label: 'Faturas' },
  { key: 'payment', label: 'Pagamentos' },
  { key: 'consumption', label: 'Consumo' },
  { key: 'notice', label: 'Avisos' },
  { key: 'support', label: 'Atendimento' },
];

interface NotificationFilterBarProps {
  activeFilter: NotificationFilterKey;
  onChange: (filter: NotificationFilterKey) => void;
  unreadCount: number;
}

export default function NotificationFilterBar({ activeFilter, onChange, unreadCount }: NotificationFilterBarProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
      {filterOptions.map((opt) => {
        const isActive = activeFilter === opt.key;
        const showCount = opt.key === 'unread' && unreadCount > 0;

        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`
              whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium
              transition-all duration-150 cursor-pointer flex-shrink-0
              ${isActive
                ? 'bg-primary-500 text-white'
                : 'bg-background-100 text-foreground-600 hover:bg-background-200'
              }
            `}
          >
            {opt.label}
            {showCount && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-white text-primary-600 text-[10px] font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}