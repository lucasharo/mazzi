export type CanonicalComplianceStatus = 'PENDING' | 'IN_REVIEW' | 'REJECTED' | 'APPROVED';

/**
 * Normalizes legacy document values at the application boundary. Provider and
 * vehicle lifecycle statuses must not use this helper.
 */
export function normalizeComplianceStatus(value: unknown): CanonicalComplianceStatus {
  switch (String(value || '').toUpperCase()) {
    case 'APPROVED':
      return 'APPROVED';
    case 'IN_REVIEW':
      return 'IN_REVIEW';
    case 'REJECTED':
      return 'REJECTED';
    case 'PENDING':
    default:
      return 'PENDING';
  }
}
