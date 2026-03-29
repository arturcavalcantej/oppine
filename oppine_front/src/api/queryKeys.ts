export const queryKeys = {
  // Projects
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,

  // Businesses
  businesses: (projectId: string) => ['businesses', projectId] as const,
  business: (id: string) => ['businesses', 'detail', id] as const,
  businessTemplates: (businessId: string) => ['businesses', businessId, 'templates'] as const,

  // Feedback
  feedbackDashboard: (businessId: string, days?: number) =>
    ['feedback', 'dashboard', businessId, days ?? 30] as const,
  feedbackRequests: (businessId: string, status?: string) =>
    ['feedback', 'requests', businessId, status ?? 'all'] as const,
  feedbackResponses: (businessId: string, classification?: string) =>
    ['feedback', 'responses', businessId, classification ?? 'all'] as const,

  // Inspirations
  inspirations: (projectId: string) => ['inspirations', projectId] as const,
  inspiration: (id: string) => ['inspirations', 'detail', id] as const,

  // Documents
  documents: (projectId: string, inspirationIds?: string[]) =>
    inspirationIds?.length
      ? ['documents', projectId, { inspirationIds }] as const
      : ['documents', projectId] as const,
  document: (id: string) => ['documents', 'detail', id] as const,
  documentInspirations: (documentId: string) => ['documents', documentId, 'inspirations'] as const,

  // Folders
  folders: (projectId: string) => ['folders', projectId] as const,

  // AI
  aiModels: ['ai', 'models'] as const,
  documentChatHistory: (documentId: string) => ['documents', documentId, 'chat', 'history'] as const,

  // User
  currentUser: ['user', 'current'] as const,

  // Creative DNA
  creativeDNA: (projectId: string) => ['creative-dna', projectId] as const,
  creativeDNADefaults: (projectId: string) => ['creative-dna', projectId, 'defaults'] as const,

  // Prompts
  prompts: (projectId: string) => ['prompts', projectId] as const,
  prompt: (id: string) => ['prompts', 'detail', id] as const,

  // Pricing
  pricing: ['pricing'] as const,
  pricePreview: (planSlug: string, couponCode: string | null, currency: string) =>
    ['pricing', 'preview', planSlug, couponCode, currency] as const,

  // Coupons
  couponValidation: (code: string) => ['coupon', 'validate', code] as const,

  // Project Stats
  projectStats: (projectId: string) => ['projects', projectId, 'stats'] as const,

  // Subscription
  subscription: ['subscription'] as const,

  // Google Integration
  googleConnection: ['google', 'connection'] as const,
  googleAccounts: ['google', 'accounts'] as const,
  googleLocations: (accountId: string) => ['google', 'locations', accountId] as const,
  googleLocationLink: (businessId: string) => ['google', 'link', businessId] as const,
  googleReviews: (businessId: string) => ['google', 'reviews', businessId] as const,
  googleConversionStats: (businessId: string) => ['google', 'conversion', businessId] as const,
};
