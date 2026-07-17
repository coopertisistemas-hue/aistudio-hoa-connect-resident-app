import { useState } from 'react';

interface DemoControlsProps {
  states?: Record<string, { type: string; message: string }>;
  currentState?: string;
  onSelectState?: (key: string) => void;
}

export default function DemoControls({
  states,
  currentState,
  onSelectState,
}: DemoControlsProps) {
  const [open, setOpen] = useState(false);

  if (!states || Object.keys(states).length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 right-4 z-30 w-9 h-9 rounded-full bg-foreground-800/80 text-white flex items-center justify-center cursor-pointer text-xs opacity-40 hover:opacity-90 transition-opacity"
        aria-label="Controles de demonstração"
      >
        <i className="ri-settings-3-line text-sm" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-2xl w-full max-w-app p-5 safe-bottom max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground-800">Demo: estados da tela</h4>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-background-100 cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(states).map(([key, state]) => (
                <button
                  key={key}
                  onClick={() => {
                    onSelectState?.(key);
                    setOpen(false);
                  }}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap
                    ${currentState === key
                      ? 'bg-primary-500 text-white'
                      : 'bg-background-200 text-foreground-600 hover:bg-background-300'}
                  `}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}