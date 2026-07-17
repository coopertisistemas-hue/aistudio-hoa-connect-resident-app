import { useState } from 'react';
import type { FAQItem, FAQCategory } from '@/fixtures/types';

interface Props {
  items: FAQItem[];
  loading: boolean;
}

const categoryLabels: Record<FAQCategory, string> = {
  consumption: 'Consumo',
  invoices: 'Faturas',
  meter: 'Hidrômetro',
  supply: 'Abastecimento',
  registration: 'Cadastro',
  support: 'Atendimento',
};

export default function FAQSection({ items, loading }: Props) {
  const [activeCategory, setActiveCategory] = useState<FAQCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-background-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const categories: { key: FAQCategory | 'all'; label: string }[] = [
    { key: 'all', label: 'Todas' },
    ...(['consumption', 'invoices', 'meter', 'supply', 'registration', 'support'] as FAQCategory[]).map((c) => ({
      key: c,
      label: categoryLabels[c],
    })),
  ];

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`
              px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer
              transition-colors duration-150 flex-shrink-0
              ${activeCategory === cat.key
                ? 'bg-primary-500 text-white'
                : 'bg-background-100 text-foreground-600 hover:bg-background-200'
              }
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-foreground-500 text-center py-8">Nenhuma dúvida nesta categoria.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const isOpen = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-background-200 bg-white overflow-hidden"
              >
                <button
                  className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-background-50 transition-colors"
                  onClick={() => setExpandedId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-foreground-800 flex-1">{item.question}</span>
                  <i className={`${isOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-foreground-400 flex-shrink-0`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <div className="border-t border-background-200 pt-3">
                      <p className="text-sm text-foreground-600 leading-relaxed">{item.answer}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}