import { useQuery } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

export interface SubscriptionLimits {
  max_projects?: number;
  max_inspirations_per_project?: number;
  max_ai_requests_daily?: number;
  max_team_members?: number;
  max_prompts?: number;
  max_dna_per_category?: number;
}

export interface SubscriptionFeatures {
  ai_generation?: boolean;
  templates?: boolean;
  export?: boolean;
  analytics?: boolean;
  priority_support?: boolean;
}

export interface SubscriptionInfo {
  plan_id: string | null;
  plan_name: string;
  plan_slug: string;
  status: string;
  is_active: boolean;
  limits: SubscriptionLimits;
  features: SubscriptionFeatures;
  usage: {
    projects?: number;
    storage_bytes?: number;
    files?: number;
  };
}

export const useSubscription = () => {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: async () => {
      const { data } = await axiosClient.get<SubscriptionInfo>('/hub/me/subscription');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

// Helper to check if user is on starter tier (lowest paid plan)
export const useIsStarterUser = () => {
  const { data: subscription, isLoading } = useSubscription();

  return {
    isStarter: !subscription || !subscription.is_active || subscription.plan_slug.includes('starter'),
    isLoading,
    subscription,
  };
};

// Helper to check if user has an active paid subscription
export const useHasPaidSubscription = () => {
  const { data: subscription, isLoading } = useSubscription();

  // User has paid subscription if plan_id is not null (has actual Stripe subscription)
  const hasPaid = subscription?.plan_id !== null && subscription?.is_active === true;

  return {
    hasPaid,
    isLoading,
    subscription,
  };
};
