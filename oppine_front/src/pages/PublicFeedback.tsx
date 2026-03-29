import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Send, Loader2, CheckCircle, Star, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { axiosClient } from '@/api/axiosClient';

// ============================================================================
// Types
// ============================================================================

interface PublicBusinessInfo {
  id: string;
  name: string;
  logo_url?: string;
}

// ============================================================================
// API Hooks
// ============================================================================

const usePublicBusinessInfo = (businessId: string) => {
  return useQuery({
    queryKey: ['publicBusiness', businessId],
    queryFn: async () => {
      const { data } = await axiosClient.get<PublicBusinessInfo>(
        `/feedback/public/business/${businessId}`
      );
      return data;
    },
    enabled: !!businessId,
    retry: false,
  });
};

const usePublicFeedbackRequest = () => {
  return useMutation({
    mutationFn: async (payload: { business_id: string; customer_phone: string; customer_name?: string }) => {
      const { data } = await axiosClient.post('/feedback/public/request', payload);
      return data;
    },
  });
};

// ============================================================================
// Main Component
// ============================================================================

export default function PublicFeedback() {
  const { t } = useTranslation();
  const { businessId } = useParams<{ businessId: string }>();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: business, isLoading, error } = usePublicBusinessInfo(businessId || '');
  const createRequest = usePublicFeedbackRequest();

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerPhone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = customerPhone.replace(/\D/g, '');
    if (phone.length < 10) {
      toast.error(t('publicFeedback.invalidPhone', 'Telefone inválido'));
      return;
    }

    try {
      await createRequest.mutateAsync({
        business_id: businessId || '',
        customer_phone: `+55${phone}`,
        customer_name: customerName || undefined,
      });
      setSubmitted(true);
    } catch {
      toast.error(t('publicFeedback.error', 'Erro ao enviar. Tente novamente.'));
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
  if (error || !business) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            {t('publicFeedback.notFound', 'Link inválido')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('publicFeedback.notFoundDescription', 'Este link de feedback não existe ou foi desativado.')}
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            {t('publicFeedback.thankYou', 'Obrigado!')}
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            {t('publicFeedback.successMessage', 'Você receberá uma mensagem no WhatsApp em instantes para avaliar sua experiência.')}
          </p>
          <div className="flex items-center justify-center gap-1 text-sm text-slate-400">
            <Star className="w-4 h-4" />
            <span>{business.name}</span>
          </div>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-sm p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          {business.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="w-16 h-16 mx-auto mb-4 rounded-xl object-cover" />
          ) : (
            <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-primary" />
            </div>
          )}
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            {t('publicFeedback.title', 'Avalie sua experiência')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('publicFeedback.subtitle', 'Sua opinião é muito importante para')} <strong>{business.name}</strong>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('publicFeedback.name', 'Seu nome')}
              <span className="text-slate-400 font-normal ml-1">({t('common.optional', 'opcional')})</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('publicFeedback.namePlaceholder', 'Ex: João Silva')}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('publicFeedback.phone', 'Seu WhatsApp')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="tel"
                value={customerPhone}
                onChange={handlePhoneChange}
                placeholder="(00) 00000-0000"
                required
                className="w-full pl-12 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {t('publicFeedback.phoneHint', 'Você receberá a pesquisa neste número')}
            </p>
          </div>

          <button
            type="submit"
            disabled={createRequest.isPending}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
          >
            {createRequest.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {t('publicFeedback.submit', 'Enviar')}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          {t('publicFeedback.privacy', 'Seus dados são usados apenas para enviar a pesquisa de satisfação.')}
        </p>
      </div>
    </div>
  );
}
