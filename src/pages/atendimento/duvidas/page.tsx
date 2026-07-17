import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Button from '@/components/base/Button';
import { useFAQ } from '@/hooks/useSupportData';
import FAQSection from '@/pages/atendimento/components/FAQSection';

export default function DuvidasPage() {
  const navigate = useNavigate();
  const { items, loading } = useFAQ();

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center cursor-pointer hover:bg-background-200 transition-colors flex-shrink-0"
        >
          <i className="ri-arrow-left-line text-foreground-600" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Dúvidas frequentes</h1>
        </div>
      </div>

      <FAQSection items={items} loading={loading} />

      {/* Bottom CTA */}
      <div className="mt-6 pt-4 border-t border-background-200">
        <p className="text-sm text-foreground-600 text-center mb-3">
          Não encontrou o que procurava?
        </p>
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={() => navigate('/atendimento/novo')}
        >
          <i className="ri-chat-1-line mr-1" />
          Abrir atendimento
        </Button>
      </div>
    </AppShell>
  );
}