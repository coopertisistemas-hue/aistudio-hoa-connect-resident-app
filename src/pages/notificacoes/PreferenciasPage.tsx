import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/feature/AppShell';
import Button from '@/components/base/Button';
import EmptyState from '@/components/base/EmptyState';
import { SkeletonList } from '@/components/base/Skeleton';
import { showToast } from '@/components/base/Toast';
import PreferenceToggle from '@/pages/notificacoes/components/PreferenceToggle';
import { fetchPreferences, savePreferences, resetNotificationState } from '@/demo/notificationService';
import type { CommunicationPreference, CommunicationChannel } from '@/fixtures/types';

export default function PreferenciasPage() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<CommunicationPreference[]>([]);
  const [originalPrefs, setOriginalPrefs] = useState<CommunicationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    resetNotificationState();
    fetchPreferences()
      .then((prefs) => {
        setPreferences(prefs);
        setOriginalPrefs(JSON.parse(JSON.stringify(prefs)));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setHasChanges(JSON.stringify(preferences) !== JSON.stringify(originalPrefs));
  }, [preferences, originalPrefs]);

  const handleToggle = useCallback((id: string) => {
    setPreferences((prev) =>
      prev.map((p) =>
        p.id === id && !p.mandatory ? { ...p, enabled: !p.enabled } : p,
      ),
    );
  }, []);

  const handleChannelToggle = useCallback((prefId: string, channel: CommunicationChannel) => {
    setPreferences((prev) =>
      prev.map((p) => {
        if (p.id !== prefId) return p;
        const hasChannel = p.channels.includes(channel);
        return {
          ...p,
          channels: hasChannel
            ? p.channels.filter((c) => c !== channel)
            : [...p.channels, channel],
        };
      }),
    );
  }, []);

  const isPrefModified = useCallback((pref: CommunicationPreference) => {
    const orig = originalPrefs.find((o) => o.id === pref.id);
    if (!orig) return false;
    return (
      orig.enabled !== pref.enabled ||
      JSON.stringify([...orig.channels].sort()) !== JSON.stringify([...pref.channels].sort())
    );
  }, [originalPrefs]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await savePreferences(preferences);
      setOriginalPrefs(JSON.parse(JSON.stringify(preferences)));
      showToast('Preferências salvas para demonstração.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.';
      setSaveError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setPreferences(JSON.parse(JSON.stringify(originalPrefs)));
    setSaveError(null);
  };

  const handleBack = () => {
    if (hasChanges) {
      const confirmed = window.confirm('Você tem alterações não salvas. Deseja descartá-las?');
      if (!confirmed) return;
    }
    navigate(-1);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-background-300 animate-pulse" />
          <div className="h-6 w-40 bg-background-300 rounded animate-pulse" />
        </div>
        <SkeletonList count={5} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer"
            aria-label="Voltar"
          >
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-lg font-bold text-foreground-900 font-heading">
            Preferências de comunicação
          </h1>
        </div>

        <p className="text-sm text-foreground-500">
          Escolha como deseja receber as comunicações da associação.
          A disponibilidade dos canais depende da configuração da sua associação.
        </p>

        {saveError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <i className="ri-error-warning-line text-red-600 mt-0.5" />
            <p className="text-xs text-red-700">{saveError}</p>
          </div>
        )}

        <div className="space-y-3">
          {preferences.map((pref) => (
            <PreferenceToggle
              key={pref.id}
              preference={pref}
              isModified={isPrefModified(pref)}
              onToggle={handleToggle}
              onChannelToggle={handleChannelToggle}
            />
          ))}
        </div>

        {hasChanges && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={handleSave}
              loading={saving}
            >
              <i className="ri-check-line" />
              Salvar preferências
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={handleDiscard}
              disabled={saving}
            >
              Descartar
            </Button>
          </div>
        )}

        <p className="text-center text-[10px] text-foreground-300 pt-2 pb-1">
          Preferências salvas apenas para esta demonstração.
        </p>
      </div>
    </AppShell>
  );
}