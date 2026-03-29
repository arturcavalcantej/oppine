import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Building2, Phone, ExternalLink, ChevronDown, HelpCircle, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/core/Logo';
import { useAuthStore } from '@/contexts/authStore';
import { useUIStore } from '@/contexts/uiStore';
import { useProjects } from '@/api/hooks/useProjects';
import {
  useCreateBusiness,
  useUpdateBusiness,
  useCreateTemplate,
  BusinessCreate,
  TemplateCreate,
} from '@/api/hooks/useBusinesses';

const TOTAL_STEPS = 2;

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, completeOnboarding } = useAuthStore();
  const { setSelectedBusinessId } = useUIStore();

  const { data: projects } = useProjects();
  const projectId = projects?.[0]?.id || '';

  const createBusinessMutation = useCreateBusiness();
  const updateBusinessMutation = useUpdateBusiness();
  const createTemplateMutation = useCreateTemplate();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGoogleTutorial, setShowGoogleTutorial] = useState(false);

  // Business data
  const [businessName, setBusinessName] = useState('');
  const [alertPhone, setAlertPhone] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');

  const isLoading = createBusinessMutation.isPending || updateBusinessMutation.isPending || createTemplateMutation.isPending;

  const canProceed = businessName.trim().length > 0 && alertPhone.trim().length > 0 && googleReviewUrl.trim().length > 0;

  // Create business + default template, then finish
  const handleFinish = async () => {
    if (!projectId || !canProceed) return;

    setIsSubmitting(true);
    try {
      // 1. Create business
      const newBusiness = await createBusinessMutation.mutateAsync({
        project_id: projectId,
        name: businessName.trim(),
        google_review_url: googleReviewUrl.trim() || undefined,
        alert_phone: alertPhone.trim() || undefined,
      } as BusinessCreate);

      setSelectedBusinessId(newBusiness.id);

      // 2. Create default template
      const templatePayload: TemplateCreate = {
        name: 'NPS Clássico',
        initial_message: `Olá {customer_name}! Obrigado por escolher ${businessName.trim()}.\n\nDe 0 a 10, qual a chance de você nos recomendar para amigos ou familiares?`,
        thank_you_promoter: 'Muito obrigado pela nota! Ficamos muito felizes com sua avaliação!\n\nQue tal compartilhar sua experiência no Google? Isso nos ajuda muito!',
        thank_you_passive: 'Obrigado pelo seu feedback!\n\nHá algo específico que poderíamos melhorar para conquistar um 10?',
        thank_you_detractor: 'Obrigado pelo seu feedback.\n\nLamentamos que sua experiência não tenha sido a melhor. Poderia nos contar o que aconteceu? Queremos melhorar.',
        is_default: true,
      };

      const created = await createTemplateMutation.mutateAsync({
        businessId: newBusiness.id,
        payload: templatePayload,
      });

      // 3. Link template to business
      await updateBusinessMutation.mutateAsync({
        businessId: newBusiness.id,
        payload: { template_id: created.data.id },
      });

      // 4. Complete onboarding
      await completeOnboarding();
      toast.success('Configuração concluída!');
      navigate('/dashboard?tour=1');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string } } };
      const errorMessage = axiosError?.response?.data?.detail || 'Ocorreu um erro ao criar o negócio.';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo variant="full" size="3xl" />
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i + 1 <= step ? 'w-10 bg-primary' : 'w-6 bg-slate-200'
              )}
            />
          ))}
        </div>

        <div className="bg-white rounded-xl ring-1 ring-slate-900/5 shadow-sm p-8">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-slate-900 mb-3">
                Bem-vindo ao Oppine{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
              </h1>
              <p className="text-sm text-slate-500 mb-8">
                Vamos configurar seu primeiro negócio para você começar a coletar feedback dos seus clientes.
              </p>
              <Button onClick={() => setStep(2)} size="lg">
                Começar
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Business info */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Configure seu Negócio</h2>
                  <p className="text-xs text-slate-500">Preencha as informações para começar</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Nome do negócio */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nome do negócio *
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    placeholder="Ex: Barbearia do João"
                    autoFocus
                  />
                </div>

                {/* Telefone para alertas */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Telefone para alertas *
                  </label>
                  <input
                    type="tel"
                    value={alertPhone}
                    onChange={(e) => setAlertPhone(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    placeholder="11999999999"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Receba alertas quando clientes derem notas baixas
                  </p>
                </div>

                {/* Separador */}
                <hr className="border-slate-100" />

                {/* Link Google Reviews */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <ExternalLink className="w-4 h-4 inline mr-1" />
                    Link do Google Reviews *
                  </label>
                  <input
                    type="url"
                    value={googleReviewUrl}
                    onChange={(e) => setGoogleReviewUrl(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                    placeholder="https://g.page/r/.../review"
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Clientes com notas 9-10 serão direcionados para avaliar aqui
                  </p>
                </div>

                {/* Tutorial */}
                <button
                  type="button"
                  onClick={() => setShowGoogleTutorial(!showGoogleTutorial)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-hover transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Como obter o link do Google?</span>
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showGoogleTutorial && 'rotate-180')} />
                </button>

                {showGoogleTutorial && (
                  <div className="p-4 bg-blue-50 rounded-lg ring-1 ring-blue-100 text-xs text-slate-700 space-y-3">
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

              <div className="flex items-center justify-between mt-8">
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={!canProceed || isSubmitting || isLoading}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Finalizar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
