import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, Loader2, CheckCircle, ExternalLink, MessageSquare, Frown, Meh, Smile } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { axiosClient } from '@/api/axiosClient';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface FeedbackInfo {
  already_responded: boolean;
  expired: boolean;
  business_name: string;
  customer_name?: string;
}

interface FeedbackResult {
  success: boolean;
  classification: 'promoter' | 'passive' | 'detractor';
  score: number;
  google_review_url?: string;
  message: string;
}

// ============================================================================
// API Hooks
// ============================================================================

const useFeedbackInfo = (requestId: string) => {
  return useQuery({
    queryKey: ['feedbackInfo', requestId],
    queryFn: async () => {
      const { data } = await axiosClient.get<FeedbackInfo>(`/feedback/public/${requestId}`);
      return data;
    },
    enabled: !!requestId,
    retry: false,
  });
};

const useSubmitFeedback = () => {
  return useMutation({
    mutationFn: async ({ requestId, score, comment }: { requestId: string; score: number; comment?: string }) => {
      const { data } = await axiosClient.post<FeedbackResult>(`/feedback/public/${requestId}/respond`, {
        score,
        comment,
      });
      return data;
    },
  });
};

// ============================================================================
// Score Button Component
// ============================================================================

function ScoreButton({
  score,
  selected,
  onClick
}: {
  score: number;
  selected: boolean;
  onClick: () => void;
}) {
  const getColor = (s: number) => {
    if (s <= 6) return selected ? 'bg-red-500 text-white ring-red-500' : 'ring-red-200 text-red-600 hover:bg-red-50';
    if (s <= 8) return selected ? 'bg-yellow-500 text-white ring-yellow-500' : 'ring-yellow-200 text-yellow-600 hover:bg-yellow-50';
    return selected ? 'bg-green-500 text-white ring-green-500' : 'ring-green-200 text-green-600 hover:bg-green-50';
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-10 h-10 sm:w-12 sm:h-12 rounded-xl ring-2 font-bold text-lg transition-all',
        getColor(score),
        selected && 'scale-110 shadow-lg'
      )}
    >
      {score}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function FeedbackForm() {
  const { t } = useTranslation();
  const { requestId } = useParams<{ requestId: string }>();

  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [result, setResult] = useState<FeedbackResult | null>(null);

  const { data: feedbackInfo, isLoading, error } = useFeedbackInfo(requestId || '');
  const submitFeedback = useSubmitFeedback();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScore === null) {
      toast.error(t('feedbackForm.selectScore', 'Selecione uma nota'));
      return;
    }

    try {
      const response = await submitFeedback.mutateAsync({
        requestId: requestId || '',
        score: selectedScore,
        comment: comment || undefined,
      });
      setResult(response);
    } catch {
      toast.error(t('feedbackForm.error', 'Erro ao enviar. Tente novamente.'));
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Error state
  if (error || !feedbackInfo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            {t('feedbackForm.notFound', 'Link inválido')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('feedbackForm.notFoundDescription', 'Este link de avaliação não existe ou expirou.')}
          </p>
        </div>
      </div>
    );
  }

  // Already responded
  if (feedbackInfo.already_responded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            {t('feedbackForm.alreadyResponded', 'Você já avaliou!')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('feedbackForm.alreadyRespondedDescription', 'Obrigado por compartilhar sua opinião com')} <strong>{feedbackInfo.business_name}</strong>
          </p>
        </div>
      </div>
    );
  }

  // Expired
  if (feedbackInfo.expired) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            {t('feedbackForm.expired', 'Link expirado')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('feedbackForm.expiredDescription', 'Este link de avaliação expirou.')}
          </p>
        </div>
      </div>
    );
  }

  // Success state - show result
  if (result) {
    const isPromoter = result.classification === 'promoter';

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-sm p-8 max-w-md w-full text-center">
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6',
            isPromoter ? 'bg-green-50' : result.classification === 'passive' ? 'bg-yellow-50' : 'bg-slate-100'
          )}>
            {isPromoter ? (
              <Smile className="w-10 h-10 text-green-600" />
            ) : result.classification === 'passive' ? (
              <Meh className="w-10 h-10 text-yellow-600" />
            ) : (
              <Frown className="w-10 h-10 text-slate-500" />
            )}
          </div>

          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            {t('feedbackForm.thankYou', 'Obrigado!')}
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            {result.message}
          </p>

          {isPromoter && result.google_review_url && (
            <a
              href={result.google_review_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
            >
              <Star className="w-5 h-5" />
              {t('feedbackForm.reviewOnGoogle', 'Avaliar no Google')}
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          <div className="flex items-center justify-center gap-1 text-sm text-slate-400 mt-6">
            <Star className="w-4 h-4" />
            <span>{feedbackInfo.business_name}</span>
          </div>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-sm p-6 sm:p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            {t('feedbackForm.title', 'Como foi sua experiência?')}
          </h1>
          <p className="text-sm text-slate-500">
            {feedbackInfo.customer_name && <span>{feedbackInfo.customer_name}, </span>}
            {t('feedbackForm.subtitle', 'sua opinião é muito importante para')} <strong>{feedbackInfo.business_name}</strong>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Score Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3 text-center">
              {t('feedbackForm.scoreLabel', 'De 0 a 10, quanto você nos recomendaria?')}
            </label>
            <div className="flex justify-center gap-1 sm:gap-2 flex-wrap">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <ScoreButton
                  key={score}
                  score={score}
                  selected={selectedScore === score}
                  onClick={() => setSelectedScore(score)}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-2 px-1">
              <span>{t('feedbackForm.notLikely', 'Nada provável')}</span>
              <span>{t('feedbackForm.veryLikely', 'Muito provável')}</span>
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('feedbackForm.commentLabel', 'Quer deixar um comentário?')}
              <span className="text-slate-400 font-normal ml-1">({t('common.optional', 'opcional')})</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('feedbackForm.commentPlaceholder', 'Conte-nos mais sobre sua experiência...')}
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none text-sm"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitFeedback.isPending || selectedScore === null}
            className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitFeedback.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            {t('feedbackForm.submit', 'Enviar Avaliação')}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          {t('feedbackForm.privacy', 'Sua avaliação é confidencial e nos ajuda a melhorar.')}
        </p>
      </div>
    </div>
  );
}
