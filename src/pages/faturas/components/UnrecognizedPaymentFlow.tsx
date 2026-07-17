import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from '@/components/base/BottomSheet';
import { unrecognizedReasons, submitUnrecognizedPayment } from '@/fixtures/financialScenarios';
import { submitNewRequest } from '@/fixtures/supportScenarios';
import type { InvoiceData, UnrecognizedReason, UnrecognizedConfirmation } from '@/fixtures/types';
import { showToast } from '@/components/base/Toast';

interface UnrecognizedPaymentFlowProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceData;
}

type Step = 'intro' | 'form' | 'review' | 'confirmation';

export default function UnrecognizedPaymentFlow({ open, onClose, invoice }: UnrecognizedPaymentFlowProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('intro');
  const [reason, setReason] = useState<UnrecognizedReason | null>(null);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionRef, setTransactionRef] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<UnrecognizedConfirmation | null>(null);
  const [supportRequestId, setSupportRequestId] = useState<string | null>(null);

  function reset() {
    setStep('intro');
    setReason(null);
    setPaymentDate('');
    setPaymentMethod('');
    setTransactionRef('');
    setDescription('');
    setAttachmentName('');
    setConfirmation(null);
    setSupportRequestId(null);
  }

  function handleClose() {
    if (step === 'form' && (reason || paymentDate)) {
      if (!window.confirm('Deseja cancelar o relato? As informações preenchidas serão perdidas.')) return;
    }
    reset();
    onClose();
  }

  function handleSubmit() {
    if (!reason) return;
    setSubmitting(true);
    const reasonLabel = unrecognizedReasons.find(r => r.value === reason)?.label || reason;
    submitUnrecognizedPayment({
      invoiceId: invoice.id,
      invoiceReference: invoice.reference,
      paymentDate,
      paymentMethod,
      transactionReference: transactionRef || undefined,
      reason,
      reasonLabel,
      description: description || undefined,
    }).then((result) => {
      setConfirmation(result);

      // Bridge: create corresponding support request in Support module
      try {
        const supportResult = submitNewRequest({
          category: 'invoice_or_payment',
          relatedEntity: { type: 'invoice', id: invoice.id, label: invoice.reference },
          subject: `Pagamento não identificado — ${invoice.reference}`,
          description: `Pagamento de ${invoice.formattedAmount} realizado em ${paymentDate} via ${paymentMethod}. ${description || ''}`,
          occurrenceDate: paymentDate,
          contactChannel: 'app',
          preferredTime: '',
          attachments: [],
          residenceId: invoice.residenceId || 'prop-001',
        });
        setSupportRequestId(supportResult.requestId);
      } catch {
        // silent — support bridge is best-effort
      }

      setStep('confirmation');
      setSubmitting(false);
    }).catch(() => {
      showToast('Erro ao enviar. Tente novamente.', 'error');
      setSubmitting(false);
    });
  }

  function handleSimulateAttachment() {
    setTimeout(() => {
      setAttachmentName('comprovante-pagamento.jpg');
      showToast('Anexo simulado adicionado para demonstração.', 'success');
    }, 600);
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title={
      step === 'intro' ? 'Informar pagamento' :
      step === 'form' ? 'Dados do pagamento' :
      step === 'review' ? 'Revisar informações' :
      'Confirmação'
    }>
      {step === 'intro' && (
        <div>
          <p className="text-sm text-foreground-600 mb-4">
            Se você já pagou esta fatura e ela ainda aparece como pendente, utilize esta ferramenta para nos informar. Vamos analisar seu caso.
          </p>
          <div className="bg-background-100 rounded-xl p-3 mb-4">
            <span className="text-xs text-foreground-500 block mb-1">Fatura selecionada</span>
            <span className="text-sm font-semibold text-foreground-900">{invoice.reference}</span>
            <span className="text-sm text-foreground-600 block mt-0.5">{invoice.formattedAmount}</span>
            <span className="text-xs text-foreground-500 block">Vencimento: {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}</span>
          </div>
          <button
            onClick={() => setStep('form')}
            className="w-full py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            Continuar
          </button>
        </div>
      )}

      {step === 'form' && (
        <div>
          {/* Payment date */}
          <label className="text-xs font-medium text-foreground-700 block mb-1.5">Data do pagamento</label>
          <input
            type="date"
            value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-background-300 bg-white text-sm text-foreground-900 mb-4 focus:outline-none focus:border-primary-400"
          />

          {/* Payment method */}
          <label className="text-xs font-medium text-foreground-700 block mb-1.5">Forma de pagamento</label>
          <div className="flex gap-2 mb-4">
            {['PIX', 'Boleto', 'Transferência', 'Dinheiro', 'Outro'].map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  paymentMethod === m ? 'bg-primary-500 text-white' : 'bg-background-200 text-foreground-600 hover:bg-background-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Transaction reference */}
          <label className="text-xs font-medium text-foreground-700 block mb-1.5">Referência da transação (opcional)</label>
          <input
            type="text"
            value={transactionRef}
            onChange={e => setTransactionRef(e.target.value)}
            placeholder="Ex: código de autorização"
            className="w-full px-3 py-2.5 rounded-xl border border-background-300 bg-white text-sm text-foreground-900 mb-4 focus:outline-none focus:border-primary-400"
          />

          {/* Reason */}
          <label className="text-xs font-medium text-foreground-700 block mb-1.5">Motivo</label>
          <div className="space-y-2 mb-4">
            {unrecognizedReasons.map(r => (
              <button
                key={r.value}
                onClick={() => setReason(r.value)}
                className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                  reason === r.value ? 'border-primary-400 bg-primary-50' : 'border-background-200 bg-white hover:border-background-300'
                }`}
              >
                <span className="text-sm font-medium text-foreground-900 block">{r.label}</span>
                <span className="text-xs text-foreground-500">{r.description}</span>
              </button>
            ))}
          </div>

          {/* Description */}
          <label className="text-xs font-medium text-foreground-700 block mb-1.5">Descrição adicional (opcional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Descreva o que aconteceu..."
            className="w-full px-3 py-2.5 rounded-xl border border-background-300 bg-white text-sm text-foreground-900 mb-2 focus:outline-none focus:border-primary-400 resize-none"
          />
          <span className="text-xs text-foreground-400 block mb-4">{description.length}/500</span>

          {/* Simulated attachment */}
          <div className="mb-4">
            <button
              onClick={handleSimulateAttachment}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-background-300 text-sm text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-attachment-2 text-lg" />
              {attachmentName || 'Anexar comprovante (demonstração)'}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('intro')}
              className="flex-1 py-3 rounded-xl border border-background-300 text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              Voltar
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={!reason || !paymentDate || !paymentMethod}
              className="flex-1 py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Revisar
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <p className="text-sm text-foreground-600 mb-4">Confira as informações antes de enviar:</p>
          <div className="bg-background-100 rounded-xl p-3 space-y-2 mb-4">
            <div><span className="text-xs text-foreground-500">Fatura:</span><span className="text-sm text-foreground-900 ml-2">{invoice.reference}</span></div>
            <div><span className="text-xs text-foreground-500">Valor:</span><span className="text-sm text-foreground-900 ml-2">{invoice.formattedAmount}</span></div>
            <div><span className="text-xs text-foreground-500">Data do pagamento:</span><span className="text-sm text-foreground-900 ml-2">{new Date(paymentDate).toLocaleDateString('pt-BR')}</span></div>
            <div><span className="text-xs text-foreground-500">Forma:</span><span className="text-sm text-foreground-900 ml-2">{paymentMethod}</span></div>
            <div><span className="text-xs text-foreground-500">Motivo:</span><span className="text-sm text-foreground-900 ml-2">{unrecognizedReasons.find(r => r.value === reason)?.label}</span></div>
            {attachmentName && <div><span className="text-xs text-foreground-500">Anexo:</span><span className="text-sm text-foreground-900 ml-2">{attachmentName}</span></div>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('form')} className="flex-1 py-3 rounded-xl border border-background-300 text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap">Voltar</button>
            <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60">
              {submitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {step === 'confirmation' && confirmation && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <i className="ri-check-line text-3xl text-green-600" />
          </div>
          <h4 className="text-base font-semibold text-foreground-900 mb-1">Relato registrado</h4>
          <p className="text-xs text-foreground-500 mb-3">Solicitação registrada para demonstração.</p>
          <div className="bg-background-100 rounded-xl p-3 text-left space-y-2 mb-4">
            <div><span className="text-xs text-foreground-500">Protocolo:</span><span className="text-sm font-mono text-foreground-900 ml-2">{confirmation.protocol}</span></div>
            <div><span className="text-xs text-foreground-500">Data:</span><span className="text-sm text-foreground-900 ml-2">{new Date(confirmation.submittedDate).toLocaleDateString('pt-BR')}</span></div>
            <div><span className="text-xs text-foreground-500">Próximo passo:</span><span className="text-sm text-foreground-700 ml-2">{confirmation.expectedStep}</span></div>
          </div>
          {supportRequestId && (
            <button
              onClick={() => { handleClose(); navigate(`/atendimento/solicitacoes/${supportRequestId}`); }}
              className="w-full mb-2 py-3 rounded-xl border border-background-300 text-sm font-semibold text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-customer-service-line" />
              Ver no atendimento
            </button>
          )}
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            Entendi
          </button>
        </div>
      )}
    </BottomSheet>
  );
}