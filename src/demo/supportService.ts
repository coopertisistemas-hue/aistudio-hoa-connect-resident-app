import type {
  SupportOverview,
  SupportRequest,
  SupportScenarioKey,
  SupportRating,
  NewRequestFormData,
  RequestSubmissionResult,
  SupportMessage,
  FAQItem,
  AssociationContactInfo,
  SupportCategoryOption,
} from '@/fixtures/types';
import {
  getSupportOverview,
  getRequestById,
  getAllRequests,
  submitNewRequest,
  addReplyToRequest,
  cancelRequest,
  closeRequest,
  reopenRequest,
  submitRating,
  confirmVisit,
  activeSupportScenario,
  setSupportScenario,
  allFaqItems,
  associationContact,
  supportCategoryOptions,
} from '@/fixtures/supportScenarios';

const DELAY_MS = 500;

export function fetchSupportOverview(
  residenceId?: string,
  scenarioOverride?: SupportScenarioKey,
): Promise<SupportOverview> {
  const prevScenario = activeSupportScenario;

  return new Promise((resolve, reject) => {
    if (scenarioOverride !== undefined) {
      setSupportScenario(scenarioOverride);
    }

    setTimeout(() => {
      const scenario = activeSupportScenario;

      if (scenario === 'offline') {
        setSupportScenario(prevScenario);
        reject(new Error('OFFLINE'));
        return;
      }

      const overview = getSupportOverview(residenceId);
      resolve(overview);
    }, DELAY_MS);
  });
}

export function fetchRequestList(
  residenceId?: string,
  scenarioOverride?: SupportScenarioKey,
): Promise<SupportRequest[]> {
  return new Promise((resolve, reject) => {
    if (scenarioOverride !== undefined) {
      setSupportScenario(scenarioOverride);
    }

    setTimeout(() => {
      const scenario = activeSupportScenario;

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'partial_list_error') {
        reject(new Error('Não foi possível carregar todas as solicitações.'));
        return;
      }

      resolve(getAllRequests(residenceId));
    }, DELAY_MS);
  });
}

export function fetchRequestDetail(id: string): Promise<SupportRequest | null> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeSupportScenario;

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'detail_unavailable') {
        reject(new Error('Detalhe da solicitação indisponível. Tente novamente.'));
        return;
      }

      resolve(getRequestById(id));
    }, DELAY_MS);
  });
}

export function performNewRequest(form: NewRequestFormData): Promise<RequestSubmissionResult> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeSupportScenario;

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'submit_error') {
        reject(new Error('Não foi possível enviar sua solicitação. Verifique sua conexão e tente novamente.'));
        return;
      }

      resolve(submitNewRequest(form));
    }, 1000);
  });
}

export function performReply(requestId: string, content: string, attachmentName?: string): Promise<SupportMessage> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeSupportScenario;

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'message_error') {
        reject(new Error('Não foi possível enviar sua resposta. Tente novamente.'));
        return;
      }

      const msg = addReplyToRequest(requestId, content, attachmentName);
      if (!msg) {
        reject(new Error('Solicitação não encontrada.'));
        return;
      }

      resolve(msg);
    }, 800);
  });
}

export function performCancelRequest(requestId: string, reason: string): Promise<SupportRequest> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeSupportScenario;

      if (scenario === 'offline') reject(new Error('OFFLINE'));
      else {
        const result = cancelRequest(requestId, reason);
        if (!result) reject(new Error('Não foi possível cancelar esta solicitação.'));
        else resolve(result);
      }
    }, 600);
  });
}

export function performCloseRequest(requestId: string): Promise<SupportRequest> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeSupportScenario;
      if (scenario === 'offline') reject(new Error('OFFLINE'));
      else {
        const result = closeRequest(requestId);
        if (!result) reject(new Error('Não foi possível encerrar esta solicitação.'));
        else resolve(result);
      }
    }, 600);
  });
}

export function performReopenRequest(requestId: string, reason: string, attachmentName?: string): Promise<SupportRequest> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeSupportScenario;
      if (scenario === 'offline') reject(new Error('OFFLINE'));
      else {
        const result = reopenRequest(requestId, reason, attachmentName);
        if (!result) reject(new Error('Não foi possível reabrir esta solicitação.'));
        else resolve(result);
      }
    }, 600);
  });
}

export function performRating(requestId: string, score: number, comment?: string): Promise<SupportRating> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeSupportScenario;
      if (scenario === 'offline') reject(new Error('OFFLINE'));
      else {
        const result = submitRating(requestId, score, comment);
        if (!result) reject(new Error('Erro ao enviar avaliação.'));
        else resolve(result);
      }
    }, 600);
  });
}

export function performConfirmVisit(requestId: string): Promise<SupportRequest> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeSupportScenario;
      if (scenario === 'offline') reject(new Error('OFFLINE'));
      else {
        const result = confirmVisit(requestId);
        if (!result) reject(new Error('Não foi possível confirmar a visita.'));
        else resolve(result);
      }
    }, 600);
  });
}

export function fetchFAQ(): Promise<FAQItem[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(allFaqItems), 400);
  });
}

export function fetchContactInfo(): Promise<AssociationContactInfo> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (activeSupportScenario === 'offline') reject(new Error('OFFLINE'));
      else resolve(associationContact);
    }, 400);
  });
}

export function getSupportCategoryOptions(): SupportCategoryOption[] {
  return supportCategoryOptions;
}