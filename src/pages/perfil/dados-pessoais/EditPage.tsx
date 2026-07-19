import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import Alert from '@/components/base/Alert';
import Toast from '@/components/base/Toast';
import { useProfileOverview, useProfileEdit } from '@/hooks/useProfileData';

export default function DadosPessoaisEditPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useProfileOverview();
  const { save, saving, error: saveError } = useProfileEdit();

  const [preferredName, setPreferredName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pronounPreference, setPronounPreference] = useState('');
  const [dirty, setDirty] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setPreferredName(data.editableFields.preferredName || '');
      setDisplayName(data.editableFields.displayName || '');
      setPronounPreference(data.editableFields.pronounPreference || '');
    }
  }, [data]);

  useEffect(() => {
    if (data) {
      const changed =
        preferredName !== (data.editableFields.preferredName || '') ||
        displayName !== (data.editableFields.displayName || '') ||
        pronounPreference !== (data.editableFields.pronounPreference || '');
      setDirty(changed);
    }
  }, [preferredName, displayName, pronounPreference, data]);

  const handleSave = async () => {
    setValidationError(null);
    if (!displayName.trim()) {
      setValidationError('O nome de exibição é obrigatório.');
      return;
    }
    const result = await save({ preferredName: preferredName.trim(), displayName: displayName.trim(), pronounPreference: pronounPreference.trim() });
    if (result) {
      setDirty(false);
      setShowSuccess(true);
      setTimeout(() => navigate('/perfil/dados-pessoais'), 1500);
    }
  };

  const handleBack = () => {
    if (dirty) {
      setShowDiscard(true);
    } else {
      navigate('/perfil/dados-pessoais');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
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

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-background-200/70 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground-900 mb-1.5">
              Nome de preferência
            </label>
            <p className="text-xs text-foreground-400 mb-2">Como você gostaria de ser chamado no aplicativo</p>
            <Input
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="Ex: Carlinhos"
              maxLength={40}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-900 mb-1.5">
              Nome de exibição
            </label>
            <p className="text-xs text-foreground-400 mb-2">Nome exibido em mensagens e interações</p>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={data.profile.fullName}
              maxLength={60}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-900 mb-1.5">
              Tratamento
            </label>
            <p className="text-xs text-foreground-400 mb-2">Pronome ou forma de tratamento</p>
            <Input
              value={pronounPreference}
              onChange={(e) => setPronounPreference(e.target.value)}
              placeholder="Ex: Sr., Sra., ele/dele, ela/dela"
              maxLength={30}
            />
          </div>
        </div>

        {validationError && (
          <Alert variant="error" title="Atenção">{validationError}</Alert>
        )}

        {saveError && (
          <Alert variant="error" title="Erro ao salvar">{saveError}</Alert>
        )}

        <div className="flex gap-3 pb-6">
          <Button variant="secondary" size="sm" className="flex-1" onClick={handleBack}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={handleSave}
            loading={saving}
            disabled={!dirty}
          >
            Salvar alterações
          </Button>
        </div>
      </div>

      {/* Discard confirmation */}
      {showDiscard && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDiscard(false)} />
          <div className="relative bg-white rounded-2xl w-full mx-4 mb-4 p-5">
            <h3 className="text-base font-semibold text-foreground-900 mb-2">
              Descartar alterações?
            </h3>
            <p className="text-sm text-foreground-500 mb-4">
              Você tem alterações não salvas. Deseja descartá-las?
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowDiscard(false)}>
                Continuar editando
              </Button>
              <Button variant="primary" size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => navigate('/perfil/dados-pessoais')}>
                Descartar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <Toast message="Alterações salvas para demonstração." type="success" />
      )}
    </AppShell>
  );
}