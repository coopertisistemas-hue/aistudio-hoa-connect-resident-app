import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import Modal from '@/components/base/Modal';
import Toast from '@/components/base/Toast';
import { useProfileOverview, useInvitationActions, useSetActiveResidence } from '@/hooks/useProfileData';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  linked: 'bg-secondary-100 text-secondary-700',
  pending_invitation: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-orange-100 text-orange-700',
  inactive: 'bg-foreground-100 text-foreground-500',
  removed: 'bg-red-100 text-red-500',
};

export default function ResidenciasPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useProfileOverview();
  const { accept, decline, acting } = useInvitationActions();
  const { setActive, changing } = useSetActiveResidence();

  const [selectedInvitation, setSelectedInvitation] = useState<string | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleAccept = async (invitationId: string) => {
    const result = await accept(invitationId);
    if (result) {
      setSelectedInvitation(null);
      setToastMsg('Convite aceito! A residência foi adicionada.');
    }
  };

  const handleDecline = async (invitationId: string) => {
    const result = await decline(invitationId);
    if (result) {
      setSelectedInvitation(null);
      setToastMsg('Convite recusado.');
    }
  };

  const handleSetActive = async (residenceId: string) => {
    const result = await setActive(residenceId);
    if (result) {
      setConfirmActivate(null);
      setToastMsg('Residência ativa alterada.');
      reload();
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-24 w-full rounded-xl" />))}
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

  const { linkedResidences, invitations } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Invitations */}
        {invitations.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1 mb-2">
              Convites pendentes
            </p>
            {invitations.map((inv) => (
              <div key={inv.id} className="bg-white rounded-2xl border border-yellow-200 p-4 mb-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <i className="ri-mail-add-line text-lg text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground-900">{inv.residenceNickname}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{inv.residenceAddress}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] font-medium bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full">
                        {inv.proposedRoleLabel}
                      </span>
                      <span className="text-[10px] font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                        Convite de {inv.inviterName}
                      </span>
                    </div>
                    <p className="text-[10px] text-foreground-400 mt-2">
                      Expira em {inv.expiresAt}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleAccept(inv.id)}
                        loading={acting}
                      >
                        Aceitar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleDecline(inv.id)}
                        loading={acting}
                      >
                        Recusar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Linked residences */}
        <div>
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1 mb-2">
            Residências vinculadas
          </p>
          {linkedResidences.length === 0 ? (
            <div className="bg-white rounded-2xl border border-background-200/70 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-home-line text-xl text-foreground-400" />
              </div>
              <p className="text-sm font-medium text-foreground-700 mb-1">Nenhuma residência vinculada</p>
              <p className="text-xs text-foreground-400">Você não possui residências vinculadas no momento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedResidences.map((res) => (
                <div
                  key={res.id}
                  className={`bg-white rounded-2xl border p-4 ${
                    res.isActiveContext ? 'border-primary-300' : 'border-background-200/70'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <i className="ri-home-line text-lg text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground-900">{res.nickname}</p>
                          {res.isActiveContext && (
                            <span className="text-[10px] font-medium bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">
                              Atual
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-foreground-500 mt-0.5 truncate">{res.address}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[res.connectionStatus]}`}>
                            {res.connectionStatusLabel}
                          </span>
                          <span className="text-[10px] font-medium bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full">
                            {res.roleLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {!res.isActiveContext && res.connectionStatus !== 'inactive' && res.connectionStatus !== 'removed' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs"
                        onClick={() => setConfirmActivate(res.id)}
                        loading={changing}
                      >
                        Definir como ativa
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-xs"
                      onClick={() => navigate(`/minha-residencia`)}
                    >
                      Ver detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-foreground-400 text-center pb-6">
          O vínculo de residências é controlado pela associação. Para adicionar ou remover vínculos, entre em contato.
        </p>
      </div>

      {/* Activate confirmation */}
      <Modal
        open={!!confirmActivate}
        onClose={() => setConfirmActivate(null)}
        title="Alterar residência ativa"
        actions={
          <>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setConfirmActivate(null)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={() => handleSetActive(confirmActivate!)} loading={changing}>
              Confirmar
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground-600">
          Deseja definir esta residência como ativa? Os dados exibidos no aplicativo serão alterados.
        </p>
      </Modal>

      {toastMsg && <Toast message={toastMsg} type="success" />}
    </AppShell>
  );
}