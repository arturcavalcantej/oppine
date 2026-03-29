import { useQuery } from '@tanstack/react-query';
import { axiosClient } from '../axiosClient';
import { queryKeys } from '../queryKeys';

// ============================================================================
// Types
// ============================================================================

export interface PricePreviewResponse {
  // Plan data
  plan_name: string;
  plan_slug: string;
  billing_period: string; // "Mensal" ou "Anual"
  currency: string;

  // Prices (string with 2 decimal places from API, converted to number)
  original_price: number;
  discount_amount: number;
  final_price: number;

  // Coupon data
  coupon_code: string | null;
  coupon_valid: boolean | null; // null=not provided, true=valid, false=invalid
  coupon_error: string | null;
  discount_type: 'percent' | 'fixed' | null;
  discount_percent: number | null;
}

// ============================================================================
// Hooks
// ============================================================================

// Raw API response (prices as strings)
interface PricePreviewApiResponse {
  plan_name: string;
  plan_slug: string;
  billing_period: string;
  currency: string;
  original_price: string;
  discount_amount: string;
  final_price: string;
  coupon_code: string | null;
  coupon_valid: boolean | null;
  coupon_error: string | null;
  discount_type: 'percent' | 'fixed' | null;
  discount_percent: number | null;
}

/**
 * Query hook to get price preview for a plan with optional coupon.
 * Automatically refetches when planSlug or couponCode changes.
 * Also validates the coupon if provided.
 */
export const usePricePreview = (
  planSlug: string | null,
  couponCode: string | null = null,
  currency: string = 'BRL'
) => {
  return useQuery({
    queryKey: queryKeys.pricePreview(planSlug || '', couponCode, currency),
    queryFn: async () => {
      const params = new URLSearchParams({
        plan_slug: planSlug || '',
      });
      if (couponCode) {
        params.append('coupon_code', couponCode);
      }
      const { data } = await axiosClient.get<PricePreviewApiResponse>(
        `/hub/billing/price-preview?${params.toString()}`
      );

      // Convert string prices to numbers (in cents for compatibility)
      const response: PricePreviewResponse = {
        ...data,
        original_price: Math.round(parseFloat(data.original_price) * 100),
        discount_amount: Math.round(parseFloat(data.discount_amount) * 100),
        final_price: Math.round(parseFloat(data.final_price) * 100),
      };

      return response;
    },
    enabled: !!planSlug,
    staleTime: 60 * 1000, // 1 minute
  });
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format price from cents to display string.
 * @param cents - Price in cents
 * @param currency - Currency code (BRL, USD, EUR)
 */
export const formatPrice = (cents: number, currency: string = 'BRL'): string => {
  const amount = cents / 100;

  const symbols: Record<string, string> = {
    BRL: 'R$',
    USD: '$',
    EUR: '€',
  };

  const symbol = symbols[currency] || currency;

  return `${symbol}${amount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Calculate discount percentage from original and final price.
 */
export const calculateDiscountPercentage = (
  originalPrice: number,
  finalPrice: number
): number => {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
};
