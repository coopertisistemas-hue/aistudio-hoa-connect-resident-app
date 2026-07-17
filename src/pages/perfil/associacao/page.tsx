import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import { useProfileOverview } from '@/hooks/useProfileData';

export default function AssociacaoPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useProfileOverview();

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
          <h3 className="text-base font-semibold text-foreground-900 mb-1">Erro ao carregar</h3>
          <p className="text-sm text-foreground-500 max-w-xs mb-4">{error}</p>
          <Button variant="secondary" size="sm" onClick={reload}>Tentar novamente</Button>
        </div>
      </AppShell>
    );
  }

  const { profile } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Association header */}
        <div className="p-4 bg-white rounded-2xl border border-background-200/70 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
            <i className="ri-building-line text-2xl text-primary-600" />
          </div>
          <h2 className="text-base font-semibold text-foreground-900">{profile.associationName}</h2>
        </div>

        {/* Contact info */}
        <div className="bg-white rounded-2xl border border-background-200/70 overflow-hidden divide-y divide-background-100">
          <InfoBlock icon="ri-map-pin-line" label="Endereço" value="Rua das Nascentes, 500 — Curitiba, PR — CEP 80000-000" />
          <InfoBlock icon="ri-phone-line" label="Telefone" value="(41) 3333-4444" />
          <InfoBlock icon="ri-mail-line" label="E-mail" value="contato@parquedasaguas.org.br" />
          <InfoBlock icon="ri-whatsapp-line" label="WhatsApp" value="(41) 99876-0000" />
          <InfoBlock icon="ri-time-line" label="Horário de atendimento" value="Segunda a Sexta, 8h às 18h" />
        </div>

        {/* Emergency guidance */}
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-alert-line text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800 mb-1">Emergências</p>
              <p className="text-xs text-red-700 leading-relaxed">
                Em caso de emergência (vazamento grave, interrupção, risco estrutural), entre em contato
                com a associação imediatamente pelo telefone (41) 3333-4444.
                Fora do horário comercial, acione os serviços públicos competentes.
              </p>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-2">
          <button
            onClick={() => navigate('/avisos')}
            className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-background-200/70 text-left cursor-pointer hover:bg-background-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-megaphone-line text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground-900">Avisos da associação</p>
              <p className="text-xs text-foreground-500">Comunicados oficiais</p>
            </div>
            <i className="ri-arrow-right-s-line text-foreground-400" />
          </button>
          <button
            onClick={() => navigate('/atendimento')}
            className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-background-200/70 text-left cursor-pointer hover:bg-background-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-customer-service-line text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground-900">Atendimento</p>
              <p className="text-xs text-foreground-500">Falar com a associação</p>
            </div>
            <i className="ri-arrow-right-s-line text-foreground-400" />
          </button>
        </div>

        <div className="pb-6" />
      </div>
    </AppShell>
  );
}

function InfoBlock({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center flex-shrink-0">
        <i className={`${icon} text-secondary-600 text-sm`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground-900">{label}</p>
        <p className="text-xs text-foreground-500 mt-0.5">{value}</p>
      </div>
    </div>
  );
}