import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import Toast from '@/components/base/Toast';
import { useProfileOverview, useAppPreferenceSave } from '@/hooks/useProfileData';

export default function PreferenciasPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useProfileOverview();
  const { savePref, saving } = useAppPreferenceSave();
  const [localPrefs, setLocalPrefs] = useState<Record<string, boolean | string>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const getPrefValue = (id: string): boolean | string => {
    if (id in localPrefs) return localPrefs[id];
    return data?.appPreferences.find((p) => p.id === id)?.value ?? '';
  };

  const handleToggle = (id: string) => {
    const current = getPrefValue(id);
    setLocalPrefs((prev) => ({ ...prev, [id]: !current }));
    setDirtyIds((prev) => new Set(prev).add(id));
  };

  const handleSelect = (id: string, value: string) => {
    setLocalPrefs((prev) => ({ ...prev, [id]: value }));
    setDirtyIds((prev) => new Set(prev).add(id));
  };

  const handleSaveAll = async () => {
    const ids = Array.from(dirtyIds);
    for (const id of ids) {
      await savePref(id, getPrefValue(id));
    }
    setDirtyIds(new Set());
    setToastMsg('Preferências salvas para demonstração.');
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (<Skeleton key={i} className="h-14 w-full rounded-xl" />))}
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

  const { appPreferences } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-background-200/70 overflow-hidden divide-y divide-background-100">
          {appPreferences.map((pref) => (
            <div key={pref.id} className="px-4 py-3.5">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-sm font-medium text-foreground-900">{pref.label}</p>
                  <p className="text-xs text-foreground-500 mt-0.5">{pref.description}</p>
                </div>

                {pref.type === 'toggle' && (
                  <button
                    onClick={() => handleToggle(pref.id)}
                    disabled={!pref.editable}
                    className={`
                      relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0
                      ${getPrefValue(pref.id) ? 'bg-primary-500' : 'bg-foreground-200'}
                      ${!pref.editable ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    role="switch"
                    aria-checked={!!getPrefValue(pref.id)}
                    aria-label={pref.label}
                  >
                    <span className={`
                      absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm
                      ${getPrefValue(pref.id) ? 'left-[calc(100%-22px)]' : 'left-0.5'}
                    `} />
                  </button>
                )}

                {pref.type === 'select' && pref.options && (
                  <select
                    value={String(getPrefValue(pref.id))}
                    onChange={(e) => handleSelect(pref.id, e.target.value)}
                    disabled={!pref.editable}
                    className="text-xs font-medium text-foreground-700 bg-background-100 rounded-lg px-2.5 py-1.5 border border-background-200 cursor-pointer appearance-none pr-7 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundImage: 'none',
                      WebkitAppearance: 'none',
                    }}
                    aria-label={pref.label}
                  >
                    {pref.options.map((opt) => (
                      <option key={opt.value} value={opt.value} disabled={!opt.available}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}

                {pref.type === 'preview' && (
                  <span className="text-xs text-foreground-500 flex-shrink-0">{String(getPrefValue(pref.id))}</span>
                )}
              </div>
              {!pref.editable && pref.editableExplanation && (
                <p className="text-xs text-foreground-400 mt-2">{pref.editableExplanation}</p>
              )}
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