import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  ProfileOverview,
  ProfileScenarioKey,
  EditableProfileFields,
  ContactMethod,
  CorrectionRequestForm,
  CorrectionConfirmation,
  SignOutResult,
  SignOutType,
  ResidenceInvitation,
  PrivacySection,
  PrivacyDataCategory,
  AboutInfo,
  DeviceAppInfo,
} from '@/fixtures/types';
import {
  fetchProfileOverview,
  performProfileEdit,
  performContactEdit,
  performContactVerification,
  performCorrectionRequest,
  performAppPreferenceSave,
  performAccessibilitySave,
  performPasswordChange,
  performRemoveDevice,
  performSignOut,
  performAcceptInvitation,
  performDeclineInvitation,
  performSetActiveResidence,
  fetchPrivacySections,
  fetchPrivacyDataCategories,
  fetchAboutInfo,
  fetchDeviceAppInfo,
} from '@/demo/profileService';

// ─── Profile Overview ──────────────────────────────────────────────

export function useProfileOverview(scenarioOverride?: ProfileScenarioKey) {
  const [data, setData] = useState<ProfileOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchProfileOverview(scenarioOverride);
      setData(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [scenarioOverride]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

// ─── Profile Edit ──────────────────────────────────────────────────

export function useProfileEdit() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (fields: EditableProfileFields): Promise<EditableProfileFields | null> => {
    setSaving(true);
    setError(null);
    try {
      const result = await performProfileEdit(fields);
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, saving, error };
}

// ─── Contact Edit ──────────────────────────────────────────────────

export function useContactEdit() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edit = useCallback(async (methodType: string, newValue: string): Promise<ContactMethod | null> => {
    setSaving(true);
    setError(null);
    try {
      return await performContactEdit(methodType, newValue);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { edit, saving, error };
}

export function useContactVerification() {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async (methodType: string): Promise<ContactMethod | null> => {
    setVerifying(true);
    setError(null);
    try {
      return await performContactVerification(methodType);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return null;
    } finally {
      setVerifying(false);
    }
  }, []);

  return { verify, verifying, error };
}

// ─── Correction Request ────────────────────────────────────────────

export function useCorrectionRequest() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (form: CorrectionRequestForm): Promise<CorrectionConfirmation | null> => {
    setSubmitting(true);
    setError(null);
    try {
      return await performCorrectionRequest(form);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error };
}

// ─── App Preferences ───────────────────────────────────────────────

export function useAppPreferenceSave() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savePref = useCallback(async (prefId: string, newValue: boolean | string): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      return await performAppPreferenceSave(prefId, newValue);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { savePref, saving, error };
}

// ─── Accessibility ─────────────────────────────────────────────────

export function useAccessibilitySave() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveAcc = useCallback(async (prefId: string, active: boolean): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      return await performAccessibilitySave(prefId, active);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saveAcc, saving, error };
}

// ─── Security ──────────────────────────────────────────────────────

export function usePasswordChange() {
  const [changing, setChanging] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const changePassword = useCallback(async (currentPw: string, newPw: string) => {
    setChanging(true);
    setResult(null);
    try {
      const res = await performPasswordChange(currentPw, newPw);
      setResult(res);
      return res;
    } finally {
      setChanging(false);
    }
  }, []);

  return { changePassword, changing, result, clearResult: () => setResult(null) };
}

export function useRemoveDevice() {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (sessionId: string): Promise<boolean> => {
    setRemoving(true);
    setError(null);
    try {
      return await performRemoveDevice(sessionId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return false;
    } finally {
      setRemoving(false);
    }
  }, []);

  return { remove, removing, error };
}

export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async (type: SignOutType): Promise<SignOutResult | null> => {
    setSigningOut(true);
    setError(null);
    try {
      return await performSignOut(type);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return null;
    } finally {
      setSigningOut(false);
    }
  }, []);

  return { signOut, signingOut, error };
}

// ─── Invitations ──────────────────────────────────────────────────

export function useInvitationActions() {
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(async (invitationId: string): Promise<ResidenceInvitation | null> => {
    setActing(true);
    setError(null);
    try {
      return await performAcceptInvitation(invitationId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return null;
    } finally {
      setActing(false);
    }
  }, []);

  const decline = useCallback(async (invitationId: string): Promise<boolean> => {
    setActing(true);
    setError(null);
    try {
      return await performDeclineInvitation(invitationId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return false;
    } finally {
      setActing(false);
    }
  }, []);

  return { accept, decline, acting, error };
}

// ─── Active Residence ──────────────────────────────────────────────

export function useSetActiveResidence() {
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setActive = useCallback(async (residenceId: string): Promise<boolean> => {
    setChanging(true);
    setError(null);
    try {
      return await performSetActiveResidence(residenceId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      return false;
    } finally {
      setChanging(false);
    }
  }, []);

  return { setActive, changing, error };
}

// ─── Static Data ───────────────────────────────────────────────────

export function usePrivacyData() {
  const [sections, setSections] = useState<PrivacySection[]>([]);
  const [categories, setCategories] = useState<PrivacyDataCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchPrivacySections(), fetchPrivacyDataCategories()])
      .then(([s, c]) => {
        if (!cancelled) { setSections(s); setCategories(c); setError(null); }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro desconhecido');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { sections, categories, loading, error };
}

export function useAboutInfo() {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAboutInfo()
      .then((i) => { if (!cancelled) setInfo(i); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { info, loading };
}

export function useDeviceAppInfo() {
  const [info, setInfo] = useState<DeviceAppInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDeviceAppInfo()
      .then((i) => { if (!cancelled) setInfo(i); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { info, loading };
}