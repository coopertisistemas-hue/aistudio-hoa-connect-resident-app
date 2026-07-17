import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setDismissed(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !dismissed) return null;
  if (dismissed) return null;

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50 px-4 py-3 safe-top
        flex items-center justify-between gap-3
        ${isOnline ? 'bg-green-600' : 'bg-amber-600'}
        text-white text-sm
      `}
      role="alert"
    >
      <div className="flex items-center gap-2">
        <i className={`${isOnline ? 'ri-wifi-line' : 'ri-wifi-off-line'} text-lg`} />
        <span>
          {isOnline
            ? 'Conexão restabelecida'
            : 'Você está offline. Algumas funções podem não estar disponíveis.'}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer flex-shrink-0"
        aria-label="Fechar"
      >
        <i className="ri-close-line" />
      </button>
    </div>
  );
}