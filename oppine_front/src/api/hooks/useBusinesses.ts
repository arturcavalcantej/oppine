import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

// ============================================================================
// Types
// ============================================================================

export interface Business {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  address?: string;
  google_place_id?: string;
  google_review_url?: string;
  whatsapp_phone?: string;
  whatsapp_instance_id?: string;
  alert_phone?: string;
  alert_email?: string;
  nps_message?: string;
  promoter_threshold: number;
  detractor_threshold: number;
  is_active: boolean;
  template_id?: string;
  auto_send_enabled: boolean;
  created_at: string;
  updated_at?: string;
  // Webhook integration
  webhook_token?: string;
  webhook_url?: string;
  // Stats
  total_feedback_requests: number;
  total_responses: number;
  average_score?: number;
  promoter_count: number;
  detractor_count: number;
}

// Webhook types
export interface WebhookInfo {
  webhook_token: string;
  webhook_url: string;
  test_url: string;
  example_payload: Record<string, unknown>;
}

export interface WebhookConfig {
  phone_field: string;
  name_field: string;
  email_field: string;
  phone_alternatives: string[];
  name_alternatives: string[];
  metadata_fields: string[];
}

export interface WebhookConfigResponse {
  webhook_token: string;
  webhook_url: string;
  config: WebhookConfig;
}

export interface WebhookTestRequest {
  payload: Record<string, unknown>;
}

export interface WebhookTestResponse {
  success: boolean;
  extracted_data: {
    phone?: string;
    phone_raw?: string;
    name?: string;
    email?: string;
    metadata: Record<string, unknown>;
  };
  extraction_log: string[];
  would_create_request: boolean;
  message: string;
}

export interface BusinessCreate {
  project_id: string;
  name: string;
  description?: string;
  address?: string;
  google_place_id?: string;
  google_review_url?: string;
  whatsapp_phone?: string;
  whatsapp_instance_id?: string;
  alert_phone?: string;
  alert_email?: string;
  nps_message?: string;
  promoter_threshold?: number;
  detractor_threshold?: number;
  template_id?: string;
}

export interface BusinessUpdate {
  name?: string;
  description?: string;
  address?: string;
  google_place_id?: string;
  google_review_url?: string;
  whatsapp_phone?: string;
  whatsapp_instance_id?: string;
  alert_phone?: string;
  alert_email?: string;
  nps_message?: string;
  promoter_threshold?: number;
  detractor_threshold?: number;
  is_active?: boolean;
  auto_send_enabled?: boolean;
  template_id?: string;
}

export interface FeedbackTemplate {
  id: string;
  project_id?: string;
  business_id?: string;
  name: string;
  pre_message?: string;
  initial_message: string;
  thank_you_promoter?: string;
  thank_you_passive?: string;
  thank_you_detractor?: string;
  testimonial_request?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface TemplateCreate {
  name: string;
  pre_message?: string;
  initial_message: string;
  thank_you_promoter?: string;
  thank_you_passive?: string;
  thank_you_detractor?: string;
  testimonial_request?: string;
  is_default?: boolean;
}

export interface TemplateUpdate {
  name?: string;
  pre_message?: string;
  initial_message?: string;
  thank_you_promoter?: string;
  thank_you_passive?: string;
  thank_you_detractor?: string;
  testimonial_request?: string;
  is_default?: boolean;
  is_active?: boolean;
}

// ============================================================================
// Business Hooks
// ============================================================================

export const useBusinesses = (projectId: string) => {
  return useQuery({
    queryKey: queryKeys.businesses(projectId),
    queryFn: async () => {
      const { data } = await axiosClient.get<Business[]>('/businesses', {
        params: { project_id: projectId },
      });
      return data;
    },
    enabled: !!projectId,
  });
};

export const useBusiness = (businessId: string) => {
  return useQuery({
    queryKey: queryKeys.business(businessId),
    queryFn: async () => {
      const { data } = await axiosClient.get<Business>(`/businesses/${businessId}`);
      return data;
    },
    enabled: !!businessId,
  });
};

export const useCreateBusiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BusinessCreate) => {
      const { data } = await axiosClient.post<Business>('/businesses', payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businesses(data.project_id) });
    },
  });
};

