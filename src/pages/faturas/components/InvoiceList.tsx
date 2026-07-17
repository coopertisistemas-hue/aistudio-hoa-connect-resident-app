import { useState, useMemo } from 'react';
import type { InvoiceData, InvoiceStatus } from '@/fixtures/types';
import Card from '@/components/base/Card';

interface InvoiceListProps {
  invoices: InvoiceData[];
  onSelect: (invoiceId: string) => void;
}

type FilterKey = 'todas' | 'pendentes' | 'vencidas' | 'pagas' | 'em_analise';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendentes', label: 'Pendentes' },
  { key: 'vencidas', label: 'Vencidas' },
  { key: 'pagas', label: 'Pagas' },
  { key: 'em_analise', label: 'Em análise' },
];

const statusBadge: Record<InvoiceStatus, { label: string; classes: string }> = {
  open: { label: 'Aberta', classes: 'bg-background-200 text-foreground-600' },
  due_soon: { label: 'Vence em breve', classes: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'Vencida', classes: 'bg-red-100 text-red-700' },
  paid: { label: 'Paga', classes: 'bg-green-100 text-green-700' },
  processing: { label: 'Processando', classes: 'bg-amber-100 text-amber-700' },
  unidentified: { label: 'Não identificado', classes: 'bg-red-100 text-red-700' },
  canceled: { label: 'Cancelada', classes: 'bg-background-200 text-foreground-500 line-through' },
  under_review: { label: 'Em análise', classes: 'bg-background-200 text-foreground-600' },
  replaced: { label: 'Substituída', classes: 'bg-background-200 text-foreground-500' },
};

function filterInvoices(invoices: InvoiceData[], key: FilterKey): InvoiceData[] {
  switch (key) {
    case 'pendentes': return invoices.filter(i => i.status === 'open' || i.status === 'due_soon');
    case 'vencidas': return invoices.filter(i => i.status === 'overdue');
    case 'pagas': return invoices.filter(i => i.status === 'paid' || i.status === 'processing');
    case 'em_analise': return invoices.filter(i => i.status === 'under_review' || i.status === 'unidentified');
    default: return invoices;
  }
}

export default function InvoiceList({ invoices, onSelect }: InvoiceListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('todas');

  const grouped = useMemo(() => {
    const filtered = filterInvoices(invoices, activeFilter);
    const groups: { year: string; items: InvoiceData[] }[] = [];
    const seen = new Set<string>();

    filtered.forEach(inv => {
      const year = inv.referencePeriod.split('/')[1] || '2026';
      const key = year;
      if (!seen.has(key)) {
        seen.add(key);
        groups.push({ year: key, items: [] });
      }
      const group = groups.find(g => g.year === key);
      if (group) group.items.push(inv);
    });

    return groups;
  }, [invoices, activeFilter]);

  if (invoices.length === 0) {
    return (
      <Card variant="outlined" className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-background-200 flex items-center justify-center mx-auto mb-3">
          <i className="ri-file-list-3-line text-2xl text-foreground-400" />
        </div>
        <p className="text-sm text-foreground-600 font-medium mb-1">Nenhuma fatura encontrada</p>
        <p className="text-xs text-foreground-500">Não há faturas disponíveis para o filtro selecionado.</p>
      </Card>
    );
  }

  return (
    <div>
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

      {/* Invoice cards */}
      <div className="space-y-2">
        {grouped.map(group => (
          <div key={group.year}>
            <h5 className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2 mt-3">
              {group.year}
            </h5>
            {group.items.map(inv => {
              const badge = statusBadge[inv.status];
              const isActionable = inv.status === 'open' || inv.status === 'due_soon' || inv.status === 'overdue' || inv.status === 'processing' || inv.status === 'under_review' || inv.status === 'unidentified';

              return (
                <button
                  key={inv.id}
                  onClick={() => onSelect(inv.id)}
                  className="w-full text-left p-3 rounded-xl bg-white border border-background-200 hover:border-background-300 transition-colors cursor-pointer mb-2"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center">
                        <i className={`${inv.status === 'paid' ? 'ri-check-double-line text-green-600' : inv.status === 'overdue' ? 'ri-error-warning-line text-red-600' : 'ri-bill-line text-foreground-500'} text-lg`} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground-900 block leading-tight">
                          {inv.reference}
                        </span>
                        <span className="text-xs text-foreground-500">
                          Vencimento: {new Date(inv.dueDate).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold block ${inv.status === 'overdue' ? 'text-red-600' : 'text-foreground-900'}`}>
                        {inv.formattedAmount}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.classes}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  {isActionable && (
                    <div className="flex items-center gap-1 text-xs text-primary-600 font-medium mt-1">
                      <i className="ri-arrow-right-line" />
                      Ver detalhes
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}