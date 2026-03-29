import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

export interface Project {
  id: string;
  name: string;
  owner_id: string;
  plan_id?: string;
  subscription_status?: string;
  daily_inspirations_count?: number;
  ai_usage_count?: number;
}

export const useProjects = () => {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      const { data } = await axiosClient.get<Project[]>('/projects');
      return data;
    },
  });
};

export const useProject = (projectId: string) => {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: async () => {
      const { data } = await axiosClient.get<Project>(`/projects/${projectId}`);
      return data;
    },
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await axiosClient.post<Project>('/projects', { name });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      await axiosClient.delete(`/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
};
