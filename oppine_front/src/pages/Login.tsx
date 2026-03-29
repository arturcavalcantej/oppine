import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowLeft, Shield, Star, MessageCircle } from 'lucide-react';
import { Logo } from '@/components/core/Logo';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/contexts/authStore';
import { useTranslation } from 'react-i18next';
import { useMemo, useState, useEffect } from 'react';
import PostAuthPlanModal from '@/components/modules/PostAuthPlanModal';
import {
  getRecommendedPlan,
  setRecommendedPlan,
  clearRecommendedPlan,
} from '@/lib/recommendedPlan';

type LoginFormData = {
  email: string;
  password: string;
};

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Persist recommended_plan from URL to sessionStorage
  useEffect(() => {
    const planFromUrl = searchParams.get('recommended_plan');
    if (planFromUrl) {
      setRecommendedPlan(planFromUrl);
    }
  }, [searchParams]);

  const handleContinueFree = () => {
    clearRecommendedPlan();
    navigate('/dashboard');
  };

  const loginSchema = useMemo(() => z.object({
    email: z.string().email(t('auth.validation.emailRequired')),
    password: z.string().min(6, t('auth.validation.passwordMin')),
  }), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      toast.success(t('auth.welcomeBack'));

      // If recommended_plan exists, show modal; otherwise go to dashboard
      const recommendedPlan = getRecommendedPlan();
      if (recommendedPlan) {
        setShowPlanModal(true);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(t('auth.validation.invalidCredentials'));
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex bg-white selection:bg-primary/20">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-[#12263F] to-[#1a3a5c] items-center justify-center p-12">
        {/* Decorative elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-gradient-to-br from-primary/30 to-transparent rounded-full blur-[150px] animate-pulse-slow" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-gradient-to-tr from-accent/20 to-transparent rounded-full blur-[150px] animate-pulse-slow delay-1000" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" />
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-5xl font-bold mb-6 leading-tight text-white">
            {t('auth.welcomeTitle')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">{t('auth.welcomeHighlight')}</span>.
          </h2>
          <p className="text-xl text-white/70 leading-relaxed">
            "{t('auth.testimonial')}"
          </p>
          <div className="mt-8 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Star className="w-6 h-6 text-white" fill="white" />
            </div>
            <div>
              <p className="font-bold text-white">{t('auth.testimonialAuthor')}</p>
              <p className="text-sm text-white/60">{t('auth.testimonialRole')}</p>
            </div>
          </div>

          {/* Feature highlights */}
          <div className="mt-12 grid grid-cols-3 gap-4">
            <div className="rounded-xl ring-1 ring-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
              <Shield className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-xs text-white/80">Blindagem de Reputação</p>
            </div>
            <div className="rounded-xl ring-1 ring-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
              <MessageCircle className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-xs text-white/80">WhatsApp Automático</p>
            </div>
            <div className="rounded-xl ring-1 ring-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
              <Star className="w-8 h-8 text-accent mx-auto mb-2" fill="#FFB800" />
              <p className="text-xs text-white/80">Mais 5 Estrelas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 sm:p-16 lg:p-24 relative">
        <Link to="/" className="absolute top-8 left-8 sm:left-16 lg:left-24 flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-sm font-medium group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {t('auth.backToHome')}
        </Link>

        <div className="max-w-sm w-full mx-auto">
          <div className="mb-10">
            <div className="mb-6">
              <Logo variant="full" size="2xl" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">{t('auth.loginTitle')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('auth.loginSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('auth.email')}</label>
              <input
                type="email"
                {...register('email')}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400"
                placeholder="nome@exemplo.com"
              />
              {errors.email && (
                <p className="text-error text-xs mt-1.5">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-medium text-slate-700">{t('auth.password')}</label>
                <Link to="#" className="text-xs text-slate-400 hover:text-primary transition-colors">{t('auth.forgotPassword')}</Link>
              </div>
              <input
                type="password"
                {...register('password')}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-error text-xs mt-1.5">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2"
              size="lg"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('auth.signIn')}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500">
            {t('auth.noAccount')}{' '}
            <Link
              to={
                searchParams.get('recommended_plan') || getRecommendedPlan()
                  ? `/register?recommended_plan=${searchParams.get('recommended_plan') || getRecommendedPlan()}`
                  : '/register'
              }
              className="text-primary hover:underline font-medium"
            >
              {t('auth.createAccount')}
            </Link>
          </div>
        </div>
      </div>

      <PostAuthPlanModal
        isOpen={showPlanModal}
        onContinueFree={handleContinueFree}
        recommendedPlan={getRecommendedPlan() || undefined}
      />
    </div>
  );
}
