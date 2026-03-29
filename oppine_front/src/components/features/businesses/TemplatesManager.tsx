import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, FileText, Check, Star, Lock, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  FeedbackTemplate,
  TemplateCreate,
  TemplateUpdate,
} from '@/api/hooks/useBusinesses';

// Backend tiers: starter, growth
type PlanTier = 'starter' | 'growth';

interface TemplatesManagerProps {
  businessId: string;
  businessName: string;
  planTier?: PlanTier;
}

interface TemplateFormData {
  name: string;
  initial_message: string;
  thank_you_promoter: string;
  thank_you_passive: string;
  thank_you_detractor: string;
  testimonial_request: string;
  is_default: boolean;
}

const defaultFormData: TemplateFormData = {
  name: '',
  initial_message: '',
  thank_you_promoter: '',
  thank_you_passive: '',
  thank_you_detractor: '',
  testimonial_request: '',
  is_default: false,
};

// Plan limits - backend tiers: starter, growth
// All plans can now edit and create templates (no more free plan restrictions)
const PLAN_LIMITS: Record<PlanTier, { canEdit: boolean; canCreate: boolean; maxTemplates: number }> = {
  starter: { canEdit: true, canCreate: true, maxTemplates: 10 },
  growth: { canEdit: true, canCreate: true, maxTemplates: Infinity },
};

