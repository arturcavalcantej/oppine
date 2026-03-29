import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

// ============================================================================
// Types
// ============================================================================

export interface GoogleConnection {
  connected: boolean;
  google_email?: string;
  sync_frequency?: string;
  last_synced_at?: string;
  is_active?: boolean;
  connection_error?: string;
}

export interface GoogleAccount {
  id: string;
  name: string;
}

export interface GoogleLocation {
  id: string;
  name: string;
}

export interface GoogleLocationLink {
  linked: boolean;
  google_account_id?: string;
  google_location_id?: string;
  google_location_name?: string;
}

export interface GoogleReview {
  id: string;
  google_review_id: string;
  reviewer_name?: string;
  star_rating?: number;
  review_text?: string;
  review_create_time?: string;
  matched_response_id?: string;
  match_confidence?: 'high' | 'medium' | 'low';
  match_method?: string;
  synced_at?: string;
}

export interface GoogleConversionStats {
  total_promoters: number;
  clicked_google_review: number;
  matched_reviews: number;
  total_google_reviews: number;
  click_rate: number;
  conversion_rate: number;
  confidence_breakdown: {
    high: number;
    medium: number;
    low: number;
  };
}

// ============================================================================
// Connection Hooks
// ============================================================================

export const useGoogleConnection = () => {
  return useQuery({
    queryKey: queryKeys.googleConnection,
    queryFn: async () => {
      const { data } = await axiosClient.get<GoogleConnection>('/google/connection');
      return data;
    },
    retry: false,
  });
};

export const useGoogleAuthUrl = () => {
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.get<{ url: string }>('/google/auth/url');
      return data;
    },
  });
};

export const useGoogleCallback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await axiosClient.post<GoogleConnection>('/google/auth/callback', {
        code,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.googleConnection });
    },
  });
};

export const useDisconnectGoogle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.delete('/google/connection');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.googleConnection });
      queryClient.invalidateQueries({ queryKey: queryKeys.googleAccounts });
    },
  });
};

// ============================================================================
// Account & Location Hooks
// ============================================================================

export const useGoogleAccounts = (enabled = false) => {
  return useQuery({
    queryKey: queryKeys.googleAccounts,
    queryFn: async () => {
      const { data } = await axiosClient.get<GoogleAccount[]>('/google/accounts');
      return data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (Google API has strict rate limits)
    retry: 1,
  });
};

export const useGoogleLocations = (accountId: string) => {
  return useQuery({
    queryKey: queryKeys.googleLocations(accountId),
    queryFn: async () => {
      const { data } = await axiosClient.get<GoogleLocation[]>(
        `/google/accounts/${accountId}/locations`
      );
      return data;
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

// ============================================================================
// Business-Location Linking Hooks
// ============================================================================

export const useGoogleLocationLink = (businessId: string) => {
  return useQuery({
    queryKey: queryKeys.googleLocationLink(businessId),
    queryFn: async () => {
      const { data } = await axiosClient.get<GoogleLocationLink>(
        `/google/businesses/${businessId}/link`
      );
      return data;
    },
    enabled: !!businessId,
  });
};

export const useLinkGoogleLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      businessId,
      googleAccountId,
      googleLocationId,
      googleLocationName,
    }: {
      businessId: string;
      googleAccountId: string;
      googleLocationId: string;
      googleLocationName?: string;
    }) => {
      const { data } = await axiosClient.post<GoogleLocationLink>(
        `/google/businesses/${businessId}/link`,
        {
          google_account_id: googleAccountId,
          google_location_id: googleLocationId,
          google_location_name: googleLocationName,
        }
      );
      return { ...data, businessId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.googleLocationLink(data.businessId),
      });
    },
  });
};

export const useUnlinkGoogleLocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessId: string) => {
      const { data } = await axiosClient.delete(`/google/businesses/${businessId}/link`);
      return { ...data, businessId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.googleLocationLink(data.businessId),
      });
    },
  });
};

// ============================================================================
// Settings Hook
// ============================================================================

export const useUpdateSyncFrequency = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (frequency: string) => {
      const { data } = await axiosClient.patch('/google/settings', { frequency });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.googleConnection });
    },
  });
};

// ============================================================================
// Reviews & Stats Hooks
// ============================================================================

export const useGoogleReviews = (businessId: string, limit = 50, offset = 0) => {
  return useQuery({
    queryKey: queryKeys.googleReviews(businessId),
    queryFn: async () => {
      const { data } = await axiosClient.get<{ total: number; reviews: GoogleReview[] }>(
        `/google/businesses/${businessId}/reviews`,
        { params: { limit, offset } }
      );
      return data;
    },
    enabled: !!businessId,
  });
};

export const useGoogleConversionStats = (businessId: string, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.googleConversionStats(businessId),
    queryFn: async () => {
      const { data } = await axiosClient.get<GoogleConversionStats>(
        `/google/businesses/${businessId}/conversion-stats`
      );
      return data;
    },
    enabled: !!businessId && enabled,
  });
};

export const useSyncGoogleReviews = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessId: string) => {
      const { data } = await axiosClient.post<{
        fetched?: number;
        new?: number;
        matched?: number;
        error?: string;
      }>(`/google/businesses/${businessId}/sync`);
      return { ...data, businessId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.googleReviews(data.businessId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.googleConversionStats(data.businessId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.feedbackDashboard(data.businessId),
      });
    },
  });
};
