import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import { recentActivities } from '@/fixtures/activity';

const iconConfig: Record<string, { bg: string; text: string }> = {
  'ri-bill-line': { bg: 'bg-primary-100', text: 'text-primary-600' },
  'ri-check-double-line': { bg: 'bg-green-100', text: 'text-green-600' },
  'ri-drop-line': { bg: 'bg-accent-100', text: 'text-accent-600' },
  'ri-information-line': { bg: 'bg-secondary-100', text: 'text-secondary-600' },
  'ri-customer-service-line': { bg: 'bg-amber-100', text: 'text-amber-600' },
};

export default function AtividadePage() {
  const navigate = useNavigate();

  if (recentActivities.length === 0) {
    return (
      <AppShell>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-foreground-500 hover:text-foreground-700 transition-colors cursor-pointer -ml-1 mb-4"
        >
          <i className="ri-arrow-left-line" />
          <span>Voltar</span>
        </button>
        <EmptyState
          icon="ri-history-line"
          title="Nenhuma atividade"
          description="Nenhuma atividade registrada no momento."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/inicio')}>
              Voltar ao início
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-foreground-500 hover:text-foreground-700 transition-colors cursor-pointer -ml-1"
          >
            <i className="ri-arrow-left-line" />
            <span>Voltar</span>
          </button>
          <h1 className="text-base font-semibold text-foreground-900">Histórico</h1>
          <div className="w-8" />
        </div>

        <Card>
          <div className="space-y-0">
            {recentActivities.map((item, i) => {
              const iconStyle = iconConfig[item.icon] || { bg: 'bg-background-200', text: 'text-foreground-500' };
              return (
                <div key={item.id} className="flex gap-3 py-3">
                  <div className="relative flex flex-col items-center flex-shrink-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconStyle.bg}`}>
                      <i className={`${item.icon} ${iconStyle.text} text-sm`} />
                    </div>
                    {i < recentActivities.length - 1 && (
                      <div className="w-0.5 flex-1 bg-background-200 mt-1" />
                    )}
                  </div>
                  <div className={`min-w-0 flex-1 ${i < recentActivities.length - 1 ? 'border-b border-background-100 pb-3' : ''}`}>
                    <p className="text-sm font-medium text-foreground-800">{item.label}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{item.description}</p>
                    <p className="text-[10px] text-foreground-400 mt-1">
                      {new Date(item.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}