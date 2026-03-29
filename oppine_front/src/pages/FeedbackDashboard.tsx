import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  MessageSquare,
  Star,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Users,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Phone,
  Clock,
  Filter,
  Plus,
  Send,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useBusiness } from '@/api/hooks/useBusinesses';
import SendNPSModal from '@/components/modules/SendNPSModal';
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

// ============================================================================
// NPS Gauge Component
// ============================================================================

interface NPSGaugeProps {
  score: number | null;
}

function NPSGauge({ score }: NPSGaugeProps) {
  const { t } = useTranslation();

  if (score === null) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-slate-400">{t('feedback.noData', 'Sem dados suficientes')}</p>
      </div>
    );
  }

  const getColor = (s: number) => {
    if (s >= 50) return 'text-green-600';
    if (s >= 0) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLabel = (s: number) => {
    if (s >= 70) return t('feedback.npsExcellent', 'Excelente');
    if (s >= 50) return t('feedback.npsGood', 'Bom');
    if (s >= 0) return t('feedback.npsOk', 'Regular');
    return t('feedback.npsBad', 'Precisa melhorar');
  };

  return (
    <div className="text-center">
      <p className={cn('text-5xl font-bold', getColor(score))}>{score}</p>
      <p className="text-sm text-slate-500 mt-2">{getLabel(score)}</p>
    </div>
  );
}

// ============================================================================
// Classification Badge
// ============================================================================

function ClassificationBadge({ classification }: { classification: string }) {
  const icon = {
    promoter: ThumbsUp,
    passive: Minus,
    detractor: ThumbsDown,
  }[classification] || Minus;

  const Icon = icon;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium', getClassificationColor(classification))}>
      <Icon className="w-3 h-3" />
      {getClassificationLabel(classification)}
    </span>
  );
}

// ============================================================================
// Response Row (for divide-y stacked list)
// ============================================================================

interface ResponseRowProps {
  response: FeedbackResponse;
  onResolve: (response: FeedbackResponse) => void;
  isResolving: boolean;
}

