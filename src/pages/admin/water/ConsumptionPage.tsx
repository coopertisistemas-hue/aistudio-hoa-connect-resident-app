import { useEffect, useState } from 'react';
import AppShell from '@/components/feature/AppShell';
import { RequireRole } from '@/lib/auth/RequireRole';
import Card from '@/components/base/Card';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import LoadingState from '@/components/base/LoadingState';
import Badge from '@/components/base/Badge';
import { useAdminWaterData } from '@/hooks/useAdminWaterData';

export default function AdminConsumptionPage() {
  const { consumption, loading, error, loadConsumption } = useAdminWaterData();
  const [fromDate, setFromDate] = useState('2026-06-01');
  const [toDate, setToDate] = useState('2026-07-31');
  const propertyId = 'demo-property-001';

  useEffect(() => {
    loadConsumption(propertyId, fromDate, toDate);
  }, []);

  const handleFilter = () => {
    loadConsumption(propertyId, fromDate, toDate);
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'calculated': return 'success';
      case 'estimated': return 'warning';
      case 'no_data': return 'neutral';
      case 'error': return 'error';
      default: return 'neutral';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'calculated': return 'Calculado';
      case 'estimated': return 'Estimado';
      case 'no_data': return 'Sem Dados';
      case 'error': return 'Erro';
      default: return status;
    }
  };

  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Histórico de Consumo</h1>
          </div>

          {error && (
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-red-700 text-sm">{error}</p>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="font-semibold mb-3">Filtrar Período</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input
                label="Data Início"
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
              />
              <Input
                label="Data Fim"
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
              />
            </div>
            <Button onClick={handleFilter} className="w-full">
              Filtrar
            </Button>
          </Card>

          {loading && <LoadingState />}

          {!loading && consumption.length === 0 && (
            <Card className="p-6">
              <p className="text-gray-500 text-center">Nenhum consumo registrado no período</p>
            </Card>
          )}

          <div className="space-y-3">
            {consumption.map((record, idx) => (
              <Card key={`${record.meterId}-${idx}`} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{record.meterNumber}</h3>
                      <Badge variant={statusVariant(record.status)} className="text-xs">
                        {statusLabel(record.status)}
                      </Badge>
                    </div>

                    {record.status === 'no_data' ? (
                      <p className="text-sm text-gray-400">{record.note}</p>
                    ) : record.status === 'error' ? (
                      <p className="text-sm text-red-500">Erro no cálculo de consumo</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-400">Leitura Atual</p>
                            <p className="font-medium">{record.currentReading.toLocaleString('pt-BR')} m³</p>
                            <p className="text-xs text-gray-400">{new Date(record.readingDate).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Leitura Anterior</p>
                            <p className="font-medium">{record.previousReading.toLocaleString('pt-BR')} m³</p>
                            <p className="text-xs text-gray-400">{new Date(record.previousReadingDate).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Consumo</p>
                            <p className="font-bold text-lg text-blue-600">{record.consumption.toLocaleString('pt-BR')} m³</p>
                          </div>
                        </div>

                        {record.note && (
                          <p className="text-xs text-gray-400 border-t border-gray-100 pt-1">{record.note}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    </RequireRole>
  );
}
