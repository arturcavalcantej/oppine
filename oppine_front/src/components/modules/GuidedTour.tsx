import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  position: 'right' | 'bottom' | 'top' | 'left';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'business-selector',
    title: 'Seletor de Negócio',
    description: 'Aqui você pode alternar entre seus negócios, editar informações ou adicionar novos.',
    position: 'right',
  },
  {
    target: 'menu-overview',
    title: 'Visão Geral',
    description: 'Acompanhe as métricas e respostas recentes do seu negócio selecionado.',
    position: 'right',
  },
  {
    target: 'menu-templates',
    title: 'Templates',
    description: 'Personalize as mensagens enviadas aos seus clientes nas pesquisas NPS.',
    position: 'right',
  },
  {
    target: 'dashboard-usage',
    title: 'Uso do Plano',
    description: 'Acompanhe quantas pesquisas você enviou e o status do seu plano.',
    position: 'bottom',
  },
  {
    target: 'dashboard-totals',
    title: 'Totais de Feedback',
    description: 'Veja o resumo de respostas positivas, negativas, passivas e NPS Score.',
    position: 'bottom',
  },
  {
    target: 'dashboard-responses',
    title: 'Respostas e Pedidos',
    description: 'Veja as respostas dos clientes e os pedidos enviados, com filtro e paginação.',
    position: 'top',
  },
];

interface GuidedTourProps {
  isActive: boolean;
  onComplete: () => void;
}

export default function GuidedTour({ isActive, onComplete }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});

  const step = TOUR_STEPS[currentStep];

  const positionTooltip = useCallback(() => {
    if (!step) return;

    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      // Skip to next step if this target doesn't exist
      if (currentStep < TOUR_STEPS.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        onComplete();
      }
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 8;
    const tooltipWidth = 300;
    const tooltipHeight = 140;

    // Highlight the target element
    setHighlightStyle({
      position: 'fixed',
      top: rect.top - 4,
      left: rect.left - 4,
      width: rect.width + 8,
      height: rect.height + 8,
      borderRadius: '12px',
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 0 2px #547FFF',
      zIndex: 9998,
      pointerEvents: 'none' as const,
      transition: 'all 0.3s ease',
    });

    let top = 0;
    let left = 0;
    const arrowPos: React.CSSProperties = {};

    switch (step.position) {
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + padding + 12;
        arrowPos.top = '50%';
        arrowPos.left = '-6px';
        arrowPos.transform = 'translateY(-50%) rotate(45deg)';
        break;
      case 'bottom':
        top = rect.bottom + padding + 12;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        arrowPos.top = '-6px';
        arrowPos.left = '50%';
        arrowPos.transform = 'translateX(-50%) rotate(45deg)';
        break;
      case 'top':
        top = rect.top - tooltipHeight - padding - 12;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        arrowPos.bottom = '-6px';
        arrowPos.left = '50%';
        arrowPos.transform = 'translateX(-50%) rotate(45deg)';
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - padding - 12;
        arrowPos.top = '50%';
        arrowPos.right = '-6px';
        arrowPos.transform = 'translateY(-50%) rotate(45deg)';
        break;
    }

    // Keep tooltip on screen
    if (top < 8) top = 8;
    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - tooltipWidth - 8;

    setTooltipStyle({
      position: 'fixed',
      top,
      left,
      width: tooltipWidth,
      zIndex: 9999,
      transition: 'all 0.3s ease',
    });

    setArrowStyle({
      position: 'absolute' as const,
      width: 12,
      height: 12,
      background: 'white',
      ...arrowPos,
    });
  }, [step, currentStep, onComplete]);

  // Reset step and wait for the first tour target element to exist in the DOM
  useEffect(() => {
    if (!isActive) {
      setVisible(false);
      setCurrentStep(0);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 x 500ms = 15s max wait

    const checkReady = () => {
      if (cancelled) return;
      attempts++;

      const firstTarget = TOUR_STEPS[0]?.target;
      const el = firstTarget ? document.querySelector(`[data-tour="${firstTarget}"]`) : null;

      if (el) {
        setVisible(true);
      } else if (attempts < maxAttempts) {
        setTimeout(checkReady, 500);
      }
    };

    // Initial delay + polling
    const timer = setTimeout(checkReady, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isActive]);

  // Position tooltip only after visible
  useEffect(() => {
    if (!isActive || !visible) return;
    positionTooltip();

    const handleResize = () => positionTooltip();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isActive, visible, currentStep, positionTooltip]);

  if (!isActive || !visible || !step) return null;

  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <>
      {/* Highlight border */}
      <div style={highlightStyle} />

      {/* Tooltip */}
      <div style={tooltipStyle} className="animate-in fade-in duration-300">
        <div className="relative bg-white rounded-xl ring-1 ring-slate-900/5 shadow-xl p-5">
          {/* Arrow */}
          <div style={arrowStyle} />

          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Step counter */}
          <p className="text-[10px] font-semibold text-primary mb-1">
            {currentStep + 1} de {TOUR_STEPS.length}
          </p>

          {/* Content */}
          <h3 className="text-sm font-semibold text-slate-900 mb-1">{step.title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">{step.description}</p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Pular tour
            </button>
            <Button onClick={handleNext} size="sm">
              {isLast ? 'Concluir' : 'Próximo'}
              {!isLast && <ArrowRight className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
