import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import Modal from '@/components/base/Modal';
import Toast from '@/components/base/Toast';
import { useProfileOverview, usePasswordChange, useRemoveDevice, useSignOut } from '@/hooks/useProfileData';

export default function SegurancaPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useProfileOverview();
  const { changePassword, changing, result: pwResult, clearResult: clearPwResult } = usePasswordChange();
  const { remove: removeDevice, removing } = useRemoveDevice();
  const { signOut, signingOut } = useSignOut();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  const [showSignOutAll, setShowSignOutAll] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handlePasswordChange = async () => {
    setPwError(null);
    if (!currentPw || !newPw || !confirmPw) {
      setPwError('Preencha todos os campos.');
      return;
    }
    if (newPw.length < 6) {
      setPwError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('As senhas não conferem.');
      return;
    }
    const res = await changePassword(currentPw, newPw);
    if (res?.success) {
      setShowPasswordModal(false);
      resetPwFields();
      setToastMsg(res.message);
    }
  };

  const resetPwFields = () => {
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError(null);
    clearPwResult();
  };

  const handleRemoveDevice = async (sessionId: string) => {
    const ok = await removeDevice(sessionId);
    if (ok) {
      setRemoveConfirmId(null);
      setToastMsg('Dispositivo removido.');
      reload();
    }
  };

  const handleSignOutAll = async () => {
    const result = await signOut('all_devices');
    if (result) {
      setShowSignOutAll(false);
      navigate(result.returnPath, { replace: true });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-xl" />
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

  const { securityInfo } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Session summary */}
        <div className="p-4 bg-white rounded-2xl border border-background-200/70">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground-900">Sessão atual</p>
            <span className="text-[10px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ativa</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground-500">Dispositivo</span>
              <span className="text-foreground-800 font-medium">{securityInfo.sessions.find((s) => s.isCurrent)?.deviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-500">Último acesso</span>
              <span className="text-foreground-800">{securityInfo.sessions.find((s) => s.isCurrent)?.lastAccess}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground-500">Autenticação</span>
              <span className="text-foreground-800">{securityInfo.sessions.find((s) => s.isCurrent)?.authMethod}</span>
            </div>
          </div>
        </div>

        {/* Security settings */}
        <div className="p-4 bg-white rounded-2xl border border-background-200/70">
          <p className="text-sm font-semibold text-foreground-900 mb-3">Configurações</p>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-foreground-500">Bloqueio automático</span>
              <span className="text-foreground-800">
                {securityInfo.sessionLockEnabled ? `Após ${securityInfo.sessionLockTimeout}` : 'Desativado'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-foreground-500">E-mail de recuperação</span>
              <span className="text-foreground-800">{securityInfo.recoveryEmailMasked}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-foreground-500">Última troca de senha</span>
              <span className="text-foreground-800">{securityInfo.lastPasswordChange}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-foreground-500">Verificação em duas etapas</span>
              <span className="text-foreground-400 text-xs">
                {securityInfo.twoFactorAvailable ? 'Disponível (associação)' : 'Não disponível'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-background-200/70 text-left cursor-pointer hover:bg-background-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-lock-password-line text-secondary-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground-900">Alterar senha</p>
              <p className="text-xs text-foreground-500">Altere sua senha de acesso</p>
            </div>
            <i className="ri-arrow-right-s-line text-foreground-400" />
          </button>
        </div>

        {/* Trusted devices */}
        <div>
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1 mb-2">
            Dispositivos confiáveis
          </p>
          <div className="space-y-2">
            {securityInfo.sessions.map((session) => (
              <div key={session.id} className="bg-white rounded-xl border border-background-200/70 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-background-100 flex items-center justify-center flex-shrink-0">
                      <i className={session.deviceType === 'Celular' ? 'ri-smartphone-line' : session.deviceType === 'Tablet' ? 'ri-tablet-line' : 'ri-computer-line'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground-900 truncate">{session.deviceName}</p>
                        {session.isCurrent && (
                          <span className="text-[10px] font-medium bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            Atual
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground-500 mt-0.5">
                        {session.lastAccess} · {session.location} · {session.authMethod}
                      </p>
                      {!session.isTrusted && (
                        <p className="text-xs text-red-600 mt-1 font-medium">
                          Dispositivo não confiável
                        </p>
                      )}
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <button
                      onClick={() => setRemoveConfirmId(session.id)}
                      className="text-xs text-red-500 cursor-pointer hover:text-red-600 flex-shrink-0 ml-2"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pb-6 space-y-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setShowSignOutAll(true)}
            loading={signingOut}
          >
            <i className="ri-logout-box-r-line mr-1" />
            Sair de todos os dispositivos
          </Button>
          <p className="text-[10px] text-foreground-400 text-center">
            As ações desta tela são simuladas. Nenhuma senha real é alterada e nenhuma sessão real é afetada.
          </p>
        </div>
      </div>

      {/* Password change modal */}
      <Modal
        open={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); resetPwFields(); }}
        title="Alterar senha"
        actions={
          <>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => { setShowPasswordModal(false); resetPwFields(); }}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={handlePasswordChange} loading={changing}>
              Alterar senha
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-foreground-700 block mb-1">Senha atual</label>
            <Input value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="••••••" maxLength={40} />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground-700 block mb-1">Nova senha</label>
            <Input value={newPw} onChange={(e) => setNewPw(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" maxLength={40} />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground-700 block mb-1">Confirmar nova senha</label>
            <Input value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="••••••" maxLength={40} />
          </div>
          <button
            onClick={() => setShowPw(!showPw)}
            className="text-xs text-primary-600 cursor-pointer hover:text-primary-700"
          >
            {showPw ? 'Ocultar senhas' : 'Mostrar senhas'}
          </button>
          {pwError && <p className="text-xs text-red-500">{pwError}</p>}
          {pwResult && !pwResult.success && <p className="text-xs text-red-500">{pwResult.message}</p>}
        </div>
      </Modal>

      {/* Remove device confirmation */}
      <Modal
        open={!!removeConfirmId}
        onClose={() => setRemoveConfirmId(null)}
        title="Remover dispositivo"
        actions={
          <>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setRemoveConfirmId(null)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleRemoveDevice(removeConfirmId!)} loading={removing}>
              Remover
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground-600">
          O dispositivo será removido da lista de confiáveis. A sessão será encerrada neste dispositivo.
        </p>
      </Modal>

      {/* Sign out all confirmation */}
      <Modal
        open={showSignOutAll}
        onClose={() => setShowSignOutAll(false)}
        title="Sair de todos os dispositivos"
        actions={
          <>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowSignOutAll(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleSignOutAll} loading={signingOut}>
              Sair de todos
            </Button>
          </>
        }
      >
        <p className="text-sm text-foreground-600">
          Todas as sessões serão encerradas. Você precisará entrar novamente em cada dispositivo.
        </p>
      </Modal>

      {toastMsg && <Toast message={toastMsg} type="success" />}
    </AppShell>
  );
}