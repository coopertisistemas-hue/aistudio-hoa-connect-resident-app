import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import Modal from '@/components/base/Modal';
import Toast from '@/components/base/Toast';
import { useProfileOverview, useContactEdit, useContactVerification } from '@/hooks/useProfileData';

const verificationStateIcons: Record<string, string> = {
  verified: 'ri-checkbox-circle-fill text-green-500',
  pending: 'ri-time-fill text-yellow-500',
  outdated: 'ri-error-warning-fill text-orange-500',
  invalid: 'ri-close-circle-fill text-red-500',
  unavailable: 'ri-indeterminate-circle-fill text-foreground-400',
};

const channelOptions = [
  { value: 'Telefone', label: 'Telefone' },
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'E-mail', label: 'E-mail' },
];

export default function ContatosPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useProfileOverview();
  const { edit: editContact, saving: savingEdit } = useContactEdit();
  const { verify: verifyContact, verifying } = useContactVerification();

  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [verifyingMethod, setVerifyingMethod] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const openEdit = (methodType: string, currentValue: string) => {
    setEditingMethod(methodType);
    setEditValue(currentValue);
  };

  const handleEditSave = async () => {
    if (!editingMethod || !editValue.trim()) return;
    const result = await editContact(editingMethod, editValue.trim());
    if (result) {
      setEditingMethod(null);
      setToastMsg('Contato atualizado. A verificação é necessária para confirmar.');
    }
  };

  const openVerify = (methodType: string) => {
    setVerifyingMethod(methodType);
    setVerifyCode('');
  };

  const handleVerify = async () => {
    if (!verifyingMethod) return;
    const result = await verifyContact(verifyingMethod);
    if (result) {
      setVerifyingMethod(null);
      setToastMsg('Verificação concluída para demonstração.');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-16 w-full rounded-xl" />))}
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
          <h3 className="text-base font-semibold text-foreground-900 mb-1">Erro ao carregar contatos</h3>
          <p className="text-sm text-foreground-500 max-w-xs mb-4">{error}</p>
          <Button variant="secondary" size="sm" onClick={reload}>Tentar novamente</Button>
        </div>
      </AppShell>
    );
  }

  const { contactInfo } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Contact methods */}
        <div>
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1 mb-2">
            Métodos de contato
          </p>
          <div className="bg-white rounded-2xl border border-background-200/70 overflow-hidden divide-y divide-background-100">
            {contactInfo.methods.map((method) => (
              <div key={method.type} className="px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-background-100 flex items-center justify-center flex-shrink-0">
                      <i className={`
                        ${method.type === 'phone' || method.type === 'whatsapp' ? 'ri-phone-line' : 'ri-mail-line'}
                        text-foreground-600
                      `} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground-900">{method.label}</span>
                        <span className="text-[10px] font-medium text-foreground-400 capitalize">{method.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs text-foreground-600 mt-0.5">{method.valueMasked}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <i className={`${verificationStateIcons[method.verificationState]} text-sm`} />
                      <span className="text-[10px] font-medium text-foreground-500">{method.verificationLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {method.editable && (
                    <button
                      onClick={() => openEdit(method.type, method.value)}
                      className="text-xs font-medium text-primary-600 cursor-pointer hover:text-primary-700 flex items-center gap-1"
                    >
                      <i className="ri-edit-line text-xs" />
                      Editar
                    </button>
                  )}
                  {!method.isVerified && (
                    <button
                      onClick={() => openVerify(method.type)}
                      className="text-xs font-medium text-secondary-600 cursor-pointer hover:text-secondary-700 flex items-center gap-1"
                    >
                      <i className="ri-shield-check-line text-xs" />
                      Verificar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preferred channel */}
        <div className="p-4 bg-white rounded-2xl border border-background-200/70">
          <p className="text-sm font-medium text-foreground-900 mb-1">Canal de contato preferido</p>
          <p className="text-xs text-foreground-500">{contactInfo.preferredChannel}</p>
        </div>

        <p className="text-xs text-foreground-400 text-center pb-6">
          A verificação de contatos é simulada nesta demonstração. Nenhum código real é enviado.
        </p>
      </div>

      {/* Edit modal */}
      <Modal
        open={!!editingMethod}
        onClose={() => setEditingMethod(null)}
        title="Editar contato"
        actions={
          <>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditingMethod(null)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={handleEditSave} loading={savingEdit} disabled={!editValue.trim()}>
              Salvar
            </Button>
          </>
        }
      >
        <div>
          <Input
            value={editValue}
            onChange={setEditValue}
            placeholder="Digite o novo valor"
            maxLength={60}
          />
          <p className="text-xs text-foreground-400 mt-2">
            Após a edição, o contato precisará ser verificado novamente.
          </p>
        </div>
      </Modal>

      {/* Verification modal */}
      <Modal
        open={!!verifyingMethod}
        onClose={() => setVerifyingMethod(null)}
        title="Verificação simulada"
        actions={
          <>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setVerifyingMethod(null)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={handleVerify} loading={verifying} disabled={!verifyCode.trim()}>
              Verificar
            </Button>
          </>
        }
      >
        <div>
          <p className="text-sm text-foreground-600 mb-3">
            Nesta demonstração, a verificação é simulada. Digite qualquer código de 4 dígitos para testar.
          </p>
          <Input
            value={verifyCode}
            onChange={setVerifyCode}
            placeholder="Código de 4 dígitos"
            maxLength={6}
          />
        </div>
      </Modal>

      {toastMsg && (
        <Toast message={toastMsg} type="success" />
      )}
    </AppShell>
  );
}