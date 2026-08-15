// ============================================================================
// MAZZI DOMAIN — MONEY IN CENTS (NO FLOATS)
// ============================================================================

/**
 * DEFAULT_DEVELOPMENT_PLATFORM_FEE_PERCENTAGE:
 * Initial development / demo take rate (10%).
 * [DECISÃO PENDENTE]: The definitive commercial commission model for MAZZI
 * is pending commercial definition and will be configured in production sprints.
 */
export const DEFAULT_DEVELOPMENT_PLATFORM_FEE_PERCENTAGE = 10;

/**
 * Formats a monetary integer in cents to Brazilian Real (BRL) string.
 * Example: 10000 -> "R$ 100,00"
 */
export function formatCentsToBRL(cents: number): string {
  if (typeof cents !== 'number' || isNaN(cents)) {
    return 'R$ 0,00';
  }
  const positive = Math.abs(cents);
  const reals = Math.floor(positive / 100);
  const remainder = positive % 100;
  const formattedReals = reals.toLocaleString('pt-BR');
  const formattedRemainder = remainder.toString().padStart(2, '0');
  const sign = cents < 0 ? '- ' : '';
  return `${sign}R$ ${formattedReals},${formattedRemainder}`;
}

/**
 * Calculates platform fee and provider payout based on an integer percentage.
 * Avoids any floating-point accumulation by using integer math.
 */
export function calculatePlatformFeeAndPayout(
  lessonPriceInCents: number,
  platformFeePercentage: number = DEFAULT_DEVELOPMENT_PLATFORM_FEE_PERCENTAGE
): { platformFeeInCents: number; providerPayoutInCents: number } {
  if (lessonPriceInCents <= 0) {
    return { platformFeeInCents: 0, providerPayoutInCents: 0 };
  }
  // Integer arithmetic: fee = round(lessonPrice * percentage / 100)
  const platformFeeInCents = Math.round((lessonPriceInCents * platformFeePercentage) / 100);
  const providerPayoutInCents = lessonPriceInCents - platformFeeInCents;
  return { platformFeeInCents, providerPayoutInCents };
}

/**
 * Safe addition of cents.
 */
export function addCents(...values: number[]): number {
  return values.reduce((acc, curr) => acc + (Math.round(curr) || 0), 0);
}

/**
 * Safe subtraction of cents.
 */
export function subtractCents(base: number, deduction: number): number {
  return (Math.round(base) || 0) - (Math.round(deduction) || 0);
}
