import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { axiosClient } from '@/api/axiosClient';
import { queryKeys } from '@/api/queryKeys';
import type { Document } from '@/api/hooks/useDocuments';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface UseCreateDocumentWithInspirationsOptions {
  projectId: string;
}

export function useCreateDocumentWithInspirations({
  projectId,
}: UseCreateDocumentWithInspirationsOptions) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const formatDocumentTitle = (ownerUsername?: string) => {
    const date = new Date().toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const prefix = ownerUsername ? `@${ownerUsername}` : t('inspiration.untitled', 'Inspiration');
    return `${prefix} - ${date}`;
  };

  const createAndNavigate = async (
    inspirationIds: string[],
    firstOwnerUsername?: string,
    folderId?: string | null
  ) => {
    if (inspirationIds.length === 0) return;

    setIsCreating(true);
    const toastId = toast.loading(t('inspiration.selection.creatingDocument', 'Creating document...'));

    try {
      const title = formatDocumentTitle(firstOwnerUsername);

      // Single API call - backend handles document creation and inspiration linking
      const { data: document } = await axiosClient.post<Document>(
        `/projects/${projectId}/documents`,
        {
          title,
          folder_id: folderId ?? null,
          content: null,
          inspiration_ids: inspirationIds,
        }
      );

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectStats(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.documentInspirations(document.id) });

      toast.success(t('inspiration.selection.documentCreated', 'Document created!'), { id: toastId });

      // Navigate to the new document
      navigate(`/dashboard/project/${projectId}/studio/document/${document.id}`);

      return document;
    } catch (error) {
      console.error('Failed to create document:', error);
      toast.error(t('inspiration.selection.documentCreateError', 'Failed to create document'), {
        id: toastId,
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createAndNavigate,
    isCreating,
    formatDocumentTitle,
  };
}
