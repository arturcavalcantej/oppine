import { axiosClient } from '@/api/axiosClient';
import { queryKeys } from '@/api/queryKeys';
import { getPlanFeatures, isYearlyPlan } from '@/config/plans';
import { clearRecommendedPlan } from '@/lib/recommendedPlan';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Crown, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface PostAuthPlanModalProps {
  isOpen: boolean;
  recommendedPlan?: string;
}

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

export default function PostAuthPlanModal({
  isOpen,
  recommendedPlan,
}: PostAuthPlanModalProps) {
  const { t } = useTranslation();

  // Auto-detect billing period from recommendedPlan slug
  const getInitialBillingPeriod = (): 'MONTHLY' | 'YEARLY' => {
    if (recommendedPlan) {
      if (recommendedPlan.includes('yearly') || recommendedPlan.includes('annual')) {
        return 'YEARLY';
      }
    }
    return 'MONTHLY';
  };

  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>(
    getInitialBillingPeriod
  );
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Reset billing period when recommendedPlan changes
  useEffect(() => {
    setBillingPeriod(getInitialBillingPeriod());
  }, [recommendedPlan]);

  // Fetch plans from Hub
  const { data: plansData, isLoading, refetch } = useQuery({
    queryKey: [...queryKeys.pricing, 'hub'],
    queryFn: async () => {
      const { data } = await axiosClient.get<PlansResponse>('/hub/billing/plans');
      return data;
    },
    enabled: isOpen,
  });

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (planSlug: string) => {
      const { data } = await axiosClient.post<{ url: string }>(
        '/hub/billing/checkout',
        {
          plan_slug: planSlug,
          success_url: `${window.location.origin}/dashboard?checkout=success`,
          cancel_url: `${window.location.origin}/dashboard?checkout=canceled`,
        }
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        clearRecommendedPlan();
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Falha ao iniciar checkout');
      setLoadingPlan(null);
    },
  });

  if (!isOpen) return null;

  // Filter plans by billing period and exclude free, sorted by price
  const paidPlans =
    plansData?.plans
      .filter(
        (plan) => plan.billing_period === billingPeriod && !plan.slug.includes('free')
      )
      .sort((a, b) => {
        const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
        const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
        return priceA - priceB;
      }) || [];

  // Determine which plan to highlight
  const getRecommendedPlanSlug = (): string | null => {
    if (recommendedPlan) {
      const basePlan = recommendedPlan
        .replace('-monthly', '')
        .replace('-yearly', '')
        .replace('-annual', '');
      const targetSlug = `${basePlan}-${billingPeriod.toLowerCase()}`;
      const exists = paidPlans.some((p) => p.slug === targetSlug);
      if (exists) return targetSlug;
      if (paidPlans.some((p) => p.slug === recommendedPlan)) return recommendedPlan;
    }
    return paidPlans.length > 0 ? paidPlans[paidPlans.length - 1].slug : null;
  };

  const recommendedPlanSlug = getRecommendedPlanSlug();

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
      return `R$${monthly.toFixed(2).replace('.', ',')}/mês`;
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - no onClick handler */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative bg-white rounded-xl ring-1 ring-slate-900/5 shadow-xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header - no X button */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-primary to-primary-hover">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white flex items-center justify-center gap-2">
              <Crown className="w-5 h-5" />
              Escolha o melhor plano para você
            </h2>
            <p className="text-sm text-white/80 mt-0.5">
              Desbloqueie todo o potencial do Oppine com nossos planos pagos.
            </p>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center px-6 pt-5 pb-0 bg-slate-50">
          <div className="inline-flex items-center rounded-lg bg-slate-200/70 p-1">
            <button
              onClick={() => setBillingPeriod('MONTHLY')}
              className={cn(
                'px-5 py-2 rounded-md text-sm font-medium transition-all',
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
                'px-5 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
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
        <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">Carregando planos...</span>
            </div>
          ) : plansData ? (
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
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
                      <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                    </div>
                    <p className="text-sm text-slate-500">{plan.description}</p>

                    <div className="mt-4 flex items-baseline">
                      {isYearly && monthlyEquivalent ? (
                        <>
                          <span className={cn(
                            'text-4xl font-extrabold tracking-tight',
                            isRecommended ? 'text-primary' : 'text-slate-900'
                          )}>
                            {monthlyEquivalent.replace('/mês', '')}
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
                    >
                      {loadingPlan === plan.slug ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Assinar Agora
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 px-6">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Crown className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Erro ao carregar planos</h3>
              <p className="text-sm text-slate-500 mt-1">Não foi possível carregar os planos. Tente novamente.</p>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 text-center text-xs text-slate-500">
          Pagamento seguro via Stripe. Cancele quando quiser.
        </div>
      </div>
    </div>,
    document.body
  );
}
