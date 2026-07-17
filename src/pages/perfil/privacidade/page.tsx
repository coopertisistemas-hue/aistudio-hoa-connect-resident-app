import AppShell from '@/components/feature/AppShell';
import Skeleton from '@/components/base/Skeleton';
import Button from '@/components/base/Button';
import { usePrivacyData } from '@/hooks/useProfileData';

export default function PrivacidadePage() {
  const { sections, categories, loading, error } = usePrivacyData();

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-20 w-full rounded-xl" />))}
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <i className="ri-error-warning-line text-2xl text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground-900 mb-1">Erro ao carregar</h3>
          <p className="text-sm text-foreground-500 max-w-xs mb-4">{error}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Data categories */}
        <div>
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1 mb-2">
            Categorias de dados
          </p>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white rounded-2xl border border-background-200/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <i className={`${cat.icon} text-primary-600`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground-900">{cat.name}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{cat.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {cat.dataTypes.map((dt) => (
                        <span key={dt} className="text-[10px] font-medium bg-background-100 text-foreground-600 px-2 py-0.5 rounded-full">
                          {dt}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-foreground-400 mt-2">
                      Retenção: {cat.retentionLabel}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy sections */}
        <div>
          <p className="text-xs font-semibold text-foreground-400 uppercase tracking-wider px-1 mb-2">
            Informações sobre privacidade
          </p>
          <div className="space-y-2">
            {sections.map((section) => (
              <div key={section.id} className="bg-white rounded-2xl border border-background-200/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center flex-shrink-0">
                    <i className={`${section.icon} text-secondary-600 text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground-900 mb-1.5">{section.title}</p>
                    <p className="text-xs text-foreground-600 leading-relaxed">{section.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pb-6">
          <p className="text-[10px] text-foreground-400 text-center">
            Esta é uma versão de demonstração. Nenhum dado pessoal real é armazenado ou transmitido.
          </p>
        </div>
      </div>
    </AppShell>
  );
}