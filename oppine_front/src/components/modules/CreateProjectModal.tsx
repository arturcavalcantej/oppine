import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createPortal } from 'react-dom';
import { X, Loader2, FolderPlus } from 'lucide-react';
import { useCreateProject } from '@/api/hooks/useProjects';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name is too long'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated?: () => void;
}

export default function CreateProjectModal({ isOpen, onClose, onProjectCreated }: CreateProjectModalProps) {
  const { t } = useTranslation();
  const createProjectMutation = useCreateProject();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  });

  if (!isOpen) return null;

  const onSubmit = async (data: ProjectFormData) => {
    try {
      await createProjectMutation.mutateAsync(data.name);
      toast.success(t('project.toast.created'));
      reset();
      onProjectCreated?.();
      onClose();
    } catch (error) {
      toast.error(t('project.toast.createError'));
      console.error(error);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl ring-1 ring-slate-900/5 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-primary" />
            {t('project.newProject')}
          </h3>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              {t('project.projectName')}
            </label>
            <input
              type="text"
              {...register('name')}
              placeholder={t('project.projectNamePlaceholder')}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              autoFocus
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createProjectMutation.isPending}>
              {createProjectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {createProjectMutation.isPending ? t('project.creating') : t('project.createProject')}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
