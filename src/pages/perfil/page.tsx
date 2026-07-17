import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import Modal from '@/components/base/Modal';
import OfflineBanner from '@/components/base/OfflineBanner';
import ProfileSectionCard from '@/pages/perfil/components/ProfileSectionCard';
import { useProfileOverview, useSignOut } from '@/hooks/useProfileData';

export default function PerfilPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useProfileOverview();
  const { signOut, signingOut } = useSignOut();
  const [showSignOut, setShowSignOut] = useState(false);

  const handleSignOut = async (type: 'current_device' | 'all_devices') => {
    const result = await signOut(type);
    if (result) {
      setShowSignOut(false);
      navigate(result.returnPath, { replace: true });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-background-200/70">
            <Skeleton className="w-14 h-14 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
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
          <h3 className="text-base font-semibold text-foreground-900 mb-1">
            Erro ao carregar perfil
          </h3>
          <p className="text-sm text-foreground-500 max-w-xs mb-4">
            {error || 'Não foi possível carregar as informações do perfil.'}
          </p>
          <Button variant="secondary" size="sm" onClick={reload}>
            Tentar novamente
          </Button>
        </div>
      </AppShell>
    );
  }

  const { profile, protectedFields, invitations } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Profile header */}
        <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-background-200/70">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-primary-600">{profile.initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground-900">
              {profile.preferredName || profile.fullName}
            </h2>
            <p className="text-xs text-foreground-500 truncate">
              {profile.roleLabel} · {profile.associationName}
            </p>
          </div>
          <button
            onClick={() => navigate('/perfil/dados-pessoais/editar')}
            className="w-9 h-9 rounded-lg bg-background-100 flex items-center justify-center cursor-pointer hover:bg-background-200 transition-colors"
            aria-label="Editar perfil"
          >
            <i className="ri-edit-line text-foreground-600" />
          </button>
        </div>

        {/* Profile completeness */}
        <div className="p-4 bg-white rounded-2xl border border-background-200/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-user-star-line text-lg text-secondary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground-900">{profile.completenessLabel}</p>
              <p className="text-xs text-foreground-500 mt-0.5">
                {profile.profileStatusLabel} · Membro desde {profile.registrationDate}
              </p>
            </div>
          </div>
        </div>

        {/* Correction needed banner */}
        {protectedFields.some((f) => f.key === 'cpf' && !f.correctionRequested) && data.scenario === 'correction_needed' && (
          <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 flex items-start gap-3">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-alert-line text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-yellow-800">Dados protegidos precisam de correção</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                Algumas informações do seu cadastro podem estar incorretas. Acesse Dados pessoais para solicitar correção.
              </p>
            </div>
          </div>
        )}

        {/* Main sections */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1">
            Dados e informações
          </p>
          <ProfileSectionCard
            icon="ri-user-line"
            title="Dados pessoais"
            description="Nome, CPF, vínculo com a residência"
            path="/perfil/dados-pessoais"
          />
          <ProfileSectionCard
            icon="ri-phone-line"
            title="Contatos"
            description="Telefone, WhatsApp, e-mail"
            path="/perfil/contatos"
          />
          <ProfileSectionCard
            icon="ri-home-line"
            title="Residências vinculadas"
            description={`${data.linkedResidences.length} residência(s)`}
            path="/perfil/residencias"
            badge={invitations.length > 0 ? `${invitations.length} convite` : undefined}
            badgeVariant="warning"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1">
            Preferências
          </p>
          <ProfileSectionCard
            icon="ri-settings-3-line"
            title="Preferências do aplicativo"
            description="Tela inicial, idioma, formato de data"
            path="/perfil/preferencias"
          />
          <ProfileSectionCard
            icon="ri-notification-3-line"
            title="Comunicação"
            description="Canais e tipos de notificação"
            path="/notificacoes/preferencias"
          />
          <ProfileSectionCard
            icon="ri-wheelchair-line"
            title="Acessibilidade"
            description="Texto ampliado, contraste, animações"
            path="/perfil/acessibilidade"
            badge={data.accessibilityPreferences.filter((a) => a.active).length > 2 ? 'Ativa' : undefined}
            badgeVariant="success"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1">
            Segurança e privacidade
          </p>
          <ProfileSectionCard
            icon="ri-shield-check-line"
            title="Segurança da conta"
            description="Senha, dispositivos, sessão"
            path="/perfil/seguranca"
          />
          <ProfileSectionCard
            icon="ri-lock-line"
            title="Privacidade e dados"
            description="Como seus dados são tratados"
            path="/perfil/privacidade"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1">
            Informações
          </p>
          <ProfileSectionCard
            icon="ri-building-line"
            title="Associação"
            description={profile.associationName}
            path="/perfil/associacao"
          />
          <ProfileSectionCard
            icon="ri-information-line"
            title="Sobre o aplicativo"
            description="Versão, ambiente, créditos"
            path="/perfil/sobre"
          />
        </div>

        {/* Sign out */}
        <div className="pt-2 pb-6">
          <button
            onClick={() => setShowSignOut(true)}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-600 bg-red-50 rounded-xl cursor-pointer hover:bg-red-100 transition-colors"
          >
            <i className="ri-logout-box-line" />
            Sair da conta
          </button>
        </div>
      </div>

      {/* Sign out confirmation modal */}
      <Modal
        open={showSignOut}
        onClose={() => setShowSignOut(false)}
        title="Sair da conta"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => setShowSignOut(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={() => handleSignOut('current_device')}
              loading={signingOut}
            >
              Sair
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground-600">
          Você está saindo da sua conta. Suas preferências serão mantidas nesta demonstração.
        </p>
        <button
          onClick={() => handleSignOut('all_devices')}
          disabled={signingOut}
          className="mt-3 text-xs text-foreground-500 underline cursor-pointer hover:text-foreground-700"
        >
          Sair de todos os dispositivos
        </button>
      </Modal>
    </AppShell>
  );
}