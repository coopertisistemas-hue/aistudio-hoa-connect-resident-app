import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import BottomSheet from '@/components/base/BottomSheet';
import type { ResidenceContext } from '@/fixtures/types';
import { fetchResidenceContexts } from '@/demo/residenceService';

export default function ResidenceContextCard() {
  const navigate = useNavigate();
  const [contexts, setContexts] = useState<ResidenceContext[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);

  useEffect(() => {
    fetchResidenceContexts().then((ctxs) => {
      setContexts(ctxs);
      const primary = ctxs.find((c) => c.isPrimary) || ctxs[0];
      if (primary) setActiveId(primary.id);
    });
  }, []);

  const active = contexts.find((c) => c.id === activeId);
  const hasMultiple = contexts.length > 1;

  const handleSelect = (id: string) => {
    if (id === activeId) {
      setSheetOpen(false);
      return;
    }
    setPendingSwitch(id);
    setShowConfirm(true);
  };

  const confirmSwitch = () => {
    if (pendingSwitch) {
      setActiveId(pendingSwitch);
      setPendingSwitch(null);
    }
    setShowConfirm(false);
    setSheetOpen(false);
  };

  const cancelSwitch = () => {
    setPendingSwitch(null);
    setShowConfirm(false);
  };

  return (
    <>
      <Card onClick={() => hasMultiple ? setSheetOpen(true) : navigate('/minha-residencia')}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center flex-shrink-0">
            <i className="ri-home-4-line text-accent-600 text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-foreground-500 mb-0.5">Minha residência</p>
            <p className="text-sm font-medium text-foreground-800 truncate">
              {active?.nickname || 'Carregando...'}
            </p>
            <p className="text-xs text-foreground-400 truncate">
              {active?.shortAddress}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {active?.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-green-500" aria-label="Ativa" />
            )}
            {hasMultiple && (
              <i className="ri-arrow-down-s-line text-foreground-400" />
            )}
            {!hasMultiple && (
              <i className="ri-arrow-right-s-line text-foreground-400" />
            )}
          </div>
        </div>
      </Card>

      {hasMultiple && (
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Selecionar residência"
        >
          <div className="space-y-2">
            {contexts.map((ctx) => (
              <button
                key={ctx.id}
                onClick={() => handleSelect(ctx.id)}
                className={`
                  w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors cursor-pointer
                  ${ctx.id === activeId ? 'bg-primary-50 border border-primary-200' : 'bg-background-50 border border-background-200 hover:bg-background-100'}
                `}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ctx.id === activeId ? 'bg-primary-100' : 'bg-background-200'}`}>
                  <i className={`ri-home-4-line text-lg ${ctx.id === activeId ? 'text-primary-600' : 'text-foreground-500'}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground-800">{ctx.nickname}</p>
                  <p className="text-xs text-foreground-500 truncate">{ctx.shortAddress}</p>
                </div>
                {ctx.id === activeId && (
                  <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                    <i className="ri-check-line text-white text-xs" />
                  </div>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setSheetOpen(false); navigate('/minha-residencia'); }}
            className="w-full mt-3 py-3 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-xl transition-colors cursor-pointer"
          >
            Ver detalhes da residência
          </button>
        </BottomSheet>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40" onClick={cancelSwitch} />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-base font-semibold text-foreground-900 mb-2">Alterar residência</h3>
            <p className="text-sm text-foreground-500 mb-4">
              Deseja alterar para esta residência? As informações da tela serão atualizadas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelSwitch}
                className="flex-1 py-3 text-sm font-medium text-foreground-600 bg-background-100 rounded-xl hover:bg-background-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSwitch}
                className="flex-1 py-3 text-sm font-medium text-white bg-primary-500 rounded-xl hover:bg-primary-600 transition-colors cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}