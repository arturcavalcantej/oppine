import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

export interface Document {
  id: string;
  title: string;
  folder_id: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
  current_version?: number;
  inspiration_count?: number;
}

export const useDocuments = (projectId: string, inspirationIds?: string[]) => {
  return useQuery({
    queryKey: queryKeys.documents(projectId, inspirationIds),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (inspirationIds?.length) {
        params.inspiration_ids = inspirationIds.join(',');
      }
      const { data } = await axiosClient.get<Document[]>(`/projects/${projectId}/documents`, { params });
      return data;
    },
    enabled: !!projectId,
  });
};

export const useDocument = (documentId: string) => {
  return useQuery({
    queryKey: queryKeys.document(documentId),
    queryFn: async () => {
      const { data } = await axiosClient.get<Document>(`/documents/${documentId}`);
      return data;
    },
    enabled: !!documentId,
  });
};

interface CreateDocumentPayload {
  title: string;
  folder_id?: string | null;
  content?: string | null;
  inspiration_ids?: string[];
}

export const useCreateDocument = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateDocumentPayload) => {
      const { data } = await axiosClient.post<Document>(
        `/projects/${projectId}/documents`,
        { ...payload, content: payload.content ?? null }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};

interface UpdateDocumentPayload {
  documentId: string;
  title?: string;
  content?: string;
  folder_id?: string | null;
}

export const useUpdateDocument = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, ...payload }: UpdateDocumentPayload) => {
      const { data } = await axiosClient.patch<Document>(`/documents/${documentId}`, payload);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.document(data.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId) });
    },
  });
};

export const useDeleteDocument = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      await axiosClient.delete(`/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};

// Document inspirations - returns full Inspiration objects
export interface LinkedInspiration {
  id: string;
  type: string;
  url: string;
  thumbnail: string | null;
  description: string | null;
  owner_username: string | null;
  tags: string | null;
  stored_media_urls: string | null;
}

export const useDocumentInspirations = (documentId: string) => {
  return useQuery({
    queryKey: queryKeys.documentInspirations(documentId),
    queryFn: async () => {
      const { data } = await axiosClient.get<LinkedInspiration[]>(
        `/documents/${documentId}/inspirations`
      );
      return data;
    },
    enabled: !!documentId,
  });
};

export const useAddDocumentInspiration = (documentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inspirationId: string) => {
      const { data } = await axiosClient.post<LinkedInspiration>(
        `/documents/${documentId}/inspirations/${inspirationId}`
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documentInspirations(documentId) });
    },
  });
};

export const useRemoveDocumentInspiration = (documentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inspirationId: string) => {
      await axiosClient.delete(`/documents/${documentId}/inspirations/${inspirationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documentInspirations(documentId) });
    },
  });
};