function ResponseRow({ response, onResolve, isResolving }: ResponseRowProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(
      'px-6 py-5',
      response.classification === 'detractor' && !response.issue_resolved && 'bg-red-50/50'
    )}>
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
          {/* Top row: name, classification, date */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-900 text-sm">
                {response.customer_name || t('feedback.anonymous', 'Cliente Anônimo')}
              </p>
              <ClassificationBadge classification={response.classification} />
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {new Date(response.responded_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
            <Phone className="w-3 h-3" />
            {response.customer_phone}
          </div>

          {/* Comment */}
          {response.comment && (
            <p className="text-sm text-slate-600 italic mb-2">"{response.comment}"</p>
          )}

          {/* Footer: badges + resolve button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs">
              {response.google_review_clicked && (
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

            {response.classification === 'detractor' && !response.issue_resolved && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolve(response)}
                disabled={isResolving}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <CheckCircle className="w-3 h-3" />
                {isResolving ? t('common.loading', 'Carregando...') : t('feedback.markResolved', 'Marcar Resolvido')}
              </Button>
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

// ============================================================================
// Request Row (for divide-y stacked list)
// ============================================================================

interface RequestRowProps {
  request: FeedbackRequest;
}

function RequestRow({ request }: RequestRowProps) {
  const { t } = useTranslation();

  const initials = (request.customer_name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          {request.customer_name ? (
            <span className="text-xs font-medium text-slate-600">{initials}</span>
          ) : (
            <UserPlus className="w-4 h-4 text-slate-400" />
          )}
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
        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', getStatusColor(request.status))}>
          {getStatusLabel(request.status)}
        </span>
        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
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
// Main Feedback Dashboard Page
// ============================================================================

export default function FeedbackDashboard() {
  const { t } = useTranslation();
  const { businessId } = useParams<{ businessId: string }>();

  // Modal state
  const [isNPSModalOpen, setIsNPSModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'responses' | 'requests'>('responses');

  // Fetch business details
  const { data: business, isLoading: loadingBusiness } = useBusiness(businessId || '');

  // Fetch dashboard stats
  const { data: stats, isLoading: loadingStats } = useDashboardStats(businessId || '', 30);

  // Fetch responses with filter
  const [filter, setFilter] = useState<'all' | 'promoter' | 'passive' | 'detractor'>('all');
  const { data: responses, isLoading: loadingResponses } = useFeedbackResponses(
    businessId || '',
    filter === 'all' ? undefined : filter
  );

  // Fetch requests
  const { data: requests, isLoading: loadingRequests } = useFeedbackRequests(businessId || '');

  // Resolve mutation
  const resolveMutation = useResolveIssue();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (response: FeedbackResponse) => {
    setResolvingId(response.id);
    try {
      await resolveMutation.mutateAsync({
        responseId: response.id,
        businessId: businessId || '',
      });
      toast.success(t('feedback.issueResolved', 'Problema marcado como resolvido!'));
    } catch {
      toast.error(t('common.error', 'Ocorreu um erro. Tente novamente.'));
    } finally {
      setResolvingId(null);
    }
  };

  const isLoading = loadingBusiness || loadingStats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500">{t('feedback.businessNotFound', 'Negócio não encontrado')}</p>
        <Link to="/dashboard/businesses" className="text-sm text-primary hover:underline mt-2 inline-block">
          {t('common.goBack', 'Voltar')}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/dashboard/businesses"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back', 'Voltar')}
        </Link>
        <div className="flex items-start justify-between pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{business.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {t('feedback.dashboardSubtitle', 'Dashboard de feedbacks e avaliações')}
            </p>
          </div>
          <Button onClick={() => setIsNPSModalOpen(true)}>
            <Plus className="w-4 h-4" />
            {t('nps.collectFeedbacks', 'Coletar Feedbacks')}
          </Button>
        </div>
      </div>

      {/* Stats Grid - shared borders pattern */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl bg-slate-900/5 ring-1 ring-slate-900/5 mb-8">
        <div className="bg-white p-5 rounded-tl-xl lg:rounded-tl-xl">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {t('feedback.totalRequests', 'Pedidos Enviados')}
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.total_requests || 0}</p>
          <p className="text-xs text-slate-400 mt-1">{t('feedback.last30days', 'Últimos 30 dias')}</p>
        </div>
        <div className="bg-white p-5 rounded-tr-xl lg:rounded-none">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            {t('feedback.totalResponses', 'Respostas')}
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.total_responses || 0}</p>
          <p className="text-xs text-slate-400 mt-1">{stats?.response_rate?.toFixed(1) || 0}% {t('feedback.responseRate', 'de resposta')}</p>
        </div>
        <div className="bg-white p-5 lg:rounded-none">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {t('feedback.avgScore', 'Nota Média')}
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.average_score?.toFixed(1) || '-'}</p>
          <p className="text-xs text-slate-400 mt-1">{t('feedback.scoreScale', 'de 0 a 10')}</p>
        </div>
        <div className="bg-white p-5 rounded-br-xl lg:rounded-br-xl">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {t('feedback.pendingAlerts', 'Alertas Pendentes')}
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{stats?.pending_alerts || 0}</p>
          <p className="text-xs text-slate-400 mt-1">{stats?.resolved_issues || 0} {t('feedback.resolved', 'resolvidos')}</p>
        </div>
      </div>

      {/* NPS and Classification */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* NPS Score */}
        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              {t('feedback.npsScore', 'NPS Score')}
            </h3>
          </div>
          <div className="p-6">
            <NPSGauge score={stats?.nps_score || null} />
          </div>
        </div>

        {/* Classification Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              {t('feedback.classificationBreakdown', 'Distribuição de Classificações')}
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setFilter(filter === 'promoter' ? 'all' : 'promoter')}
                className={cn(
                  'p-4 rounded-lg text-center transition-colors ring-1',
                  filter === 'promoter'
                    ? 'ring-2 ring-green-500 bg-green-50'
                    : 'ring-slate-200 hover:bg-slate-50'
                )}
              >
                <ThumbsUp className="w-5 h-5 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">{stats?.promoters || 0}</p>
                <p className="text-xs text-green-600 font-medium">{t('feedback.promoters', 'Promotores')}</p>
                <p className="text-xs text-slate-400 mt-0.5">(9-10)</p>
              </button>

              <button
                onClick={() => setFilter(filter === 'passive' ? 'all' : 'passive')}
                className={cn(
                  'p-4 rounded-lg text-center transition-colors ring-1',
                  filter === 'passive'
                    ? 'ring-2 ring-slate-400 bg-slate-50'
                    : 'ring-slate-200 hover:bg-slate-50'
                )}
              >
                <Minus className="w-5 h-5 text-slate-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">{stats?.passives || 0}</p>
                <p className="text-xs text-slate-500 font-medium">{t('feedback.passives', 'Neutros')}</p>
                <p className="text-xs text-slate-400 mt-0.5">(7-8)</p>
              </button>

              <button
                onClick={() => setFilter(filter === 'detractor' ? 'all' : 'detractor')}
                className={cn(
                  'p-4 rounded-lg text-center transition-colors ring-1',
                  filter === 'detractor'
                    ? 'ring-2 ring-red-500 bg-red-50'
                    : 'ring-slate-200 hover:bg-slate-50'
                )}
              >
                <ThumbsDown className="w-5 h-5 text-red-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">{stats?.detractors || 0}</p>
                <p className="text-xs text-red-500 font-medium">{t('feedback.detractors', 'Detratores')}</p>
                <p className="text-xs text-slate-400 mt-0.5">(0-6)</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Content */}
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 overflow-hidden">
        {/* Tabs Header - underline tabs */}
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
                {stats && stats.total_responses > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                    {stats.total_responses}
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
                {requests && requests.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600">
                    {requests.length}
                  </span>
                )}
              </button>
            </nav>

            {activeTab === 'responses' && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
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
                <p className="text-sm text-slate-500 mt-1">Comece enviando sua primeira pesquisa NPS.</p>
                <Button
                  size="sm"
                  onClick={() => setIsNPSModalOpen(true)}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4" />
                  {t('nps.sendFirstNPS', 'Enviar primeira pesquisa')}
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
                <p className="text-sm text-slate-500 mt-1">Envie sua primeira pesquisa NPS para começar.</p>
                <Button
                  size="sm"
                  onClick={() => setIsNPSModalOpen(true)}
                  className="mt-4"
                >
                  <Plus className="w-4 h-4" />
                  {t('nps.sendFirstNPS', 'Enviar primeira pesquisa')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Send NPS Modal */}
      <SendNPSModal
        isOpen={isNPSModalOpen}
        onClose={() => setIsNPSModalOpen(false)}
        businessId={businessId || ''}
        businessName={business?.name || ''}
      />
    </div>
  );
}
