import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

// ============================================================================
// Types
// ============================================================================

export interface GoogleConversionStats {
  total_promoters: number;
  clicked_google_review: number;
  matched_reviews: number;
  total_google_reviews: number;
  click_rate: number;
  conversion_rate: number;
}

export interface DashboardStats {
  total_requests: number;
  total_responses: number;
  response_rate: number;
  average_score: number | null;
  nps_score: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  pending_alerts: number;
  resolved_issues: number;
  google_conversion: GoogleConversionStats | null;
}

export interface FeedbackRequest {
  id: string;
  business_id: string;
  template_id?: string;
  customer_name?: string;
  customer_phone: string;
  customer_email?: string;
  transaction_id?: string;
  transaction_date?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'responded' | 'expired' | 'failed';
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  created_at: string;
  response?: {
    score: number;
    classification: 'promoter' | 'passive' | 'detractor';
    comment?: string;
    responded_at?: string;
  };
}

export interface FeedbackResponse {
  id: string;
  request_id: string;
  score: number;
  classification: 'promoter' | 'passive' | 'detractor';
  comment?: string;
  testimonial_text?: string;
  testimonial_approved: boolean;
  google_review_clicked: boolean;
  google_review_completed: boolean;
  google_review_matched: boolean;
  google_review_matched_at?: string;
  alert_sent: boolean;
  issue_resolved: boolean;
  resolution_notes?: string;
  responded_at: string;
  customer_name?: string;
  customer_phone: string;
  business_name: string;
}

export interface FeedbackRequestCreate {
  business_id: string;
  template_id?: string;
  customer_name?: string;
  customer_phone: string;
  customer_email?: string;
  transaction_id?: string;
  transaction_date?: string;
  transaction_amount?: string;
  send_immediately?: boolean;
}

export interface FeedbackRequestBulkCreate {
  business_id: string;
  template_id?: string;
  customers: Array<{
    name?: string;
    phone: string;
    email?: string;
    transaction_id?: string;
  }>;
  send_immediately?: boolean;
}

// ============================================================================
// Dashboard Hooks
// ============================================================================

export const useDashboardStats = (businessId: string, days: number = 30) => {
  return useQuery({
    queryKey: queryKeys.feedbackDashboard(businessId, days),
    queryFn: async () => {
      const { data } = await axiosClient.get<DashboardStats>(
        `/feedback/dashboard/${businessId}`,
        { params: { days } }
      );
      return data;
    },
    enabled: !!businessId,
  });
};

// ============================================================================
// Feedback Request Hooks
// ============================================================================

export const useFeedbackRequests = (
  businessId: string,
  status?: string,
  limit: number = 50,
  offset: number = 0
) => {
  return useQuery({
    queryKey: queryKeys.feedbackRequests(businessId, status),
    queryFn: async () => {
      const { data } = await axiosClient.get<FeedbackRequest[]>('/feedback/requests', {
        params: { business_id: businessId, status, limit, offset },
      });
      return data;
    },
    enabled: !!businessId,
  });
};

export const useCreateFeedbackRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FeedbackRequestCreate) => {
      const { data } = await axiosClient.post<FeedbackRequest>('/feedback/requests', payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedbackRequests(data.business_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedbackDashboard(data.business_id),
      });
    },
  });
};

export const useCreateBulkFeedbackRequests = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: FeedbackRequestBulkCreate) => {
      const { data } = await axiosClient.post<{ created: number; failed: number }>(
        '/feedback/requests/bulk',
        payload
      );
      return { ...data, businessId: payload.business_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedbackRequests(data.businessId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedbackDashboard(data.businessId),
      });
    },
  });
};

export const useSendFeedbackRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, businessId }: { requestId: string; businessId: string }) => {
      const { data } = await axiosClient.post<{ success: boolean; message_id?: string; error?: string }>(
        `/feedback/requests/${requestId}/send`
      );
      return { ...data, businessId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedbackRequests(data.businessId),
      });
    },
  });
};

// ============================================================================
// Feedback Response Hooks
// ============================================================================

export const useFeedbackResponses = (
  businessId: string,
  classification?: 'promoter' | 'passive' | 'detractor',
  limit: number = 50,
  offset: number = 0
) => {
  return useQuery({
    queryKey: queryKeys.feedbackResponses(businessId, classification),
    queryFn: async () => {
      const { data } = await axiosClient.get<FeedbackResponse[]>('/feedback/responses', {
        params: { business_id: businessId, classification, limit, offset },
      });
      return data;
    },
    enabled: !!businessId,
  });
};

export const useResolveIssue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      responseId,
      businessId,
      resolutionNotes,
    }: {
      responseId: string;
      businessId: string;
      resolutionNotes?: string;
    }) => {
      const { data } = await axiosClient.patch<{ message: string }>(
        `/feedback/responses/${responseId}/resolve`,
        null,
        { params: { resolution_notes: resolutionNotes } }
      );
      return { ...data, businessId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedbackResponses(data.businessId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedbackDashboard(data.businessId),
      });
    },
  });
};

// ============================================================================
// Classification Helpers
// ============================================================================

export const getClassificationColor = (classification: string): string => {
  switch (classification) {
    case 'promoter':
      return 'text-green-700 bg-green-100';
    case 'passive':
      return 'text-slate-600 bg-slate-100';
    case 'detractor':
      return 'text-red-500 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const getClassificationLabel = (classification: string): string => {
  switch (classification) {
    case 'promoter':
      return 'Promotor';
    case 'passive':
      return 'Neutro';
    case 'detractor':
      return 'Detrator';
    default:
      return classification;
  }
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    sent: 'Enviado',
    delivered: 'Entregue',
    read: 'Lido',
    responded: 'Respondido',
    expired: 'Expirado',
    failed: 'Falhou',
  };
  return labels[status] || status;
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'responded':
      return 'text-green-600 bg-green-100';
    case 'sent':
    case 'delivered':
    case 'read':
      return 'text-blue-600 bg-blue-100';
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'expired':
    case 'failed':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};
