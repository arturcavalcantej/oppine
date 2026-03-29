const STORAGE_KEY = 'boilerplate_recommended_plan';

export function getRecommendedPlan(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setRecommendedPlan(plan: string): void {
  sessionStorage.setItem(STORAGE_KEY, plan);
}

export function clearRecommendedPlan(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
