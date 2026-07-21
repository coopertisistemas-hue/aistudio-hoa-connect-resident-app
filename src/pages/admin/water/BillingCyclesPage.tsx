import { useState } from 'react';
import AppShell from '@/components/feature/AppShell';
import { RequireRole } from '@/lib/auth/RequireRole';
import Card from '@/components/base/Card';
import Button from '@/components/base/Button';
import Badge from '@/components/base/Badge';

const demoBillingCycles = [
  {
    id: 'demo-cycle-001',
    referencePeriod: '07/2026',
    cycleStart: '2026-07-01',
    cycleEnd: '2026-07-31',
    dueDate: '2026-08-15',
    status: 'open',
    invoiceCount: 0,
    totalAmount: 0,
  },
  {
    id: 'demo-cycle-002',
    referencePeriod: '06/2026',
    cycleStart: '2026-06-01',
    cycleEnd: '2026-06-30',
    dueDate: '2026-07-15',
    status: 'closed',
    invoiceCount: 1,
    totalAmount: 165.00,
  },
  {
    id: 'demo-cycle-003',
    referencePeriod: '05/2026',
    cycleStart: '2026-05-01',
    cycleEnd: '2026-05-31',
    dueDate: '2026-06-15',
    status: 'closed',
    invoiceCount: 1,
    totalAmount: 142.50,
  },
];

export default function AdminBillingCyclesPage() {
  const [cycles] = useState(demoBillingCycles);

  const statusVariant = (status: string) => {
    switch (status) {
      case 'open': return 'warning';
      case 'closed': return 'success';
      case 'draft': return 'neutral';
      case 'cancelled': return 'error';
      default: return 'neutral';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'closed': return 'Fechado';
      case 'draft': return 'Rascunho';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Ciclos de Faturamento</h1>
          </div>

          <div className="space-y-3">
            {cycles.map(cycle => (
              <Card key={cycle.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{cycle.referencePeriod}</h3>
                      <Badge variant={statusVariant(cycle.status)} className="text-xs">
                        {statusLabel(cycle.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-500">
                      <div>Início: {new Date(cycle.cycleStart).toLocaleDateString('pt-BR')}</div>
                      <div>Fim: {new Date(cycle.cycleEnd).toLocaleDateString('pt-BR')}</div>
                      <div>Vencimento: {new Date(cycle.dueDate).toLocaleDateString('pt-BR')}</div>
                      <div>
                        {cycle.invoiceCount > 0
                          ? `${cycle.invoiceCount} fatura(s) — ${cycle.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                          : 'Nenhuma fatura gerada'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {cycle.status === 'open' && (
                      <a href={`/admin/agua/faturamento?cycle=${cycle.id}`}>
                      <Button variant="secondary" size="sm">Processar</Button>
                      </a>
                    )}
                    {cycle.status === 'closed' && (
                      <a href="/admin/finance/faturas">
                        <Button variant="text" size="sm">Ver Faturas</Button>
                      </a>
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
