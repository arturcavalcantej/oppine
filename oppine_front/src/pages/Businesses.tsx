import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Building2, MapPin, Phone, AlertTriangle, Star, FileText, ChevronRight, ChevronDown, HelpCircle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/api/hooks/useProjects';
import { useProjectStats, useProjectTemplates } from '@/api/hooks/useProjectStats';
import {
  useBusinesses,
  useCreateBusiness,
  useUpdateBusiness,
  useDeleteBusiness,
  useCreateTemplate,
  useTemplates,
  Business,
  BusinessCreate,
  BusinessUpdate,
  TemplateCreate,
} from '@/api/hooks/useBusinesses';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Remove Brazil country code (55) prefix from phone number for display.
 * Backend automatically adds it when sending messages.
 */
function stripBrazilPrefix(phone: string | undefined): string {
  if (!phone) return '';
  // Remove all non-digits first
  const digits = phone.replace(/\D/g, '');
  // Remove 55 prefix if present (Brazilian numbers are 10-11 digits without country code)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

// ============================================================================
// Business Form Modal
// ============================================================================

// Tier values from backend: starter, growth
type PlanTier = 'starter' | 'growth';

interface BusinessFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  business?: Business | null;
  projectId: string;
  planTier: PlanTier;
  existingBusinessId?: string;
}

