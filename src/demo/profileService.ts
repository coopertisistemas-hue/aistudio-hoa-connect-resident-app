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
  getProfileOverview,
  setProfileScenario,
  getProfileScenario,
  applyProfileEdit,
  applyContactEdit,
  applyContactVerification,
  acceptInvitation,
  declineInvitation,
  applyAppPreferenceChange,
  applyAccessibilityChange,
  simulatePasswordChange,
  removeTrustedDevice,
  simulateSignOut,
  submitCorrectionRequest,
  setActiveResidence,
  privacySections,
  privacyDataCategories,
  aboutInfo,
  deviceAppInfo,
} from '@/fixtures/profileScenarios';

const DELAY_MS = 500;

// ─── Profile Overview ──────────────────────────────────────────────

export function fetchProfileOverview(
  scenarioOverride?: ProfileScenarioKey,
): Promise<ProfileOverview> {
  const prevScenario = getProfileScenario();

  return new Promise((resolve, reject) => {
    if (scenarioOverride !== undefined) {
      setProfileScenario(scenarioOverride);
    }

    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        setProfileScenario(prevScenario);
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'detail_unavailable') {
        setProfileScenario(prevScenario);
        reject(new Error('Não foi possível carregar os dados do perfil.'));
        return;
      }

      if (scenario === 'partial_service_error') {
        reject(new Error('Alguns dados do perfil estão indisponíveis no momento.'));
        return;
      }

      resolve(getProfileOverview());
    }, DELAY_MS);
  });
}

// ─── Profile Edit ──────────────────────────────────────────────────

export function performProfileEdit(fields: EditableProfileFields): Promise<EditableProfileFields> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'preference_save_error') {
        reject(new Error('Não foi possível salvar as alterações. Tente novamente.'));
        return;
      }

      resolve(applyProfileEdit(fields));
    }, 800);
  });
}

// ─── Contact Edit ──────────────────────────────────────────────────

export function performContactEdit(methodType: string, newValue: string): Promise<ContactMethod> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      const method = applyContactEdit(methodType, newValue);
      if (!method) {
        reject(new Error('Método de contato não encontrado.'));
        return;
      }
      resolve(method);
    }, 600);
  });
}

export function performContactVerification(methodType: string): Promise<ContactMethod> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'preference_save_error') {
        reject(new Error('Falha na verificação. Tente novamente.'));
        return;
      }

      const method = applyContactVerification(methodType);
      if (!method) {
        reject(new Error('Método de contato não encontrado.'));
        return;
      }
      resolve(method);
    }, 1200);
  });
}

// ─── Correction Request ────────────────────────────────────────────

export function performCorrectionRequest(form: CorrectionRequestForm): Promise<CorrectionConfirmation> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'preference_save_error') {
        reject(new Error('Não foi possível enviar a solicitação de correção.'));
        return;
      }

      resolve(submitCorrectionRequest(form));
    }, 1000);
  });
}

// ─── App Preferences ───────────────────────────────────────────────

export function performAppPreferenceSave(prefId: string, newValue: boolean | string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'preference_save_error') {
        reject(new Error('Não foi possível salvar a preferência.'));
        return;
      }

      const ok = applyAppPreferenceChange(prefId, newValue);
      if (!ok) reject(new Error('Preferência não encontrada.'));
      else resolve(true);
    }, 500);
  });
}

// ─── Accessibility ─────────────────────────────────────────────────

export function performAccessibilitySave(prefId: string, active: boolean): Promise<boolean> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'preference_save_error') {
        reject(new Error('Não foi possível salvar.'));
        return;
      }

      const ok = applyAccessibilityChange(prefId, active);
      if (!ok) reject(new Error('Preferência não encontrada.'));
      else resolve(true);
    }, 400);
  });
}

// ─── Security Actions ──────────────────────────────────────────────

export function performPasswordChange(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const result = simulatePasswordChange();
      resolve(result);
    }, 1200);
  });
}

export function performRemoveDevice(sessionId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      const ok = removeTrustedDevice(sessionId);
      if (!ok) reject(new Error('Não foi possível remover o dispositivo.'));
      else resolve(true);
    }, 600);
  });
}

export function performSignOut(type: SignOutType): Promise<SignOutResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(simulateSignOut(type));
    }, 800);
  });
}

// ─── Invitation Actions ────────────────────────────────────────────

export function performAcceptInvitation(invitationId: string): Promise<ResidenceInvitation> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      const inv = acceptInvitation(invitationId);
      if (!inv) reject(new Error('Convite não encontrado.'));
      else resolve(inv);
    }, 600);
  });
}

export function performDeclineInvitation(invitationId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      const ok = declineInvitation(invitationId);
      if (!ok) reject(new Error('Convite não encontrado.'));
      else resolve(true);
    }, 500);
  });
}

// ─── Active Residence ──────────────────────────────────────────────

export function performSetActiveResidence(residenceId: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = getProfileScenario();

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      const ok = setActiveResidence(residenceId);
      if (!ok) reject(new Error('Não foi possível alterar a residência ativa.'));
      else resolve(true);
    }, 500);
  });
}

// ─── Static Data ───────────────────────────────────────────────────

export function fetchPrivacySections(): Promise<PrivacySection[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(privacySections), 400);
  });
}

export function fetchPrivacyDataCategories(): Promise<PrivacyDataCategory[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(privacyDataCategories), 400);
  });
}

export function fetchAboutInfo(): Promise<AboutInfo> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(aboutInfo), 300);
  });
}

export function fetchDeviceAppInfo(): Promise<DeviceAppInfo> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(deviceAppInfo), 300);
  });
}