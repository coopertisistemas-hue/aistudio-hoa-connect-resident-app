// Admin Finance Dashboard — Page Skeleton
// EPF-01 Financial Domain Foundation
//
// Consideration 10: Dashboard consumes Ledger, not invoice aggregates.
// This page shows skeleton UI for future implementation.
// Currently displays placeholder with future feature list.

import AppShell from '@/components/feature/AppShell';
import { RequireRole } from '@/lib/auth/RequireRole';
import Card from '@/components/base/Card';

export default function AdminFinanceDashboardPage() {
  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <h1 className="text-xl font-bold">Financeiro</h1>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-sm text-foreground-600">Arrecadado (mês)</p>
              <p className="text-2xl font-bold">—</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-foreground-600">Pendente</p>
              <p className="text-2xl font-bold">—</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-foreground-600">Inadimplência</p>
              <p className="text-2xl font-bold">—</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-foreground-600">Taxa de Cobrança</p>
              <p className="text-2xl font-bold">—</p>
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="font-semibold mb-3">Faturas por Status</h2>
            <div className="space-y-2 text-sm text-foreground-500">
              <p>Ciclos de Cobrança — em breve</p>
              <p>Faturas — em breve</p>
              <p>Pagamentos — em breve</p>
              <p>Relatórios — em breve</p>
              <p>Auditoria — em breve</p>
            </div>
          </Card>
        </div>
      </AppShell>
    </RequireRole>
  );
}
