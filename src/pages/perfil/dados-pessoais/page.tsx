import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import Card from '@/components/base/Card';
import { useProfileOverview } from '@/hooks/useProfileData';

export default function DadosPessoaisPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useProfileOverview();

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
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

  const { profile, editableFields, protectedFields } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Editable fields */}
        <div>
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1 mb-2">
            Informações editáveis
          </p>
          <div className="bg-white rounded-2xl border border-background-200/70 overflow-hidden divide-y divide-background-100">
            {/* Preferred name */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground-900">Nome de preferência</p>
                <p className="text-xs text-foreground-500 mt-0.5">
                  {editableFields.preferredName || 'Não informado'}
                </p>
              </div>
              <button
                onClick={() => navigate('/perfil/dados-pessoais/editar')}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-background-100 transition-colors"
                aria-label="Editar nome de preferência"
              >
                <i className="ri-edit-line text-sm text-foreground-400" />
              </button>
            </div>

            {/* Display name */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground-900">Nome de exibição</p>
                <p className="text-xs text-foreground-500 mt-0.5">
                  {editableFields.displayName || profile.fullName}
                </p>
              </div>
              <button
                onClick={() => navigate('/perfil/dados-pessoais/editar')}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-background-100 transition-colors"
                aria-label="Editar nome de exibição"
              >
                <i className="ri-edit-line text-sm text-foreground-400" />
              </button>
            </div>

            {/* Pronoun preference */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground-900">Tratamento</p>
                <p className="text-xs text-foreground-500 mt-0.5">
                  {editableFields.pronounPreference || 'Não informado'}
                </p>
              </div>
              <button
                onClick={() => navigate('/perfil/dados-pessoais/editar')}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-background-100 transition-colors"
                aria-label="Editar tratamento"
              >
                <i className="ri-edit-line text-sm text-foreground-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Protected fields */}
        <div>
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1 mb-2">
            Dados controlados pela associação
          </p>
          <div className="bg-white rounded-2xl border border-background-200/70 overflow-hidden divide-y divide-background-100">
            {protectedFields.map((field) => (
              <div key={field.key} className="px-4 py-3.5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground-900">{field.label}</p>
                    <p className="text-sm text-foreground-600 mt-0.5">{field.value}</p>
                    <p className="text-xs text-foreground-400 mt-1.5 leading-relaxed">{field.explanation}</p>
                  </div>
                </div>
                {field.correctionRequested ? (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                      <i className="ri-check-line text-green-600 text-[10px]" />
                    </div>
                    <span className="text-green-700">
                      Solicitação enviada · {field.correctionProtocol}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => navigate(`/perfil/dados-pessoais/correcao?field=${field.key}`)}
                    className="mt-3 text-xs font-medium text-primary-600 cursor-pointer hover:text-primary-700 transition-colors flex items-center gap-1"
                  >
                    <i className="ri-edit-line text-xs" />
                    Solicitar correção
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pb-6">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => navigate('/perfil/dados-pessoais/editar')}
          >
            <i className="ri-edit-line mr-1" />
            Editar informações
          </Button>
        </div>
      </div>
    </AppShell>
  );
}