import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import Button from '@/components/base/Button';
import EmptyState from '@/components/base/EmptyState';
import { SkeletonCard } from '@/components/base/Skeleton';
import { showToast } from '@/components/base/Toast';
import { useConsumoData } from '@/hooks/useConsumoData';
import DivergenceFlow from '@/pages/consumo/components/DivergenceFlow';
import type { HistoricalDataPoint } from '@/fixtures/types';

export default function LeituraDetailPage() {
  const navigate = useNavigate();
  const { readingId } = useParams<{ readingId: string }>();
  const { fetchDetail, residenceId } = useConsumoData();
  const [reading, setReading] = useState<HistoricalDataPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [divergenceOpen, setDivergenceOpen] = useState(false);

  useEffect(() => {
    if (!readingId) { setError('Leitura não encontrada.'); setLoading(false); return; }

    async function load() {
      try {
        const result = await fetchDetail(readingId!);
        if (!result) { setError('Leitura não encontrada.'); }
        else setReading(result);
      } catch { setError('Não foi possível carregar os detalhes da leitura.'); }
      finally { setLoading(false); }
    }
    load();
  }, [readingId, fetchDetail]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  if (error || !reading) {
    return (
      <AppShell>
        <EmptyState
          icon="ri-file-search-line"
          title="Leitura não encontrada"
          description={error || 'A leitura solicitada não foi localizada.'}
          action={
            <Button variant="primary" size="sm" onClick={() => navigate('/consumo/leituras')}>
              Voltar para o histórico
            </Button>
          }
        />
      </AppShell>
    );
  }

  const statusConfig: Record<string, { variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; icon: string }> = {
    registered: { variant: 'success', icon: 'ri-check-line' },
    estimated: { variant: 'warning', icon: 'ri-contrast-line' },
    revised: { variant: 'info', icon: 'ri-loop-left-line' },
    pending: { variant: 'neutral', icon: 'ri-time-line' },
    not_performed: { variant: 'neutral', icon: 'ri-close-circle-line' },
    under_review: { variant: 'warning', icon: 'ri-search-eye-line' },
  };
  const config = statusConfig[reading.status] || statusConfig.registered;

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Back nav */}
        <button
          onClick={() => navigate('/consumo/leituras')}
          className="flex items-center gap-1 text-sm text-foreground-500 hover:text-foreground-700 transition-colors cursor-pointer -ml-1"
        >
          <i className="ri-arrow-left-line" />
          <span>Histórico</span>
        </button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground-900 font-heading">{reading.period}</h1>
            <p className="text-xs text-foreground-500">{residenceId === 'prop-002' ? 'Casa Centro' : 'Apto Bloco 3'}</p>
          </div>
          <Badge variant={config.variant} size="sm">
            <i className={`${config.icon} text-[10px]`} />
            {reading.statusLabel}
          </Badge>
        </div>

        {/* Reading values */}
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-background-50 rounded-xl p-3 text-center">
              <p className="text-xs text-foreground-400 mb-1">Leitura anterior</p>
              <p className="text-xl font-bold text-foreground-800">{reading.previousReadingValue}</p>
            </div>
            <div className="bg-background-50 rounded-xl p-3 text-center">
              <p className="text-xs text-foreground-400 mb-1">Leitura atual</p>
              <p className="text-xl font-bold text-foreground-800">{reading.readingValue}</p>
            </div>
          </div>
        </Card>

        {/* Consumption result */}
        <Card>
          <p className="text-xs text-foreground-500 mb-1">Consumo no período</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground-900 font-heading">
              {reading.consumption > 0 ? reading.consumption : '—'}
            </span>
            {reading.consumption > 0 && <span className="text-sm text-foreground-500">m³</span>}
          </div>
          {reading.comparison && (
            <p className="text-xs text-foreground-500 mt-1">{reading.comparison}</p>
          )}
        </Card>

        {/* Details */}
        <Card>
          <p className="text-sm font-medium text-foreground-800 mb-3">Detalhes da leitura</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-background-100">
              <span className="text-foreground-500">Hidrômetro</span>
              <span className="text-foreground-800 font-medium">
                {residenceId === 'prop-002' ? 'HID-2023-0621' : 'HID-2024-0891'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-background-100">
              <span className="text-foreground-500">Data da leitura</span>
              <span className="text-foreground-800 font-medium">{reading.readingDate}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-background-100">
              <span className="text-foreground-500">Origem</span>
              <span className="text-foreground-800 font-medium text-right max-w-[55%]">{reading.readingOrigin}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-background-100">
              <span className="text-foreground-500">Status</span>
              <span className="text-foreground-800 font-medium">{reading.statusLabel}</span>
            </div>
            {reading.note && (
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-500">Observação</span>
                <span className="text-foreground-800 font-medium text-right max-w-[60%]">{reading.note}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Revision history */}
        {reading.revisionHistory && reading.revisionHistory.length > 0 && (
          <Card>
            <p className="text-sm font-medium text-foreground-800 mb-3">Histórico de revisões</p>
            <div className="space-y-2">
              {reading.revisionHistory.map((rev, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-foreground-800 font-medium">{rev.type}</p>
                    <p className="text-foreground-500">{rev.description}</p>
                    <p className="text-foreground-400 mt-0.5">{rev.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              showToast('Funcionalidade de download simulada.', 'info');
            }}
          >
            <i className="ri-download-line" />
            Baixar comprovante de leitura
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={() => setDivergenceOpen(true)}
          >
            <i className="ri-error-warning-line" />
            Informar possível divergência
          </Button>
        </div>

        <div className="h-4" />
      </div>

      {/* Divergence flow bottom sheet */}
      {reading && (
        <DivergenceFlow
          reading={reading}
          open={divergenceOpen}
          onClose={() => setDivergenceOpen(false)}
        />
      )}
    </AppShell>
  );
}