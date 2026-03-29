import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
}

export const useAIModels = () => {
  return useQuery({
    queryKey: queryKeys.aiModels,
    queryFn: async () => {
      const { data } = await axiosClient.get<AIModel[]>('/ai/models');
      return data;
    },
  });
};

// Chat History Types
export interface ChatMessage {
  id: string;
  document_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  persona_id?: string;
  produto_id?: string;
  voz_id?: string;
  created_at: string;
}

interface ChatHistoryResponse {
  messages: ChatMessage[];
  total_count: number;
  has_more: boolean;
}

// Hook to fetch chat history for a document
export const useDocumentChatHistory = (documentId: string) => {
  return useQuery({
    queryKey: queryKeys.documentChatHistory(documentId),
    queryFn: async () => {
      const { data } = await axiosClient.get<ChatHistoryResponse>(
        `/documents/${documentId}/chat/history`
      );
      return data;
    },
    enabled: !!documentId,
    staleTime: 0, // Always refetch when navigating back
  });
};

// Hook to clear chat history
export const useClearDocumentChatHistory = (documentId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.delete<{ message: string; deleted_count: number }>(
        `/documents/${documentId}/chat/history`
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate chat history to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.documentChatHistory(documentId) });
    },
  });
};

interface ChatPayload {
  message: string;
  model: string;
  persona_id?: string;
  produto_id?: string;
  voz_id?: string;
}

interface ChatResponse {
  response: string;
  message_id?: string;
}

export const useDocumentChat = (documentId: string, projectId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ChatPayload) => {
      const { data } = await axiosClient.post<ChatResponse>(
        `/documents/${documentId}/chat`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      // Invalidate chat history to show new messages
      queryClient.invalidateQueries({ queryKey: queryKeys.documentChatHistory(documentId) });
      // Invalidate stats to update AI usage count
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
      }
    },
  });
};
