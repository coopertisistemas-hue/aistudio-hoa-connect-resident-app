import { useState, useEffect, useCallback } from 'react';
import type {
  NotificationOverview,
  NotificationItem,
  NoticeItem,
  CommunicationPreference,
  NotificationScenarioKey,
} from '@/fixtures/types';
import {
  fetchNotificationOverview,
  fetchNotificationDetail,
  fetchNoticeDetail,
  performMarkAsRead,
  performMarkAsUnread,
  performMarkAllAsRead,
  performMarkNoticeRead,
  performMarkNoticeUnread,
  fetchPreferences,
  savePreferences,
  resetNotificationState,
} from '@/demo/notificationService';

interface UseNotificationsDataResult {
  data: NotificationOverview | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  isOffline: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  getNotification: (id: string) => Promise<NotificationItem | null>;
  getNotice: (id: string) => Promise<NoticeItem | null>;
  markNoticeRead: (id: string) => Promise<void>;
  markNoticeUnread: (id: string) => Promise<void>;
  loadPreferences: () => Promise<CommunicationPreference[]>;
  saveUserPreferences: (prefs: CommunicationPreference[]) => Promise<CommunicationPreference[]>;
  refresh: () => Promise<void>;
  setScenario: (scenario: NotificationScenarioKey) => Promise<void>;
}

export function useNotificationsData(scenarioOverride?: NotificationScenarioKey): UseNotificationsDataResult {
  const [data, setData] = useState<NotificationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const load = useCallback(async (isRefresh = false, scenario?: NotificationScenarioKey) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      setIsOffline(false);

      const result = await fetchNotificationOverview(undefined, scenario);
      setData(result);
    } catch (err) {
      const errorObj = err as Error;
      if (errorObj.message === 'OFFLINE') {
        setIsOffline(true);
        setError('Você está offline. Conecte-se à internet para atualizar.');
      } else {
        setError('Não foi possível carregar as notificações. Tente novamente.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false, scenarioOverride);
  }, [load, scenarioOverride]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  const setScenario = useCallback(async (scenario: NotificationScenarioKey) => {
    resetNotificationState();
    await load(false, scenario);
  }, [load]);

  const markAsRead = useCallback(async (id: string) => {
    await performMarkAsRead(id);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
        notifications: prev.notifications.map((n) =>
          n.id === id ? { ...n, unread: false } : n,
        ),
      };
    });
  }, []);

  const markAsUnread = useCallback(async (id: string) => {
    await performMarkAsUnread(id);
    setData((prev) => {
      if (!prev) return prev;
      const wasUnread = prev.notifications.find((n) => n.id === id)?.unread;
      return {
        ...prev,
        unreadCount: wasUnread ? prev.unreadCount : prev.unreadCount + 1,
        notifications: prev.notifications.map((n) =>
          n.id === id ? { ...n, unread: true } : n,
        ),
      };
    });
  }, []);

  const markAllAsRead = useCallback(async () => {
    await performMarkAllAsRead();
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unreadCount: 0,
        notifications: prev.notifications.map((n) => ({ ...n, unread: false })),
      };
    });
  }, []);

  const getNotification = useCallback(async (id: string): Promise<NotificationItem | null> => {
    const item = await fetchNotificationDetail(id);
    if (item) {
      setData((prev) => {
        if (!prev) return prev;
        const wasUnread = prev.notifications.find((n) => n.id === id)?.unread;
        return {
          ...prev,
          unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
          notifications: prev.notifications.map((n) =>
            n.id === id ? { ...n, unread: false } : n,
          ),
        };
      });
    }
    return item;
  }, []);

  const getNotice = useCallback(async (id: string): Promise<NoticeItem | null> => {
    const item = await fetchNoticeDetail(id);
    if (item) {
      await performMarkNoticeRead(id);
    }
    return item;
  }, []);

  const markNoticeReadFn = useCallback(async (id: string) => {
    await performMarkNoticeRead(id);
  }, []);

  const markNoticeUnreadFn = useCallback(async (id: string) => {
    await performMarkNoticeUnread(id);
  }, []);

  const loadPreferences = useCallback(async (): Promise<CommunicationPreference[]> => {
    return fetchPreferences();
  }, []);

  const saveUserPreferences = useCallback(async (prefs: CommunicationPreference[]): Promise<CommunicationPreference[]> => {
    return savePreferences(prefs);
  }, []);

  return {
    data,
    loading,
    refreshing,
    error,
    isOffline,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    getNotification,
    getNotice,
    markNoticeRead: markNoticeReadFn,
    markNoticeUnread: markNoticeUnreadFn,
    loadPreferences,
    saveUserPreferences,
    refresh,
    setScenario,
  };
}