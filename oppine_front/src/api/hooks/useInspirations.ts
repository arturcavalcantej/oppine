import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

export interface Inspiration {
  id: string;
  type: string;
  url: string;
  thumbnail?: string;
  stored_media_urls?: string;
  description?: string;
  owner_username?: string;
  likes_count?: number;
  comments_count?: number;
  tags?: string;
  notes?: string;
  transcription?: string;
  audio_transcription?: string;
  post_timestamp?: string;
  location?: string;
  created_at: string;
}

export interface InspirationFilters {
  search?: string;
  type?: string;
  profile?: string;
  tags?: string[];
  date_from?: string;
  date_to?: string;
  min_likes?: number | null;
  min_comments?: number | null;
}

export const useInspirations = (projectId: string, filters?: InspirationFilters) => {
  return useQuery({
    queryKey: [...queryKeys.inspirations(projectId), filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.append('search', filters.search);
      if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
      if (filters?.profile) params.append('profile', filters.profile);
      if (filters?.tags?.length) params.append('tags', filters.tags.join(','));
      if (filters?.date_from) params.append('date_from', filters.date_from);
      if (filters?.date_to) params.append('date_to', filters.date_to);
      if (filters?.min_likes !== null && filters?.min_likes !== undefined)
        params.append('min_likes', filters.min_likes.toString());
      if (filters?.min_comments !== null && filters?.min_comments !== undefined)
        params.append('min_comments', filters.min_comments.toString());

      const queryString = params.toString();
      const url = `/projects/${projectId}/inspirations${queryString ? `?${queryString}` : ''}`;

      const { data } = await axiosClient.get<Inspiration[]>(url);
      return data;
    },
    enabled: !!projectId,
  });
};

export const useInspiration = (inspirationId: string) => {
  return useQuery({
    queryKey: queryKeys.inspiration(inspirationId),
    queryFn: async () => {
      const { data } = await axiosClient.get<Inspiration>(`/inspirations/${inspirationId}`);
      return data;
    },
    enabled: !!inspirationId,
  });
};

interface CreateInspirationPayload {
  url: string;
  tags?: string;
  notes?: string;
}

export const useCreateInspiration = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateInspirationPayload) => {
      const { data } = await axiosClient.post<Inspiration>(
        `/projects/${projectId}/inspirations`,
        { type: 'post', ...payload }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspirations(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};

interface UpdateInspirationPayload {
  tags?: string;
  notes?: string;
}

export const useUpdateInspiration = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inspirationId, ...payload }: UpdateInspirationPayload & { inspirationId: string }) => {
      const { data } = await axiosClient.patch<Inspiration>(
        `/inspirations/${inspirationId}`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspirations(projectId) });
    },
  });
};

export const useDeleteInspiration = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inspirationId: string) => {
      await axiosClient.delete(`/inspirations/${inspirationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inspirations(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};

export const useRelevantInspirations = (projectId: string, days: number = 30, limit: number = 8) => {
  return useQuery({
    queryKey: ['inspirations', projectId, 'relevant', { days, limit }],
    queryFn: async () => {
      const { data } = await axiosClient.get<Inspiration[]>(
        `/projects/${projectId}/inspirations/relevant`,
        { params: { days, limit } }
      );
      return data;
    },
    enabled: !!projectId,
  });
};