export const useUpdateBusiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ businessId, payload }: { businessId: string; payload: BusinessUpdate }) => {
      const { data } = await axiosClient.patch<Business>(`/businesses/${businessId}`, payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businesses(data.project_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.business(data.id) });
    },
  });
};

export const useDeleteBusiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ businessId, projectId }: { businessId: string; projectId: string }) => {
      await axiosClient.delete(`/businesses/${businessId}`);
      return { businessId, projectId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businesses(data.projectId) });
    },
  });
};

// ============================================================================
// Template Hooks
// ============================================================================

export const useTemplates = (businessId: string) => {
  return useQuery({
    queryKey: queryKeys.businessTemplates(businessId),
    queryFn: async () => {
      const { data } = await axiosClient.get<FeedbackTemplate[]>(
        `/businesses/${businessId}/templates`
      );
      return data;
    },
    enabled: !!businessId,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ businessId, payload }: { businessId: string; payload: TemplateCreate }) => {
      const { data } = await axiosClient.post<FeedbackTemplate>(
        `/businesses/${businessId}/templates`,
        payload
      );
      return { data, businessId };
    },
    onSuccess: ({ businessId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessTemplates(businessId) });
    },
  });
};

export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      businessId,
      templateId,
      payload,
    }: {
      businessId: string;
      templateId: string;
      payload: TemplateUpdate;
    }) => {
      const { data } = await axiosClient.patch<FeedbackTemplate>(
        `/businesses/${businessId}/templates/${templateId}`,
        payload
      );
      return { data, businessId };
    },
    onSuccess: ({ businessId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessTemplates(businessId) });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ businessId, templateId }: { businessId: string; templateId: string }) => {
      await axiosClient.delete(`/businesses/${businessId}/templates/${templateId}`);
      return { businessId, templateId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businessTemplates(data.businessId) });
    },
  });
};

// ============================================================================
// Webhook Hooks
// ============================================================================

export const useWebhookInfo = (businessId: string) => {
  return useQuery({
    queryKey: ['webhook', businessId],
    queryFn: async () => {
      const { data } = await axiosClient.get<WebhookInfo>(`/businesses/${businessId}/webhook`);
      return data;
    },
    enabled: !!businessId,
  });
};

export const useRegenerateWebhookToken = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessId: string) => {
      const { data } = await axiosClient.post<WebhookInfo>(
        `/businesses/${businessId}/webhook/regenerate`
      );
      return { businessId, data };
    },
    onSuccess: ({ businessId }) => {
      queryClient.invalidateQueries({ queryKey: ['webhook', businessId] });
    },
  });
};

export const useWebhookConfig = (webhookToken: string) => {
  return useQuery({
    queryKey: ['webhookConfig', webhookToken],
    queryFn: async () => {
      const { data } = await axiosClient.get<WebhookConfigResponse>(
        `/api/v1/inbound/${webhookToken}/config`
      );
      return data;
    },
    enabled: !!webhookToken,
  });
};

export const useUpdateWebhookConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      webhookToken,
      config,
    }: {
      webhookToken: string;
      config: Partial<WebhookConfig>;
    }) => {
      const { data } = await axiosClient.patch<WebhookConfigResponse>(
        `/api/v1/inbound/${webhookToken}/config`,
        config
      );
      return { webhookToken, data };
    },
    onSuccess: ({ webhookToken }) => {
      queryClient.invalidateQueries({ queryKey: ['webhookConfig', webhookToken] });
    },
  });
};

export const useTestWebhookPayload = () => {
  return useMutation({
    mutationFn: async ({
      webhookToken,
      payload,
    }: {
      webhookToken: string;
      payload: Record<string, unknown>;
    }) => {
      const { data } = await axiosClient.post<WebhookTestResponse>(
        `/api/v1/inbound/${webhookToken}/test`,
        { payload }
      );
      return data;
    },
  });
};
