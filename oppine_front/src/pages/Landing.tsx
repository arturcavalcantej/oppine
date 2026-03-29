import { Logo } from '@/components/core/Logo';
import { axiosClient } from '@/api/axiosClient';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  Loader2,
  MessageCircle,
  Minus,
  Quote,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// ============================================
// PRICING TYPES & HELPERS
// ============================================
interface HubPlan {
  id: number | string;
  name: string;
  slug: string;
  description: string;
  price: number | string;
  billing_period: 'MONTHLY' | 'YEARLY';
  features: Record<string, boolean | number>;
  limits: Record<string, number>;
  is_popular?: boolean;
}

// Static features for each tier (not from API)
const tierFeatures: Record<string, { description: string; disabled?: boolean }[]> = {
  starter: [
    { description: '50 envios/mês' },
    { description: '1 negócio' },
    { description: 'Automação total' },
    { description: 'Triagem automática' },
    { description: 'Dashboard de métricas' },
    { description: 'White-label', disabled: true },
    { description: 'Suporte prioritário', disabled: true },
  ],
  growth: [
    { description: 'Envios ilimitados' },
    { description: 'Negócios ilimitados' },
    { description: 'Automação total' },
    { description: 'Triagem automática' },
    { description: 'Dashboard de métricas' },
    { description: 'White-label (sua marca)' },
    { description: 'Suporte prioritário' },
  ],
};

