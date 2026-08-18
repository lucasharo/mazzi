/**
 * ============================================================================
 * MAZZI PLATFORM — PHONE UTILITIES (MASKING & NORMALIZATION)
 * ============================================================================
 */

/**
 * Removes non-digits and truncates to max 11 digits.
 */
export function normalizePhone(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, 11);
}

/**
 * Applies progressive Brazilian phone mask:
 * (00) 0000-0000 (10 digits) or (00) 00000-0000 (11 digits)
 */
export function formatPhone(value: string | null | undefined): string {
  const digits = normalizePhone(value);
  if (!digits) return '';

  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Validates if the phone number has a valid length (10 or 11 digits with DDD).
 */
export function isValidPhone(value: string | null | undefined): boolean {
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11;
}
