import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Trash2, ChevronDown, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/api/hooks/useProjects';
import { useProjectStats } from '@/api/hooks/useProjectStats';
import { useUIStore } from '@/contexts/uiStore';
import {
  useBusinesses,
  FeedbackTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useTemplates,
  TemplateCreate,
  TemplateUpdate,
} from '@/api/hooks/useBusinesses';

type PlanTier = 'starter' | 'growth';

// All plans can now edit and create templates (no more free plan restrictions)
const PLAN_LIMITS: Record<PlanTier, { canEdit: boolean; canCreate: boolean; maxTemplates: number }> = {
  starter: { canEdit: true, canCreate: true, maxTemplates: 10 },
  growth: { canEdit: true, canCreate: true, maxTemplates: Infinity },
};

interface TemplateFormData {
  name: string;
  pre_message: string;
  initial_message: string;
  thank_you_promoter: string;
  thank_you_passive: string;
  thank_you_detractor: string;
}

// ============================================================================
// Question Cards Config
// ============================================================================

interface CardConfig {
  field: keyof TemplateFormData;
  label: string;
  badge: string;
  badgeColor: string;
  borderColor: string;
  headerBg: string;
  placeholder: string;
  hint?: string;
  required: boolean;
}

const NPS_CARD: CardConfig = {
  field: 'initial_message',
  label: 'Pergunta NPS (0-10)',
  badge: 'NPS',
  badgeColor: 'bg-blue-50 text-blue-700',
  borderColor: 'border-l-blue-500',
  headerBg: 'hover:bg-blue-50/80',
  placeholder: 'Olá {customer_name}! De 0 a 10...',
  hint: 'Use {customer_name} para inserir o nome do cliente',
  required: true,
};

const RESPONSE_CARDS: CardConfig[] = [
  {
    field: 'thank_you_promoter',
    label: 'Promotor (9-10)',
    badge: 'Automática',
    badgeColor: 'bg-emerald-50 text-emerald-700',
    borderColor: 'border-l-emerald-500',
    headerBg: 'hover:bg-emerald-50/80',
    placeholder: 'Obrigado pela nota! ...',
    required: false,
  },
  {
    field: 'thank_you_passive',
    label: 'Neutro (7-8)',
    badge: 'Automática',
    badgeColor: 'bg-amber-50 text-amber-700',
    borderColor: 'border-l-amber-500',
    headerBg: 'hover:bg-amber-50/80',
    placeholder: 'Obrigado pelo feedback! ...',
    required: false,
  },
  {
    field: 'thank_you_detractor',
    label: 'Detrator (0-6)',
    badge: 'Automática',
    badgeColor: 'bg-red-50 text-red-700',
    borderColor: 'border-l-red-500',
    headerBg: 'hover:bg-red-50/80',
    placeholder: 'Lamentamos que...',
    required: false,
  },
];

// ============================================================================
// Template Editor (Inline)
// ============================================================================

interface TemplateEditorProps {
  template?: FeedbackTemplate | null;
  businessName: string;
  canEdit: boolean;
  isSaving: boolean;
  onSave: (data: TemplateFormData) => void;
  onDelete?: () => void;
}

