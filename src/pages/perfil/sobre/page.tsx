import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import { useAboutInfo, useDeviceAppInfo } from '@/hooks/useProfileData';

export default function SobrePage() {
  const { info, loading: loadingAbout } = useAboutInfo();
  const { info: deviceInfo, loading: loadingDevice } = useDeviceAppInfo();
  const loading = loadingAbout || loadingDevice;

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (<Skeleton key={i} className="h-20 w-full rounded-xl" />))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {/* App identity */}
        <div className="p-4 bg-white rounded-2xl border border-background-200/70 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
            <i className="ri-building-4-line text-2xl text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground-900">{info?.appName}</h2>
          <p className="text-xs text-foreground-500 mt-1">{info?.appPurpose}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <span className="text-[10px] font-medium bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full">
              v{info?.appVersion}
            </span>
            <span className="text-[10px] font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              {info?.environment}
            </span>
            <span className="text-[10px] font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Offline
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl border border-background-200/70 overflow-hidden divide-y divide-background-100">
          <InfoRow label="Associação" value={info?.associationName || ''} />
          <InfoRow label="Versão" value={info?.appVersion || ''} />
          <InfoRow label="Ambiente" value={info?.environment || ''} />
          <InfoRow label="Última atualização" value={info?.lastUpdateDate || ''} />
        </div>

        {/* Device info */}
        {deviceInfo && (
          <div className="bg-white rounded-2xl border border-background-200/70 overflow-hidden divide-y divide-background-100">
            <InfoRow label="Dispositivo" value={deviceInfo.deviceLabel} />
            <InfoRow label="Tipo de instalação" value={deviceInfo.installationType} />
            <InfoRow label="Funciona offline" value={deviceInfo.offlineCapable ? 'Sim' : 'Não'} />
            <InfoRow label="Última atualização local" value={deviceInfo.lastLocalUpdate} />
            <InfoRow label="Armazenamento" value={deviceInfo.storageDescription} />
          </div>
        )}

        {/* Legal previews */}
        {info && (
          <div className="space-y-2">
            <div className="bg-white rounded-2xl border border-background-200/70 p-4">
              <p className="text-sm font-semibold text-foreground-900 mb-1.5">Termos de uso</p>
              <p className="text-xs text-foreground-600 leading-relaxed">{info.termsPreview}</p>
            </div>
            <div className="bg-white rounded-2xl border border-background-200/70 p-4">
              <p className="text-sm font-semibold text-foreground-900 mb-1.5">Privacidade</p>
              <p className="text-xs text-foreground-600 leading-relaxed">{info.privacyPreview}</p>
            </div>
            <div className="bg-white rounded-2xl border border-background-200/70 p-4">
              <p className="text-sm font-semibold text-foreground-900 mb-1.5">Acessibilidade</p>
              <p className="text-xs text-foreground-600 leading-relaxed">{info.accessibilityStatement}</p>
            </div>
            <div className="bg-white rounded-2xl border border-background-200/70 p-4">
              <p className="text-sm font-semibold text-foreground-900 mb-1.5">Contato</p>
              <p className="text-xs text-foreground-600">{info.supportPhone} · {info.supportEmail}</p>
            </div>
            <div className="bg-white rounded-2xl border border-background-200/70 p-4">
              <p className="text-sm font-semibold text-foreground-900 mb-1.5">Créditos</p>
              <p className="text-xs text-foreground-600 leading-relaxed">{info.acknowledgements}</p>
            </div>
          </div>
        )}

        <p className="text-[10px] text-foreground-400 text-center pb-6">
          Esta é uma versão de demonstração. As informações são simuladas e não representam um aplicativo em produção.
        </p>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-sm text-foreground-500">{label}</span>
      <span className="text-sm font-medium text-foreground-800 text-right max-w-[60%]">{value}</span>
    </div>
  );
}