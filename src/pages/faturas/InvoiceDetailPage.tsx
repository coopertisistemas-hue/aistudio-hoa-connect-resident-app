import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import { useFinancasData } from '@/hooks/useFinancasData';
import type { InvoiceData, InvoiceStatus } from '@/fixtures/types';
import UnrecognizedPaymentFlow from '@/pages/faturas/components/UnrecognizedPaymentFlow';
import { showToast } from '@/components/base/Toast';

const statusBadge: Record<InvoiceStatus, { variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; label: string }> = {
  open: { variant: 'info', label: 'Aberta' },
  due_soon: { variant: 'warning', label: 'Vence em breve' },
  overdue: { variant: 'error', label: 'Vencida' },
  paid: { variant: 'success', label: 'Paga' },
  processing: { variant: 'warning', label: 'Processando' },
  unidentified: { variant: 'error', label: 'Não identificado' },
  canceled: { variant: 'neutral', label: 'Cancelada' },
  under_review: { variant: 'info', label: 'Em análise' },
  replaced: { variant: 'neutral', label: 'Substituída' },
};

const itemTypeIcons: Record<string, string> = {
  water: 'ri-drop-line',
  maintenance: 'ri-building-line',
  reserve: 'ri-bank-line',
  adjustment: 'ri-arrow-left-right-line',
  discount: 'ri-price-tag-3-line',
  interest: 'ri-alert-line',
  fine: 'ri-error-warning-line',
  other: 'ri-file-text-line',
};

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { fetchInvoice, fetchBoleto, fetchPix } = useFinancasData();

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUnrecognizedFlow, setShowUnrecognizedFlow] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    fetchInvoice(invoiceId).then(result => {
      if (result) { setInvoice(result); setError(null); }
      else setError('Fatura não encontrada.');
      setLoading(false);
    }).catch(() => {
      setError('Erro ao carregar fatura.');
      setLoading(false);
    });
  }, [invoiceId, fetchInvoice]);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-24 bg-background-200 rounded" />
          <div className="h-48 bg-background-200 rounded-xl" />
          <div className="h-32 bg-background-200 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (error || !invoice) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <i className="ri-error-warning-line text-3xl text-red-600" />
          </div>
          <p className="text-sm text-foreground-600 mb-4">{error || 'Fatura não encontrada'}</p>
          <button onClick={() => navigate('/faturas')} className="px-6 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
            Voltar para faturas
          </button>
        </div>
      </AppShell>
    );
  }

  const badge = statusBadge[invoice.status];
  const isPayable = invoice.status === 'open' || invoice.status === 'due_soon' || invoice.status === 'overdue';
  const isOverdue = invoice.status === 'overdue';
  const showUnrecognized = invoice.status === 'overdue' || invoice.status === 'unidentified';

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full hover:bg-background-200 flex items-center justify-center cursor-pointer transition-colors" aria-label="Voltar">
          <i className="ri-arrow-left-line text-foreground-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground-900 font-heading">
            {invoice.reference}
          </h1>
          <span className="text-xs text-foreground-500">{invoice.residenceNickname}</span>
        </div>
      </div>

      {/* Amount & status card */}
      <Card variant="filled" className={`border-l-4 ${isOverdue ? 'border-l-red-500' : 'border-l-primary-500'} mb-3`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-xs text-foreground-500 block mb-0.5">
              {invoice.status === 'paid' ? 'Valor pago' : 'Valor'}
            </span>
            <span className="text-2xl font-bold text-foreground-900">
              {invoice.paidAmountFormatted || invoice.formattedAmount}
            </span>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <p className="text-sm text-foreground-600 leading-relaxed">{invoice.statusExplanation}</p>

        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-background-200">
          <div>
            <span className="text-xs text-foreground-500 block">Vencimento</span>
            <span className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-foreground-800'}`}>
              {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <div>
            <span className="text-xs text-foreground-500 block">Emissão</span>
            <span className="text-sm font-semibold text-foreground-800">
              {new Date(invoice.issuedDate).toLocaleDateString('pt-BR')}
            </span>
          </div>
          {invoice.paymentDate && (
            <>
              <div>
                <span className="text-xs text-foreground-500 block">Pagamento</span>
                <span className="text-sm font-semibold text-foreground-800">
                  {new Date(invoice.paymentDate).toLocaleDateString('pt-BR')}
                </span>
              </div>
              {invoice.paymentMethod && (
                <div>
                  <span className="text-xs text-foreground-500 block">Método</span>
                  <span className="text-sm font-semibold text-foreground-800">{invoice.paymentMethod}</span>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Document info */}
      <Card variant="outlined" className="mb-3 p-3">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs text-foreground-500">Documento</span>
            <span className="text-xs text-foreground-800 font-medium">{invoice.documentNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-foreground-500">Referência</span>
            <span className="text-xs text-foreground-800 font-medium">{invoice.referencePeriod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-foreground-500">Associação</span>
            <span className="text-xs text-foreground-800 font-medium">{invoice.associationName}</span>
          </div>
          {invoice.isReplaced && (
            <div className="flex justify-between">
              <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <i className="ri-arrow-left-right-line" /> Substituída
              </span>
              {invoice.replacedById && (
                <button onClick={() => navigate(`/faturas/${invoice.replacedById}`)} className="text-xs text-primary-600 font-medium hover:underline cursor-pointer">
                  Ver versão atual
                </button>
              )}
            </div>
          )}
          {invoice.secondCopyNote && (
            <p className="text-xs text-foreground-500 italic">{invoice.secondCopyNote}</p>
          )}
        </div>
      </Card>

      {/* Line Items */}
      <Card variant="outlined" className="mb-3">
        <h4 className="text-sm font-semibold text-foreground-800 mb-3">Composição da fatura</h4>
        <div className="space-y-2">
          {invoice.lineItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-background-100 last:border-b-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-background-100 flex items-center justify-center">
                  <i className={`${itemTypeIcons[item.type] || 'ri-file-text-line'} text-foreground-500 text-xs`} />
                </div>
                <span className="text-sm text-foreground-700">{item.description}</span>
              </div>
              <span className={`text-sm font-medium ${item.type === 'discount' ? 'text-green-600' : item.type === 'interest' || item.type === 'fine' ? 'text-red-600' : 'text-foreground-800'}`}>
                {item.formattedAmount}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-background-200">
            <span className="text-sm font-semibold text-foreground-900">Total</span>
            <span className="text-base font-bold text-foreground-900">{invoice.formattedAmount}</span>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="space-y-2 mb-4">
        {isPayable && (
          <button
            onClick={() => navigate(`/faturas/${invoice.id}/pagamento`)}
            className="w-full py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-barcode-line text-lg" />
            Ver documento de pagamento
          </button>
        )}

        {invoice.status === 'paid' && invoice.hasBoleto && (
          <button
            onClick={() => navigate(`/faturas/${invoice.id}/pagamento`)}
            className="w-full py-3 rounded-xl border border-background-300 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-file-copy-line text-lg" />
            Ver documento de pagamento
          </button>
        )}

        {invoice.isEligibleForSecondCopy && (invoice.status === 'open' || invoice.status === 'due_soon' || invoice.status === 'overdue') && (
          <button
            onClick={() => {
              navigate(`/faturas/${invoice.id}/pagamento`);
            }}
            className="w-full py-3 rounded-xl border border-background-300 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-file-copy-line text-lg" />
            Emitir 2ª via
          </button>
        )}

        {showUnrecognized && (
          <button
            onClick={() => setShowUnrecognizedFlow(true)}
            className="w-full py-3 rounded-xl border border-amber-300 text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            <i className="ri-error-warning-line text-lg" />
            Informar pagamento não identificado
          </button>
        )}
      </div>

      <UnrecognizedPaymentFlow
        open={showUnrecognizedFlow}
        onClose={() => setShowUnrecognizedFlow(false)}
        invoice={invoice}
      />
    </AppShell>
  );
}