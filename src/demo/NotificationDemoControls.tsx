import { useState } from 'react';
import BottomSheet from '@/components/base/BottomSheet';
import Button from '@/components/base/Button';
import type { NotificationScenarioKey } from '@/fixtures/types';
import { activeNotificationScenario, queueSimulatedEvent, simulatedEventTemplates } from '@/fixtures/notificationScenarios';

const scenarioOptions: { key: NotificationScenarioKey; label: string }[] = [
  { key: 'no_unread', label: 'Sem não lidas' },
  { key: 'one_unread', label: 'Uma não lida' },
  { key: 'many_unread', label: 'Muitas não lidas' },
  { key: 'invoice_notification', label: 'Notificação de fatura' },
  { key: 'payment_identified', label: 'Pagamento identificado' },
  { key: 'payment_processing', label: 'Pagamento processando' },
  { key: 'reading_recorded', label: 'Leitura registrada' },
  { key: 'unusual_consumption', label: 'Alerta de consumo' },
  { key: 'support_update', label: 'Atualização de chamado' },
  { key: 'important_notice', label: 'Aviso importante' },
  { key: 'urgent_maintenance', label: 'Manutenção urgente' },
  { key: 'multi_residence', label: 'Múltiplas residências' },
  { key: 'no_notices', label: 'Sem avisos' },
  { key: 'archived_only', label: 'Apenas arquivados' },
  { key: 'partial_error', label: 'Erro parcial' },
  { key: 'detail_unavailable', label: 'Detalhe indisponível' },
  { key: 'preferences_error', label: 'Erro ao salvar prefs' },
  { key: 'offline', label: 'Offline' },
];

interface NotificationDemoControlsProps {
  onScenarioChange: (scenario: NotificationScenarioKey) => void;
  onSimulateEvent: () => void;
}

export default function NotificationDemoControls({
  onScenarioChange,
  onSimulateEvent,
}: NotificationDemoControlsProps) {
  const [open, setOpen] = useState(false);

  const handleSimulateEvent = () => {
    const template = simulatedEventTemplates[Math.floor(Math.random() * simulatedEventTemplates.length)];
    queueSimulatedEvent({ ...template, id: `sim-ev-${Date.now()}`, timestamp: Date.now() });
    onSimulateEvent();
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 w-10 h-10 rounded-full bg-foreground-800 text-white flex items-center justify-center cursor-pointer opacity-40 hover:opacity-70 transition-opacity z-30 shadow-sm"
        aria-label="Controles de demonstração"
      >
        <i className="ri-settings-3-line text-sm" />
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Cenários de demonstração"
      >
        <div className="space-y-3">
          <p className="text-xs text-foreground-500">
            Cenário atual: <strong>{scenarioOptions.find((s) => s.key === activeNotificationScenario)?.label}</strong>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {scenarioOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  onScenarioChange(opt.key);
                  setOpen(false);
                }}
                className={`
                  text-left px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer
                  ${activeNotificationScenario === opt.key
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'bg-background-100 text-foreground-600 hover:bg-background-200 border border-transparent'
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="border-t border-background-200 pt-3">
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={handleSimulateEvent}
            >
              <i className="ri-notification-line" />
              Simular notificação recebida
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}