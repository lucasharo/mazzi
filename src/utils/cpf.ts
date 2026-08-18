/**
 * ============================================================================
 * MAZZI PLATFORM — CPF UTILITIES (NORMALIZATION, FORMATTING, RIGOROUS VALIDATION)
 * ============================================================================
 */

/**
 * Removes all non-digit characters from the input string.
 * Truncates to max 11 digits.
 */
export function normalizeCpf(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '').slice(0, 11);
}

/**
 * Applies visual progressive masking: 000.000.000-00
 */
export function formatCpf(value: string | null | undefined): string {
  const digits = normalizeCpf(value);
  if (!digits) return '';

  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Validates CPF mathematically using the 2 check digits algorithms.
 * Rejects repeated sequences (e.g. 00000000000, 11111111111).
 */
export function isValidCpf(value: string | null | undefined): boolean {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11) {
    return false;
  }

  // Reject all repeating digit sequences (e.g. 00000000000, 11111111111, ..., 99999999999)
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  // First check digit calculation
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cpf.charAt(9), 10)) {
    return false;
  }

  // Second check digit calculation
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cpf.charAt(10), 10)) {
    return false;
  }

  return true;
}

/**
 * Masks CPF for display and privacy preservation (e.g. 123.***.***-09).
 * Returns 'CPF indisponível' for missing, null, or incomplete CPFs (< 11 digits).
 */
export function maskCpf(value: string | null | undefined): string {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return 'CPF indisponível';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9, 11)}`;
}

export const maskCpfForDisplay = maskCpf;

