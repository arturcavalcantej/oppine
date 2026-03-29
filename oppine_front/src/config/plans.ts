// ============================================================================
// Plan Configuration - Single source of truth for plan features
// ============================================================================

// Backend tiers: starter, growth
// Display names: Starter, Growth
export type PlanTier = 'starter' | 'growth';
export type BillingPeriod = 'MONTHLY' | 'YEARLY';

// Features por tier (usa i18n keys de billing.features)
const STARTER_FEATURES = [
  'billing.features.oneBusiness',
  'billing.features.fiftyMessagesMonth',
  'billing.features.autoTriage',
  'billing.features.whatsappIntegration',
  'billing.features.googleRedirect',
  'billing.features.dashboard',
];

const GROWTH_FEATURES = [
  'billing.features.unlimitedBusinesses',
  'billing.features.unlimitedMessages',
  'billing.features.whiteLabel',
  'billing.features.multiClientManagement',
  'billing.features.prioritySupport',
];

export const PLAN_FEATURES_BY_TIER: Record<PlanTier, string[]> = {
  starter: STARTER_FEATURES,
  growth: GROWTH_FEATURES,
};

// Tier colors for UI styling
export const TIER_COLORS: Record<PlanTier, string> = {
  starter: 'bg-blue-100 text-blue-700',
  growth: 'bg-purple-100 text-purple-700',
};

// Helper para extrair tier do slug
export function extractTierFromSlug(slug: string): PlanTier {
  const s = slug.toLowerCase();
  if (s.includes('growth')) return 'growth';
  return 'starter';
}

// Helper para obter features (i18n keys) de um plano
export function getPlanFeatures(slug: string): string[] {
  const tier = extractTierFromSlug(slug);
  return PLAN_FEATURES_BY_TIER[tier];
}

// Helper para verificar se é plano anual
export function isYearlyPlan(slug: string): boolean {
  const s = slug.toLowerCase();
  return s.includes('yearly') || s.includes('annual');
}

// Helper para obter o slug base (sem o período)
export function getBasePlanSlug(slug: string): string {
  return slug
    .replace('-monthly', '')
    .replace('-yearly', '')
    .replace('-annual', '');
}

// Helper para construir slug com período
export function buildPlanSlug(baseSlug: string, period: BillingPeriod): string {
  const base = getBasePlanSlug(baseSlug);
  return `${base}-${period.toLowerCase()}`;
}
