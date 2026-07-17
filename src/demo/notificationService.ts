import type {
  NotificationOverview,
  NotificationItem,
  NoticeItem,
  CommunicationPreference,
  NotificationScenarioKey,
} from '@/fixtures/types';
import {
  getNotificationOverview,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  markNoticeRead,
  markNoticeUnread,
  resetReadState,
  getNotificationById,
  getNoticeById,
  activeNotificationScenario,
  setNotificationScenario,
} from '@/fixtures/notificationScenarios';

const DELAY_MS = 600;

export function fetchNotificationOverview(
  _residenceId?: string,
  scenarioOverride?: NotificationScenarioKey,
): Promise<NotificationOverview> {
  const prevScenario = activeNotificationScenario;

  return new Promise((resolve, reject) => {
    if (scenarioOverride !== undefined) {
      setNotificationScenario(scenarioOverride);
    }

    setTimeout(() => {
      const scenario = activeNotificationScenario;

      if (scenario === 'offline') {
        setNotificationScenario(prevScenario);
        reject(new Error('OFFLINE'));
        return;
      }

      const overview = getNotificationOverview();
      resolve(overview);
    }, DELAY_MS);
  });
}

export function fetchNotificationDetail(id: string): Promise<NotificationItem | null> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeNotificationScenario;

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'detail_unavailable' && id === 'notif-001') {
        reject(new Error('Indisponível'));
        return;
      }

      const item = getNotificationById(id);
      if (item) {
        markNotificationRead(id);
      }
      resolve(item || null);
    }, 400);
  });
}

export function fetchNoticeDetail(id: string): Promise<NoticeItem | null> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const scenario = activeNotificationScenario;

      if (scenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      if (scenario === 'detail_unavailable' && id === 'notice-001') {
        reject(new Error('Indisponível'));
        return;
      }

      const item = getNoticeById(id);
      if (item) {
        markNoticeRead(id);
      }
      resolve(item || null);
    }, 400);
  });
}

export function performMarkAsRead(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      markNotificationRead(id);
      resolve(true);
    }, 150);
  });
}

export function performMarkAsUnread(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      markNotificationUnread(id);
      resolve(true);
    }, 150);
  });
}

export function performMarkAllAsRead(): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      markAllNotificationsRead();
      resolve(true);
    }, 300);
  });
}

export function performMarkNoticeRead(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      markNoticeRead(id);
      resolve(true);
    }, 150);
  });
}

export function performMarkNoticeUnread(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      markNoticeUnread(id);
      resolve(true);
    }, 150);
  });
}

export function fetchPreferences(): Promise<CommunicationPreference[]> {
  return new Promise((resolve) => {
    const overview = getNotificationOverview();
    setTimeout(() => resolve(overview.preferences), 400);
  });
}

export function savePreferences(preferences: CommunicationPreference[]): Promise<CommunicationPreference[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (activeNotificationScenario === 'preferences_error') {
        reject(new Error('Não foi possível salvar as preferências. Tente novamente.'));
        return;
      }

      if (activeNotificationScenario === 'offline') {
        reject(new Error('OFFLINE'));
        return;
      }

      resolve(preferences);
    }, 800);
  });
}

export function resetNotificationState() {
  resetReadState();
}