// ============================================
// NAVBAR
// ============================================
function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled
        ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-slate-100'
        : 'bg-transparent'
        }`}
    >
      <div className="container mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between">
        <Link to="/" className="transition-transform hover:scale-105">
          <Logo variant="full" size="md" className="md:hidden" />
          <Logo variant="full" size="xl" className="hidden md:block" />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-xs md:text-sm font-medium text-slate-600 hover:text-primary transition-colors px-3 md:px-4 py-2"
          >
            Entrar
          </Link>
          <a
            href="#precos"
            className="px-4 md:px-6 py-2.5 md:py-3 rounded-full bg-secondary-dark text-white text-xs md:text-sm font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            Começar Agora
          </a>
        </div>
      </div>
    </header>
  );
}

// ============================================
// HERO SECTION
// ============================================
function Hero() {
  return (
    <section className="relative pt-24 md:pt-32 pb-16 md:pb-24 overflow-hidden bg-gradient-to-b from-white via-slate-50/50 to-white">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 md:px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-semibold mb-6 md:mb-8 animate-fade-in-up">
            <Shield className="w-4 h-4" />
            Blindagem de Reputação via WhatsApp
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-secondary-dark mb-3 md:mb-4 tracking-tight leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Transforme clientes satisfeitos em{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">
              avaliações 5 estrelas
            </span>
          </h1>

          <p className="text-base md:text-lg lg:text-xl text-slate-500 mb-3 md:mb-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            (e intercepte os insatisfeitos antes da crise)
          </p>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed px-2 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            Automação de coleta de feedback pós-compra via WhatsApp.
            <strong className="text-secondary-dark"> Notas altas vão pro Google.</strong>{' '}
            <strong className="text-secondary-dark">Notas baixas vão pra você resolver.</strong>
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 mb-12 md:mb-16 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <a
              href="#precos"
              className="group w-full sm:w-auto px-6 md:px-8 py-3.5 md:py-4 rounded-full bg-primary text-white font-bold text-base md:text-lg flex items-center justify-center gap-2 hover:bg-primary/90 shadow-xl shadow-primary/25 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              Começar Agora
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#como-funciona"
              className="w-full sm:w-auto px-6 md:px-8 py-3.5 md:py-4 rounded-full border-2 border-slate-200 text-slate-700 font-bold text-base md:text-lg hover:border-primary hover:text-primary transition-all duration-200 flex items-center justify-center gap-2"
            >
              Ver Como Funciona
              <ChevronDown className="w-5 h-5 animate-bounce-slow" />
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 max-w-xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            {[
              { value: '85%', label: 'Taxa de resposta' },
              { value: '4.8', label: 'Média de estrelas' },
              { value: '2x', label: 'Mais avaliações' },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-3 md:p-4 rounded-xl md:rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-100 hover:border-primary/30 hover:shadow-lg transition-all duration-200">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold text-secondary-dark">{stat.value}</div>
                <div className="text-xs md:text-sm text-slate-500 mt-0.5 md:mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// US VS THEM (VISUAL COMPARISON)
// ============================================
function Comparison() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-secondary-dark via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="text-center mb-10 md:mb-16">
          <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <X className="w-4 h-4" />
            Pare de perder tempo
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 md:mb-4 leading-tight">
            Chega de <span className="text-red-400 line-through decoration-2">implorar</span> por avaliações
          </h2>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto px-2">
            Veja como a jornada do seu cliente muda completamente com o OPINNE.
          </p>
        </div>

        {/* Visual Comparison - Two Journeys */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">

          {/* OLD WAY - The Chaos Journey */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-900/20 rounded-3xl blur-xl opacity-50" />
            <div className="relative bg-slate-900/90 backdrop-blur-sm rounded-2xl md:rounded-3xl p-5 md:p-8 border border-red-500/30 h-full">
              {/* Header */}
              <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-red-500/20 flex items-center justify-center">
                  <X className="w-5 h-5 md:w-7 md:h-7 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-white">Sem o OPINNE</h3>
                  <p className="text-red-400 text-sm font-medium">Caos e risco</p>
                </div>
              </div>

              {/* Visual Flow */}
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                    <span className="text-2xl">🛒</span>
                  </div>
                  <div className="flex-1 h-1 bg-gradient-to-r from-slate-600 to-red-500/50 rounded" />
                  <div className="text-sm text-slate-400">Cliente compra</div>
                </div>

                {/* Step 2 - The awkward moment */}
                <div className="relative bg-slate-800/50 rounded-2xl p-5 border border-red-500/20">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">😬</div>
                    <div>
                      <p className="text-white font-medium">"Me avalia aí no Google?"</p>
                      <p className="text-red-400 text-sm mt-1">Momento constrangedor...</p>
                    </div>
                  </div>
                </div>

                {/* Step 3 - The wait */}
                <div className="flex items-center gap-4 opacity-60">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <div className="text-sm text-slate-500">Você espera... e espera...</div>
                </div>

                {/* Step 4 - The result */}
                <div className="relative">
                  <div className="bg-red-500/10 rounded-2xl p-5 border border-red-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">Google Meu Negócio</span>
                      <div className="flex">
                        <Star className="w-4 h-4 text-red-400 fill-red-400" />
                        <Star className="w-4 h-4 text-slate-600" />
                        <Star className="w-4 h-4 text-slate-600" />
                        <Star className="w-4 h-4 text-slate-600" />
                        <Star className="w-4 h-4 text-slate-600" />
                      </div>
                    </div>
                    <p className="text-red-400 text-sm italic">"Péssimo atendimento! Nunca mais volto!"</p>
                    <p className="text-slate-500 text-xs mt-2">Você só descobre depois...</p>
                  </div>
                  <div className="absolute -right-2 -top-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                    <X className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Result Badge */}
                <div className="flex items-center justify-center gap-3 pt-4">
                  <div className="px-4 py-2 bg-red-500/20 rounded-full">
                    <span className="text-red-400 font-bold">Resultado: Crise Pública 💀</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* NEW WAY - The OPINNE Journey */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-emerald-500/20 rounded-3xl blur-xl opacity-60" />
            <div className="relative bg-slate-900/90 backdrop-blur-sm rounded-2xl md:rounded-3xl p-5 md:p-8 border border-primary/40 h-full">
              {/* Header */}
              <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-primary/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 md:w-7 md:h-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-white">Com o OPINNE</h3>
                  <p className="text-primary text-sm font-medium">Automático e blindado</p>
                </div>
              </div>

              {/* Visual Flow */}
              <div className="space-y-4 md:space-y-6">
                {/* Step 1 */}
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-primary/30">
                    <span className="text-xl md:text-2xl">🛒</span>
                  </div>
                  <div className="flex-1 h-1 bg-gradient-to-r from-primary/50 to-primary rounded" />
                  <div className="text-sm text-primary">Cliente compra</div>
                </div>

                {/* Step 2 - WhatsApp auto */}
                <div className="relative bg-primary/10 rounded-xl md:rounded-2xl p-4 md:p-5 border border-primary/30">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-xs md:text-sm">WhatsApp Automático</p>
                      <div className="bg-slate-800 rounded-lg md:rounded-xl p-2 md:p-3 mt-2">
                        <p className="text-slate-300 text-sm">"Olá! Como foi sua experiência?"</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <div key={n} className={`w-5 h-5 md:w-6 md:h-6 rounded text-[10px] md:text-xs flex items-center justify-center font-bold ${n >= 9 ? 'bg-primary text-white' : 'bg-slate-700 text-slate-400'}`}>
                              {n}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 - The split */}
                <div className="relative py-4">
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-transparent" />

                  <div className="grid grid-cols-2 gap-4">
                    {/* Promoter path */}
                    <div className="bg-primary/10 rounded-xl p-4 border border-primary/30">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="text-primary text-xs font-bold">NOTA 9-10</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star key={i} className="w-3 h-3 text-accent fill-accent" />
                          ))}
                        </div>
                        <span className="text-white text-xs">→ Google</span>
                      </div>
                    </div>

                    {/* Detractor path */}
                    <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-400 text-xs font-bold">NOTA 1-6</span>
                      </div>
                      <span className="text-white text-xs">→ Alerta pra você</span>
                    </div>
                  </div>
                </div>

                {/* Step 4 - The result */}
                <div className="relative">
                  <div className="bg-primary/10 rounded-2xl p-5 border border-primary/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">Google Meu Negócio</span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} className="w-4 h-4 text-accent fill-accent" />
                        ))}
                      </div>
                    </div>
                    <p className="text-primary text-sm italic">"Excelente atendimento! Super recomendo!"</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-slate-400 text-xs">+47 avaliações em 30 dias</span>
                    </div>
                  </div>
                  <div className="absolute -right-2 -top-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Result Badge */}
                <div className="flex items-center justify-center gap-3 pt-4">
                  <div className="px-4 py-2 bg-primary/20 rounded-full">
                    <span className="text-primary font-bold">Resultado: Reputação Blindada 🛡️</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <a
            href="#precos"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-primary text-white font-bold text-lg hover:bg-primary/90 shadow-xl shadow-primary/25 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
          >
            Quero Automatizar Agora
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
    </section>
  );
}


// ============================================
// HOW IT WORKS
// ============================================
function HowItWorks() {
  return (
    <section id="como-funciona" className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative">
        <div className="text-center mb-10 md:mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <Sparkles className="w-4 h-4" />
            Simples de configurar
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-secondary-dark mb-3 md:mb-4">
            Como funciona em 3 passos
          </h2>
          <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto px-2">
            Configure uma vez e deixe o sistema trabalhar por você.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
          {/* Step 1 - WhatsApp Message */}
          <div className="relative group">
            {/* Connector for desktop */}
            <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-primary/50 to-transparent z-10" />

            <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 h-full border border-slate-100 hover:border-primary/30 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden">
              {/* Step badge */}
              <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-600 px-3 py-1.5 rounded-full text-xs font-bold mb-5">
                <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px]">1</span>
                PASSO 1
              </div>

              {/* Icon with glow */}
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-green-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
              </div>

              <h3 className="text-lg md:text-xl font-bold text-secondary-dark mb-2">Cliente Compra</h3>
              <p className="text-sm md:text-base text-slate-500 leading-relaxed mb-5">
                Após a compra, o OPINNE envia automaticamente uma pesquisa via WhatsApp.
              </p>

              {/* Mini mockup */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-xs font-medium text-slate-600">WhatsApp Business</span>
                </div>
                <div className="bg-white rounded-lg p-2.5 text-xs text-slate-600 shadow-sm">
                  "Olá! Como foi sua experiência conosco?" 💬
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 - AI Triage */}
          <div className="relative group">
            {/* Connector for desktop */}
            <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-accent/50 to-transparent z-10" />

            <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 h-full border border-slate-100 hover:border-accent/30 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden">
              {/* Step badge */}
              <div className="inline-flex items-center gap-2 bg-accent/10 text-amber-600 px-3 py-1.5 rounded-full text-xs font-bold mb-5">
                <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[10px]">2</span>
                PASSO 2
              </div>

              {/* Icon with glow */}
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-accent/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
              </div>

              <h3 className="text-lg md:text-xl font-bold text-secondary-dark mb-2">Triagem Inteligente</h3>
              <p className="text-sm md:text-base text-slate-500 leading-relaxed mb-5">
                Nossa IA classifica automaticamente cada resposta.
              </p>

              {/* Mini mockup - Score display */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="text-slate-500">Classificação:</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-slate-600">Promotores</span>
                    <span className="text-xs font-bold text-green-600 ml-auto">9-10</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs text-slate-600">Passivos</span>
                    <span className="text-xs font-bold text-amber-600 ml-auto">7-8</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-600">Detratores</span>
                    <span className="text-xs font-bold text-red-600 ml-auto">0-6</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 - Result */}
          <div className="relative group">
            <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 h-full border border-slate-100 hover:border-primary/30 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden">
              {/* Step badge */}
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold mb-5">
                <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">3</span>
                PASSO 3
              </div>

              {/* Icon with glow */}
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-primary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                  <Shield className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
              </div>

              <h3 className="text-lg md:text-xl font-bold text-secondary-dark mb-2">Resultado Automático</h3>
              <p className="text-sm md:text-base text-slate-500 leading-relaxed mb-5">
                Cada perfil é direcionado para o destino correto.
              </p>

              {/* Mini mockup - Two paths */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                <div className="flex items-center gap-2 bg-green-50 rounded-lg p-2 border border-green-100">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs text-green-700">→ Google</span>
                </div>
                <div className="flex items-center gap-2 bg-red-50 rounded-lg p-2 border border-red-100">
                  <Bell className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-700">→ Alerta para você</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


// ============================================
// FEATURES (BENTO GRID)
// ============================================
function Features() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-secondary-dark mb-3 md:mb-4 px-2">
            Tudo que você precisa para dominar o Google
          </h2>
          <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto px-2">
            Funcionalidades pensadas para proteger sua reputação e acelerar seu crescimento.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
          {/* Feature 1 - Large */}
          <div className="md:row-span-2 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl md:rounded-2xl p-6 md:p-8 border border-red-100 hover:shadow-xl transition-all duration-300 group">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-red-100 flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform">
              <Bell className="w-6 h-6 md:w-7 md:h-7 text-red-500" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-secondary-dark mb-2">🛡️ Filtro de Proteção</h3>
            <p className="text-slate-600 font-medium mb-4">Nunca mais uma avaliação ruim surpresa</p>
            <p className="text-sm md:text-base text-slate-500 mb-6 md:mb-8 leading-relaxed">
              Cliente deu nota baixa? Você é alertado instantaneamente para resolver o problema antes que ele vá reclamar no Google. Transforme detratores em promotores.
            </p>

            {/* Mockup */}
            <div className="bg-white rounded-xl p-4 shadow-lg border border-slate-100 mockup-float">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">⚠️ Alerta de Crise</div>
                  <div className="text-xs text-slate-500">Cliente Roberto deu nota 3</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                  Resolver Agora
                </button>
                <button className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                  Ver
                </button>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="bg-gradient-to-br from-primary/5 to-emerald-50 rounded-2xl p-8 border border-primary/10 hover:shadow-xl transition-all duration-300 group">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Star className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-secondary-dark mb-2">⭐ Máquina de 5 Estrelas</h3>
            <p className="text-slate-600 font-medium mb-3">Direcione promotores para o Google</p>
            <p className="text-slate-500 leading-relaxed">
              Clientes satisfeitos (nota 9-10) recebem link direto para avaliar seu negócio. Sem fricção.
            </p>

            {/* Rating visual */}
            <div className="mt-6 flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-400">4.2</div>
                <div className="text-xs text-slate-400">Antes</div>
              </div>
              <ArrowRight className="w-5 h-5 text-primary" />
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">4.8</div>
                <div className="text-xs text-primary font-medium">Depois</div>
              </div>
              <div className="flex ml-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-5 h-5 text-accent fill-accent" />
                ))}
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="bg-gradient-to-br from-secondary-dark/5 to-slate-100 rounded-2xl p-8 border border-slate-200 hover:shadow-xl transition-all duration-300 group">
            <div className="w-14 h-14 rounded-xl bg-secondary-dark/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-7 h-7 text-secondary-dark" />
            </div>
            <h3 className="text-xl font-bold text-secondary-dark mb-2">📊 Dashboard de Reputação</h3>
            <p className="text-slate-600 font-medium mb-3">Saiba o que seus clientes pensam</p>
            <p className="text-slate-500 leading-relaxed">
              NPS em tempo real, histórico de feedbacks, ranking de satisfação. Tudo em um só lugar.
            </p>

            {/* Mini chart visual */}
            <div className="mt-6 flex items-end gap-2 h-16">
              {[40, 55, 45, 70, 65, 80, 75].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary/20 rounded-t-sm hover:bg-primary/40 transition-colors"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// TESTIMONIALS
// ============================================
function Testimonials() {
  const testimonials = [
    {
      quote: 'Configurei em 10 minutos e esqueci. Só recebo notificação quando alguém dá nota baixa ou quando chega avaliação nova no Google.',
      author: 'Carlos Silva',
      role: 'Dono da Barbearia Premium',
      avatar: '👨‍💼',
    },
    {
      quote: 'Integrei com meu CRM em 2 cliques. Agora toda venda dispara a pesquisa automaticamente. Minha vida ficou muito mais fácil.',
      author: 'Marina Oliveira',
      role: 'Proprietária de Loja de Tênis',
      avatar: '👩‍💼',
    },
    {
      quote: 'Em 30 dias, passei de 12 para 47 avaliações no Google. Minha nota subiu de 4.1 para 4.6. O retorno foi imediato!',
      author: 'Roberto Mendes',
      role: 'Dono de Restaurante',
      avatar: '👨‍🍳',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-secondary-dark mb-3 md:mb-4">
            Quem usa, recomenda
          </h2>
          <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto px-2">
            Veja o que nossos clientes estão dizendo sobre o OPINNE.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.author}
              className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 border border-slate-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Quote icon */}
              <Quote className="w-8 h-8 md:w-10 md:h-10 text-primary/20 mb-3 md:mb-4" />

              {/* Stars */}
              <div className="flex gap-1 mb-3 md:mb-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-5 h-5 text-accent fill-accent" />
                ))}
              </div>

              {/* Quote text */}
              <p className="text-sm md:text-base text-slate-700 leading-relaxed mb-4 md:mb-6 italic">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl md:text-2xl">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-bold text-secondary-dark">{testimonial.author}</div>
                  <div className="text-sm text-slate-500">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// PRICING
// ============================================
function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [plans, setPlans] = useState<HubPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await axiosClient.get<{ plans: HubPlan[] }>('/hub/billing/plans');
        setPlans(data.plans || []);
      } catch (error) {
        console.error('Failed to fetch plans:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // Filter plans by billing period and sort by price
  const filteredPlans = plans
    .filter((plan) => plan.billing_period === billingPeriod)
    .sort((a, b) => {
      const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
      const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
      return priceA - priceB;
    });

  const formatPrice = (price: number | string): string => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `R$${numPrice.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  const getMonthlyEquivalent = (plan: HubPlan): string | null => {
    if (plan.billing_period === 'YEARLY') {
      const price = typeof plan.price === 'string' ? parseFloat(plan.price) : plan.price;
      const monthly = price / 12;
      return `R$${monthly.toFixed(2).replace('.', ',')}`;
    }
    return null;
  };

  const getTierFromSlug = (slug: string): string => {
    if (slug.includes('growth')) return 'growth';
    return 'starter';
  };

  const isPopular = (plan: HubPlan): boolean => {
    return plan.is_popular || plan.slug.includes('growth');
  };

  return (
    <section id="precos" className="py-16 md:py-24 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-10 md:mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-4">
            <Zap className="w-4 h-4" />
            Planos simples e transparentes
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-dark mb-3 md:mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto">
            Comece a blindar sua reputação hoje. Escolha o plano que mais combina com você.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10 md:mb-12">
          <div className="bg-slate-100 p-1.5 rounded-xl flex">
            <button
              onClick={() => setBillingPeriod('MONTHLY')}
              className={`px-5 md:px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                billingPeriod === 'MONTHLY'
                  ? 'bg-white shadow text-secondary-dark'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingPeriod('YEARLY')}
              className={`px-5 md:px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billingPeriod === 'YEARLY'
                  ? 'bg-white shadow text-secondary-dark'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Anual
              <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full font-bold">
                -17%
              </span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          /* Pricing Cards */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">
            {filteredPlans.map((plan) => {
              const popular = isPopular(plan);
              const tier = getTierFromSlug(plan.slug);
              const features = tierFeatures[tier] || [];
              const monthlyEquivalent = getMonthlyEquivalent(plan);
              const isYearly = plan.billing_period === 'YEARLY';

              return (
                <div
                  key={plan.slug}
                  className={`relative bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 border-2 transition-all duration-300 hover:-translate-y-2 ${
                    popular
                      ? 'border-primary shadow-xl shadow-primary/10'
                      : 'border-slate-200 hover:border-primary/30 hover:shadow-xl'
                  }`}
                >
                  {/* Popular badge */}
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-full">
                        MAIS POPULAR
                      </span>
                    </div>
                  )}

                  {/* Plan header */}
                  <div className={popular ? 'mt-2' : ''}>
                    <h3 className="text-xl md:text-2xl font-bold text-secondary-dark">{plan.name}</h3>
                    <p className="text-slate-500 text-sm mt-1">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="mt-6 mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-4xl md:text-5xl font-bold ${popular ? 'text-primary' : 'text-secondary-dark'}`}>
                        {isYearly && monthlyEquivalent ? monthlyEquivalent : formatPrice(plan.price)}
                      </span>
                      <span className="text-slate-500">/mês</span>
                    </div>
                    {isYearly && (
                      <p className="text-sm text-slate-500 mt-1">
                        Cobrado {formatPrice(plan.price)} anualmente
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  <Link
                    to={`/register?plan=${plan.slug}`}
                    className={`block w-full py-3.5 rounded-xl text-center font-bold transition-all ${
                      popular
                        ? 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25'
                        : 'bg-slate-100 text-secondary-dark hover:bg-slate-200'
                    }`}
                  >
                    Assinar Agora
                  </Link>

                  {/* Features */}
                  <div className="mt-8">
                    <p className="text-sm font-semibold text-secondary-dark mb-4">Inclui:</p>
                    <ul className="space-y-3">
                      {features.map((feature) => (
                        <li
                          key={feature.description}
                          className={`flex items-center gap-3 text-sm ${
                            feature.disabled ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          {feature.disabled ? (
                            <Minus className="w-4 h-4 text-slate-300 flex-shrink-0" />
                          ) : (
                            <Check className={`w-4 h-4 flex-shrink-0 ${popular ? 'text-primary' : 'text-green-500'}`} />
                          )}
                          {feature.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Note */}
        <p className="text-center text-sm text-slate-500 mt-10">
          Pagamento seguro via Stripe. Cancele quando quiser.
        </p>
      </div>
    </section>
  );
}

// ============================================
// FAQ
// ============================================
function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: 'Como funciona a integração com meu negócio?',
      answer: 'Você pode integrar o OPINNE via API com seu CRM ou ERP, ou simplesmente enviar os dados manualmente pelo dashboard. Também oferecemos integração via Zapier e Make.',
    },
    {
      question: 'O cliente sabe que está sendo filtrado?',
      answer: 'Não! O processo é transparente. O cliente responde a pesquisa normalmente. A triagem acontece automaticamente em background, direcionando cada perfil para o caminho ideal.',
    },
    {
      question: 'E se o cliente insatisfeito já tiver conta no Google?',
      answer: 'O OPINNE intercepta ANTES do cliente ir ao Google. Ele recebe a pesquisa via WhatsApp primeiro, e se der nota baixa, você é alertado para resolver o problema proativamente.',
    },
    {
      question: 'Posso personalizar as mensagens?',
      answer: 'Sim! Você pode customizar todo o texto da pesquisa, mensagens de follow-up e até o tom de voz. Oferecemos templates prontos e sugestões de IA.',
    },
    {
      question: 'Quanto custa?',
      answer: 'O plano Starter custa R$ 49/mês (50 envios) e o Growth custa R$ 149/mês (envios ilimitados). Você pode cancelar quando quiser.',
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-dark mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Tire suas dúvidas sobre o OPINNE.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-slate-200 rounded-2xl overflow-hidden hover:border-primary/30 transition-colors"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
              >
                <span className="font-semibold text-secondary-dark pr-4">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200 ${openIndex === index ? 'rotate-180' : ''
                    }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${openIndex === index ? 'max-h-48' : 'max-h-0'
                  }`}
              >
                <p className="px-6 pb-5 text-slate-600 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// FINAL CTA
// ============================================
function FinalCTA() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-secondary-dark via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />

        {/* Floating icons */}
        <Star className="absolute top-20 left-[15%] w-6 h-6 text-accent/20 animate-float" />
        <Shield className="absolute top-32 right-[20%] w-8 h-8 text-primary/20 animate-float animation-delay-2000" />
        <Star className="absolute bottom-28 right-[30%] w-5 h-5 text-accent/15 animate-float animation-delay-4000" />
      </div>

      <div className="container mx-auto px-4 md:px-6 text-center relative">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6 px-2">
          Pronto para blindar sua reputação?
        </h2>
        <p className="text-base md:text-xl text-slate-300 max-w-2xl mx-auto mb-8 md:mb-10 px-2">
          Comece agora e veja suas avaliações no Google crescerem em semanas.
        </p>

        <a
          href="#precos"
          className="group inline-flex items-center gap-2 px-8 md:px-10 py-4 md:py-5 rounded-full bg-primary text-white font-bold text-base md:text-lg hover:bg-primary/90 shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 hover:-translate-y-1"
        >
          Começar Agora
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </a>

        <p className="text-slate-400 text-sm mt-6">
          Pagamento seguro via Stripe. Cancele quando quiser.
        </p>
      </div>
    </section>
  );
}

// ============================================
// FOOTER
// ============================================
function Footer() {
  return (
    <footer className="py-8 md:py-12 border-t border-slate-200 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo variant="full" size="sm" />
          <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm text-slate-500">
            <a href="#" className="hover:text-primary transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
            <a href="#" className="hover:text-primary transition-colors">Contato</a>
          </div>
          <div className="text-slate-400 text-xs md:text-sm">
            © {new Date().getFullYear()} OPINNE. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================
// MAIN LANDING PAGE
// ============================================
export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />
      <Hero />
      <Comparison />
      <HowItWorks />
      <Features />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
