import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { resident } from '@/fixtures/resident';
import { association } from '@/fixtures/association';
import { getUnreadCount } from '@/fixtures/notificationScenarios';

export default function HomeHeader() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        setUnreadCount(getUnreadCount());
      } catch {
        setUnreadCount(0);
      }
    };
    updateCount();
    const interval = setInterval(updateCount, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      setUnreadCount(getUnreadCount());
    } catch {
      setUnreadCount(0);
    }
  });

  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-foreground-900 font-heading truncate">
          Olá, {resident.firstName}
        </h1>
        <p className="text-xs text-foreground-500 truncate">
          {association.shortName}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate('/notificacoes')}
          className="w-10 h-10 rounded-full bg-background-100 flex items-center justify-center cursor-pointer hover:bg-background-200 transition-colors relative"
          aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ''}`}
        >
          <i className="ri-notification-3-line text-lg text-foreground-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate('/perfil')}
          className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center cursor-pointer hover:bg-primary-200 transition-colors"
          aria-label="Perfil"
        >
          <span className="text-sm font-semibold text-primary-700">
            {resident.firstName.charAt(0)}{resident.name.split(' ').pop()?.charAt(0)}
          </span>
        </button>
      </div>
    </div>
  );
}