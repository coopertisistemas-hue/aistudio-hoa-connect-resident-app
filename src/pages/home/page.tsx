import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import { useHomeData } from '@/hooks/useHomeData';
import { SkeletonCard } from '@/components/base/Skeleton';
import EmptyState from '@/components/base/EmptyState';
import Button from '@/components/base/Button';
import { showToast } from '@/components/base/Toast';
import HomeHeader from '@/pages/home/components/HomeHeader';
import ResidenceContextCard from '@/pages/home/components/ResidenceContextCard';
import PrimaryStatusCard from '@/pages/home/components/PrimaryStatusCard';
import QuickActions from '@/pages/home/components/QuickActions';
import ConsumptionPreviewCard from '@/pages/home/components/ConsumptionPreviewCard';
import NoticePreviewCard from '@/pages/home/components/NoticePreviewCard';
import SupportPreviewCard from '@/pages/home/components/SupportPreviewCard';
import RecentActivityCard from '@/pages/home/components/RecentActivityCard';
import { useRef, useState, useCallback } from 'react';
import HomeDemoControls from '@/demo/HomeDemoControls';
import { activeScenario, setScenario, type ScenarioKey } from '@/fixtures/scenarios';

export default function HomePage() {
  const navigate = useNavigate();
  const { data, loading, refreshing, error, isOffline, refresh } = useHomeData();
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullThreshold = 80;
  const [scenario, setScenarioState] = useState<ScenarioKey>(activeScenario);

  const handleScenarioChange = useCallback((key: ScenarioKey) => {
    setScenario(key);
    setScenarioState(key);
    refresh();
  }, [refresh]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      const diff = e.touches[0].clientY - touchStartY.current;
      if (diff > 0) {
        setIsPulling(true);
        setPullDistance(Math.min(diff * 0.4, 120));
      }
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= pullThreshold && !refreshing) {
      await refresh();
      showToast('Informações atualizadas para demonstração.', 'info');
    }
    setIsPulling(false);
    setPullDistance(0);
  }, [pullDistance, refreshing, refresh]);

  if (loading && !data) {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <SkeletonCard />
          </div>
          <SkeletonCard />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-background-300 animate-pulse" />
                <div className="w-14 h-3 rounded bg-background-300 animate-pulse" />
              </div>
            ))}
          </div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  if (error && !data && !isOffline) {
    return (
      <AppShell>
        <EmptyState
          icon="ri-error-warning-line"
          title="Algo deu errado"
          description={error}
          action={
            <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
              <i className="ri-refresh-line mr-1" />
              Tentar novamente
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div
        className="space-y-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isPulling && (
          <div
            className="flex items-center justify-center overflow-hidden transition-all duration-200"
            style={{ height: pullDistance, opacity: Math.min(pullDistance / pullThreshold, 1) }}
          >
            <div className="flex items-center gap-2 text-sm text-foreground-400">
              {pullDistance >= pullThreshold ? (
                <>
                  <i className="ri-arrow-up-line" />
                  <span>Solte para atualizar</span>
                </>
              ) : (
                <>
                  <i className="ri-arrow-down-line animate-pulse" />
                  <span>Puxe para atualizar</span>
                </>
              )}
            </div>
          </div>
        )}

        {refreshing && (
          <div className="flex items-center justify-center gap-2 py-2">
            <i className="ri-loader-4-line animate-spin text-primary-500" />
            <span className="text-xs text-foreground-400">Atualizando...</span>
          </div>
        )}

        <HomeHeader />
        <ResidenceContextCard />
        {data && (
          <>
            <PrimaryStatusCard status={data.primaryStatus} />
            <QuickActions />
            <ConsumptionPreviewCard data={data.consumptionPreview} />
            <NoticePreviewCard notice={data.noticePreview} />
            <SupportPreviewCard support={data.supportPreview} />
            <RecentActivityCard activities={data.recentActivity} />

            <p className="text-center text-[10px] text-foreground-300 pt-2 pb-1">
              HOA Connect · Demonstração local
            </p>
          </>
        )}
      </div>
      <HomeDemoControls currentScenario={scenario} onSelectScenario={handleScenarioChange} />
    </AppShell>
  );
}