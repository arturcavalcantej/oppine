import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { lazy, Suspense, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';

import { queryClient } from '@/api/queryClient';
import GlobalUpgradeModal from '@/components/modules/GlobalUpgradeModal';
import { useAuthStore } from '@/contexts/authStore';

// Layouts and Guards
import DashboardLayout from '@/components/modules/DashboardLayout';
import ProtectedRoute from '@/components/modules/ProtectedRoute';

// Pages - Lazy loaded
const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Settings = lazy(() => import('@/pages/Settings'));
const Templates = lazy(() => import('@/pages/Templates'));
const FAQ = lazy(() => import('@/pages/FAQ'));
const SelectPlan = lazy(() => import('@/pages/SelectPlan'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const PublicFeedback = lazy(() => import('@/pages/PublicFeedback'));
const FeedbackForm = lazy(() => import('@/pages/FeedbackForm'));

// Loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#FAFAF9]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  );
}

// JWT auth initializer
function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <>{children}</>;
}

// Smart redirect
function SmartRedirect() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return null;
  }

  return <Navigate to={user ? '/dashboard' : '/'} replace />;
}

// Redirect /offer to /register
function OfferRedirect() {
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  return <Navigate to={`/register${queryString ? `?${queryString}` : ''}`} replace />;
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/select-plan" element={<SelectPlan />} />
                <Route path="/offer" element={<OfferRedirect />} />
                {/* QR Code public pages hidden for now
                <Route path="/feedback/:businessId" element={<PublicFeedback />} />
                <Route path="/f/:requestId" element={<FeedbackForm />} />
                */}

                {/* Protected Routes */}
                <Route element={<ProtectedRoute />}>
                  {/* Onboarding - full screen, no sidebar */}
                  <Route path="/onboarding" element={<Onboarding />} />

                  <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/dashboard/templates" element={<Templates />} />
                    <Route path="/dashboard/faq" element={<FAQ />} />
                    <Route path="/dashboard/settings" element={<Settings />} />
                  </Route>
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<SmartRedirect />} />
              </Routes>
            </Suspense>

            <GlobalUpgradeModal />
          </BrowserRouter>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1E293B',
                color: '#fff',
                borderRadius: '12px',
                padding: '12px 16px',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>

        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
