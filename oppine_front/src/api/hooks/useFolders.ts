import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

export interface Folder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
}

export const useFolders = (projectId: string) => {
  return useQuery({
    queryKey: queryKeys.folders(projectId),
    queryFn: async () => {
      const { data } = await axiosClient.get<Folder[]>(`/projects/${projectId}/folders`);
      return data;
    },
    enabled: !!projectId,
  });
};

interface CreateFolderPayload {
  name: string;
  parent_folder_id?: string | null;
}

export const useCreateFolder = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateFolderPayload) => {
      const { data } = await axiosClient.post<Folder>(
        `/projects/${projectId}/folders`,
        { ...payload, parent_folder_id: payload.parent_folder_id ?? null }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};

interface UpdateFolderPayload {
  folderId: string;
  name?: string;
  parent_folder_id?: string | null;
}

export const useUpdateFolder = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ folderId, ...payload }: UpdateFolderPayload) => {
      const { data } = await axiosClient.patch<Folder>(`/folders/${folderId}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders(projectId) });
    },
  });
};

export const useDeleteFolder = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string) => {
      await axiosClient.delete(`/folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.folders(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
    },
  });
};
