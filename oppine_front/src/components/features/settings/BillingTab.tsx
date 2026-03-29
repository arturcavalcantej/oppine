import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, Sparkles, Check, ExternalLink, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/api/hooks/useSubscription';
import { useProjectStats } from '@/api/hooks/useProjectStats';
import { useProjects } from '@/api/hooks/useProjects';
import { axiosClient } from '@/api/axiosClient';
import { queryKeys } from '@/api/queryKeys';
import { PLAN_FEATURES_BY_TIER, TIER_COLORS, extractTierFromSlug } from '@/config/plans';
import PricingModal from '@/components/modules/PricingModal';

interface ProgressBarProps {
  label: string;
  current: number;
  limit: number;
  period?: string;
}

function ProgressBar({ label, current, limit, period }: ProgressBarProps) {
  const { t } = useTranslation();
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  const periodLabels: Record<string, string> = {
    daily: t('billing.perDay', '/dia'),
    weekly: t('billing.perWeek', '/semana'),
    monthly: t('billing.perMonth', '/mês'),
    unlimited: '',
  };

  const periodLabel = period ? periodLabels[period] || '' : '';

  return (
    <div className="px-6 py-4">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-slate-500">
          {label}
          {periodLabel && <span className="text-xs ml-1 opacity-70">{periodLabel}</span>}
        </span>
        <span
          className={cn(
            'font-medium',
            isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-slate-900'
          )}
        >
          {isUnlimited ? '∞' : `${current}/${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-primary'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingTab() {
  const { t } = useTranslation();
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: subscription, isLoading: loadingSubscription } = useSubscription();
  const { data: projects, isLoading: loadingProjects } = useProjects();

  // Use projectId from URL or fallback to first project
  const projectId = urlProjectId || projects?.[0]?.id;

  const { data: stats } = useProjectStats(projectId || '');
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  // Tratar retorno do Stripe checkout
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
      toast.success(t('billing.subscriptionSuccess', 'Assinatura realizada com sucesso!'));
      searchParams.delete('success');
      setSearchParams(searchParams, { replace: true });
    }

    if (canceled === 'true') {
      toast(t('billing.checkoutCanceled', 'Checkout cancelado. Você pode tentar novamente quando quiser.'), {
        icon: 'ℹ️',
      });
      searchParams.delete('canceled');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient, t]);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data } = await axiosClient.post<{ url: string }>('/hub/billing/portal', {
        return_url: window.location.href
      });
      setLoadingPortal(false);
      window.location.href = data.url;
    } catch (error) {
      console.error('Failed to open billing portal:', error);
      setLoadingPortal(false);
    }
  };

  // Wait for subscription and projects to load
  if (loadingSubscription || loadingProjects) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Use subscription data as source of truth (from /hub/me/subscription)
  const planName = subscription?.plan_name || 'Starter';
  const planSlug = subscription?.plan_slug || 'oppine-starter-monthly';
  const isActive = subscription?.is_active ?? true;
  const isStarter = planSlug.includes('starter');

  // Derive tier from slug for visual styling only
  const tier = extractTierFromSlug(planSlug);
  const planFeatures = PLAN_FEATURES_BY_TIER[tier] || PLAN_FEATURES_BY_TIER.starter;

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('billing.currentPlan')}</p>
                <h3 className="text-lg font-semibold text-slate-900">{planName}</h3>
              </div>
            </div>
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium',
                TIER_COLORS[tier] || TIER_COLORS.starter
              )}
            >
              {isActive ? t('billing.active') : t('billing.inactive')}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-wrap gap-3">
          <Button onClick={() => setShowPricingModal(true)}>
            <Sparkles className="w-4 h-4" />
            {isStarter ? t('billing.upgrade') : t('billing.changePlan')}
          </Button>
          {!isStarter && (
            <Button
              variant="outline"
              onClick={handleManageSubscription}
              disabled={loadingPortal}
            >
              {loadingPortal ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              {t('billing.manageSubscription')}
            </Button>
          )}
        </div>
      </div>

      {/* Usage Section */}
      {stats && (
        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">{t('billing.usage', 'Uso')}</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.usage?.messages && (
              <ProgressBar
                label={t('billing.messages', 'Envios')}
                current={stats.usage.messages.current}
                limit={stats.usage.messages.limit}
                period={stats.usage.messages.period}
              />
            )}
            {stats.usage?.businesses && (
              <ProgressBar
                label={t('billing.businesses', 'Negócios')}
                current={stats.usage.businesses.current}
                limit={stats.usage.businesses.limit}
              />
            )}
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">{t('billing.includedFeatures')}</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {planFeatures.map((featureKey) => (
            <div key={featureKey} className="flex items-center gap-3 px-6 py-3">
              <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-green-600" />
              </div>
              <span className="text-sm text-slate-700">{t(featureKey)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Modal */}
      {projectId && (
        <PricingModal
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
          projectId={projectId}
        />
      )}
    </div>
  );
}
