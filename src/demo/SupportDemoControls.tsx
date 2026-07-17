import { useState } from 'react';
import { supportScenarioLabels } from '@/fixtures/supportScenarios';
import { setSupportScenario } from '@/fixtures/supportScenarios';
import type { SupportScenarioKey } from '@/fixtures/types';

interface SupportDemoControlsProps {
  currentResidenceId: string;
  onRefresh: () => void;
}

export default function SupportDemoControls({ currentResidenceId, onRefresh }: SupportDemoControlsProps) {
  const [open, setOpen] = useState(false);

  const handleScenario = (key: SupportScenarioKey) => {
    setSupportScenario(key);
    setOpen(false);
    setTimeout(onRefresh, 100);
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 right-4 z-30 w-9 h-9 rounded-full bg-foreground-800/80 text-white flex items-center justify-center cursor-pointer text-xs opacity-40 hover:opacity-90 transition-opacity"
        aria-label="Cenários de demonstração de atendimento"
      >
        <i className="ri-settings-3-line text-sm" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-2xl w-full max-w-app p-5 safe-bottom max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground-800">Demo: cenários de atendimento</h4>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background-100 cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <p className="text-xs text-foreground-500 mb-3">
              Selecione um cenário para visualizar como o módulo de atendimento se comporta.
            </p>

            <div className="flex flex-wrap gap-2">
              {(Object.entries(supportScenarioLabels) as [SupportScenarioKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleScenario(key)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap bg-background-200 text-foreground-600 hover:bg-background-300"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}