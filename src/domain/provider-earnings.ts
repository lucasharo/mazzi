import type { ProviderEarningsReviews, ProviderReviewDimension } from '../types';

export const PROVIDER_INSIGHTS_MINIMUM_STUDENTS = 30;

const DIMENSION_LABELS: Record<ProviderReviewDimension, string> = {
  didactics: 'Didática',
  punctuality: 'Pontualidade',
  safety: 'Segurança',
  vehicle: 'Veículo',
  cordiality: 'Cordialidade',
};

const DIMENSION_ORDER: ProviderReviewDimension[] = [
  'didactics',
  'punctuality',
  'safety',
  'vehicle',
  'cordiality',
];

export interface ProviderEarningsInsights {
  isUnlocked: boolean;
  progress: number;
  strongest: string[];
  weakest: string[];
  summary: 'insufficient_data' | 'balanced' | 'actionable';
}

/**
 * Deterministic, local interpretation of real review dimensions. It intentionally
 * does not call an LLM or expose free-form generated commentary.
 */
export function buildProviderEarningsInsights(
  reviews: ProviderEarningsReviews,
  minimumStudents = PROVIDER_INSIGHTS_MINIMUM_STUDENTS,
): ProviderEarningsInsights {
  const distinctStudents = Math.max(0, Math.trunc(reviews.distinct_students_count || 0));
  const isUnlocked = distinctStudents >= minimumStudents;
  const values = DIMENSION_ORDER
    .map((key, index) => ({ key, index, value: reviews.dimensions[key] }))
    .filter((item): item is { key: ProviderReviewDimension; index: number; value: number } => item.value !== null && item.value !== undefined && Number.isFinite(item.value));

  if (!isUnlocked) {
    return {
      isUnlocked: false,
      progress: Math.min(distinctStudents, minimumStudents),
      strongest: [],
      weakest: [],
      summary: 'insufficient_data',
    };
  }

  if (values.length < 2) {
    return { isUnlocked: true, progress: distinctStudents, strongest: [], weakest: [], summary: 'balanced' };
  }

  const sorted = [...values].sort((left, right) => right.value - left.value || left.index - right.index);
  const strongestValue = sorted[0].value;
  const weakestValue = sorted[sorted.length - 1].value;
  const strongest = sorted.filter((item) => item.value === strongestValue).map((item) => DIMENSION_LABELS[item.key]);
  const weakest = strongestValue - weakestValue >= 0.5
    ? sorted.filter((item) => item.value === weakestValue).map((item) => DIMENSION_LABELS[item.key])
    : [];

  return {
    isUnlocked: true,
    progress: distinctStudents,
    strongest,
    weakest,
    summary: weakest.length > 0 ? 'actionable' : 'balanced',
  };
}
