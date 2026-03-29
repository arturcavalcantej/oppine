import { Logo } from '@/components/core/Logo';
import { axiosClient } from '@/api/axiosClient';
import { queryKeys } from '@/api/queryKeys';
import { getPlanFeatures, isYearlyPlan } from '@/config/plans';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/contexts/authStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Crown, Loader2, LogOut, Sparkles } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface HubPlan {
  id: number | string;
  name: string;
  slug: string;
  description: string;
  price: number | string;
  billing_period: 'MONTHLY' | 'YEARLY';
  features: Record<string, boolean | number>;
  limits: Record<string, number>;
  is_popular?: boolean;
}

interface PlansResponse {
  plans: HubPlan[];
}

export default function SelectPlan() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isAutoCheckout, setIsAutoCheckout] = useState(false);
  const isMountedRef = useRef(true);
  const pendingPlanRef = useRef<string | null>(null);

  // Fetch plans from Hub
  const { data: plansData, isLoading, refetch } = useQuery({
    queryKey: [...queryKeys.pricing, 'hub'],
    queryFn: async () => {
      const { data } = await axiosClient.get<PlansResponse>('/hub/billing/plans');
      return data;
    },
  });

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (planSlug: string) => {
      const { data } = await axiosClient.post<{ url: string }>(
        '/hub/billing/checkout',
        {
          plan_slug: planSlug,
          success_url: `${window.location.origin}/dashboard?checkout=success`,
          cancel_url: `${window.location.origin}/select-plan?checkout=canceled`,
        }
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        sessionStorage.removeItem('pendingCheckoutPlan');
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Falha ao iniciar checkout. Escolha um plano.');
      sessionStorage.removeItem('pendingCheckoutPlan');
      setLoadingPlan(null);
      setIsAutoCheckout(false);
    },
  });

  // Auto-checkout if there's a pending plan from registration
  useEffect(() => {
    isMountedRef.current = true;

    const pendingPlan = sessionStorage.getItem('pendingCheckoutPlan');
    console.log('SelectPlan mounted, pendingPlan:', pendingPlan); // Debug

    if (pendingPlan) {
      sessionStorage.removeItem('pendingCheckoutPlan');
      pendingPlanRef.current = pendingPlan;
    }

    if (pendingPlanRef.current) {
      const plan = pendingPlanRef.current;
      setIsAutoCheckout(true);
      setLoadingPlan(plan);

      setTimeout(() => {
        if (isMountedRef.current && pendingPlanRef.current) {
          console.log('Starting auto-checkout for plan:', plan); // Debug
          pendingPlanRef.current = null;
          checkoutMutation.mutate(plan);
        }
      }, 1500);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Filter plans by billing period, sorted by price
  const paidPlans =
    plansData?.plans
      .filter((plan) => plan.billing_period === billingPeriod)
      .sort((a, b) => {
        const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
        const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
        return priceA - priceB;
      }) || [];

  // Most expensive plan is recommended
  const recommendedPlanSlug = paidPlans.length > 0 ? paidPlans[paidPlans.length - 1].slug : null;

  const handleSubscribe = (plan: HubPlan) => {
    setLoadingPlan(plan.slug);
    checkoutMutation.mutate(plan.slug);
  };

  const formatPrice = (price: number | string): string => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `R$${numPrice.toFixed(2).replace('.', ',')}`;
  };

  const getMonthlyEquivalent = (plan: HubPlan): string | null => {
    if (plan.billing_period === 'YEARLY') {
      const price = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;
      const monthly = price / 12;
      return `R$${monthly.toFixed(2).replace('.', ',')}`;
    }
    return null;
  };

  const getFeatures = (plan: HubPlan): string[] => {
    const featureKeys = getPlanFeatures(plan.slug);
    const features = featureKeys.map((key) => t(key));
    if (isYearlyPlan(plan.slug)) {
      features.push(t('billing.features.twoMonthsFree'));
    }
    return features;
  };

  // Show loading screen during auto-checkout
  if (isAutoCheckout) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Preparando seu checkout...</h2>
          <p className="text-sm text-slate-500">Você será redirecionado para o pagamento em instantes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white ring-1 ring-slate-900/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo variant="full" size="lg" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <Crown className="w-4 h-4" />
            Bem-vindo ao Oppine!
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            Escolha seu plano para começar
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Selecione o plano ideal para o seu negócio e comece a transformar clientes em avaliações 5 estrelas.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center rounded-lg bg-slate-200/70 p-1">
            <button
              onClick={() => setBillingPeriod('MONTHLY')}
              className={cn(
                'px-6 py-2.5 rounded-md text-sm font-medium transition-all',
                billingPeriod === 'MONTHLY'
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingPeriod('YEARLY')}
              className={cn(
                'px-6 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                billingPeriod === 'YEARLY'
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              Anual
              <span className="bg-accent text-white text-xs px-2 py-0.5 rounded-full font-bold">
                2 meses grátis
              </span>
            </button>
          </div>
        </div>

        {/* Plans */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-sm text-slate-500">Carregando planos...</span>
          </div>
        ) : plansData ? (
          <div className="grid md:grid-cols-2 gap-6">
            {paidPlans.map((plan) => {
              const monthlyEquivalent = getMonthlyEquivalent(plan);
              const isYearly = plan.billing_period === 'YEARLY';
              const isRecommended = plan.slug === recommendedPlanSlug;

              return (
                <div
                  key={plan.slug}
                  className={cn(
                    'relative bg-white rounded-xl p-6 flex flex-col',
                    isRecommended
                      ? 'ring-2 ring-primary shadow-sm'
                      : 'ring-1 ring-slate-900/5'
                  )}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">
                        RECOMENDADO
                      </span>
                    </div>
                  )}

                  <div className={cn(
                    'flex items-center gap-2 mb-2',
                    isRecommended && 'mt-2'
                  )}>
                    <Crown className={cn(
                      'w-5 h-5',
                      isRecommended ? 'text-primary' : 'text-slate-400'
                    )} />
                    <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-slate-500">{plan.description}</p>

                  <div className="mt-4 flex items-baseline">
                    {isYearly && monthlyEquivalent ? (
                      <>
                        <span className={cn(
                          'text-4xl font-extrabold tracking-tight',
                          isRecommended ? 'text-primary' : 'text-slate-900'
                        )}>
                          {monthlyEquivalent}
                        </span>
                        <span className="ml-1 text-lg font-medium text-slate-500">/mês</span>
                      </>
                    ) : (
                      <>
                        <span className={cn(
                          'text-4xl font-extrabold tracking-tight',
                          isRecommended ? 'text-primary' : 'text-slate-900'
                        )}>
                          {formatPrice(plan.price)}
                        </span>
                        <span className="ml-1 text-lg font-medium text-slate-500">/mês</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {isYearly
                      ? `Cobrado ${formatPrice(plan.price)} anualmente`
                      : 'Cobrado mensalmente'}
                  </p>

                  <ul className="mt-6 space-y-3 flex-1">
                    {getFeatures(plan).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                        <span className="text-sm text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSubscribe(plan)}
                    disabled={!!loadingPlan}
                    className="mt-8 w-full"
                    size="lg"
                  >
                    {loadingPlan === plan.slug ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Assinar {plan.name}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 px-6 bg-white rounded-xl ring-1 ring-slate-900/5">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Crown className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Erro ao carregar planos</h3>
            <p className="text-sm text-slate-500 mt-1">
              Não foi possível carregar os planos. Tente novamente.
            </p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8">
          Pagamento seguro via Stripe. Cancele quando quiser.
        </p>
      </main>
    </div>
  );
}