export default function TemplatesManager({ businessId, businessName, planTier = 'starter' }: TemplatesManagerProps) {
  const { t } = useTranslation();
  const { data: templates, isLoading } = useTemplates(businessId);
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const [editingTemplate, setEditingTemplate] = useState<FeedbackTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState<FeedbackTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Get plan limits
  const limits = PLAN_LIMITS[planTier] || PLAN_LIMITS.starter;
  const currentTemplateCount = templates?.length || 0;
  const canCreateMore = limits.canCreate && currentTemplateCount < limits.maxTemplates;

  const handleCreate = () => {
    if (!limits.canCreate) {
      toast.error(t('templates.upgradeToPlan', 'Faça upgrade do seu plano para criar templates'));
      return;
    }
    if (!canCreateMore) {
      toast.error(t('templates.limitReached', `Limite de ${limits.maxTemplates} templates atingido`));
      return;
    }
    setEditingTemplate(null);
    setFormData({
      ...defaultFormData,
      name: `Template ${currentTemplateCount + 1}`,
      initial_message: `Olá {customer_name}! Obrigado por escolher ${businessName}.\n\nDe 0 a 10, qual a chance de você nos recomendar para amigos ou familiares?`,
      thank_you_promoter: 'Muito obrigado pela nota! Ficamos muito felizes com sua avaliação!\n\nQue tal compartilhar sua experiência no Google? Isso nos ajuda muito!',
      thank_you_passive: 'Obrigado pelo seu feedback!\n\nHá algo específico que poderíamos melhorar para conquistar um 10?',
      thank_you_detractor: 'Obrigado pelo seu feedback.\n\nLamentamos que sua experiência não tenha sido a melhor. Poderia nos contar o que aconteceu? Queremos melhorar.',
    });
    setIsCreating(true);
  };

  const handleEdit = (template: FeedbackTemplate) => {
    if (!limits.canEdit) {
      // Open in view mode instead
      handleView(template);
      return;
    }
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      initial_message: template.initial_message,
      thank_you_promoter: template.thank_you_promoter || '',
      thank_you_passive: template.thank_you_passive || '',
      thank_you_detractor: template.thank_you_detractor || '',
      testimonial_request: template.testimonial_request || '',
      is_default: template.is_default,
    });
    setIsCreating(true);
  };

  const handleView = (template: FeedbackTemplate) => {
    setViewingTemplate(template);
    setIsViewing(true);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsViewing(false);
    setEditingTemplate(null);
    setViewingTemplate(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error(t('templates.nameRequired', 'Nome do template é obrigatório'));
      return;
    }

    if (!formData.initial_message.trim()) {
      toast.error(t('templates.initialMessageRequired', 'Mensagem inicial é obrigatória'));
      return;
    }

    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({
          businessId,
          templateId: editingTemplate.id,
          payload: formData as TemplateUpdate,
        });
        toast.success(t('templates.updated', 'Template atualizado!'));
      } else {
        await createMutation.mutateAsync({
          businessId,
          payload: formData as TemplateCreate,
        });
        toast.success(t('templates.created', 'Template criado!'));
      }
      handleCancel();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      const errorMessage = axiosError?.response?.data?.detail || t('common.error', 'Ocorreu um erro');
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!limits.canEdit) {
      toast.error(t('templates.upgradeToEdit', 'Faça upgrade para gerenciar templates'));
      return;
    }
    try {
      await deleteMutation.mutateAsync({ businessId, templateId });
      toast.success(t('templates.deleted', 'Template excluído!'));
      setDeleteConfirm(null);
    } catch {
      toast.error(t('common.error', 'Ocorreu um erro'));
    }
  };

  const handleSetDefault = async (template: FeedbackTemplate) => {
    if (!limits.canEdit) {
      toast.error(t('templates.upgradeToEdit', 'Faça upgrade para gerenciar templates'));
      return;
    }
    if (template.is_default) return;
    try {
      await updateMutation.mutateAsync({
        businessId,
        templateId: template.id,
        payload: { is_default: true },
      });
      toast.success(t('templates.setAsDefault', 'Template definido como padrão!'));
    } catch {
      toast.error(t('common.error', 'Ocorreu um erro'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // View-only mode for Free plan
  if (isViewing && viewingTemplate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            {t('templates.view', 'Visualizar Template')}
          </h3>
        </div>

        <div className="bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            {t('templates.readOnlyFree', 'Plano Free: visualização apenas. Faça upgrade para editar templates.')}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nome</label>
            <div className="px-3 py-2 bg-slate-50 ring-1 ring-slate-200 rounded-lg text-sm">
              {viewingTemplate.name}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Mensagem Inicial</label>
            <div className="px-3 py-2 bg-slate-50 ring-1 ring-slate-200 rounded-lg text-sm font-mono whitespace-pre-wrap">
              {viewingTemplate.initial_message}
            </div>
          </div>

          {viewingTemplate.thank_you_promoter && (
            <div className="p-3 bg-green-50 rounded-lg ring-1 ring-green-100">
              <label className="block text-xs font-medium text-green-700 mb-1">Resposta Promotores (9-10)</label>
              <div className="text-sm whitespace-pre-wrap">{viewingTemplate.thank_you_promoter}</div>
            </div>
          )}

          {viewingTemplate.thank_you_passive && (
            <div className="p-3 bg-amber-50 rounded-lg ring-1 ring-amber-100">
              <label className="block text-xs font-medium text-amber-700 mb-1">Resposta Passivos (7-8)</label>
              <div className="text-sm whitespace-pre-wrap">{viewingTemplate.thank_you_passive}</div>
            </div>
          )}

          {viewingTemplate.thank_you_detractor && (
            <div className="p-3 bg-red-50 rounded-lg ring-1 ring-red-100">
              <label className="block text-xs font-medium text-red-700 mb-1">Resposta Detratores (0-6)</label>
              <div className="text-sm whitespace-pre-wrap">{viewingTemplate.thank_you_detractor}</div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={handleCancel}>
            {t('common.close', 'Fechar')}
          </Button>
        </div>
      </div>
    );
  }

  // Form view (edit/create)
  if (isCreating) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">
            {editingTemplate ? t('templates.edit', 'Editar Template') : t('templates.create', 'Novo Template')}
          </h3>
        </div>

        {/* Nome do Template */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('templates.name', 'Nome do Template')} *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            placeholder="Ex: Template Padrão"
          />
        </div>

        {/* Mensagem Inicial */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('templates.initialMessage', 'Mensagem Inicial (Pedindo Nota)')} *
          </label>
          <textarea
            value={formData.initial_message}
            onChange={(e) => setFormData({ ...formData, initial_message: e.target.value })}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-mono"
            rows={3}
          />
          <p className="text-xs text-slate-500 mt-1">
            Use <code className="bg-slate-100 px-1 rounded">{'{customer_name}'}</code> e <code className="bg-slate-100 px-1 rounded">{'{business_name}'}</code>
          </p>
        </div>

        {/* Respostas por classificação */}
        <div className="grid gap-4">
          <div className="p-3 bg-green-50 rounded-lg ring-1 ring-green-100">
            <label className="block text-sm font-medium text-green-800 mb-1">
              {t('templates.thankYouPromoter', 'Resposta para Promotores (9-10)')}
            </label>
            <textarea
              value={formData.thank_you_promoter}
              onChange={(e) => setFormData({ ...formData, thank_you_promoter: e.target.value })}
              className="w-full px-3 py-2.5 border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
              rows={2}
              placeholder="Muito obrigado! Que tal deixar uma avaliação no Google?"
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-lg ring-1 ring-amber-100">
            <label className="block text-sm font-medium text-amber-800 mb-1">
              {t('templates.thankYouPassive', 'Resposta para Passivos (7-8)')}
            </label>
            <textarea
              value={formData.thank_you_passive}
              onChange={(e) => setFormData({ ...formData, thank_you_passive: e.target.value })}
              className="w-full px-3 py-2.5 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm"
              rows={2}
              placeholder="Obrigado! O que podemos melhorar?"
            />
          </div>

          <div className="p-3 bg-red-50 rounded-lg ring-1 ring-red-100">
            <label className="block text-sm font-medium text-red-800 mb-1">
              {t('templates.thankYouDetractor', 'Resposta para Detratores (0-6)')}
            </label>
            <textarea
              value={formData.thank_you_detractor}
              onChange={(e) => setFormData({ ...formData, thank_you_detractor: e.target.value })}
              className="w-full px-3 py-2.5 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
              rows={2}
              placeholder="Lamentamos. Pode nos contar o que aconteceu?"
            />
          </div>
        </div>

        {/* Definir como padrão */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_default"
            checked={formData.is_default}
            onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
            className="rounded border-slate-300 text-primary focus:ring-primary"
          />
          <label htmlFor="is_default" className="text-sm text-slate-700">
            {t('templates.setDefault', 'Usar como template padrão')}
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={handleCancel}>
            {t('common.cancel', 'Cancelar')}
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? t('common.saving', 'Salvando...')
              : t('common.save', 'Salvar')}
          </Button>
        </div>
      </form>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {t('templates.description', 'Personalize as mensagens enviadas aos clientes')}
        </p>
        {limits.canCreate && (
          <button
            onClick={handleCreate}
            disabled={!canCreateMore}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              canCreateMore
                ? 'text-primary hover:bg-primary/10'
                : 'text-slate-400 cursor-not-allowed'
            )}
            title={!canCreateMore ? `Limite de ${limits.maxTemplates} templates` : undefined}
          >
            {canCreateMore ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {t('templates.add', 'Novo Template')}
          </button>
        )}
      </div>

      {templates && templates.length > 0 ? (
        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className={cn(
                'p-3 rounded-lg',
                template.is_default ? 'ring-2 ring-primary bg-primary/5' : 'ring-1 ring-slate-200 bg-white'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 truncate">{template.name}</span>
                      {template.is_default && (
                        <span className="px-1.5 py-0.5 text-xs font-medium text-primary bg-primary/10 rounded">
                          Padrão
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {template.initial_message.substring(0, 60)}...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {limits.canEdit ? (
                    <>
                      {!template.is_default && (
                        <button
                          onClick={() => handleSetDefault(template)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                          title={t('templates.setAsDefault', 'Definir como padrão')}
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(template)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title={t('common.edit', 'Editar')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!template.is_default && (
                        deleteConfirm === template.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(template.id)}
                              disabled={deleteMutation.isPending}
                              className="p-1.5 text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                              title={t('common.confirm', 'Confirmar')}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              title={t('common.cancel', 'Cancelar')}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(template.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t('common.delete', 'Excluir')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleView(template)}
                      className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                      title={t('templates.view', 'Visualizar')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 px-6">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            {t('templates.empty', 'Nenhum template personalizado')}
          </h3>
          {limits.canCreate ? (
            <Button onClick={handleCreate} size="sm" className="mt-4">
              <Plus className="w-4 h-4" />
              {t('templates.createFirst', 'Criar Primeiro Template')}
            </Button>
          ) : (
            <p className="text-xs text-slate-400 mt-2">
              Faça upgrade para criar templates personalizados
            </p>
          )}
        </div>
      )}
    </div>
  );
}
