import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import { useFinancasData } from '@/hooks/useFinancasData';
import { showToast } from '@/components/base/Toast';
import FinancialSummaryCard from './components/FinancialSummaryCard';
import InvoiceList from './components/InvoiceList';
import PaymentGuidance from './components/PaymentGuidance';
import FinancasDemoControls from '@/demo/FinancasDemoControls';

export default function FaturasPage() {
  const navigate = useNavigate();
  const {
    overview, loading, refreshing, residenceId, error, listError, isOffline,
    setResidenceId, refresh,
  } = useFinancasData();

  const [showGuidance, setShowGuidance] = useState(false);

  function handleNavigate(path: string) {
    navigate(path);
  }

  async function handleRefresh() {
    await refresh();
    showToast('Informações atualizadas para demonstração.', 'info');
  }

  // Skeleton
  if (loading && !overview) {
    return (
      <AppShell>
        <div className="space-y-3 animate-pulse">
          <div className="h-6 w-32 bg-background-200 rounded" />
          <div className="h-32 bg-background-200 rounded-xl" />
          <div className="flex gap-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-7 w-16 bg-background-200 rounded-full" />
            ))}
          </div>
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-background-200 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  // Error
  if (error && !overview) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <i className="ri-error-warning-line text-3xl text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground-900 mb-1">Erro ao carregar</h2>
          <p className="text-sm text-foreground-500 max-w-xs mb-6">{error}</p>
          <button onClick={handleRefresh} className="px-6 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
            Tentar novamente
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Faturas</h1>
          {overview && (
            <p className="text-xs text-foreground-500 mt-0.5">
              {overview.residenceId === 'prop-002' ? 'Casa Centro' : 'Apto Bloco 3 - 302'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuidance(!showGuidance)}
            className="w-9 h-9 rounded-full hover:bg-background-200 flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Ajuda sobre pagamento"
          >
            <i className="ri-question-line text-foreground-500" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-9 h-9 rounded-full hover:bg-background-200 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40"
            aria-label="Atualizar"
          >
            <i className={`ri-refresh-line text-foreground-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Offline Banner */}
      {isOffline && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
          <i className="ri-wifi-off-line text-amber-600" />
          <span className="text-sm text-amber-800">Você está offline. Os dados exibidos podem estar desatualizados.</span>
        </div>
      )}

      {/* Financial Summary */}
      {overview && (
        <div className="mb-4">
          <FinancialSummaryCard overview={overview} onNavigate={handleNavigate} />
        </div>
      )}

      {/* Paid this year quick stat */}
      {overview && overview.paidThisYear > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-green-50 border border-green-100">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <i className="ri-check-double-line text-green-600 text-lg" />
          </div>
          <div>
            <span className="text-xs text-green-700 block">Pago em {new Date().getFullYear()}</span>
            <span className="text-sm font-bold text-green-800">{overview.paidThisYearFormatted}</span>
          </div>
        </div>
      )}

      {/* Partial list error */}
      {listError && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
          <i className="ri-alert-line text-amber-600" />
          <span className="text-sm text-amber-800">Algumas faturas não puderam ser carregadas. As demais estão disponíveis.</span>
        </div>
      )}

      {/* Guidance */}
      {showGuidance && <PaymentGuidance />}

      {/* Invoice List */}
      {overview && (
        <div className="mt-2">
          <h3 className="text-sm font-semibold text-foreground-800 mb-3">Histórico de faturas</h3>
          <InvoiceList
            invoices={overview.invoices}
            onSelect={(invoiceId) => navigate(`/faturas/${invoiceId}`)}
          />
        </div>
      )}

      {/* Payments link */}
      {overview && overview.payments.length > 0 && (
        <button
          onClick={() => navigate('/pagamentos')}
          className="w-full mt-4 p-3 rounded-xl bg-background-100 hover:bg-background-200 transition-colors cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
              <i className="ri-history-line text-primary-600 text-lg" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-foreground-900 block">Histórico de pagamentos</span>
              <span className="text-xs text-foreground-500">{overview.payments.length} pagamento(s) registrado(s)</span>
            </div>
          </div>
          <i className="ri-arrow-right-s-line text-foreground-400 text-lg" />
        </button>
      )}

      {/* Demo Controls */}
      <FinancasDemoControls
        currentResidenceId={residenceId}
        onSwitchResidence={setResidenceId}
      />
    </AppShell>
  );
}