// Admin Financial Reports — Page Skeleton
// EPF-01 Financial Domain Foundation

import AppShell from '@/components/feature/AppShell';
import { RequireRole } from '@/lib/auth/RequireRole';
import Card from '@/components/base/Card';
import EmptyState from '@/components/base/EmptyState';

export default function AdminReportsPage() {
  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <h1 className="text-xl font-bold">Relatórios</h1>

          <Card className="p-6">
            <EmptyState
              title="Em breve"
              description="Relatórios financeiros estarão disponíveis em uma próxima atualização."
            />
          </Card>
        </div>
      </AppShell>
    </RequireRole>
  );
}
