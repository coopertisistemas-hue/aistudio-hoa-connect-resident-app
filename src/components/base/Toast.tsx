import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

let addToastFn: ((toast: Omit<ToastData, 'id'>) => void) | null = null;

export function showToast(message: string, type: ToastType = 'info', duration?: number) {
  if (addToastFn) {
    addToastFn({ message, type, duration });
  }
}

const typeConfig: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: 'bg-green-600', icon: 'ri-check-line' },
  error: { bg: 'bg-red-600', icon: 'ri-error-warning-line' },
  warning: { bg: 'bg-amber-600', icon: 'ri-alert-line' },
  info: { bg: 'bg-primary-600', icon: 'ri-information-line' },
};

export default function ToastContainer(_props?: { message?: string; type?: string }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  return createPortal(
    <div
      className="fixed bottom-24 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-app mx-auto"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDone={() => removeToast(toast.id)}
        />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({ toast, onDone }: { toast: ToastData; onDone: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 50);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, toast.duration || 3500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [toast.duration, onDone]);

  const config = typeConfig[toast.type];

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm shadow-lg
        transition-all duration-300
        ${config.bg}
        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
      `}
      role="alert"
    >
      <i className={`${config.icon} text-lg flex-shrink-0`} />
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onDone, 300);
        }}
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer flex-shrink-0"
        aria-label="Fechar"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}