import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import { SkeletonCard } from '@/components/base/Skeleton';
import BottomSheet from '@/components/base/BottomSheet';
import { showToast } from '@/components/base/Toast';
import { useConsumoData } from '@/hooks/useConsumoData';
import CurrentPeriodCard from '@/pages/consumo/components/CurrentPeriodCard';
import MeterReadingCard from '@/pages/consumo/components/MeterReadingCard';
import ConsumptionChart, { ChartSkeleton } from '@/pages/consumo/components/ConsumptionChart';
import InsightsSection from '@/pages/consumo/components/InsightsSection';
import AlertsSection from '@/pages/consumo/components/AlertsSection';
import EducationSection from '@/pages/consumo/components/EducationSection';
import ConsumoDemoControls from '@/demo/ConsumoDemoControls';

export default function ConsumoPage() {
  const navigate = useNavigate();
  const {
    overview, history, loading, refreshing, residenceId,
    error, chartError, insightsUnavailable,
    setResidenceId, refresh,
  } = useConsumoData();

  const [selectedReadingId, setSelectedReadingId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(12);
  const [timeRangeSheetOpen, setTimeRangeSheetOpen] = useState(false);

  const handleRefresh = useCallback(async () => {
    await refresh();
    showToast('Informações atualizadas para demonstração.', 'info');
  }, [refresh]);

  const selectedReading = history.find((r) => r.id === selectedReadingId) || null;

  // Full error state
  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <SkeletonCard />
          <ChartSkeleton />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  if (error && !overview) {
    return (
      <AppShell>
        <EmptyState
          icon="ri-error-warning-line"
          title="Não foi possível carregar"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={handleRefresh}>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground-900 font-heading">Meu consumo</h1>
            <p className="text-xs text-foreground-500">Residência: {residenceId === 'prop-002' ? 'Casa Centro' : 'Apto Bloco 3'}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center hover:bg-background-200 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Atualizar dados"
          >
            <i className={`ri-refresh-line ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Current Period Summary */}
        {overview?.currentPeriod && (
          <CurrentPeriodCard data={overview.currentPeriod} />
        )}

        {/* Meter Reading Context */}
        {overview?.meterReading && (
          <MeterReadingCard
            data={overview.meterReading}
            onViewDetails={() => navigate('/consumo/leituras')}
          />
        )}

        {/* Alerts */}
        {overview?.alerts && overview.alerts.length > 0 && (
          <AlertsSection alerts={overview.alerts} />
        )}

        {/* Time range selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-500">Período:</span>
          <div className="flex gap-1">
            {[6, 12].map((months) => (
              <button
                key={months}
                onClick={() => setTimeRange(months)}
                className={`
                  px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer whitespace-nowrap
                  ${timeRange === months
                    ? 'bg-primary-500 text-white'
                    : 'bg-background-200 text-foreground-600 hover:bg-background-300'}
                `}
              >
                {months} meses
              </button>
            ))}
            <button
              onClick={() => setTimeRangeSheetOpen(true)}
              className="px-3 py-1 text-xs font-medium rounded-full bg-background-200 text-foreground-600 hover:bg-background-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              Outro
            </button>
          </div>
        </div>

        {/* Consumption Chart */}
        {chartError ? (
          <ConsumptionChart
            data={[]}
            selectedReadingId={null}
            onSelectReading={() => {}}
            timeRange={6}
            error
          />
        ) : (
          <ConsumptionChart
            data={history}
            selectedReadingId={selectedReadingId}
            onSelectReading={(id) => {
              setSelectedReadingId(id);
              const reading = history.find((r) => r.id === id);
              setSelectedPeriod(reading?.period || null);
            }}
            timeRange={timeRange}
          />
        )}

        {/* Selected Period Detail Card */}
        {selectedReading && (
          <div className="bg-white border border-background-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground-800">{selectedReading.period}</p>
              <button
                onClick={() => { setSelectedReadingId(null); setSelectedPeriod(null); }}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-background-100 cursor-pointer"
              >
                <i className="ri-close-line text-foreground-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="bg-background-50 rounded-lg p-2.5">
                <p className="text-foreground-400">Consumo</p>
                <p className="text-foreground-800 font-semibold text-sm mt-0.5">
                  {selectedReading.consumption > 0 ? `${selectedReading.consumption} m³` : '—'}
                </p>
              </div>
              <div className="bg-background-50 rounded-lg p-2.5">
                <p className="text-foreground-400">Status</p>
                <p className="text-foreground-800 font-semibold text-sm mt-0.5">{selectedReading.statusLabel}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-foreground-500">
              <div className="flex justify-between">
                <span>Data da leitura</span>
                <span className="text-foreground-700">{selectedReading.readingDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Origem</span>
                <span className="text-foreground-700">{selectedReading.readingOrigin}</span>
              </div>
              {selectedReading.comparison && (
                <div className="flex justify-between">
                  <span>Comparação</span>
                  <span className="text-foreground-700">{selectedReading.comparison}</span>
                </div>
              )}
            </div>
            {selectedReading.note && (
              <p className="text-xs text-primary-600 mt-2 bg-primary-50 rounded-lg p-2.5">{selectedReading.note}</p>
            )}
            <button
              onClick={() => navigate(`/consumo/leituras/${selectedReading.id}`)}
              className="mt-3 w-full py-2 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              Ver detalhes completos
              <i className="ri-arrow-right-line" />
            </button>
          </div>
        )}

        {/* Insights */}
        {overview && (
          <InsightsSection insights={overview.insights} unavailable={insightsUnavailable} />
        )}

        {/* Education */}
        {overview && overview.educationCards.length > 0 && (
          <EducationSection cards={overview.educationCards} />
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => navigate('/consumo/leituras')}
            className="flex-1 py-3 text-sm font-medium text-foreground-700 bg-background-200 rounded-xl hover:bg-background-300 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <i className="ri-history-line" />
            Histórico completo
          </button>
        </div>

        <div className="h-4" />
      </div>

      {/* Time range bottom sheet */}
      <BottomSheet
        open={timeRangeSheetOpen}
        onClose={() => setTimeRangeSheetOpen(false)}
        title="Selecionar período"
      >
        <div className="space-y-1 pb-4">
          {[{ value: 3, label: '3 meses' }, { value: 6, label: '6 meses' }, { value: 12, label: '12 meses' }, { value: 24, label: 'Todos os dados' }].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setTimeRange(opt.value); setTimeRangeSheetOpen(false); }}
              className={`
                w-full text-left px-4 py-3 rounded-xl text-sm transition-colors cursor-pointer
                ${timeRange === opt.value
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-foreground-700 hover:bg-background-100'}
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Demo Controls */}
      <ConsumoDemoControls
        currentResidenceId={residenceId}
        onSwitchResidence={setResidenceId}
      />
    </AppShell>
  );
}