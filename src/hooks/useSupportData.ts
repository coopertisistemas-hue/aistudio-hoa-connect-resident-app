import { useState, useEffect, useCallback } from 'react';
import type {
  SupportOverview,
  SupportRequest,
  FAQItem,
  AssociationContactInfo,
  RequestSubmissionResult,
  SupportRating,
  SupportMessage,
  SupportScenarioKey,
  NewRequestFormData,
} from '@/fixtures/types';
import {
  fetchSupportOverview,
  fetchRequestList,
  fetchRequestDetail,
  performNewRequest,
  performReply,
  performCancelRequest,
  performCloseRequest,
  performReopenRequest,
  performRating,
  performConfirmVisit,
  fetchFAQ,
  fetchContactInfo,
} from '@/demo/supportService';

interface UseSupportDataResult {
  data: SupportOverview | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isOffline: boolean;
  refresh: () => Promise<void>;
}

export function useSupportData(residenceId?: string): UseSupportDataResult {
  const [data, setData] = useState<SupportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      setIsOffline(false);

      const result = await fetchSupportOverview(residenceId);
      setData(result);
    } catch (err) {
      const errorObj = err as Error;
      if (errorObj.message === 'OFFLINE') {
        setIsOffline(true);
        setError('Você está offline. Conecte-se à internet para atualizar.');
      } else {
        setError('Não foi possível carregar as informações. Tente novamente.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [residenceId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return { data, loading, refreshing, error, isOffline, refresh };
}

interface UseRequestListResult {
  requests: SupportRequest[];
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  refresh: () => Promise<void>;
}

export function useRequestList(residenceId?: string): UseRequestListResult {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsOffline(false);

      const result = await fetchRequestList(residenceId);
      setRequests(result);
    } catch (err) {
      const errorObj = err as Error;
      if (errorObj.message === 'OFFLINE') {
        setIsOffline(true);
        setError('Você está offline.');
      } else {
        setError(errorObj.message || 'Erro ao carregar solicitações.');
      }
    } finally {
      setLoading(false);
    }
  }, [residenceId]);

  useEffect(() => {
    load();
  }, [load]);

  return { requests, loading, error, isOffline, refresh: load };
}

interface UseRequestDetailResult {
  request: SupportRequest | null;
  loading: boolean;
  error: string | null;
  isOffline: boolean;
  refresh: () => Promise<void>;
}

export function useRequestDetail(requestId: string): UseRequestDetailResult {
  const [request, setRequest] = useState<SupportRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsOffline(false);

      const result = await fetchRequestDetail(requestId);
      setRequest(result);
    } catch (err) {
      const errorObj = err as Error;
      if (errorObj.message === 'OFFLINE') {
        setIsOffline(true);
        setError('Você está offline.');
      } else {
        setError(errorObj.message || 'Erro ao carregar detalhes.');
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  return { request, loading, error, isOffline, refresh: load };
}

// ─── Mutation Hooks ──────────────────────────────────────────────

export function useSubmitRequest() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (form: NewRequestFormData): Promise<RequestSubmissionResult | null> => {
    try {
      setSubmitting(true);
      setError(null);
      const result = await performNewRequest(form);
      return result;
    } catch (err) {
      const errorObj = err as Error;
      const msg = errorObj.message === 'OFFLINE'
        ? 'Você está offline. Conecte-se para enviar.'
        : errorObj.message || 'Erro ao enviar solicitação.';
      setError(msg);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error, clearError: () => setError(null) };
}

export function useReplyAction() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendReply = useCallback(async (requestId: string, content: string, attachmentName?: string): Promise<SupportMessage | null> => {
    try {
      setSending(true);
      setError(null);
      const result = await performReply(requestId, content, attachmentName);
      return result;
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message || 'Erro ao enviar resposta.');
      return null;
    } finally {
      setSending(false);
    }
  }, []);

  return { sendReply, sending, error, clearError: () => setError(null) };
}

export function useCancelRequest() {
  const [loading, setLoading] = useState(false);

  const cancel = useCallback(async (requestId: string, reason: string): Promise<SupportRequest | null> => {
    try {
      setLoading(true);
      return await performCancelRequest(requestId, reason);
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { cancel, loading };
}

export function useCloseRequest() {
  const [loading, setLoading] = useState(false);

  const close = useCallback(async (requestId: string): Promise<SupportRequest | null> => {
    try {
      setLoading(true);
      return await performCloseRequest(requestId);
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { close, loading };
}

export function useReopenRequest() {
  const [loading, setLoading] = useState(false);

  const reopen = useCallback(async (requestId: string, reason: string, attachmentName?: string): Promise<SupportRequest | null> => {
    try {
      setLoading(true);
      return await performReopenRequest(requestId, reason, attachmentName);
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { reopen, loading };
}

export function useRatingAction() {
  const [loading, setLoading] = useState(false);

  const rate = useCallback(async (requestId: string, score: number, comment?: string): Promise<SupportRating | null> => {
    try {
      setLoading(true);
      return await performRating(requestId, score, comment);
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { rate, loading };
}

export function useConfirmVisitAction() {
  const [loading, setLoading] = useState(false);

  const confirm = useCallback(async (requestId: string): Promise<SupportRequest | null> => {
    try {
      setLoading(true);
      return await performConfirmVisit(requestId);
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { confirm, loading };
}

interface UseFAQResult {
  items: FAQItem[];
  loading: boolean;
}

export function useFAQ(): UseFAQResult {
  const [items, setItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFAQ().then((data) => {
      setItems(data);
      setLoading(false);
    }).catch(() => {
      setItems([]);
      setLoading(false);
    });
  }, []);

  return { items, loading };
}

interface UseContactInfoResult {
  contact: AssociationContactInfo | null;
  loading: boolean;
}

export function useContactInfo(): UseContactInfoResult {
  const [contact, setContact] = useState<AssociationContactInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContactInfo().then((data) => {
      setContact(data);
      setLoading(false);
    }).catch(() => {
      setContact(null);
      setLoading(false);
    });
  }, []);

  return { contact, loading };
}