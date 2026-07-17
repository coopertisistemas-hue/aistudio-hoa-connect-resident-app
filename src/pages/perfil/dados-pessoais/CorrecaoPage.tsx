import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import Alert from '@/components/base/Alert';
import Toast from '@/components/base/Toast';
import { useProfileOverview, useCorrectionRequest } from '@/hooks/useProfileData';

const stepLabels = ['Informação', 'Correção', 'Revisão'];

export default function CorrecaoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fieldKey = searchParams.get('field') || '';
  const { data, loading, error, reload } = useProfileOverview();
  const { submit, submitting } = useCorrectionRequest();

  const [step, setStep] = useState(0);
  const [requestedValue, setRequestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const affectedField = data?.protectedFields.find((f) => f.key === fieldKey);

  useEffect(() => {
    const el = document.querySelector('[data-toast-container]');
  }, [toastMsg]);

  const handleNext = () => {
    if (step === 0 && !requestedValue.trim()) return;
    if (step === 1 && !reason.trim()) return;
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (!affectedField) return;
    const result = await submit({
      affectedField: fieldKey as any,
      affectedFieldLabel: affectedField.label,
      currentValue: affectedField.value,
      requestedValue: requestedValue.trim(),
      reason: reason.trim(),
      attachmentName: attachmentName.trim() || undefined,
    });
    if (result) {
      setConfirmation(result);
      setStep(3);
    }
  };

  const handleGoToSupport = () => {
    if (confirmation?.requestId) {
      navigate(`/atendimento/solicitacoes/${confirmation.requestId}`);
    } else {
      navigate('/atendimento');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (error || !data || !affectedField) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <i className="ri-error-warning-line text-2xl text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground-900 mb-1">Informação não encontrada</h3>
          <p className="text-sm text-foreground-500 max-w-xs mb-4">
            {error || 'O campo solicitado não está disponível para correção.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/perfil/dados-pessoais')}>
            Voltar
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Step indicator */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-2">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  ${i <= step ? 'bg-primary-500 text-white' : 'bg-background-200 text-foreground-400'}
                `}>
                  {i + 1}
                </div>
                <span className={`text-xs font-medium ${i <= step ? 'text-foreground-800' : 'text-foreground-400'}`}>
                  {label}
                </span>
                {i < 2 && <div className={`w-6 h-px ${i < step ? 'bg-primary-500' : 'bg-background-200'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 0: Information */}
        {step === 0 && (
          <div className="bg-white rounded-2xl border border-background-200/70 p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground-900 mb-1">{affectedField.label}</p>
              <p className="text-xs text-foreground-400 mb-3">Dado controlado pela associação</p>
              <div className="p-3 bg-background-100 rounded-lg">
                <p className="text-xs text-foreground-500">Valor atual</p>
                <p className="text-sm font-medium text-foreground-800 mt-0.5">{affectedField.value}</p>
              </div>
              <p className="text-xs text-foreground-500 mt-3 leading-relaxed">{affectedField.explanation}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground-900 block mb-1.5">
                Qual é o valor correto?
              </label>
              <Input
                value={requestedValue}
                onChange={setRequestedValue}
                placeholder="Informe o valor correto"
                maxLength={80}
              />
            </div>

            <Button variant="primary" size="sm" className="w-full" onClick={handleNext} disabled={!requestedValue.trim()}>
              Continuar
            </Button>
          </div>
        )}

        {/* Step 1: Reason + document */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-background-200/70 p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground-900 block mb-1.5">
                Motivo da correção
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva por que esta informação precisa ser corrigida"
                rows={4}
                maxLength={500}
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-background-200 bg-white text-foreground-900 placeholder:text-foreground-400 resize-none focus:outline-none focus:border-primary-400 transition-colors"
              />
              <p className="text-[10px] text-foreground-400 mt-1 text-right">{reason.length}/500</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground-900 block mb-1.5">
                Documento comprobatório (simulado)
              </label>
              <Input
                value={attachmentName}
                onChange={setAttachmentName}
                placeholder="Nome do arquivo (ex: documento.pdf)"
                maxLength={60}
              />
              <p className="text-[10px] text-foreground-400 mt-1">
                Anexos são simulados nesta demonstração.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={handleNext} disabled={!reason.trim()}>
                Revisar
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-background-200/70 p-4 space-y-4">
            <p className="text-sm font-semibold text-foreground-900">Revisão da solicitação</p>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-500">Campo</span>
                <span className="text-foreground-800 font-medium">{affectedField.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-500">Valor atual</span>
                <span className="text-foreground-800">{affectedField.value}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-500">Valor solicitado</span>
                <span className="text-foreground-800 font-medium">{requestedValue}</span>
              </div>
              <div>
                <p className="text-foreground-500 mb-1">Motivo</p>
                <p className="text-xs text-foreground-700 bg-background-100 p-2 rounded-lg">{reason}</p>
              </div>
              {attachmentName && (
                <div className="flex items-center gap-2">
                  <i className="ri-file-line text-foreground-400" />
                  <span className="text-xs text-foreground-600">{attachmentName}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setStep(1)}>
                Editar
              </Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={handleSubmit} loading={submitting}>
                Enviar solicitação
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && confirmation && (
          <div className="bg-white rounded-2xl border border-background-200/70 p-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <i className="ri-check-line text-2xl text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground-900">Solicitação enviada</p>
              <p className="text-xs text-foreground-500 mt-1">Correção de dados cadastrais</p>
            </div>
            <div className="p-3 bg-background-100 rounded-lg text-left space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-foreground-400">Protocolo</span>
                <span className="text-foreground-800 font-medium">{confirmation.protocol}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-foreground-400">Data</span>
                <span className="text-foreground-800">{confirmation.submittedDate}</span>
              </div>
            </div>
            <p className="text-xs text-foreground-500">{confirmation.expectedStep}</p>
            <div className="space-y-2">
              <Button variant="primary" size="sm" className="w-full" onClick={handleGoToSupport}>
                Acompanhar no Atendimento
              </Button>
              <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate('/perfil/dados-pessoais')}>
                Voltar aos dados pessoais
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}