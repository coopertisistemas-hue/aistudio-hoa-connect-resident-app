import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HistoricalDataPoint, DivergenceReason, DivergenceReport, DivergenceConfirmation } from '@/fixtures/types';
import { divergenceReasons, submitSimulatedDivergence } from '@/fixtures/consumptionScenarios';
import { submitNewRequest } from '@/fixtures/supportScenarios';
import BottomSheet from '@/components/base/BottomSheet';
import Button from '@/components/base/Button';
import { showToast } from '@/components/base/Toast';

type Step = 'explanation' | 'form' | 'review' | 'confirmation';

interface DivergenceFlowProps {
  reading: HistoricalDataPoint;
  open: boolean;
  onClose: () => void;
}

export default function DivergenceFlow({ reading, open, onClose }: DivergenceFlowProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('explanation');
  const [reason, setReason] = useState<DivergenceReason | null>(null);
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [confirmation, setConfirmation] = useState<DivergenceConfirmation | null>(null);
  const [supportRequestId, setSupportRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attachmentSimulated, setAttachmentSimulated] = useState(false);

  function handleClose() {
    if (step === 'form' && (reason || description)) {
      if (!window.confirm('Deseja cancelar o relato de divergência? As informações preenchidas serão perdidas.')) return;
    }
    resetForm();
    onClose();
  }

  function resetForm() {
    setStep('explanation');
    setReason(null);
    setDescription('');
    setAttachmentName('');
    setConfirmation(null);
    setSupportRequestId(null);
    setAttachmentSimulated(false);
  }

  function handleAttachSimulated() {
    setAttachmentName('imagem-hidrometro-julho.jpg');
    setAttachmentSimulated(true);
    showToast('Imagem simulada anexada para demonstração.', 'info');
  }

  function handleSubmit() {
    if (!reason) return;
    setSubmitting(true);
    setTimeout(() => {
      const result = submitSimulatedDivergence();
      setConfirmation(result);

      // Bridge: create corresponding support request in Support module
      try {
        const supportResult = submitNewRequest({
          category: 'consumption_or_reading',
          relatedEntity: { type: 'reading', id: reading.id, label: `Leitura — ${reading.period}` },
          subject: `Divergência de leitura — ${reading.period}`,
          description: description || `Divergência relatada: ${reasonLabel}. Período: ${reading.period}. Consumo: ${reading.consumption} m³.`,
          occurrenceDate: reading.readingDate,
          contactChannel: 'app',
          preferredTime: '',
          attachments: [],
          residenceId: 'prop-001',
        });
        setSupportRequestId(supportResult.requestId);
      } catch {
        // silent — support bridge is best-effort
      }

      setStep('confirmation');
      setSubmitting(false);
    }, 1200);
  }

  const reasonLabel = divergenceReasons.find((r) => r.value === reason)?.label || '';

  const report: DivergenceReport = {
    readingId: reading.id,
    period: reading.period,
    readingDate: reading.readingDate,
    reason: reason || 'outro',
    reasonLabel,
    description: description || undefined,
    attachmentName: attachmentName || undefined,
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title={step === 'confirmation' ? 'Solicitação enviada' : 'Informar divergência'}>
      {/* Step 1: Explanation */}
      {step === 'explanation' && (
        <div className="space-y-4">
          <div className="bg-accent-50 rounded-xl p-3 text-xs text-foreground-600 leading-relaxed">
            <p>
              Use este canal para informar à associação quando você identificar algo que não parece certo na sua leitura de consumo.
            </p>
            <p className="mt-2">
              Exemplos: valor muito diferente do hidrômetro, imóvel desocupado no período, possível erro de leitura.
            </p>
          </div>

          <div className="bg-background-50 rounded-xl p-3 space-y-2 text-xs">
            <p className="font-medium text-foreground-800">Leitura selecionada</p>
            <div className="flex justify-between">
              <span className="text-foreground-500">Período</span>
              <span className="text-foreground-800 font-medium">{reading.period}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-500">Consumo</span>
              <span className="text-foreground-800 font-medium">{reading.consumption} m³</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-500">Status</span>
              <span className="text-foreground-800 font-medium">{reading.statusLabel}</span>
            </div>
          </div>

          <Button variant="primary" fullWidth onClick={() => setStep('form')}>
            Continuar
          </Button>
        </div>
      )}

      {/* Step 2: Form */}
      {step === 'form' && (
        <div className="space-y-4">
          <p className="text-xs text-foreground-500">Selecione o motivo que melhor descreve a divergência:</p>

          <div className="space-y-1.5">
            {divergenceReasons.map((r) => (
              <label
                key={r.value}
                className={`
                  flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                  ${reason === r.value
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-background-200 hover:border-background-300 bg-white'}
                `}
              >
                <input
                  type="radio"
                  name="divergence_reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="mt-0.5 accent-primary-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground-800">{r.label}</p>
                  <p className="text-xs text-foreground-500 mt-0.5">{r.description}</p>
                </div>
              </label>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-foreground-700 mb-1 block">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que você observou..."
              maxLength={500}
              rows={3}
              className="w-full text-sm p-3 rounded-xl border border-background-300 bg-white text-foreground-800 placeholder:text-foreground-300 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200 resize-none"
            />
            <p className="text-[10px] text-foreground-400 text-right mt-1">{description.length}/500</p>
          </div>

          {/* Simulated attachment */}
          <div>
            {attachmentSimulated ? (
              <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-green-50 border border-green-200">
                <i className="ri-image-line text-green-600" />
                <span className="text-green-700 font-medium">{attachmentName}</span>
                <button
                  onClick={() => { setAttachmentName(''); setAttachmentSimulated(false); }}
                  className="ml-auto text-green-500 hover:text-green-700 cursor-pointer"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAttachSimulated}
                className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-foreground-500 border border-dashed border-background-300 rounded-xl hover:border-foreground-300 hover:text-foreground-600 transition-colors cursor-pointer"
              >
                <i className="ri-camera-line" />
                Anexar foto do hidrômetro (demonstração)
              </button>
            )}
            <p className="text-[10px] text-foreground-300 mt-1 text-center">Demonstração — nenhuma imagem real será enviada.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep('explanation')} className="flex-1">
              Voltar
            </Button>
            <Button
              variant="primary"
              disabled={!reason}
              onClick={() => setStep('review')}
              className="flex-1"
            >
              Revisar
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <p className="text-xs text-foreground-500">Confira os dados antes de enviar:</p>

          <div className="bg-background-50 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-background-200">
              <span className="text-foreground-500">Período</span>
              <span className="text-foreground-800 font-medium">{report.period}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-background-200">
              <span className="text-foreground-500">Data da leitura</span>
              <span className="text-foreground-800 font-medium">{report.readingDate}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-background-200">
              <span className="text-foreground-500">Motivo</span>
              <span className="text-foreground-800 font-medium text-right max-w-[60%]">{report.reasonLabel}</span>
            </div>
            {report.description && (
              <div className="flex justify-between py-1.5 border-b border-background-200">
                <span className="text-foreground-500">Descrição</span>
                <span className="text-foreground-800 font-medium text-right max-w-[55%]">{report.description}</span>
              </div>
            )}
            {report.attachmentName && (
              <div className="flex justify-between py-1.5">
                <span className="text-foreground-500">Anexo</span>
                <span className="text-foreground-800 font-medium">{report.attachmentName}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep('form')} className="flex-1">
              Voltar
            </Button>
            <Button variant="primary" loading={submitting} onClick={handleSubmit} className="flex-1">
              Enviar
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmation */}
      {step === 'confirmation' && confirmation && (
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <i className="ri-check-line text-3xl text-green-600" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-foreground-900">Solicitação registrada para demonstração</h4>
            <p className="text-xs text-foreground-500 mt-1">
              Nenhuma solicitação real foi enviada. Este é um fluxo simulado.
            </p>
          </div>

          <div className="bg-background-50 rounded-xl p-3 space-y-2 text-xs text-left">
            <div className="flex justify-between py-1.5 border-b border-background-200">
              <span className="text-foreground-500">Protocolo</span>
              <span className="text-foreground-800 font-medium font-mono">{confirmation.protocol}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-background-200">
              <span className="text-foreground-500">Data</span>
              <span className="text-foreground-800 font-medium">{confirmation.submittedDate}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-foreground-500">Próximo passo</span>
              <span className="text-foreground-800 font-medium text-right max-w-[60%]">{confirmation.expectedStep}</span>
            </div>
          </div>

          <div className="space-y-2">
            {supportRequestId && (
              <Button variant="secondary" fullWidth onClick={() => { handleClose(); navigate(`/atendimento/solicitacoes/${supportRequestId}`); }}>
                <i className="ri-customer-service-line mr-1" />
                Ver no atendimento
              </Button>
            )}
            <Button variant="primary" fullWidth onClick={handleClose}>
              Voltar para o consumo
            </Button>
            <Button variant="text" fullWidth onClick={handleClose}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}