import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Send, MessageSquare, ThumbsUp, ThumbsDown, Minus,
  Crown, Sparkles, Plus, Phone, Clock, Star,
  Filter, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight, HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/contexts/uiStore';
import { useProjects } from '@/api/hooks/useProjects';
import { useBusinesses } from '@/api/hooks/useBusinesses';
import { useProjectStats } from '@/api/hooks/useProjectStats';
import {
  useDashboardStats,
  useFeedbackResponses,
  useFeedbackRequests,
  useResolveIssue,
  FeedbackResponse,
  FeedbackRequest,
  getClassificationColor,
  getClassificationLabel,
  getStatusLabel,
  getStatusColor,
} from '@/api/hooks/useFeedback';
import PricingModal from '@/components/modules/PricingModal';
import SendNPSModal from '@/components/modules/SendNPSModal';
import GoogleConversionCard from '@/components/features/feedback/GoogleConversionCard';

// ============================================================================
// Sub-components
// ============================================================================

function UsageCard({ icon: Icon, label, value, subtitle, iconBgColor, iconColor, className }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  iconBgColor: string;
  iconColor: string;
  className?: string;
}) {
  return (
    <div className={cn('bg-white p-5', className)}>
      <div className="flex items-center gap-4">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', iconBgColor)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
          {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function PlanCard({ planName, isStarter, onUpgrade, className }: {
  planName: string;
  isStarter: boolean;
  onUpgrade: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('bg-white p-5', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-50">
            <Crown className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">{t('billing.currentPlan', 'Plano Atual')}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{planName}</p>
          </div>
        </div>
        {isStarter && (
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Upgrade
          </button>
        )}
      </div>
    </div>
  );
}

function TotalCard({ label, value, dotColor, tooltip, className }: {
  label: string;
  value: string | number;
  dotColor: string;
  tooltip?: string;
  className?: string;
}) {
  return (
    <div className={cn('bg-white p-5 relative group', className)}>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className={cn('w-2 h-2 rounded-full', dotColor)} />
        {label}
      </div>
      <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
      {tooltip && (
        <>
          <HelpCircle className="w-3.5 h-3.5 text-slate-300 absolute top-3 right-3 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-pre-line w-48 text-left opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>
        </>
      )}
    </div>
  );
}

function ClassificationBadge({ classification }: { classification: string }) {
  const icon = {
    promoter: ThumbsUp,
    passive: Minus,
    detractor: ThumbsDown,
  }[classification] || Minus;

  const Icon = icon;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', getClassificationColor(classification))}>
      <Icon className="w-3 h-3" />
      {getClassificationLabel(classification)}
    </span>
  );
}

function ResponseRow({ response, onResolve, isResolving }: {
  response: FeedbackResponse;
  onResolve: (response: FeedbackResponse) => void;
  isResolving: boolean;
}) {
  const { t } = useTranslation();
  const isUnresolvedDetractor = response.classification === 'detractor' && !response.issue_resolved;

  return (
    <div className={cn('px-6 py-5', isUnresolvedDetractor && 'bg-red-50/50')}>
      <div className="flex items-start gap-4">
        {/* Score circle */}
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0',
          response.classification === 'promoter' ? 'bg-green-500' :
          response.classification === 'detractor' ? 'bg-red-500' : 'bg-slate-400'
        )}>
          {response.score}
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: name + meta */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {response.customer_name || t('feedback.anonymous', 'Cliente Anônimo')}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Phone className="w-3 h-3" />
                  {response.customer_phone}
                </span>
                <ClassificationBadge classification={response.classification} />
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {new Date(response.responded_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Comment */}
          {response.comment && (
            <p className="text-sm text-slate-600 italic mt-2">"{response.comment}"</p>
          )}

          {/* Bottom row: flags + resolve */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3 text-xs">
              {response.google_review_matched && (
                <span className="text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded">
                  <Star className="w-3 h-3" />
                  Review confirmado
                </span>
              )}
              {response.google_review_clicked && !response.google_review_matched && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {t('feedback.clickedGoogle', 'Clicou no Google')}
                </span>
              )}
              {response.alert_sent && (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('feedback.alertSent', 'Alerta enviado')}
                </span>
              )}
            </div>

            {isUnresolvedDetractor && (
              <button
                onClick={() => onResolve(response)}
                disabled={isResolving}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCircle className="w-3 h-3" />
                {isResolving ? t('common.loading', 'Carregando...') : t('feedback.markResolved', 'Marcar Resolvido')}
              </button>
            )}

            {response.issue_resolved && (
              <span className="text-green-600 text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {t('feedback.resolved', 'Resolvido')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestRow({ request }: { request: FeedbackRequest }) {
  const { t } = useTranslation();
  const initials = (request.customer_name || '?')[0].toUpperCase();

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-xs font-semibold text-slate-500">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">
            {request.customer_name || t('feedback.anonymous', 'Cliente Anônimo')}
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Phone className="w-3 h-3" />
            {request.customer_phone}
          </div>
        </div>
      </div>
      <div className="text-right">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', getStatusColor(request.status))}>
          {getStatusLabel(request.status)}
        </span>
        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1 justify-end">
          <Clock className="w-3 h-3" />
          {new Date(request.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Dashboard
// ============================================================================

const PAGE_SIZE = 10;

export default function Dashboard() {
  const { t } = useTranslation();
  const { selectedBusinessId } = useUIStore();

  // Data hooks
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const projectId = projects?.[0]?.id || '';
  const { data: businesses, isLoading: loadingBusinesses } = useBusinesses(projectId);
  const { data: projectStats } = useProjectStats(projectId);

  // Per-business stats
  const effectiveBusinessId = selectedBusinessId || businesses?.[0]?.id || '';
  const effectiveBusinessName = businesses?.find(b => b.id === effectiveBusinessId)?.name || '';
  const { data: bizStats, isLoading: loadingStats } = useDashboardStats(effectiveBusinessId, 30);

  // Plan info
  const planName = projectStats?.subscription?.plan_name || 'Starter';
  const tier = projectStats?.subscription?.tier || 'starter';
  const isStarter = tier === 'starter';

  // Usage info
  const messagesCurrent = projectStats?.usage?.messages?.current || 0;
  const messagesLimit = projectStats?.usage?.messages?.limit;
  const messagesDisplay = messagesLimit === -1
    ? `${messagesCurrent}`
    : `${messagesCurrent}/${messagesLimit || 50}`;

  // Tabs and pagination state
  const [activeTab, setActiveTab] = useState<'responses' | 'requests'>('responses');
  const [filter, setFilter] = useState<'all' | 'promoter' | 'passive' | 'detractor'>('all');
  const [responsesPage, setResponsesPage] = useState(0);
  const [requestsPage, setRequestsPage] = useState(0);

  // Feedback data with pagination
  const { data: responses, isLoading: loadingResponses } = useFeedbackResponses(
    effectiveBusinessId,
    filter === 'all' ? undefined : filter,
    PAGE_SIZE,
    responsesPage * PAGE_SIZE
  );
  const { data: requests, isLoading: loadingRequests } = useFeedbackRequests(
    effectiveBusinessId,
    undefined,
    PAGE_SIZE,
    requestsPage * PAGE_SIZE
  );

  // Resolve mutation
  const resolveMutation = useResolveIssue();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (response: FeedbackResponse) => {
    setResolvingId(response.id);
    try {
      await resolveMutation.mutateAsync({
        responseId: response.id,
        businessId: effectiveBusinessId,
      });
      toast.success(t('feedback.issueResolved', 'Problema marcado como resolvido!'));
    } catch {
      toast.error(t('common.error', 'Ocorreu um erro. Tente novamente.'));
    } finally {
      setResolvingId(null);
    }
  };

  // Reset pagination when filter changes
  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    setResponsesPage(0);
  };

  // Modals
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isNPSModalOpen, setIsNPSModalOpen] = useState(false);

  const isLoading = loadingProjects || loadingBusinesses;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // No businesses: redirect to onboarding
  if (!businesses?.length) {
    return <Navigate to="/onboarding" replace />;
  }

  // NPS score color for dot
  const npsColor =
    bizStats?.nps_score == null ? 'bg-slate-400'
      : bizStats.nps_score >= 50 ? 'bg-emerald-500'
      : bizStats.nps_score >= 0 ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {t('dashboard.title', 'Visão Geral')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('dashboard.subtitle', 'Acompanhe as métricas do seu negócio')}
          </p>
        </div>
        <Button
          onClick={() => setIsNPSModalOpen(true)}
          className="bg-[#A8ED8E] text-slate-800 hover:bg-[#95da7b] shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('nps.collectFeedbacks', 'Coletar Feedbacks')}
        </Button>
      </div>

      {/* Usage Stats — shared borders grid */}
      <div className="mb-8" data-tour="dashboard-usage">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-xl bg-slate-900/5 ring-1 ring-slate-900/5 overflow-hidden">
          <UsageCard
            icon={Send}
            label={t('dashboard.surveysSent', 'Pesquisas Enviadas')}
            value={messagesDisplay}
            subtitle={messagesLimit === -1 ? 'Ilimitado' : undefined}
            iconBgColor="bg-blue-50"
            iconColor="text-blue-600"
          />
          <UsageCard
            icon={MessageSquare}
            label={t('dashboard.responses', 'Respostas')}
            value={loadingStats ? '...' : (bizStats?.total_responses || 0)}
            subtitle={bizStats?.response_rate ? `${bizStats.response_rate.toFixed(0)}% de resposta` : undefined}
            iconBgColor="bg-violet-50"
            iconColor="text-violet-600"
          />
          <PlanCard
            planName={planName}
            isStarter={isStarter}
            onUpgrade={() => setIsPricingOpen(true)}
          />
        </div>
      </div>

      {/* Totals — shared borders grid */}
      <div className="mb-8" data-tour="dashboard-totals">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl bg-slate-900/5 ring-1 ring-slate-900/5 overflow-hidden">
          <TotalCard
            label={t('dashboard.positive', 'Positivas')}
            value={loadingStats ? '...' : (bizStats?.promoters || 0)}
            dotColor="bg-green-500"
          />
          <TotalCard
            label={t('dashboard.negative', 'Negativas')}
            value={loadingStats ? '...' : (bizStats?.detractors || 0)}
            dotColor="bg-red-500"
          />
          <TotalCard
            label={t('dashboard.passive', 'Passivas')}
            value={loadingStats ? '...' : (bizStats?.passives || 0)}
            dotColor="bg-slate-400"
          />
          <TotalCard
            label="NPS Score"
            value={loadingStats ? '...' : (bizStats?.nps_score ?? '-')}
            dotColor={npsColor}
            tooltip={"9-10 → Promotor\n7-8 → Neutro\n0-6 → Detrator\n\nNPS = % Promotores − % Detratores\nVaria de −100 a +100"}
          />
        </div>
      </div>

      {/* Google Conversion Card */}
      {bizStats?.google_conversion && bizStats.google_conversion.total_promoters > 0 && (
        <div className="mb-8">
          <GoogleConversionCard stats={bizStats.google_conversion} />
        </div>
      )}

      {/* Responses / Requests Section */}
      <div className="mb-8" data-tour="dashboard-responses">
        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
          {/* Tabs Header */}
          <div className="border-b border-slate-200">
            <div className="flex items-center justify-between px-6">
              <nav className="flex gap-x-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('responses')}
                  className={cn(
                    'py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === 'responses'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  )}
                >
                  {t('nps.tabResponses', 'Respostas')}
                  {bizStats && bizStats.total_responses > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                      {bizStats.total_responses}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('requests')}
                  className={cn(
                    'py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                    activeTab === 'requests'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  )}
                >
                  {t('nps.tabRequests', 'Pedidos Enviados')}
                  {bizStats && bizStats.total_requests > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600">
                      {bizStats.total_requests}
                    </span>
                  )}
                </button>
              </nav>

              {activeTab === 'responses' && (
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={filter}
                    onChange={(e) => handleFilterChange(e.target.value as typeof filter)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="all">{t('feedback.filterAll', 'Todos')}</option>
                    <option value="promoter">{t('feedback.filterPromoters', 'Promotores')}</option>
                    <option value="passive">{t('feedback.filterPassives', 'Neutros')}</option>
                    <option value="detractor">{t('feedback.filterDetractors', 'Detratores')}</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'responses' ? (
            <>
              {loadingResponses ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                </div>
              ) : responses && responses.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {responses.map((response) => (
                    <ResponseRow
                      key={response.id}
                      response={response}
                      onResolve={handleResolve}
                      isResolving={resolvingId === response.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 px-6">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {filter === 'all'
                      ? t('feedback.noResponses', 'Nenhuma resposta recebida ainda')
                      : t('feedback.noResponsesFilter', 'Nenhuma resposta com este filtro')}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {t('nps.emptySubtitle', 'Comece enviando sua primeira pesquisa NPS.')}
                  </p>
                  <Button onClick={() => setIsNPSModalOpen(true)} size="sm" className="mt-4">
                    <Plus className="w-4 h-4" />
                    {t('nps.sendFirstNPS', 'Enviar primeira pesquisa')}
                  </Button>
                </div>
              )}

              {/* Responses Pagination */}
              {responses && responses.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResponsesPage(p => Math.max(0, p - 1))}
                    disabled={responsesPage === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('common.previous', 'Anterior')}
                  </Button>
                  <span className="text-sm text-slate-500">
                    {t('common.page', 'Página')} {responsesPage + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResponsesPage(p => p + 1)}
                    disabled={responses.length < PAGE_SIZE}
                  >
                    {t('common.next', 'Próxima')}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {loadingRequests ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                </div>
              ) : requests && requests.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {requests.map((request) => (
                    <RequestRow key={request.id} request={request} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 px-6">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <Send className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('nps.noRequests', 'Nenhum pedido enviado ainda')}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {t('nps.emptySubtitle', 'Comece enviando sua primeira pesquisa NPS.')}
                  </p>
                  <Button onClick={() => setIsNPSModalOpen(true)} size="sm" className="mt-4">
                    <Plus className="w-4 h-4" />
                    {t('nps.sendFirstNPS', 'Enviar primeira pesquisa')}
                  </Button>
                </div>
              )}

              {/* Requests Pagination */}
              {requests && requests.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRequestsPage(p => Math.max(0, p - 1))}
                    disabled={requestsPage === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('common.previous', 'Anterior')}
                  </Button>
                  <span className="text-sm text-slate-500">
                    {t('common.page', 'Página')} {requestsPage + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRequestsPage(p => p + 1)}
                    disabled={requests.length < PAGE_SIZE}
                  >
                    {t('common.next', 'Próxima')}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        projectId={projectId}
      />

      {/* Send NPS Modal */}
      <SendNPSModal
        isOpen={isNPSModalOpen}
        onClose={() => setIsNPSModalOpen(false)}
        businessId={effectiveBusinessId}
        businessName={effectiveBusinessName}
      />
    </div>
  );
}
