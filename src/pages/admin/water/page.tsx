import { useEffect } from 'react';
import AppShell from '@/components/feature/AppShell';
import { RequireRole } from '@/lib/auth/RequireRole';
import Card from '@/components/base/Card';
import LoadingState from '@/components/base/LoadingState';
import Badge from '@/components/base/Badge';
import { useAdminWaterData } from '@/hooks/useAdminWaterData';

export default function AdminWaterPage() {
  const { dashboard, loading, error, loadDashboard } = useAdminWaterData();

  useEffect(() => {
    loadDashboard('demo-tenant-001');
  }, [loadDashboard]);

  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Água — Painel</h1>
          </div>

          {loading && <LoadingState />}

          {error && (
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-red-700 text-sm">{error}</p>
            </Card>
          )}

          {dashboard && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-gray-500">Hidrômetros Ativos</p>
                  <p className="text-2xl font-bold mt-1">{dashboard.activeMeterCount}</p>
                </Card>

                <Card className="p-4">
                  <p className="text-sm text-gray-500">Leituras (este mês)</p>
                  <p className="text-2xl font-bold mt-1">{dashboard.readingsThisMonth}</p>
                </Card>

                <Card className="p-4">
                  <p className="text-sm text-gray-500">Último Ciclo</p>
                  {dashboard.lastBillingCycle ? (
                    <div className="mt-1">
                      <p className="text-lg font-bold">
                        {dashboard.lastBillingCycle.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                      <p className="text-xs text-gray-500">{dashboard.lastBillingCycle.referencePeriod} — {dashboard.lastBillingCycle.invoiceCount} fatura(s)</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mt-1">Nenhum ciclo processado</p>
                  )}
                </Card>
              </div>

              <Card className="p-4">
                <h2 className="font-semibold mb-3">Leituras Recentes</h2>
                {dashboard.recentReadings.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma leitura registrada</p>
                ) : (
                  <div className="space-y-2">
                    {dashboard.recentReadings.map(reading => (
                      <div key={reading.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <div>
                          <p className="text-sm font-medium">Leitura: {reading.readingValue.toLocaleString('pt-BR')} m³</p>
                          <p className="text-xs text-gray-500">{new Date(reading.readingDate).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <Badge variant="neutral" className="text-xs">
                          {reading.source === 'initial' ? 'Inicial' : reading.source === 'estimated' ? 'Estimada' : 'Manual'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h2 className="font-semibold mb-2">Acesso Rápido</h2>
                  <div className="space-y-2">
                    <a href="/admin/agua/hidrometros" className="block text-sm text-blue-600 hover:text-blue-800">
                      Hidrômetros &rarr;
                    </a>
                    <a href="/admin/agua/leituras" className="block text-sm text-blue-600 hover:text-blue-800">
                      Registrar Leitura &rarr;
                    </a>
                    <a href="/admin/agua/tarifas" className="block text-sm text-blue-600 hover:text-blue-800">
                      Gerenciar Tarifas &rarr;
                    </a>
                    <a href="/admin/agua/faturamento" className="block text-sm text-blue-600 hover:text-blue-800">
                      Processar Faturamento &rarr;
                    </a>
                    <a href="/admin/agua/consumo" className="block text-sm text-blue-600 hover:text-blue-800">
                      Histórico de Consumo &rarr;
                    </a>
                  </div>
                </Card>

                <Card className="p-4">
                  <h2 className="font-semibold mb-2">Status do Sistema</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Modo</span>
                      <Badge variant="neutral">Demonstração</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Leituras Pendentes</span>
                      <span>0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ciclos Abertos</span>
                      <span>1 (07/2026)</span>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}