function TemplateEditor({
  template,
  businessName,
  canEdit,
  isSaving,
  onSave,
  onDelete,
}: TemplateEditorProps) {
  const { t } = useTranslation();
  const isEditing = !!template;

  const getDefaultFormData = (): TemplateFormData => ({
    name: 'Novo Template',
    pre_message: '',
    initial_message: `Olá {customer_name}! Obrigado por escolher ${businessName}.\n\nDe 0 a 10, qual a chance de você nos recomendar para amigos ou familiares?`,
    thank_you_promoter: 'Muito obrigado pela nota! Ficamos muito felizes com sua avaliação!\n\nQue tal compartilhar sua experiência no Google? Isso nos ajuda muito!',
    thank_you_passive: 'Obrigado pelo seu feedback!\n\nHá algo específico que poderíamos melhorar para conquistar um 10?',
    thank_you_detractor: 'Obrigado pelo seu feedback.\n\nLamentamos que sua experiência não tenha sido a melhor. Poderia nos contar o que aconteceu? Queremos melhorar.',
  });

  const [formData, setFormData] = useState<TemplateFormData>(() => {
    if (template) {
      return {
        name: template.name,
        pre_message: template.pre_message || '',
        initial_message: template.initial_message,
        thank_you_promoter: template.thank_you_promoter || '',
        thank_you_passive: template.thank_you_passive || '',
        thank_you_detractor: template.thank_you_detractor || '',
      };
    }
    return getDefaultFormData();
  });
  const [expandedCard, setExpandedCard] = useState<string | null>('initial_message');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [preMessageEnabled, setPreMessageEnabled] = useState(!!template?.pre_message);

  // Greeting prefix used when toggling pre_message on/off
  const greetingPrefix = `Olá {customer_name}! Obrigado por escolher ${businessName}.`;

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error(t('templates.nameRequired', 'Nome do template é obrigatório'));
      return;
    }
    if (!formData.initial_message.trim()) {
      toast.error(t('templates.messageRequired', 'Mensagem inicial é obrigatória'));
      return;
    }
    onSave(formData);
  };

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
      <div className="p-6 space-y-4">
        {/* Template Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t('templates.name', 'Nome do Template')} *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            disabled={!canEdit}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="Ex: Template Padrão"
          />
        </div>

        {/* Sequência de perguntas */}
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Sequência de envio
        </p>

        {/* Pergunta Aberta (opcional, antes do NPS) */}
        {preMessageEnabled ? (() => {
          const isExpanded = expandedCard === 'pre_message';
          const preValue = formData.pre_message;
          const prePreview = preValue ? preValue.split('\n')[0].slice(0, 60) + (preValue.length > 60 ? '...' : '') : '';
          return (
            <div className={cn(
              'rounded-lg ring-1 ring-slate-200 overflow-hidden transition-all',
              isExpanded && 'ring-slate-300'
            )}>
              <button
                type="button"
                onClick={() => setExpandedCard(isExpanded ? null : 'pre_message')}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-purple-50/80 border-l-4 border-l-purple-500"
              >
                <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span>
                <span className="flex-1 text-sm font-medium text-slate-800">
                  Pergunta Aberta
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700">
                  Aberta
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreMessageEnabled(false);
                      // Restore greeting to NPS message
                      const msg = formData.initial_message;
                      const restored = msg.toLowerCase().startsWith('olá') ? msg : `${greetingPrefix}\n\n${msg}`;
                      setFormData({ ...formData, pre_message: '', initial_message: restored });
                      if (expandedCard === 'pre_message') setExpandedCard('initial_message');
                    }}
                    className="p-0.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                    title="Remover pergunta aberta"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
              </button>
              {!isExpanded && prePreview && (
                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                  <p className="text-xs text-slate-400 truncate italic">"{prePreview}"</p>
                </div>
              )}
              {isExpanded && (
                <div className="px-4 py-3 border-t border-slate-100">
                  <textarea
                    value={preValue}
                    onChange={(e) => setFormData({ ...formData, pre_message: e.target.value })}
                    disabled={!canEdit}
                    rows={3}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500 resize-none text-sm"
                    placeholder={`${greetingPrefix} O que achou do nosso atendimento?`}
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Use {'{customer_name}'} para inserir o nome do cliente. Personalize a mensagem para o seu negócio.
                  </p>
                </div>
              )}
            </div>
          );
        })() : canEdit ? (
          <>
            <button
              type="button"
              onClick={() => {
                setPreMessageEnabled(true);
                // Extract greeting from NPS message, move it to pre_message
                const msg = formData.initial_message;
                const splitIdx = msg.indexOf('\n\n');
                const greeting = splitIdx !== -1 ? msg.substring(0, splitIdx) : greetingPrefix;
                const simplified = splitIdx !== -1 ? msg.substring(splitIdx + 2) : msg;
                setFormData({ ...formData, pre_message: `${greeting} O que achou do nosso atendimento?`, initial_message: simplified });
                setExpandedCard('pre_message');
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-purple-200 rounded-lg text-sm text-purple-500 hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50/50 transition-all"
            >
              <Plus className="w-4 h-4" />
              Adicionar pergunta aberta antes do NPS
            </button>
            <p className="text-[10px] text-slate-400 leading-relaxed -mt-1">
              Opcional: envia uma pergunta aberta antes da nota NPS, ideal para coletar feedback qualitativo (ex: "O que achou do atendimento?"). Sem ela, o cliente recebe direto a pergunta de nota 0-10.
            </p>
          </>
        ) : null}

        {/* NPS Card */}
        {(() => {
          const card = NPS_CARD;
          const npsStep = preMessageEnabled ? 2 : 1;
          const isExpanded = expandedCard === card.field;
          const value = formData[card.field];
          const preview = value ? value.split('\n')[0].slice(0, 60) + (value.length > 60 ? '...' : '') : '';
          return (
            <div className={cn(
              'rounded-lg ring-1 ring-slate-200 overflow-hidden transition-all',
              isExpanded && 'ring-slate-300'
            )}>
              <button
                type="button"
                onClick={() => setExpandedCard(isExpanded ? null : card.field)}
                className={cn('w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-4', card.headerBg, card.borderColor)}
              >
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{npsStep}</span>
                <span className="flex-1 text-sm font-medium text-slate-800">
                  {card.label}
                  {card.required && <span className="text-red-400 ml-0.5">*</span>}
                </span>
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', card.badgeColor)}>
                  {card.badge}
                </span>
                <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
              </button>
              {!isExpanded && preview && (
                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                  <p className="text-xs text-slate-400 truncate italic">"{preview}"</p>
                </div>
              )}
              {isExpanded && (
                <div className="px-4 py-3 border-t border-slate-100">
                  <textarea
                    value={value}
                    onChange={(e) => setFormData({ ...formData, [card.field]: e.target.value })}
                    disabled={!canEdit}
                    rows={4}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500 resize-none text-sm"
                    placeholder={card.placeholder}
                    autoFocus
                  />
                  {card.hint && (
                    <p className="text-[10px] text-slate-400 mt-1.5">{card.hint}</p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Respostas por Classificação */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Respostas automáticas por classificação
          </p>
          <p className="text-[10px] text-slate-400 mb-3">
            Enviadas automaticamente conforme a nota do cliente
          </p>
          <div className="space-y-3">
            {RESPONSE_CARDS.map((card) => {
              const isExpanded = expandedCard === card.field;
              const value = formData[card.field];
              const preview = value ? value.split('\n')[0].slice(0, 60) + (value.length > 60 ? '...' : '') : '';

              return (
                <div
                  key={card.field}
                  className={cn(
                    'rounded-lg ring-1 ring-slate-200 overflow-hidden transition-all',
                    isExpanded && 'ring-slate-300'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedCard(isExpanded ? null : card.field)}
                    className={cn('w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-4', card.headerBg, card.borderColor)}
                  >
                    <span className="flex-1 text-sm font-medium text-slate-800">
                      {card.label}
                    </span>
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold', card.badgeColor)}>
                      {card.badge}
                    </span>
                    <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
                  </button>
                  {!isExpanded && preview && (
                    <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                      <p className="text-xs text-slate-400 truncate italic">"{preview}"</p>
                    </div>
                  )}
                  {isExpanded && (
                    <div className="px-4 py-3 border-t border-slate-100">
                      <textarea
                        value={value}
                        onChange={(e) => setFormData({ ...formData, [card.field]: e.target.value })}
                        disabled={!canEdit}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500 resize-none text-sm"
                        placeholder={card.placeholder}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 flex justify-between">
        <div>
          {isEditing && onDelete && (
            showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Confirmar exclusão?</span>
                <Button
                  onClick={() => { onDelete(); setShowDeleteConfirm(false); }}
                  disabled={isSaving}
                  variant="destructive"
                  size="sm"
                >
                  Sim
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="ghost"
                  size="sm"
                >
                  Não
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </Button>
            )
          )}
          {isEditing && !onDelete && (
            <span className="text-xs text-slate-400">
              Template padrão não pode ser excluído
            </span>
          )}
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Templates Page
// ============================================================================

export default function Templates() {
  const { t } = useTranslation();
  const { selectedBusinessId } = useUIStore();

  // Get user's projects
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const projectId = projects?.[0]?.id || '';

  // Get project stats to determine plan tier
  const { data: stats } = useProjectStats(projectId);
  const planTier: PlanTier = (stats?.subscription?.tier as PlanTier) || 'starter';
  const limits = PLAN_LIMITS[planTier] || PLAN_LIMITS.starter;

  // Get businesses for the project
  const { data: businesses, isLoading: loadingBusinesses } = useBusinesses(projectId);
  const effectiveBusinessId = selectedBusinessId || businesses?.[0]?.id || '';
  const businessName = businesses?.find(b => b.id === effectiveBusinessId)?.name || '';

  // Fetch templates for the selected business
  const { data: templates, isLoading: loadingTemplates } = useTemplates(effectiveBusinessId);

  // Mutations
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  // Selection state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const isLoading = loadingProjects || loadingBusinesses || loadingTemplates;
  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const canCreateMore = limits.canCreate && (templates?.length || 0) < limits.maxTemplates;

  // Reset selection when business changes
  useEffect(() => {
    setSelectedTemplateId(null);
    setIsCreating(false);
  }, [effectiveBusinessId]);

  // Auto-select first template
  useEffect(() => {
    if (templates?.length && !selectedTemplateId && !isCreating) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId, isCreating]);

  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId) || null;

  const handleSelectTemplate = (tmpl: FeedbackTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setIsCreating(false);
  };

  const handleCreate = () => {
    if (!limits.canCreate) {
      toast.error(t('templates.upgradeToPlan', 'Faça upgrade do seu plano para criar templates'));
      return;
    }
    if (!canCreateMore) {
      toast.error(t('templates.limitReached', `Limite de ${limits.maxTemplates} template(s) atingido.`));
      return;
    }
    setSelectedTemplateId(null);
    setIsCreating(true);
  };

  const handleSave = async (formData: TemplateFormData) => {
    try {
      if (selectedTemplateId) {
        await updateMutation.mutateAsync({
          businessId: effectiveBusinessId,
          templateId: selectedTemplateId,
          payload: formData as TemplateUpdate,
        });
        toast.success(t('templates.updated', 'Template atualizado!'));
      } else {
        const result = await createMutation.mutateAsync({
          businessId: effectiveBusinessId,
          payload: formData as TemplateCreate,
        });
        setSelectedTemplateId(result.data.id);
        setIsCreating(false);
        toast.success(t('templates.created', 'Template criado!'));
      }
    } catch {
      toast.error(t('common.error', 'Ocorreu um erro'));
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) return;
    try {
      await deleteMutation.mutateAsync({ businessId: effectiveBusinessId, templateId: selectedTemplateId });
      setSelectedTemplateId(null);
      toast.success(t('templates.deleted', 'Template excluído!'));
    } catch {
      toast.error(t('common.error', 'Ocorreu um erro'));
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200 mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          {t('templates.title', 'Templates de Mensagens')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('templates.subtitle', 'Personalize as mensagens enviadas aos clientes')}
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : !businesses || businesses.length === 0 ? (
        <div className="text-center py-16 px-6">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            {t('templates.noBusinesses', 'Nenhum negócio cadastrado')}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {t('templates.noBusinessesDesc', 'Cadastre um negócio primeiro para criar templates')}
          </p>
        </div>
      ) : (
        <>
          {/* Template tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {templates?.map(tmpl => (
              <button
                key={tmpl.id}
                onClick={() => handleSelectTemplate(tmpl)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all ring-1',
                  selectedTemplateId === tmpl.id
                    ? 'ring-primary bg-primary/5 text-primary'
                    : 'ring-slate-200 bg-white text-slate-600 hover:ring-slate-300'
                )}
              >
                <FileText className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                {tmpl.name}
                {tmpl.is_default && (
                  <span className="text-[10px] ml-1.5 opacity-50">padrão</span>
                )}
              </button>
            ))}
            {canCreateMore && (
              <button
                onClick={handleCreate}
                className={cn(
                  'px-4 py-2 rounded-lg border-2 border-dashed text-sm font-medium transition-all',
                  isCreating
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
                )}
              >
                <Plus className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                Novo
              </button>
            )}
          </div>

          {/* Info card (only when no templates) */}
          {(!templates || templates.length === 0) && !isCreating && (
            <div className="text-center py-16 px-6">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                {t('templates.empty', 'Nenhum template')}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {t('templates.emptyDesc', 'Crie seu primeiro template para personalizar as mensagens')}
              </p>
              {limits.canCreate && (
                <Button onClick={handleCreate} size="sm" className="mt-4">
                  <Plus className="w-4 h-4" />
                  {t('templates.createFirst', 'Criar Template')}
                </Button>
              )}
            </div>
          )}

          {/* Inline Editor */}
          {(selectedTemplate || isCreating) && (
            <TemplateEditor
              key={selectedTemplateId || 'new'}
              template={isCreating ? null : selectedTemplate}
              businessName={businessName}
              canEdit={limits.canEdit}
              isSaving={isSaving}
              onSave={handleSave}
              onDelete={selectedTemplate && !selectedTemplate.is_default ? handleDelete : undefined}
            />
          )}
        </>
      )}
    </div>
  );
}
