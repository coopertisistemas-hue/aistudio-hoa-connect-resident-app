import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Button from '@/components/base/Button';
import BottomSheet from '@/components/base/BottomSheet';
import { showToast } from '@/components/base/Toast';
import { useSubmitRequest } from '@/hooks/useSupportData';
import { getSupportCategoryOptions } from '@/demo/supportService';
import type { NewRequestStep, NewRequestFormData, SupportRequestCategory, RelatedEntity } from '@/fixtures/types';

const supportCategoryOptions = getSupportCategoryOptions();

const emptyForm: NewRequestFormData = {
  category: null,
  relatedEntity: { type: 'none', id: '', label: 'Nenhum' },
  subject: '',
  description: '',
  occurrenceDate: '',
  contactChannel: 'whatsapp',
  preferredTime: '',
  attachments: [],
  residenceId: 'prop-001',
};

const stepLabels: Record<NewRequestStep, string> = {
  category: 'Categoria',
  context: 'Contexto',
  description: 'Descrição',
  attachments: 'Anexos',
  review: 'Revisar',
  confirmation: 'Confirmação',
};

const contactChannels = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'app', label: 'Pelo próprio app' },
];

const relatedEntityOptions: { value: RelatedEntity['type']; label: string; icon: string }[] = [
  { value: 'none', label: 'Nenhum registro relacionado', icon: 'ri-close-circle-line' },
  { value: 'invoice', label: 'Fatura', icon: 'ri-bill-line' },
  { value: 'payment', label: 'Pagamento', icon: 'ri-money-dollar-circle-line' },
  { value: 'reading', label: 'Leitura do hidrômetro', icon: 'ri-drop-line' },
  { value: 'notice', label: 'Aviso da associação', icon: 'ri-megaphone-line' },
  { value: 'residence', label: 'Minha residência', icon: 'ri-home-line' },
];

