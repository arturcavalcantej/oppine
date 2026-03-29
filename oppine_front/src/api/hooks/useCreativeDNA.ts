import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '@/api/axiosClient';
import { queryKeys } from '@/api/queryKeys';

// Types
export type DNAType = 'persona' | 'produto' | 'voz';

export interface CreativeDNA {
  id: string;
  project_id: string;
  user_id: string;
  type: DNAType;
  name: string;
  content: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface CreativeDNADefaults {
  persona: CreativeDNA | null;
  produto: CreativeDNA | null;
  voz: CreativeDNA | null;
}

interface CreateDNAInput {
  type: DNAType;
  name: string;
  content?: string;
  is_default?: boolean;
}

interface UpdateDNAInput {
  id: string;
  name?: string;
  content?: string;
}

// Query: List all Creative DNA items for a project
export const useCreativeDNA = (projectId: string) => {
  return useQuery({
    queryKey: queryKeys.creativeDNA(projectId),
    queryFn: async () => {
      const { data } = await axiosClient.get<CreativeDNA[]>(
        `/projects/${projectId}/creative-dna`
      );
      return data;
    },
    enabled: !!projectId,
  });
};

// Query: Get default DNA items by type for a project
export const useCreativeDNADefaults = (projectId: string) => {
  return useQuery({
    queryKey: queryKeys.creativeDNADefaults(projectId),
    queryFn: async () => {
      const { data } = await axiosClient.get<CreativeDNADefaults>(
        `/projects/${projectId}/creative-dna/defaults`
      );
      return data;
    },
    enabled: !!projectId,
  });
};

// Mutation: Create a new DNA item
export const useCreateCreativeDNA = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDNAInput) => {
      const { data } = await axiosClient.post<CreativeDNA>(
        `/projects/${projectId}/creative-dna`,
        input
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.creativeDNA(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.creativeDNADefaults(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};

// Mutation: Update a DNA item
export const useUpdateCreativeDNA = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateDNAInput) => {
      const { data } = await axiosClient.patch<CreativeDNA>(
        `/projects/${projectId}/creative-dna/${id}`,
        input
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.creativeDNA(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.creativeDNADefaults(projectId) });
    },
  });
};

// Mutation: Delete a DNA item
export const useDeleteCreativeDNA = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await axiosClient.delete(`/projects/${projectId}/creative-dna/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.creativeDNA(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.creativeDNADefaults(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};

// Mutation: Set a DNA item as default
export const useSetDefaultCreativeDNA = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await axiosClient.post<CreativeDNA>(
        `/projects/${projectId}/creative-dna/${id}/set-default`
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.creativeDNA(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.creativeDNADefaults(projectId) });
    },
  });
};
