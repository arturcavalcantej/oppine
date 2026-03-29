import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '@/api/axiosClient';
import { queryKeys } from '@/api/queryKeys';

// Types
export interface Prompt {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  content: string;
  description: string | null;
  is_favorite: boolean;
  variables: string[]; // Extracted from content, e.g., ["TEMA", "FORMATO"]
  created_at: string;
  updated_at: string | null;
}

interface CreatePromptInput {
  name: string;
  content: string;
  description?: string;
  is_favorite?: boolean;
}

interface UpdatePromptInput {
  id: string;
  name?: string;
  content?: string;
  description?: string;
  is_favorite?: boolean;
}

// Utility function to extract variables from prompt content (frontend)
export function extractVariables(content: string): string[] {
  const pattern = /\{([A-Z_][A-Z0-9_]*)\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = pattern.exec(content)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

// Query: List all prompts for a project
export const usePrompts = (projectId: string) => {
  return useQuery({
    queryKey: queryKeys.prompts(projectId),
    queryFn: async () => {
      const { data } = await axiosClient.get<Prompt[]>(
        `/projects/${projectId}/prompts`
      );
      return data;
    },
    enabled: !!projectId,
  });
};

// Query: List favorite prompts for a project
export const useFavoritePrompts = (projectId: string) => {
  return useQuery({
    queryKey: [...queryKeys.prompts(projectId), 'favorites'],
    queryFn: async () => {
      const { data } = await axiosClient.get<Prompt[]>(
        `/projects/${projectId}/prompts?favorites=true`
      );
      return data;
    },
    enabled: !!projectId,
  });
};

// Mutation: Create a new prompt
export const useCreatePrompt = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePromptInput) => {
      const { data } = await axiosClient.post<Prompt>(
        `/projects/${projectId}/prompts`,
        input
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};

// Mutation: Update a prompt
export const useUpdatePrompt = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePromptInput) => {
      const { data } = await axiosClient.patch<Prompt>(
        `/projects/${projectId}/prompts/${id}`,
        input
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts(projectId) });
    },
  });
};

// Mutation: Delete a prompt
export const useDeletePrompt = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/projects/${projectId}/prompts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};

// Mutation: Toggle favorite status
export const useToggleFavoritePrompt = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axiosClient.post<Prompt>(
        `/projects/${projectId}/prompts/${id}/toggle-favorite`
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts(projectId) });
    },
  });
};
