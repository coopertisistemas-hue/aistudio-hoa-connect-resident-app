import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import { useFinancasData } from '@/hooks/useFinancasData';
import type { ReceiptData } from '@/fixtures/types';
import { showToast } from '@/components/base/Toast';

export default function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { fetchReceipt } = useFinancasData();

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    setLoading(true);
    fetchReceipt(paymentId).then(result => {
      if (result) { setReceipt(result); setError(null); }
      else setError('Comprovante não encontrado.');
      setLoading(false);
    }).catch(() => {
      setError('Erro ao carregar comprovante.');
      setLoading(false);
    });
  }, [paymentId, fetchReceipt]);

  function handleSimulatedDownload() {
    showToast('Download do comprovante simulado.', 'info');
  }

  function handleSimulatedShare() {
    showToast('Compartilhamento simulado.', 'info');
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-24 bg-background-200 rounded" />
          <div className="h-64 bg-background-200 rounded-xl" />
          <div className="h-32 bg-background-200 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (error || !receipt) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <i className="ri-file-text-line text-3xl text-red-600" />
          </div>
          <p className="text-sm text-foreground-600 mb-4">{error || 'Comprovante não encontrado'}</p>
          <button onClick={() => navigate('/pagamentos')} className="px-6 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
            Voltar para pagamentos
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
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Comprovante</h1>
          <span className="text-xs text-foreground-500">{receipt.receiptReference}</span>
        </div>
      </div>

      {/* Receipt card */}
      <Card variant="outlined" className="border-2 border-background-300 mb-3">
        <div className="text-center mb-4 pb-3 border-b border-dashed border-background-300">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
            <i className="ri-check-double-line text-2xl text-green-600" />
          </div>
          <span className="text-xs text-foreground-500 block">Comprovante de pagamento</span>
          <h2 className="text-base font-bold text-foreground-900 mt-0.5">{receipt.associationName}</h2>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground-500">Residente</span>
            <span className="text-foreground-800 font-medium">{receipt.residentName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-500">Residência</span>
            <span className="text-foreground-800 font-medium">{receipt.residenceNickname}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-500">Fatura</span>
            <span className="text-foreground-800 font-medium">{receipt.invoiceReference}</span>
          </div>

          <div className="py-3 border-t border-dashed border-background-200">
            <div className="text-center mb-2">
              <span className="text-xs text-foreground-400 block">Valor pago</span>
              <span className="text-2xl font-bold text-foreground-900">{receipt.formattedAmountPaid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-500">Data do pagamento</span>
              <span className="text-foreground-800 font-medium">{new Date(receipt.paymentDate).toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-foreground-500">Identificado em</span>
              <span className="text-foreground-800 font-medium">{new Date(receipt.identificationDate).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <div className="py-3 border-t border-dashed border-background-200">
            <div className="flex justify-between">
              <span className="text-foreground-500">Método</span>
              <span className="text-foreground-800 font-medium">{receipt.paymentMethod}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-foreground-500">Status</span>
              <span className="text-green-700 font-medium">{receipt.paymentStatus}</span>
            </div>
          </div>

          <div className="py-2 border-t border-dashed border-background-200">
            <div className="flex justify-between">
              <span className="text-foreground-500">Referência</span>
              <span className="text-foreground-800 font-medium font-mono text-xs">{receipt.receiptReference}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-foreground-400 italic mt-3 pt-3 border-t border-dashed border-background-300">
          {receipt.validationNote}
        </p>

        {receipt.isDemo && (
          <p className="text-xs text-amber-600 mt-2 font-medium">
            Comprovante disponível para demonstração.
          </p>
        )}
      </Card>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={handleSimulatedDownload}
          className="w-full py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
        >
          <i className="ri-download-line text-lg" />
          Baixar comprovante
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleSimulatedShare}
            className="flex-1 py-2.5 rounded-xl border border-background-300 text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <i className="ri-share-line" />
            Compartilhar
          </button>
          <button
            onClick={() => navigate(`/faturas`)}
            className="flex-1 py-2.5 rounded-xl border border-background-300 text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <i className="ri-bill-line" />
            Ver faturas
          </button>
        </div>
      </div>
    </AppShell>
  );
}