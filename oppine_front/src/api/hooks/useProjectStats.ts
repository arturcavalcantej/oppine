import { useQuery } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

export interface UsageMetric {
  current: number;
  limit: number;
  period?: string;
}

export interface ProjectStats {
  usage: {
    messages?: UsageMetric;
    businesses?: UsageMetric;
  };
  totals: {
    businesses: number;
    feedback_requests: number;
    feedback_responses: number;
    positive_reviews: number;
    negative_alerts: number;
  };
  subscription: {
    tier: string;
    plan_slug: string;
    plan_name: string;
    status: string;
    period_end: string | null;
  };
}

export const useProjectStats = (projectId: string) => {
  return useQuery({
    queryKey: queryKeys.projectStats(projectId),
    queryFn: async () => {
      const { data } = await axiosClient.get<ProjectStats>(`/projects/${projectId}/stats`);
      return data;
    },
    enabled: !!projectId,
  });
};

// Templates fetched directly from project (no business required)
export interface ProjectTemplate {
  id: string;
  name: string;
  initial_message: string;
  thank_you_promoter?: string;
  thank_you_passive?: string;
  thank_you_detractor?: string;
  testimonial_request?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export const useProjectTemplates = (projectId: string) => {
  return useQuery({
    queryKey: ['projectTemplates', projectId],
    queryFn: async () => {
      const { data } = await axiosClient.get<ProjectTemplate[]>(`/projects/${projectId}/templates`);
      return data;
    },
    enabled: !!projectId,
  });
};
