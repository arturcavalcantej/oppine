import { useState, useEffect } from 'react';
import { useUIStore } from '@/contexts/uiStore';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import GuidedTour from './GuidedTour';

export default function DashboardLayout() {
  const { sidebarCollapsed } = useUIStore();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTour, setShowTour] = useState(false);

  // Check for tour=1 query param (set after onboarding)
  useEffect(() => {
    if (searchParams.get('tour') === '1' && location.pathname === '/dashboard') {
      setShowTour(true);
      // Remove the query param from URL without navigation
      searchParams.delete('tour');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, location.pathname]);

  const handleTourComplete = () => {
    setShowTour(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className={`${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'} min-h-screen transition-all duration-300 pt-16 lg:pt-0`}>
        <Outlet />
      </main>
      <GuidedTour isActive={showTour} onComplete={handleTourComplete} />
    </div>
  );
}
