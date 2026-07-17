import { useState } from 'react';
import type { ProfileScenarioKey } from '@/fixtures/types';
import { setProfileScenario } from '@/fixtures/profileScenarios';

const scenarios: ProfileScenarioKey[] = [
  'complete',
  'incomplete',
  'no_preferred_name',
  'contact_pending',
  'outdated_phone',
  'invalid_email',
  'multi_residence',
  'pending_invitation',
  'access_under_review',
  'correction_needed',
  'correction_submitted',
  'accessibility_active',
  'high_contrast',
  'reduced_motion',
  'trusted_device',
  'unknown_device',
  'password_change_error',
  'preference_save_error',
  'detail_unavailable',
  'partial_service_error',
  'offline',
];

const scenarioLabels: Record<ProfileScenarioKey, string> = {
  complete: 'Perfil completo',
  incomplete: 'Perfil incompleto',
  no_preferred_name: 'Sem nome preferido',
  contact_pending: 'Contato pendente',
  outdated_phone: 'Telefone desatualizado',
  invalid_email: 'E-mail inválido',
  multi_residence: 'Múltiplas residências',
  pending_invitation: 'Convite pendente',
  access_under_review: 'Acesso em análise',
  correction_needed: 'Correção necessária',
  correction_submitted: 'Correção enviada',
  accessibility_active: 'Acessibilidade ativa',
  high_contrast: 'Contraste alto',
  reduced_motion: 'Animação reduzida',
  trusted_device: 'Dispositivo confiável',
  unknown_device: 'Dispositivo desconhecido',
  password_change_error: 'Erro ao trocar senha',
  preference_save_error: 'Erro ao salvar prefs',
  detail_unavailable: 'Perfil indisponível',
  partial_service_error: 'Erro parcial',
  offline: 'Offline',
};

export default function ProfileDemoControls() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ProfileScenarioKey>('complete');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 w-9 h-9 bg-foreground-900 text-white rounded-full flex items-center justify-center text-xs shadow-lg cursor-pointer hover:bg-foreground-800 transition-colors"
        aria-label="Controles de demonstração do Perfil"
      >
        <i className="ri-settings-3-line" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative bg-white rounded-t-2xl w-full max-h-[70vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground-900">Demo: Perfil</h3>
          <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-background-100 flex items-center justify-center cursor-pointer">
            <i className="ri-close-line" />
          </button>
        </div>
        <p className="text-xs text-foreground-500 mb-3">Selecione um cenário para o módulo Perfil:</p>
        <div className="flex flex-wrap gap-1.5">
          {scenarios.map((s) => (
            <button
              key={s}
              onClick={() => {
                setCurrent(s);
                setProfileScenario(s);
              }}
              className={`
                text-xs font-medium px-2.5 py-1.5 rounded-full cursor-pointer transition-colors
                ${current === s
                  ? 'bg-primary-500 text-white'
                  : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                }
              `}
            >
              {scenarioLabels[s]}
            </button>
          ))}
        </div>
        <div className="mt-4 p-3 bg-secondary-50 rounded-xl">
          <p className="text-xs text-foreground-600">
            Cenário atual: <strong>{scenarioLabels[current]}</strong>
          </p>
          <p className="text-[10px] text-foreground-400 mt-1">
            Recarregue a página do Perfil para ver as mudanças.
          </p>
        </div>
      </div>
    </div>
  );
}