function BusinessFormModal({ isOpen, onClose, business, projectId, existingBusinessId }: BusinessFormModalProps) {
  const { t } = useTranslation();
  const isEditing = !!business;

  const [formData, setFormData] = useState<Partial<BusinessCreate & BusinessUpdate>>({
    name: business?.name || '',
    google_review_url: business?.google_review_url || '',
    alert_phone: stripBrazilPrefix(business?.alert_phone),
  });

  const [showGoogleTutorial, setShowGoogleTutorial] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Get templates for this project
  const templateBusinessId = business?.id || existingBusinessId || '';
  const { data: businessTemplates } = useTemplates(templateBusinessId);
  const { data: projectTemplates } = useProjectTemplates(projectId);

  const templates = businessTemplates?.length ? businessTemplates : projectTemplates;

  // Reset form when modal opens/closes or business changes
  useEffect(() => {
    setFormData({
      name: business?.name || '',
      google_review_url: business?.google_review_url || '',
      alert_phone: stripBrazilPrefix(business?.alert_phone),
    });
    setSelectedTemplateId(business?.template_id || '');
  }, [business, isOpen]);

  const createBusinessMutation = useCreateBusiness();
  const updateBusinessMutation = useUpdateBusiness();
  const createTemplateMutation = useCreateTemplate();

  const validateGeneral = () => {
    if (!formData.name?.trim()) {
      toast.error(t('businesses.nameRequired', 'Nome do negócio é obrigatório'));
      return false;
    }
    if (!formData.google_review_url?.trim()) {
      toast.error(t('businesses.googleReviewUrlRequired', 'Link do Google Meu Negócio é obrigatório'));
      return false;
    }
    return true;
  };

  const handleSaveGeneral = async () => {
    if (!validateGeneral()) return;

    try {
      if (isEditing && business) {
        const payload: BusinessUpdate = {
          ...formData as BusinessUpdate,
        };
        if (selectedTemplateId && selectedTemplateId !== business.template_id) {
          payload.template_id = selectedTemplateId;
        }

        await updateBusinessMutation.mutateAsync({
          businessId: business.id,
          payload,
        });

        toast.success(t('businesses.updated', 'Negócio atualizado com sucesso!'));
        onClose();
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      const errorMessage = axiosError?.response?.data?.detail || t('common.error', 'Ocorreu um erro.');
      toast.error(errorMessage);
    }
  };

  const handleCreateBusiness = async () => {
    if (!validateGeneral()) return;

    try {
      const newBusiness = await createBusinessMutation.mutateAsync({
        project_id: projectId,
        name: formData.name!,
        google_review_url: formData.google_review_url,
        alert_phone: formData.alert_phone,
      } as BusinessCreate);

      if (templates && templates.length > 0) {
        const templateToUse = selectedTemplateId
          || templates.find(t => t.is_default)?.id
          || templates[0].id;
        await updateBusinessMutation.mutateAsync({
          businessId: newBusiness.id,
          payload: { template_id: templateToUse },
        });
      } else {
        const createdTemplate = await createTemplateMutation.mutateAsync({
          businessId: newBusiness.id,
          payload: {
            name: 'Template Padrão',
            initial_message: 'Olá {customer_name}! Obrigado por escolher {business_name}.\n\nDe 0 a 10, qual a chance de você nos recomendar para amigos ou familiares?',
            thank_you_promoter: 'Muito obrigado pela nota! Ficamos muito felizes com sua avaliação!\n\nQue tal compartilhar sua experiência no Google? Isso nos ajuda muito!',
            thank_you_passive: 'Obrigado pelo seu feedback!\n\nHá algo específico que poderíamos melhorar para conquistar um 10?',
            thank_you_detractor: 'Obrigado pelo seu feedback.\n\nLamentamos que sua experiência não tenha sido a melhor. Poderia nos contar o que aconteceu? Queremos melhorar.',
            is_default: true,
          } as TemplateCreate,
        });
        await updateBusinessMutation.mutateAsync({
          businessId: newBusiness.id,
          payload: { template_id: createdTemplate.data.id },
        });
      }

      toast.success(t('businesses.created', 'Negócio criado com sucesso!'));
      onClose();
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      const errorMessage = axiosError?.response?.data?.detail || t('common.error', 'Ocorreu um erro.');
      toast.error(errorMessage);
    }
  };

  if (!isOpen) return null;

  const isLoading = createBusinessMutation.isPending || updateBusinessMutation.isPending || createTemplateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl ring-1 ring-slate-900/5 shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            {isEditing ? t('businesses.edit', 'Editar Negócio') : t('businesses.create', 'Novo Negócio')}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {t('businesses.name', 'Nome do Negócio')} *
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              placeholder="Ex: Barbearia do João"
            />
          </div>

          {/* Google Review URL */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <MapPin className="w-4 h-4 inline mr-1" />
              {t('businesses.googleReviewUrl', 'Link do Google Meu Negócio')} *
            </label>
            <input
              type="url"
              value={formData.google_review_url || ''}
              onChange={(e) => setFormData({ ...formData, google_review_url: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              placeholder="https://g.page/r/.../review"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Link para onde clientes satisfeitos serão redirecionados
            </p>

            {/* Tutorial expandível */}
            <button
              type="button"
              onClick={() => setShowGoogleTutorial(!showGoogleTutorial)}
              className="flex items-center gap-1.5 mt-2 text-xs text-primary hover:text-primary-hover transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Como obter o link do Google?</span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showGoogleTutorial && 'rotate-180')} />
            </button>

            {showGoogleTutorial && (
              <div className="mt-3 p-4 bg-blue-50 rounded-lg ring-1 ring-blue-100 text-xs text-slate-700 space-y-3">
                <p className="font-semibold text-blue-800 flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4" />
                  Passo a passo para obter seu link de avaliação
                </p>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                    <p>Acesse <strong>google.com</strong> e pesquise pelo nome do seu negócio</p>
                  </div>

                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                    <p>No painel do seu negócio, clique em <strong>"Solicitar avaliações"</strong></p>
                  </div>

                  <div className="flex gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                    <p>Copie o link que aparece (formato: <code className="bg-blue-100 px-1 py-0.5 rounded">https://g.page/r/.../review</code>)</p>
                  </div>
                </div>

                <p className="text-blue-600 text-[10px] pt-1 border-t border-blue-200">
                  Certifique-se de estar logado na mesma conta Google do seu Perfil Empresarial
                </p>
              </div>
            )}
          </div>

          {/* Template selector */}
          {templates && templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <FileText className="w-4 h-4 inline mr-1" />
                Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              >
                {!isEditing && !selectedTemplateId && (
                  <option value="">Selecione um template</option>
                )}
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.id === (business?.template_id || selectedTemplateId) ? '(atual)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1.5">
                O template será usado para enviar pesquisas NPS
              </p>
              <a
                href="/dashboard/templates"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover mt-2 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Gerenciar templates
              </a>
            </div>
          )}

          <hr className="border-slate-100" />

          {/* Alertas de Feedback Negativo */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {t('businesses.alertConfig', 'Configuração de Alertas')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Receba alertas quando clientes derem notas baixas
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Phone className="w-4 h-4 inline mr-1" />
                {t('businesses.alertPhone', 'Telefone para Alertas')}
              </label>
              <input
                type="tel"
                value={formData.alert_phone || ''}
                onChange={(e) => setFormData({ ...formData, alert_phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                placeholder="11999999999"
              />
            </div>
          </div>

          {/* Info about templates (only for first business when no templates exist) */}
          {!isEditing && (!templates || templates.length === 0) && (
            <div className="bg-slate-50 ring-1 ring-slate-200 rounded-lg p-3 mt-2">
              <p className="text-xs text-slate-600">
                <FileText className="w-3.5 h-3.5 inline mr-1" />
                Um template padrão será criado automaticamente. Você pode personalizá-lo depois em <strong>Templates</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel', 'Cancelar')}
          </Button>
          {isEditing ? (
            <Button onClick={handleSaveGeneral} disabled={isLoading}>
              {isLoading ? t('common.saving', 'Salvando...') : t('common.save', 'Salvar')}
            </Button>
          ) : (
            <Button onClick={handleCreateBusiness} disabled={isLoading}>
              {isLoading ? t('common.creating', 'Criando...') : t('common.create', 'Criar Negócio')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Delete Confirmation Modal
// ============================================================================

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  businessName: string;
  isDeleting: boolean;
}

function DeleteModal({ isOpen, onClose, onConfirm, businessName, isDeleting }: DeleteModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl ring-1 ring-slate-900/5 shadow-xl w-full max-w-md mx-4 p-6">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {t('businesses.deleteTitle', 'Excluir Negócio')}
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            {t('businesses.deleteConfirm', 'Tem certeza que deseja excluir')} <strong>{businessName}</strong>?
            {t('businesses.deleteWarning', ' Todos os dados de feedback serão perdidos.')}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel', 'Cancelar')}
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? t('common.deleting', 'Excluindo...') : t('common.delete', 'Excluir')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper function to format relative time
// ============================================================================

function formatRelativeTime(date: Date | string | undefined): string {
  if (!date) return '';

  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'há poucos minutos';
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
}

// ============================================================================
// Business Card Component
// ============================================================================

interface BusinessCardProps {
  business: Business;
  onEdit: (business: Business) => void;
  onDelete: (business: Business) => void;
  onSelect: (business: Business) => void;
}

function BusinessCard({ business, onEdit, onDelete, onSelect }: BusinessCardProps) {
  const { t } = useTranslation();

  const positivas = business.promoter_count || 0;
  const negativas = business.detractor_count || 0;
  const totais = business.total_responses || 0;

  const hasGoogleUrl = !!business.google_review_url;
  const hasPhone = !!business.alert_phone;
  const hasContactInfo = hasGoogleUrl || hasPhone;

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
      <div className="p-5">
        {/* Header: Icon + Name + Actions */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#4D7AFF]/15 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-[#547FFF]/20">
              <Building2 className="w-6 h-6 text-[#547FFF]" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 text-base">{business.name}</h3>
              <p className="text-xs text-slate-400">
                {business.updated_at
                  ? `Última atualização ${formatRelativeTime(business.updated_at)}`
                  : `Criado ${formatRelativeTime(business.created_at)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(business); }}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              title={t('common.edit', 'Editar')}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(business); }}
              className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              title={t('common.delete', 'Excluir')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Row - shared borders pattern */}
        <div className="grid grid-cols-3 gap-px rounded-lg bg-slate-900/5 ring-1 ring-slate-900/5 mb-5">
          <div className="bg-white py-3 px-2 text-center first:rounded-l-lg">
            <p className="text-2xl font-bold text-slate-900">{positivas}</p>
            <p className="text-xs text-green-600 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Positivas
            </p>
          </div>
          <div className="bg-white py-3 px-2 text-center">
            <p className="text-2xl font-bold text-slate-900">{negativas}</p>
            <p className="text-xs text-red-500 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Negativas
            </p>
          </div>
          <div className="bg-white py-3 px-2 text-center last:rounded-r-lg">
            <p className="text-2xl font-bold text-slate-900">{totais}</p>
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Totais
            </p>
          </div>
        </div>

        {/* Contact Info */}
        {hasContactInfo && (
          <div className="space-y-2 mb-4">
            {hasGoogleUrl && (
              <div className="flex items-center gap-2 text-green-600">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-medium">Google configurado</span>
              </div>
            )}
            {hasPhone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs">{stripBrazilPrefix(business.alert_phone)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Average Score */}
      <div className="flex items-center justify-between py-3 px-5 border-t border-slate-100 bg-amber-50/50">
        <span className="text-sm font-medium text-amber-900">
          Nota Média
        </span>
        <div className="flex items-center gap-1.5">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          <span className="text-lg font-bold text-amber-900">
            {business.average_score !== null && business.average_score !== undefined
              ? business.average_score.toFixed(1)
              : '-'}
          </span>
        </div>
      </div>

      {/* View Details Link */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => onSelect(business)}
          className="w-full flex items-center justify-center gap-1 py-3 px-5 text-sm font-medium text-slate-500 hover:text-primary hover:bg-slate-50 transition-colors"
        >
          Ver mais detalhes
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Businesses Page
// ============================================================================

export default function Businesses() {
  const { t } = useTranslation();

  const { data: projects, isLoading: loadingProjects } = useProjects();
  const projectId = projects?.[0]?.id || '';

  const { data: stats } = useProjectStats(projectId);
  const planTier: PlanTier = (stats?.subscription?.tier as PlanTier) || 'starter';

  const { data: businesses, isLoading: loadingBusinesses } = useBusinesses(projectId);

  const PLAN_BUSINESS_LIMITS: Record<PlanTier, number> = {
    starter: 1,
    growth: Infinity,
  };
  const businessLimit = PLAN_BUSINESS_LIMITS[planTier] ?? 1;
  const currentBusinessCount = businesses?.length || 0;
  const canAddBusiness = currentBusinessCount < businessLimit;

  const deleteMutation = useDeleteBusiness();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [deletingBusiness, setDeletingBusiness] = useState<Business | null>(null);

  const handleAddBusiness = () => {
    if (!canAddBusiness) {
      const limitText = businessLimit === Infinity ? 'ilimitado' : businessLimit.toString();
      toast.error(
        t('businesses.limitReached', `Limite de ${limitText} negócio(s) atingido. Faça upgrade do plano para adicionar mais negócios.`)
      );
      return;
    }
    setIsFormOpen(true);
  };

  const handleEdit = (business: Business) => {
    setEditingBusiness(business);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingBusiness) return;

    try {
      await deleteMutation.mutateAsync({
        businessId: deletingBusiness.id,
        projectId: deletingBusiness.project_id,
      });
      toast.success(t('businesses.deleted', 'Negócio excluído com sucesso!'));
      setDeletingBusiness(null);
    } catch {
      toast.error(t('common.error', 'Ocorreu um erro. Tente novamente.'));
    }
  };

  const handleSelect = (business: Business) => {
    window.location.href = `/dashboard/feedback/${business.id}`;
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBusiness(null);
  };

  const isLoading = loadingProjects || loadingBusinesses;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {t('businesses.title', 'Meus negócios')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('businesses.subtitle', 'Crie e gerencie as avaliações dos seus negócios')}
          </p>
        </div>
        <Button
          onClick={handleAddBusiness}
          disabled={!projectId}
        >
          <Plus className="w-4 h-4" />
          {t('businesses.add', 'Adicionar negócios')}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : businesses && businesses.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {businesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              onEdit={handleEdit}
              onDelete={setDeletingBusiness}
              onSelect={handleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-6">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            {t('businesses.empty', 'Nenhum negócio cadastrado')}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {t('businesses.emptyDesc', 'Adicione seu primeiro negócio para começar a coletar feedbacks')}
          </p>
          <Button
            onClick={handleAddBusiness}
            disabled={!projectId}
            size="sm"
            className="mt-4"
          >
            <Plus className="w-4 h-4" />
            {t('businesses.addFirst', 'Adicionar Primeiro Negócio')}
          </Button>
        </div>
      )}

      {/* Modals */}
      <BusinessFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        business={editingBusiness}
        projectId={projectId}
        planTier={planTier}
        existingBusinessId={businesses?.[0]?.id}
      />

      <DeleteModal
        isOpen={!!deletingBusiness}
        onClose={() => setDeletingBusiness(null)}
        onConfirm={handleDelete}
        businessName={deletingBusiness?.name || ''}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
