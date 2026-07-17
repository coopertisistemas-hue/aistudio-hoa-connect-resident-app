import type { ReactNode } from 'react';
import BottomNav from '@/components/feature/BottomNav';
import OfflineBanner from '@/components/base/OfflineBanner';
import ToastContainer from '@/components/base/Toast';

interface AppShellProps {
  children: ReactNode;
  noPadding?: boolean;
}

export default function AppShell({ children, noPadding = false }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background-50 max-w-app mx-auto relative">
      <OfflineBanner />
      <main className={noPadding ? '' : 'px-4 pt-4'} style={{ paddingBottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}>
        {children}
      </main>
      <BottomNav />
      <ToastContainer />
    </div>
  );
}