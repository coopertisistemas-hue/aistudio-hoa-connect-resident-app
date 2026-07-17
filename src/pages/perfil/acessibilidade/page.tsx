import { useState } from 'react';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import Toast from '@/components/base/Toast';
import { useProfileOverview, useAccessibilitySave } from '@/hooks/useProfileData';

export default function AcessibilidadePage() {
  const { data, loading, error, reload } = useProfileOverview();
  const { saveAcc, saving } = useAccessibilitySave();
  const [localActive, setLocalActive] = useState<Record<string, boolean>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isActive = (id: string): boolean => {
    if (id in localActive) return localActive[id];
    return data?.accessibilityPreferences.find((p) => p.id === id)?.active ?? false;
  };

  const handleToggle = (id: string) => {
    const current = isActive(id);
    setLocalActive((prev) => ({ ...prev, [id]: !current }));
    setDirtyIds((prev) => new Set(prev).add(id));
    if (id === 'reduced_motion') {
      setDirtyIds((prev) => new Set(prev).add('avoid_auto_animation'));
      setLocalActive((prev) => ({ ...prev, avoid_auto_animation: !current }));
    }
  };

  const handleSaveAll = async () => {
    for (const id of Array.from(dirtyIds)) {
      await saveAcc(id, isActive(id));
    }
    setDirtyIds(new Set());
    setToastMsg('Preferências de acessibilidade salvas para demonstração.');
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (<Skeleton key={i} className="h-16 w-full rounded-xl" />))}
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <i className="ri-error-warning-line text-2xl text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground-900 mb-1">Erro ao carregar</h3>
          <p className="text-sm text-foreground-500 max-w-xs mb-4">{error}</p>
          <Button variant="secondary" size="sm" onClick={reload}>Tentar novamente</Button>
        </div>
      </AppShell>
    );
  }

  const { accessibilityPreferences } = data;
  const largeText = isActive('larger_text');
  const highContrast = isActive('enhanced_contrast');

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Preview section */}
        <div className={`p-4 rounded-2xl border ${
          highContrast
            ? 'bg-white border-foreground-900'
            : 'bg-secondary-50 border-secondary-200'
        }`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
            highContrast ? 'text-foreground-900' : 'text-foreground-400'
          }`}>
            Pré-visualização
          </p>
          <div className="space-y-2">
            <p className={`${largeText ? 'text-base' : 'text-sm'} font-medium ${highContrast ? 'text-foreground-900' : 'text-foreground-700'}`}>
              Este texto demonstra as preferências selecionadas
            </p>
            <p className={`${largeText ? 'text-sm' : 'text-xs'} ${highContrast ? 'text-foreground-900' : 'text-foreground-500'}`}>
              O tamanho e contraste do texto são ajustados conforme suas escolhas. Esta pré-visualização mostra como o aplicativo se comporta com as opções ativas.
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="bg-white rounded-2xl border border-background-200/70 overflow-hidden divide-y divide-background-100">
          {accessibilityPreferences.map((pref) => (
            <div key={pref.id} className="px-4 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm font-medium text-foreground-900">{pref.label}</p>
                  <p className="text-xs text-foreground-500 mt-0.5">{pref.description}</p>
                  {pref.previewNote && (
                    <p className="text-[10px] text-foreground-400 mt-1 italic">{pref.previewNote}</p>
                  )}
                </div>
                <button
                  onClick={() => handleToggle(pref.id)}
                  className={`
                    relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0
                    ${isActive(pref.id) ? 'bg-primary-500' : 'bg-foreground-200'}
                  `}
                  role="switch"
                  aria-checked={isActive(pref.id)}
                  aria-label={pref.label}
                >
                  <span className={`
                    absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm
                    ${isActive(pref.id) ? 'left-[calc(100%-22px)]' : 'left-0.5'}
                  `} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="pb-6">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={handleSaveAll}
            loading={saving}
            disabled={dirtyIds.size === 0}
          >
            Salvar preferências
          </Button>
        </div>
      </div>

      {toastMsg && <Toast message={toastMsg} type="success" />}
    </AppShell>
  );
}