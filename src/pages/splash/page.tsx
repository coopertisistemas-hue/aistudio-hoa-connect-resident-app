import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SplashPage() {
  const navigate = useNavigate();
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2200);
    const navTimer = setTimeout(() => {
      navigate('/welcome');
    }, 2600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  }, [navigate]);

  return (
    <div
      className={`
        fixed inset-0 bg-primary-500 flex flex-col items-center justify-center z-50
        transition-opacity duration-400 ease-out
        ${fadeOut ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center">
            <i className="ri-drop-fill text-4xl text-primary-500" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-white font-heading tracking-tight">
            HOA Connect
          </h1>
          <p className="text-sm text-white/70 mt-2 font-light">
            App do Morador
          </p>
        </div>

        <div className="mt-8 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        <p className="text-xs text-white/50 mt-4">
          Preparando seu aplicativo...
        </p>
      </div>
    </div>
  );
}