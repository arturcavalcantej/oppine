import { Logo } from '@/components/core/Logo';
import { useAuthStore } from '@/contexts/authStore';
import { Button } from '@/components/ui/button';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Loader2, Shield, Star, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

type RegisterFormData = {
  name: string;
  email: string;
  password: string;
};

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register: registerUser } = useAuthStore();

  // Get plan from URL param (e.g., /register?plan=oppine-starter-monthly)
  const planSlug = searchParams.get('plan');

  const registerSchema = useMemo(() => z.object({
    name: z.string().min(2, t('auth.validation.nameMin')),
    email: z.string().email(t('auth.validation.emailRequired')),
    password: z.string().min(6, t('auth.validation.passwordMin')),
  }), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser(data.email, data.password, data.name);
      toast.success('Conta criada com sucesso!');

      // If plan was specified, save to sessionStorage for auto-checkout
      if (planSlug) {
        console.log('Saving pending plan to sessionStorage:', planSlug); // Debug
        sessionStorage.setItem('pendingCheckoutPlan', planSlug);
      }

      // Navigate to select-plan page (which will auto-checkout if plan is pending)
      console.log('Navigating to /select-plan'); // Debug
      navigate('/select-plan');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao criar conta';
      toast.error(message);
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex bg-white selection:bg-primary/20">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-primary to-[#00996B] items-center justify-center p-12">
        {/* Decorative elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-gradient-to-br from-white/20 to-transparent rounded-full blur-[150px] animate-pulse-slow" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-gradient-to-tr from-accent/30 to-transparent rounded-full blur-[150px] animate-pulse-slow delay-1000" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" />
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-5xl font-bold mb-6 leading-tight text-white">
            Transforme clientes em <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-white">avaliações 5 estrelas</span>
          </h2>
          <p className="text-lg text-white/80 leading-relaxed mb-8">
            {t('oppine.tagline')}. Junte-se a centenas de negócios locais que já aumentaram sua visibilidade no Google.
          </p>

          {/* Benefits list */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">{t('oppine.benefits.protection')}</p>
                <p className="text-sm text-white/70">{t('oppine.benefits.protectionDesc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">{t('oppine.benefits.automation')}</p>
                <p className="text-sm text-white/70">{t('oppine.benefits.automationDesc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-white">{t('oppine.benefits.growth')}</p>
                <p className="text-sm text-white/70">{t('oppine.benefits.growthDesc')}</p>
              </div>
            </div>
          </div>

          {/* Rating display */}
          <div className="mt-10 rounded-xl ring-1 ring-white/10 bg-white/5 backdrop-blur-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-6 h-6 text-accent" fill="#FFB800" />
              ))}
            </div>
            <p className="text-white/90 text-sm">
              "Em 30 dias, passei de 15 para 47 avaliações no Google. A OPINNE é essencial."
            </p>
            <p className="text-white/60 text-xs mt-2">— Maria Silva, Salão de Beleza</p>
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
            <h1 className="text-2xl font-semibold text-slate-900">{t('auth.registerTitle')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('auth.registerSubtitle')}</p>

            {/* Show selected plan */}
            {planSlug && (
              <div className="mt-4 p-3 bg-primary/5 rounded-lg ring-1 ring-primary/20">
                <p className="text-sm text-primary font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Plano selecionado: <span className="font-bold">{planSlug.includes('growth') ? 'Growth' : 'Starter'}</span>
                  {planSlug.includes('yearly') && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">Anual</span>}
                </p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('auth.name')}</label>
              <input
                type="text"
                {...register('name')}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400"
                placeholder="João Silva"
              />
              {errors.name && (
                <p className="text-error text-xs mt-1.5">{errors.name.message}</p>
              )}
            </div>

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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('auth.password')}</label>
              <input
                type="password"
                {...register('password')}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm placeholder:text-slate-400"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-error text-xs mt-1.5">{errors.password.message}</p>
              )}
              <p className="text-xs text-slate-400 mt-1.5">Mínimo de 8 caracteres</p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2"
              size="lg"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('auth.createAccount')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {t('auth.hasAccount')}{' '}
            <Link
              to="/login"
              className="text-primary hover:underline font-medium"
            >
              {t('auth.signIn')}
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-400 text-center">
            Ao criar uma conta, você concorda com nossos{' '}
            <Link to="#" className="text-primary hover:underline">Termos de Serviço</Link>
            {' '}e{' '}
            <Link to="#" className="text-primary hover:underline">Política de Privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
