import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone, AlertTriangle, FileText, ChevronDown, HelpCircle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import {
  useCreateBusiness,
  useUpdateBusiness,
  useCreateTemplate,
  useTemplates,
  Business,
  BusinessCreate,
  BusinessUpdate,
  TemplateCreate,
} from '@/api/hooks/useBusinesses';
import { useProjectTemplates } from '@/api/hooks/useProjectStats';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Remove Brazil country code (55) prefix from phone number for display.
 * Backend automatically adds it when sending messages.
 */
export function stripBrazilPrefix(phone: string | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

// ============================================================================
// Business Form Modal
// ============================================================================

export type PlanTier = 'starter' | 'growth';

interface BusinessFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  business?: Business | null;
  projectId: string;
  existingBusinessId?: string;
  onCreated?: (business: Business) => void;
}

export default function BusinessFormModal({ isOpen, onClose, business, projectId, existingBusinessId, onCreated }: BusinessFormModalProps) {
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
    return true;
  };

  // Handle save for editing
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

  // Handle creation
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
      onCreated?.(newBusiness);
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
              {t('businesses.googleReviewUrl', 'Link do Google Meu Negócio')}
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
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showGoogleTutorial ? 'rotate-180' : ''}`} />
            </button>

            {showGoogleTutorial && (
              <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100 text-xs text-slate-700 space-y-3">
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
                    <p>No painel do seu negócio, clique em <strong>"Solicitar avaliações"</strong> </p>
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
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-2">
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
