import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import { useFinancasData } from '@/hooks/useFinancasData';
import type { PaymentRecord, PaymentStatus } from '@/fixtures/types';
import { showToast } from '@/components/base/Toast';

const statusBadge: Record<PaymentStatus, { label: string; classes: string }> = {
  identified: { label: 'Identificado', classes: 'bg-green-100 text-green-700' },
  processing: { label: 'Em processamento', classes: 'bg-amber-100 text-amber-700' },
  refunded: { label: 'Estornado', classes: 'bg-red-100 text-red-700' },
  under_review: { label: 'Em análise', classes: 'bg-background-200 text-foreground-600' },
  not_reconciled: { label: 'Não conciliado', classes: 'bg-red-100 text-red-700' },
};

type FilterKey = 'todos' | 'identificados' | 'em processamento' | 'em analise';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'identificados', label: 'Identificados' },
  { key: 'em processamento', label: 'Em processamento' },
  { key: 'em analise', label: 'Em análise' },
];

export default function PagamentosPage() {
  const navigate = useNavigate();
  const { fetchPayments, residenceId } = useFinancasData();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('todos');

  useEffect(() => {
    setLoading(true);
    fetchPayments().then(result => {
      setPayments(result);
      setError(null);
      setLoading(false);
    }).catch(() => {
      setError('Erro ao carregar histórico.');
      setLoading(false);
    });
  }, [fetchPayments, residenceId]);

  const filtered = useMemo(() => {
    switch (activeFilter) {
      case 'identificados': return payments.filter(p => p.status === 'identified');
      case 'em processamento': return payments.filter(p => p.status === 'processing');
      case 'em analise': return payments.filter(p => p.status === 'under_review' || p.status === 'not_reconciled');
      default: return payments;
    }
  }, [payments, activeFilter]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-24 bg-background-200 rounded" />
          <div className="flex gap-2">
            {[1,2,3,4].map(i => <div key={i} className="h-7 w-20 bg-background-200 rounded-full" />)}
          </div>
          {[1,2,3].map(i => <div key={i} className="h-20 bg-background-200 rounded-xl" />)}
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <i className="ri-error-warning-line text-3xl text-red-600" />
          </div>
          <p className="text-sm text-foreground-600 mb-4">{error}</p>
          <button onClick={() => navigate('/faturas')} className="px-6 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
            Voltar para faturas
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full hover:bg-background-200 flex items-center justify-center cursor-pointer transition-colors" aria-label="Voltar">
          <i className="ri-arrow-left-line text-foreground-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Histórico de pagamentos</h1>
          <span className="text-xs text-foreground-500">{residenceId === 'prop-002' ? 'Casa Centro' : 'Apto Bloco 3 - 302'}</span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar" role="tablist">
        {filters.map(f => (
          <button
            key={f.key}
            role="tab"
            aria-selected={activeFilter === f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeFilter === f.key
                ? 'bg-primary-500 text-white'
                : 'bg-background-200 text-foreground-600 hover:bg-background-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card variant="outlined" className="text-center py-8 mt-4">
          <div className="w-14 h-14 rounded-full bg-background-200 flex items-center justify-center mx-auto mb-3">
            <i className="ri-history-line text-2xl text-foreground-400" />
          </div>
          <p className="text-sm text-foreground-600 font-medium mb-1">Nenhum pagamento encontrado</p>
          <p className="text-xs text-foreground-500">Não há registros para o filtro selecionado.</p>
        </Card>
      ) : (
        <div className="space-y-2 mt-1">
          {filtered.map(payment => {
            const badge = statusBadge[payment.status];
            return (
              <button
                key={payment.id}
                onClick={() => payment.hasReceipt ? navigate(`/pagamentos/${payment.id}/comprovante`) : showToast('Comprovante não disponível.', 'info')}
                className="w-full text-left p-3 rounded-xl bg-white border border-background-200 hover:border-background-300 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
                      <i className="ri-check-double-line text-green-600 text-lg" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-foreground-900 block leading-tight">
                        {payment.reference}
                      </span>
                      <span className="text-xs text-foreground-500">
                        {new Date(payment.paymentDate).toLocaleDateString('pt-BR')} — {payment.paymentMethod}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-foreground-900 block">{payment.formattedAmount}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.classes}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>
                {payment.hasReceipt && (
                  <div className="flex items-center gap-1 text-xs text-primary-600 font-medium mt-1">
                    <i className="ri-file-text-line" />
                    Ver comprovante
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}