export default function NovoAtendimentoPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<NewRequestStep>('category');
  const [form, setForm] = useState<NewRequestFormData>(emptyForm);
  const { submit, submitting, error: submitError, clearError } = useSubmitRequest();
  const [confirmation, setConfirmation] = useState<any>(null);

  const updateForm = (partial: Partial<NewRequestFormData>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  };

  const totalSteps = 5;
  const currentStepIndex = ['category', 'context', 'description', 'attachments', 'review'].indexOf(step);

  const canGoNext = () => {
    switch (step) {
      case 'category': return form.category !== null;
      case 'context': return true;
      case 'description': return form.subject.trim().length >= 5 && form.description.trim().length >= 10;
      case 'attachments': return true;
      case 'review': return true;
      default: return false;
    }
  };

  const handleNext = () => {
    const order: NewRequestStep[] = ['category', 'context', 'description', 'attachments', 'review'];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };

  const handleBack = () => {
    if (step === 'category') {
      navigate(-1);
      return;
    }
    const order: NewRequestStep[] = ['category', 'context', 'description', 'attachments', 'review'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const handleSubmit = async () => {
    const result = await submit(form);
    if (result) {
      setConfirmation(result);
      setStep('confirmation');
    }
  };

  const selectedCategory = supportCategoryOptions.find((c) => c.value === form.category);

  if (step === 'confirmation' && confirmation) {
    return (
      <AppShell>
        <div className="flex flex-col items-center text-center pt-8 pb-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <i className="ri-check-double-line text-2xl text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground-900 font-heading mb-2">
            Solicitação registrada para demonstração
          </h2>
          <p className="text-sm text-foreground-500 max-w-xs mb-6">
            Sua solicitação foi registrada. Em breve a associação analisará seu caso.
          </p>

          <div className="w-full bg-white rounded-2xl border border-background-200 p-4 mb-6 text-left">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-foreground-500 mb-0.5">Protocolo</p>
                <p className="text-base font-mono font-semibold text-foreground-900">{confirmation.protocol}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-0.5">Data de envio</p>
                <p className="text-sm text-foreground-700">
                  {new Date(confirmation.submittedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-0.5">Categoria</p>
                <p className="text-sm text-foreground-700">{confirmation.categoryLabel}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-0.5">Próximo passo</p>
                <p className="text-sm text-foreground-700">{confirmation.expectedStep}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => navigate(`/atendimento/solicitacoes/${confirmation.requestId}`)}
            >
              Acompanhar solicitação
            </Button>
            <Button variant="text" size="md" fullWidth onClick={() => navigate('/atendimento')}>
              Voltar ao atendimento
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={handleBack}
          className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center cursor-pointer hover:bg-background-200 transition-colors flex-shrink-0"
        >
          <i className="ri-arrow-left-line text-foreground-600" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Novo atendimento</h1>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto scrollbar-hide">
        {(['category', 'context', 'description', 'attachments', 'review'] as NewRequestStep[]).map((s, idx) => (
          <div key={s} className="flex items-center gap-1.5 flex-shrink-0">
            <div className={`
              w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center transition-colors
              ${idx < currentStepIndex ? 'bg-green-500 text-white' : idx === currentStepIndex ? 'bg-primary-500 text-white' : 'bg-background-200 text-foreground-400'}
            `}>
              {idx < currentStepIndex ? (
                <i className="ri-check-line text-xs" />
              ) : (
                idx + 1
              )}
            </div>
            <span className={`text-xs ${idx === currentStepIndex ? 'font-semibold text-foreground-800' : 'text-foreground-400'} hidden sm:inline`}>
              {stepLabels[s]}
            </span>
            {idx < 4 && <div className={`w-4 h-0.5 ${idx < currentStepIndex ? 'bg-green-500' : 'bg-background-200'}`} />}
          </div>
        ))}
      </div>

      {/* Submit Error */}
      {submitError && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
          <span className="flex-1">{submitError}</span>
          <button onClick={clearError} className="cursor-pointer text-red-500 hover:text-red-700 ml-2">
            <i className="ri-close-line" />
          </button>
        </div>
      )}

      {/* Step Content */}
      <div className="mb-5">
        {step === 'category' && (
          <div>
            <p className="text-sm text-foreground-600 mb-4">
              Selecione a categoria que melhor descreve o assunto do seu atendimento:
            </p>
            <div className="space-y-2">
              {supportCategoryOptions.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => updateForm({ category: cat.value })}
                  className={`w-full text-left p-4 rounded-2xl border cursor-pointer transition-all duration-150 ${
                    form.category === cat.value
                      ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-100'
                      : 'border-background-200 bg-white hover:bg-background-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      form.category === cat.value ? 'bg-primary-100' : 'bg-background-100'
                    }`}>
                      <i className={`${cat.icon} ${form.category === cat.value ? 'text-primary-600' : 'text-foreground-500'} text-lg`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground-800 mb-0.5">{cat.label}</p>
                      <p className="text-xs text-foreground-500">{cat.description}</p>
                    </div>
                    {form.category === cat.value && (
                      <i className="ri-checkbox-circle-fill text-primary-500 text-xl flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'context' && (
          <div>
            <p className="text-sm text-foreground-600 mb-4">
              Selecione o que está relacionado a este atendimento. Isso ajuda a associação a entender melhor seu caso.
            </p>
            <div className="space-y-2 mb-4">
              {relatedEntityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateForm({ relatedEntity: { ...form.relatedEntity, type: opt.value, label: opt.label } })}
                  className={`w-full text-left p-3.5 rounded-2xl border cursor-pointer transition-all duration-150 ${
                    form.relatedEntity.type === opt.value
                      ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-100'
                      : 'border-background-200 bg-white hover:bg-background-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <i className={`${opt.icon} text-lg ${form.relatedEntity.type === opt.value ? 'text-primary-600' : 'text-foreground-400'}`} />
                    <span className="text-sm font-medium text-foreground-800">{opt.label}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateForm({ residenceId: 'prop-001' })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                  form.residenceId === 'prop-001' ? 'bg-primary-500 text-white' : 'bg-background-200 text-foreground-600'
                }`}
              >
                Apto Bloco 3
              </button>
              <button
                onClick={() => updateForm({ residenceId: 'prop-002' })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                  form.residenceId === 'prop-002' ? 'bg-primary-500 text-white' : 'bg-background-200 text-foreground-600'
                }`}
              >
                Casa Centro
              </button>
            </div>
          </div>
        )}

        {step === 'description' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">Assunto *</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => updateForm({ subject: e.target.value })}
                placeholder="Descreva o assunto em poucas palavras"
                className="w-full rounded-xl border border-background-300 bg-background-50 px-3 py-3 text-sm text-foreground-900 placeholder:text-foreground-300 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                maxLength={120}
              />
              <p className="text-xs text-foreground-400 mt-1 text-right">{form.subject.length}/120</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">Descrição *</label>
              <textarea
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value.slice(0, 500) })}
                placeholder="Explique sua situação com detalhes para que a associação possa ajudar..."
                rows={4}
                className="w-full rounded-xl border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-300 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none"
              />
              <p className="text-xs text-foreground-400 mt-1 text-right">{form.description.length}/500</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">Data da ocorrência</label>
              <input
                type="date"
                value={form.occurrenceDate}
                onChange={(e) => updateForm({ occurrenceDate: e.target.value })}
                className="w-full rounded-xl border border-background-300 bg-background-50 px-3 py-3 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">Canal de contato preferencial</label>
              <div className="flex flex-wrap gap-2">
                {contactChannels.map((ch) => (
                  <button
                    key={ch.value}
                    onClick={() => updateForm({ contactChannel: ch.value })}
                    className={`px-3.5 py-2 rounded-full text-sm font-medium cursor-pointer transition-colors ${
                      form.contactChannel === ch.value ? 'bg-primary-500 text-white' : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">Melhor horário para contato</label>
              <input
                type="text"
                value={form.preferredTime}
                onChange={(e) => updateForm({ preferredTime: e.target.value })}
                placeholder="Ex: Manhã, Tarde, Após as 18h"
                className="w-full rounded-xl border border-background-300 bg-background-50 px-3 py-3 text-sm text-foreground-900 placeholder:text-foreground-300 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
        )}

        {step === 'attachments' && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-600">
              Adicione fotos ou documentos que possam ajudar a associação a entender melhor sua situação. Formatos aceitos: JPG, PNG, PDF.
            </p>
            {form.attachments.length > 0 && (
              <div className="space-y-2 mb-3">
                {form.attachments.map((att, i) => (
                  <div key={att.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-background-100 border border-background-200">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                      <i className="ri-file-text-line text-foreground-500 text-sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground-700 truncate">{att.name}</p>
                      <p className="text-xs text-foreground-400">{att.size}</p>
                    </div>
                    <button
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.filter((_, idx) => idx !== i),
                        }));
                      }}
                      className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center cursor-pointer hover:bg-red-100 transition-colors flex-shrink-0"
                    >
                      <i className="ri-close-line text-red-500 text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                const id = `sim-att-${Date.now()}`;
                const types = ['photo', 'document', 'receipt', 'meter_image'] as const;
                const names = ['foto_local.jpg', 'comprovante.pdf', 'documento.pdf', 'foto_hidrometro.jpg'];
                const typeIdx = Math.floor(Math.random() * 4);
                setForm((prev) => ({
                  ...prev,
                  attachments: [
                    ...prev.attachments,
                    { id, name: names[typeIdx], type: types[typeIdx], size: `${(Math.random() * 3 + 0.5).toFixed(1)} MB`, isDemo: true },
                  ],
                }));
                showToast('Arquivo simulado adicionado para demonstração.', 'info');
              }}
              className="w-full py-8 rounded-2xl border-2 border-dashed border-background-300 bg-background-50 flex flex-col items-center gap-2 cursor-pointer hover:bg-background-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-background-200 flex items-center justify-center">
                <i className="ri-image-add-line text-foreground-500 text-lg" />
              </div>
              <span className="text-sm font-medium text-foreground-600">Adicionar foto ou documento</span>
              <span className="text-xs text-foreground-400">JPG, PNG ou PDF — Até 5 arquivos</span>
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-600">
              Revise as informações abaixo antes de enviar. Você pode tocar em qualquer item para editá-lo.
            </p>
            <div className="space-y-2">
              <button onClick={() => setStep('category')} className="w-full text-left p-3.5 rounded-2xl bg-background-100 border border-background-200 cursor-pointer hover:bg-background-200/70 transition-colors">
                <p className="text-xs text-foreground-500 mb-0.5">Categoria</p>
                <p className="text-sm font-medium text-foreground-800">{selectedCategory?.label || '—'}</p>
              </button>
              <button onClick={() => setStep('context')} className="w-full text-left p-3.5 rounded-2xl bg-background-100 border border-background-200 cursor-pointer hover:bg-background-200/70 transition-colors">
                <p className="text-xs text-foreground-500 mb-0.5">Relacionado a</p>
                <p className="text-sm font-medium text-foreground-800">{form.relatedEntity.label}</p>
              </button>
              <button onClick={() => setStep('description')} className="w-full text-left p-3.5 rounded-2xl bg-background-100 border border-background-200 cursor-pointer hover:bg-background-200/70 transition-colors">
                <p className="text-xs text-foreground-500 mb-0.5">Assunto</p>
                <p className="text-sm font-medium text-foreground-800 line-clamp-1">{form.subject}</p>
              </button>
              <button onClick={() => setStep('description')} className="w-full text-left p-3.5 rounded-2xl bg-background-100 border border-background-200 cursor-pointer hover:bg-background-200/70 transition-colors">
                <p className="text-xs text-foreground-500 mb-0.5">Descrição</p>
                <p className="text-sm text-foreground-700 line-clamp-2">{form.description}</p>
              </button>
              <button onClick={() => setStep('description')} className="w-full text-left p-3.5 rounded-2xl bg-background-100 border border-background-200 cursor-pointer hover:bg-background-200/70 transition-colors">
                <p className="text-xs text-foreground-500 mb-0.5">Contato</p>
                <p className="text-sm font-medium text-foreground-800">
                  {contactChannels.find((c) => c.value === form.contactChannel)?.label || 'App'}
                  {form.preferredTime ? ` · ${form.preferredTime}` : ''}
                </p>
              </button>
              <button onClick={() => setStep('attachments')} className="w-full text-left p-3.5 rounded-2xl bg-background-100 border border-background-200 cursor-pointer hover:bg-background-200/70 transition-colors">
                <p className="text-xs text-foreground-500 mb-0.5">Anexos</p>
                <p className="text-sm font-medium text-foreground-800">
                  {form.attachments.length > 0 ? `${form.attachments.length} arquivo(s)` : 'Nenhum'}
                </p>
              </button>
            </div>
            <p className="text-xs text-foreground-400 text-center">
              Ao enviar, você confirma que as informações estão corretas.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <div className="flex gap-2">
        <Button variant="secondary" size="md" fullWidth onClick={handleBack}>
          {step === 'category' ? 'Cancelar' : 'Voltar'}
        </Button>
        {step === 'review' ? (
          <Button
            variant="primary"
            size="md"
            fullWidth
            loading={submitting}
            onClick={handleSubmit}
          >
            Enviar solicitação
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            fullWidth
            disabled={!canGoNext()}
            onClick={handleNext}
          >
            Continuar
          </Button>
        )}
      </div>
    </AppShell>
  );
}