import { useState, useEffect, useCallback } from 'react';
import type { ResidenceContext, ResidenceDetail, WaterServiceInfo, LinkedResident, ContactPreferences, AssociationInfo, DocumentPreview } from '@/fixtures/types';
import { fetchResidenceContexts, fetchResidenceDetail, fetchWaterServiceInfo, fetchLinkedResidents, fetchContactPreferences, fetchAssociationInfo, fetchPropertyDocuments } from '@/demo/residenceService';
import { activeScenario } from '@/fixtures/scenarios';

interface UseResidenceDataResult {
  contexts: ResidenceContext[];
  activeContext: ResidenceContext | null;
  detail: ResidenceDetail | null;
  waterService: WaterServiceInfo | null;
  linkedResidents: LinkedResident[];
  preferences: ContactPreferences | null;
  association: AssociationInfo | null;
  documents: DocumentPreview[];
  loading: boolean;
  error: string | null;
  sectionErrors: Record<string, string>;
  switchResidence: (id: string) => Promise<void>;
}

export function useResidenceData(): UseResidenceDataResult {
  const [contexts, setContexts] = useState<ResidenceContext[]>([]);
  const [activeContext, setActiveContext] = useState<ResidenceContext | null>(null);
  const [detail, setDetail] = useState<ResidenceDetail | null>(null);
  const [waterServiceInfo, setWaterServiceInfo] = useState<WaterServiceInfo | null>(null);
  const [linkedResidentsList, setLinkedResidentsList] = useState<LinkedResident[]>([]);
  const [preferences, setPreferences] = useState<ContactPreferences | null>(null);
  const [association, setAssociation] = useState<AssociationInfo | null>(null);
  const [documents, setDocuments] = useState<DocumentPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});

  const loadAll = useCallback(async (residenceId: string) => {
    setLoading(true);
    setError(null);
    setSectionErrors({});

    try {
      const [detailResult, waterResult, residentsResult, prefsResult, assocResult, docsResult] = await Promise.allSettled([
        fetchResidenceDetail(residenceId),
        fetchWaterServiceInfo(),
        fetchLinkedResidents(),
        fetchContactPreferences(),
        fetchAssociationInfo(),
        fetchPropertyDocuments(),
      ]);

      const newSectionErrors: Record<string, string> = {};

      if (detailResult.status === 'fulfilled') setDetail(detailResult.value);
      else newSectionErrors.detail = 'Erro ao carregar detalhes';

      if (waterResult.status === 'fulfilled') setWaterServiceInfo(waterResult.value);
      else newSectionErrors.water = 'Erro ao carregar serviço de água';

      if (residentsResult.status === 'fulfilled') setLinkedResidentsList(residentsResult.value);
      else newSectionErrors.residents = 'Erro ao carregar residentes';

      if (prefsResult.status === 'fulfilled') setPreferences(prefsResult.value);
      else newSectionErrors.prefs = 'Erro ao carregar preferências';

      if (assocResult.status === 'fulfilled') setAssociation(assocResult.value);
      else newSectionErrors.assoc = 'Erro ao carregar associação';

      if (docsResult.status === 'fulfilled') setDocuments(docsResult.value);
      else newSectionErrors.docs = 'Erro ao carregar documentos';

      if (Object.keys(newSectionErrors).length > 0) {
        setSectionErrors(newSectionErrors);
      }
    } catch {
      setError('Não foi possível carregar as informações da residência.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const ctxs = await fetchResidenceContexts();
        setContexts(ctxs);
        const primary = ctxs.find((c) => c.isPrimary) || ctxs[0];
        setActiveContext(primary);
        if (primary) await loadAll(primary.id);
      } catch {
        setError('Não foi possível carregar as residências.');
        setLoading(false);
      }
    };
    init();
  }, [loadAll]);

  const switchResidence = useCallback(async (id: string) => {
    const ctx = contexts.find((c) => c.id === id);
    if (!ctx) return;
    setActiveContext(ctx);
    await loadAll(id);
  }, [contexts, loadAll]);

  return {
    contexts,
    activeContext,
    detail,
    waterService: waterServiceInfo,
    linkedResidents: linkedResidentsList,
    preferences,
    association,
    documents,
    loading,
    error,
    sectionErrors,
    switchResidence,
  };
}