import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import Button from '@/components/base/Button';
import EmptyState from '@/components/base/EmptyState';
import { SkeletonCard } from '@/components/base/Skeleton';
import BottomSheet from '@/components/base/BottomSheet';
import { useResidenceData } from '@/hooks/useResidenceData';
import { activeScenario, setScenario } from '@/fixtures/scenarios';
import { useState } from 'react';

export default function MinhaResidenciaPage() {
  const navigate = useNavigate();
  const {
    contexts, activeContext, detail, waterService, linkedResidents,
    preferences, association, documents, loading, error, sectionErrors,
    switchResidence,
  } = useResidenceData();

  const [prefsSheetOpen, setPrefsSheetOpen] = useState(false);
  const [assocSheetOpen, setAssocSheetOpen] = useState(false);

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  if (error && !detail) {
    return (
      <AppShell>
        <EmptyState
          icon="ri-error-warning-line"
          title="Não foi possível carregar"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Back navigation */}
        <button
          onClick={() => navigate('/inicio')}
          className="flex items-center gap-1 text-sm text-foreground-500 hover:text-foreground-700 transition-colors cursor-pointer -ml-1"
        >
          <i className="ri-arrow-left-line" />
          <span>Voltar</span>
        </button>

        {/* Residence selector if multiple */}
        {contexts.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {contexts.map((ctx) => (
              <button
                key={ctx.id}
                onClick={() => switchResidence(ctx.id)}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors cursor-pointer
                  ${ctx.id === activeContext?.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-background-200 text-foreground-600 hover:bg-background-300'
                  }
                `}
              >
                {ctx.nickname}
              </button>
            ))}
          </div>
        )}

        {/* Residence Summary */}
        {detail && (
          <Card>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <i className="ri-home-4-line text-primary-600 text-xl" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-bold text-foreground-900 font-heading">
                  {detail.nickname}
                </h1>
                <p className="text-xs text-foreground-500 mt-0.5">{detail.fullAddress}</p>
              </div>
              <Badge variant="success" size="sm">{detail.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-background-50 rounded-lg p-2.5">
                <p className="text-foreground-400">Tipo</p>
                <p className="text-foreground-800 font-medium mt-0.5">{detail.type}</p>
              </div>
              <div className="bg-background-50 rounded-lg p-2.5">
                <p className="text-foreground-400">Quartos</p>
                <p className="text-foreground-800 font-medium mt-0.5">{detail.bedrooms}</p>
              </div>
              <div className="bg-background-50 rounded-lg p-2.5">
                <p className="text-foreground-400">Ocupação</p>
                <p className="text-foreground-800 font-medium mt-0.5">{detail.occupancy}</p>
              </div>
              <div className="bg-background-50 rounded-lg p-2.5">
                <p className="text-foreground-400">Residentes</p>
                <p className="text-foreground-800 font-medium mt-0.5">{detail.residentsCount}</p>
              </div>
            </div>
            <p className="text-[10px] text-foreground-400 mt-3">
              Matrícula: {detail.registrationNumber} · {detail.associationShortName}
            </p>
          </Card>
        )}

        {/* Water Service */}
        {sectionErrors.water ? (
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <i className="ri-drop-line text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground-800">Serviço de água</p>
                <p className="text-xs text-red-600">{sectionErrors.water}</p>
              </div>
            </div>
          </Card>
        ) : waterService && (
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
                <i className="ri-drop-line text-accent-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground-800">Serviço de água</p>
                <Badge
                  variant={waterService.serviceStatus === 'active' ? 'success' : 'warning'}
                  size="sm"
                >
                  {waterService.serviceStatusLabel}
                </Badge>
              </div>
            </div>
            <div className="space-y-2 text-xs ml-12">
              <div className="flex justify-between">
                <span className="text-foreground-500">Hidrômetro</span>
                <span className="text-foreground-800 font-medium">{waterService.meterLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-500">Local</span>
                <span className="text-foreground-800 font-medium text-right max-w-[60%]">{waterService.installationLocation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-500">Última leitura</span>
                <span className="text-foreground-800 font-medium">{waterService.lastReadingValue} m³ em {new Date(waterService.lastReadingDate).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-500">Próxima leitura</span>
                <span className="text-foreground-800 font-medium text-right max-w-[55%]">{waterService.nextReadingWindow}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/consumo')}
              className="mt-3 ml-12 text-xs font-medium text-primary-600 flex items-center gap-1 hover:text-primary-700 transition-colors cursor-pointer"
            >
              Ver histórico de leituras
              <i className="ri-arrow-right-line" />
            </button>
          </Card>
        )}

        {/* Linked Residents */}
        {sectionErrors.residents ? (
          <Card>
            <p className="text-sm font-medium text-foreground-800 mb-1">Residentes vinculados</p>
            <p className="text-xs text-red-600">{sectionErrors.residents}</p>
          </Card>
        ) : (
          <Card>
            <p className="text-sm font-medium text-foreground-800 mb-3">Residentes vinculados</p>
            <div className="space-y-2">
              {linkedResidents.map((lr) => (
                <div key={lr.id} className="flex items-center gap-3 py-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${lr.status === 'pending' ? 'bg-background-200' : 'bg-primary-100'}`}>
                    <span className={`text-sm font-semibold ${lr.status === 'pending' ? 'text-foreground-400' : 'text-primary-700'}`}>
                      {lr.initials}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground-800">{lr.firstName}</p>
                    <p className="text-xs text-foreground-500">{lr.relationshipLabel}</p>
                  </div>
                  {lr.status === 'pending' && (
                    <Badge variant="neutral" size="sm">Pendente</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Contact Preferences */}
        {sectionErrors.prefs ? (
          <Card>
            <p className="text-sm font-medium text-foreground-800 mb-1">Preferências de contato</p>
            <p className="text-xs text-red-600">{sectionErrors.prefs}</p>
          </Card>
        ) : preferences && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground-800">Preferências de contato</p>
              <button
                onClick={() => setPrefsSheetOpen(true)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
              >
                Revisar
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-foreground-500">Receber faturas</span>
                <span className="text-foreground-800">{preferences.invoiceDelivery}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-500">Avisos</span>
                <span className="text-foreground-800">{preferences.noticeChannel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-500">Telefone</span>
                <span className="text-foreground-800">{preferences.primaryPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-500">E-mail</span>
                <span className="text-foreground-800">{preferences.maskedEmail}</span>
              </div>
            </div>
          </Card>
        )}

        {/* Association Info */}
        {sectionErrors.assoc ? (
          <Card>
            <p className="text-sm font-medium text-foreground-800 mb-1">Associação</p>
            <p className="text-xs text-red-600">{sectionErrors.assoc}</p>
          </Card>
        ) : association && (
          <Card onClick={() => setAssocSheetOpen(true)}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0">
                <i className="ri-building-line text-secondary-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground-800">{association.shortName}</p>
                <p className="text-xs text-foreground-500">{association.businessHours}</p>
              </div>
              <i className="ri-arrow-right-s-line text-foreground-400 flex-shrink-0" />
            </div>
          </Card>
        )}

        {/* Documents */}
        {sectionErrors.docs ? (
          <Card>
            <p className="text-sm font-medium text-foreground-800 mb-1">Documentos</p>
            <p className="text-xs text-red-600">{sectionErrors.docs}</p>
          </Card>
        ) : (
          <Card>
            <p className="text-sm font-medium text-foreground-800 mb-3">Documentos da residência</p>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-9 h-9 rounded-lg bg-background-200 flex items-center justify-center flex-shrink-0">
                    <i className="ri-file-text-line text-foreground-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground-800">{doc.title}</p>
                    <p className="text-xs text-foreground-500">{doc.description}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); }}
                    className="w-8 h-8 rounded-lg bg-background-200 flex items-center justify-center hover:bg-background-300 transition-colors cursor-pointer flex-shrink-0"
                    aria-label={`Baixar ${doc.title}`}
                  >
                    <i className="ri-download-line text-foreground-500 text-sm" />
                  </button>
                </div>
              ))}
            </div>
            {documents.some(d => d.isDemo) && (
              <p className="text-[10px] text-foreground-300 mt-2 text-center">
                Documentos de demonstração
              </p>
            )}
          </Card>
        )}

        <div className="h-4" />
      </div>

      {/* Preferences Bottom Sheet */}
      <BottomSheet
        open={prefsSheetOpen}
        onClose={() => setPrefsSheetOpen(false)}
        title="Preferências de contato"
      >
        {preferences && (
          <div className="space-y-4">
            <div className="bg-background-50 rounded-xl p-3">
              <p className="text-xs text-foreground-400 mb-2">Estas são as preferências atuais registradas para sua conta.</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-background-200">
                  <span className="text-foreground-500">Faturas</span>
                  <span className="text-foreground-800 font-medium">{preferences.invoiceDelivery}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-background-200">
                  <span className="text-foreground-500">Avisos</span>
                  <span className="text-foreground-800 font-medium">{preferences.noticeChannel}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-background-200">
                  <span className="text-foreground-500">Contato preferido</span>
                  <span className="text-foreground-800 font-medium">{preferences.preferredContact}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-background-200">
                  <span className="text-foreground-500">Idioma</span>
                  <span className="text-foreground-800 font-medium">{preferences.communicationLanguage}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-foreground-500">Telefone</span>
                  <span className="text-foreground-800 font-medium">{preferences.primaryPhone}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-foreground-400 text-center">
              Para alterar suas preferências, entre em contato com a associação.
            </p>
          </div>
        )}
      </BottomSheet>

      {/* Association Info Bottom Sheet */}
      <BottomSheet
        open={assocSheetOpen}
        onClose={() => setAssocSheetOpen(false)}
        title="Associação"
      >
        {association && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-2">
                <i className="ri-building-line text-2xl text-primary-600" />
              </div>
              <h3 className="text-base font-semibold text-foreground-900">{association.name}</h3>
            </div>
            <div className="bg-background-50 rounded-xl p-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-background-200 flex items-center justify-center flex-shrink-0">
                  <i className="ri-map-pin-line text-foreground-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground-400">Endereço</p>
                  <p className="text-sm text-foreground-800">{association.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-background-200 flex items-center justify-center flex-shrink-0">
                  <i className="ri-time-line text-foreground-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground-400">Horário de atendimento</p>
                  <p className="text-sm text-foreground-800">{association.businessHours}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-background-200 flex items-center justify-center flex-shrink-0">
                  <i className="ri-phone-line text-foreground-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground-400">Telefone</p>
                  <p className="text-sm text-foreground-800">{association.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-background-200 flex items-center justify-center flex-shrink-0">
                  <i className="ri-mail-line text-foreground-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground-400">E-mail</p>
                  <p className="text-sm text-foreground-800">{association.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-background-200 flex items-center justify-center flex-shrink-0">
                  <i className="ri-drop-line text-foreground-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground-400">Concessionária</p>
                  <p className="text-sm text-foreground-800">{association.waterUtility}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => { setAssocSheetOpen(false); navigate('/atendimento'); }}
              className="w-full py-3 text-sm font-medium text-white bg-primary-500 rounded-xl hover:bg-primary-600 transition-colors cursor-pointer"
            >
              Abrir atendimento
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Demo: toggle partial error */}
      <button
        onClick={() => setScenario(activeScenario === 'partialError' ? 'default' : 'partialError')}
        className={`fixed bottom-20 right-4 z-30 w-9 h-9 rounded-full text-white flex items-center justify-center cursor-pointer text-xs opacity-40 hover:opacity-90 transition-opacity ${activeScenario === 'partialError' ? 'bg-red-500' : 'bg-foreground-800/80'}`}
        aria-label={activeScenario === 'partialError' ? 'Restaurar dados (demo)' : 'Simular erro parcial (demo)'}
      >
        <i className={`text-sm ${activeScenario === 'partialError' ? 'ri-refresh-line' : 'ri-bug-line'}`} />
      </button>
    </AppShell>
  );
}