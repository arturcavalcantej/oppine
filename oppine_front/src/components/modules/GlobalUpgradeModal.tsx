import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/contexts/uiStore';
import PricingModal from './PricingModal';

/**
 * Global upgrade modal that renders when upgradeModal.isOpen is true.
 * Uses the current project from URL params.
 * Shows a limit message first, then allows viewing plans.
 */
export default function GlobalUpgradeModal() {
  const { t } = useTranslation();
  const location = useLocation();
  // Extrai projectId de URLs como /dashboard/project/:projectId/...
  const projectIdMatch = location.pathname.match(/\/dashboard\/project\/([^/]+)/);
  const projectId = projectIdMatch?.[1];
  const { upgradeModal, closeUpgradeModal } = useUIStore();
  const [showPricing, setShowPricing] = useState(false);

  if (!upgradeModal.isOpen) return null;

  // If showing pricing modal
  if (showPricing && projectId) {
    return (
      <PricingModal
        isOpen={true}
        onClose={() => {
          setShowPricing(false);
          closeUpgradeModal();
        }}
        projectId={projectId}
      />
    );
  }

  // Limit reached message modal
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeUpgradeModal}
      />
      <div className="relative bg-white rounded-xl ring-1 ring-slate-900/5 shadow-xl max-w-md w-full p-6 text-center">
        <button
          onClick={closeUpgradeModal}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>

        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          {t('upgrade.limitReached', 'Limite atingido')}
        </h2>
        <p className="text-sm text-slate-500 mb-4">{upgradeModal.reason}</p>

        {upgradeModal.currentUsage !== null && upgradeModal.limit !== null && (
          <div className="mb-4 p-3 bg-amber-50 ring-1 ring-amber-200 rounded-lg">
            <span className="text-amber-700 font-medium text-sm">
              {t('upgrade.usageInfo', 'Uso: {{current}}/{{limit}}', {
                current: upgradeModal.currentUsage,
                limit: upgradeModal.limit,
              })}
            </span>
            {upgradeModal.tier && (
              <span className="ml-2 text-amber-600 text-xs capitalize">
                ({upgradeModal.tier})
              </span>
            )}
          </div>
        )}

        <p className="text-sm text-slate-500 mb-6">
          {t(
            'upgrade.upgradeToUnlock',
            'Faça upgrade para desbloquear mais recursos e continuar usando.'
          )}
        </p>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={closeUpgradeModal}
            className="flex-1"
          >
            {t('common.cancel', 'Cancelar')}
          </Button>
          {projectId ? (
            <Button
              onClick={() => setShowPricing(true)}
              className="flex-1"
            >
              <Sparkles className="w-4 h-4" />
              {t('upgrade.seePlans', 'Ver planos')}
            </Button>
          ) : (
            <p className="flex-1 text-sm text-slate-400 flex items-center justify-center">
              {t(
                'upgrade.navigateToProject',
                'Navegue até um projeto para ver os planos.'
              )}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
