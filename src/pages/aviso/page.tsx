import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';

export default function AvisoRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/avisos', { replace: true });
  }, [navigate]);

  return (
    <AppShell>
      <div className="flex items-center justify-center py-20">
        <i className="ri-loader-4-line animate-spin text-2xl text-foreground-400" />
      </div>
    </AppShell>
  );
}