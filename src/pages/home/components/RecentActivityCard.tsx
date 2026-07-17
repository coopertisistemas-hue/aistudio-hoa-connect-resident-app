import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import type { ActivityItem } from '@/fixtures/types';

interface Props {
  activities: ActivityItem[];
}

export default function RecentActivityCard({ activities }: Props) {
  const navigate = useNavigate();

  if (activities.length === 0) {
    return (
      <Card>
        <p className="text-sm font-medium text-foreground-800 mb-1">Atividade recente</p>
        <p className="text-xs text-foreground-500">Nenhuma atividade recente no momento.</p>
      </Card>
    );
  }

  return (
    <Card onClick={() => navigate('/atividade')}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground-800">Atividade recente</p>
        <span className="text-xs text-primary-600 font-medium flex items-center gap-1">
          Ver histórico
          <i className="ri-arrow-right-line" />
        </span>
      </div>
      <div className="space-y-3">
        {activities.map((item, i) => (
          <div key={item.id} className="flex gap-3">
            <div className="relative flex flex-col items-center flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center">
                <i className={`${item.icon} text-accent-600 text-sm`} />
              </div>
              {i < activities.length - 1 && (
                <div className="w-0.5 flex-1 bg-background-200 mt-1" />
              )}
            </div>
            <div className="min-w-0 pb-3">
              <p className="text-xs font-medium text-foreground-800">{item.label}</p>
              <p className="text-xs text-foreground-500 line-clamp-1">{item.description}</p>
              <p className="text-[10px] text-foreground-400 mt-0.5">
                {new Date(item.date).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}