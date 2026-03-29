import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/contexts/authStore';
import { useHasPaidSubscription } from '@/api/hooks/useSubscription';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute() {
  const { user, loading: authLoading } = useAuthStore();
  const { hasPaid, isLoading: subscriptionLoading } = useHasPaidSubscription();
  const location = useLocation();

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Show loading while checking subscription (only after auth confirmed)
  if (subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to plan selection if user doesn't have a paid subscription
  if (!hasPaid) {
    return <Navigate to="/select-plan" replace />;
  }

  // Redirect to onboarding if user explicitly hasn't completed it
  // Use === false to avoid redirecting users with old cached data (undefined)
  if (user.has_completed_onboarding === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
