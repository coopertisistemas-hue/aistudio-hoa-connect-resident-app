import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import { RequireRole } from '@/lib/auth/RequireRole';
import Card from '@/components/base/Card';
import Button from '@/components/base/Button';
import LoadingState from '@/components/base/LoadingState';
import Badge from '@/components/base/Badge';
import { useAdminWaterData } from '@/hooks/useAdminWaterData';

export default function AdminMeterDetailPage() {
  const { meterId } = useParams<{ meterId: string }>();
  const { selectedMeter, loading, error, loadMeter } = useAdminWaterData();

  useEffect(() => {
    if (meterId) loadMeter(meterId);
  }, [meterId, loadMeter]);

  if (loading) return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell><div className="p-4"><LoadingState /></div></AppShell>
    </RequireRole>
  );

  if (error) return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4">
          <Card className="p-4 border-red-200 bg-red-50">
            <p className="text-red-700 text-sm">{error}</p>
          </Card>
        </div>
      </AppShell>
    </RequireRole>
  );

  if (!selectedMeter) return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4">
          <Card className="p-6"><p className="text-gray-500 text-center">Hidrômetro não encontrado</p></Card>
        </div>
      </AppShell>
    </RequireRole>
  );

  const { meter, readings, lastConsumption } = selectedMeter;

  const statusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'neutral';
      case 'damaged': return 'error';
      case 'removed': return 'neutral';
      default: return 'neutral';
    }
  };

  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <a href="/admin/agua/hidrometros" className="text-sm text-blue-600 hover:text-blue-800">&larr; Voltar</a>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold">{meter.meterNumber}</h1>
              <Badge variant={statusVariant(meter.status)}>
                {meter.status === 'active' ? 'Ativo' : meter.status === 'inactive' ? 'Inativo' : meter.status === 'damaged' ? 'Danificado' : 'Removido'}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Instalação:</span>{' '}
                {new Date(meter.installationDate).toLocaleDateString('pt-BR')}
              </div>
              <div>
                <span className="text-gray-500">Leitura Inicial:</span>{' '}
                {meter.initialReading.toLocaleString('pt-BR')} m³
              </div>
              {meter.location && (
                <div>
                  <span className="text-gray-500">Local:</span> {meter.location}
                </div>
              )}
              {meter.notes && (
                <div className="col-span-full">
                  <span className="text-gray-500">Observações:</span> {meter.notes}
                </div>
              )}
            </div>
          </Card>

          {lastConsumption && (
            <Card className="p-4 border-blue-200 bg-blue-50">
              <h2 className="font-semibold text-sm text-blue-800 mb-2">Último Consumo</h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-blue-600">Leitura Atual:</span>{' '}
                  {lastConsumption.currentReading.toLocaleString('pt-BR')} m³
                </div>
                <div>
                  <span className="text-blue-600">Leitura Anterior:</span>{' '}
                  {lastConsumption.previousReading.toLocaleString('pt-BR')} m³
                </div>
                <div className="col-span-full">
                  <span className="text-blue-600 font-semibold">Consumo:</span>{' '}
                  <span className="font-bold text-lg">{lastConsumption.consumption.toLocaleString('pt-BR')} m³</span>
                </div>
                <div className="text-xs text-blue-400">
                  Período: {new Date(lastConsumption.previousReadingDate).toLocaleDateString('pt-BR')} — {new Date(lastConsumption.readingDate).toLocaleDateString('pt-BR')}
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="font-semibold mb-3">Histórico de Leituras</h2>
            {readings.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma leitura registrada</p>
            ) : (
              <div className="space-y-2">
                {readings.map(reading => (
                  <div key={reading.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div>
                      <p className="text-sm font-medium">{reading.readingValue.toLocaleString('pt-BR')} m³</p>
                      <p className="text-xs text-gray-500">
                        {new Date(reading.readingDate).toLocaleDateString('pt-BR')}
                        {reading.readByProfileId ? ` — Leitor: ${reading.readByProfileId}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {reading.isEstimated && <Badge variant="warning" className="text-xs">Estimada</Badge>}
                      <Badge variant="neutral" className="text-xs">
                        {reading.source === 'initial' ? 'Inicial' : reading.source === 'corrected' ? 'Corrigida' : 'Manual'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </AppShell>
    </RequireRole>
  );
}
