// ============================================================================
// MAZZI PLATFORM — UI INPUT MASKS & PERSISTENCE NORMALIZERS
// Presentation layer masks for user inputs and clean normalization for backend.
// ============================================================================

/** Normalizes any string to digits only */
export function digitsOnly(value: string = ''): string {
  return value.replace(/\D/g, '');
}

/** Formats a phone string into Brazilian format (11) 99999-9999 or (11) 3333-4444 */
export function maskBrazilianPhone(value: string = ''): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/** Normalizes phone for persistence (digits only) */
export function normalizePhone(value: string = ''): string {
  return digitsOnly(value);
}

/** Formats CPF into 000.000.000-00 */
export function maskCpf(value: string = ''): string {
  const digits = digitsOnly(value).slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/** Formats CNPJ into 00.000.000/0000-00 */
export function maskCnpj(value: string = ''): string {
  const digits = digitsOnly(value).slice(0, 14);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/** Dynamic CPF / CNPJ mask based on provider type or length */
export function maskCpfCnpj(value: string = '', providerType?: string): string {
  const digits = digitsOnly(value);
  if (providerType === 'DRIVING_SCHOOL' || digits.length > 11) {
    return maskCnpj(digits);
  }
  return maskCpf(digits);
}

/** Normalizes CPF/CNPJ for persistence (digits only) */
export function normalizeDocument(value: string = ''): string {
  return digitsOnly(value);
}

/** Validates a Brazilian CNPJ after stripping presentation characters. */
export function isValidCnpj(value: string = ''): boolean {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calculateDigit = (base: string, weights: number[]) => {
    const total = base.split('').reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj === `${cnpj.slice(0, 12)}${first}${second}`;
}

/** Formats vehicle plate to Mercosul (ABC1D23) or Legacy (ABC-1234 / ABC1234) */
export function maskVehiclePlate(value: string = ''): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (!clean) return '';
  if (clean.length <= 3) return clean;
  // Legacy plate ABC1234 -> ABC-1234 (all digits after 3 letters)
  if (clean.length >= 4 && /^[A-Z]{3}\d{1,4}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  // Mercosul plate ABC1D23 or in progress
  return clean;
}

/** Normalizes vehicle plate for persistence (uppercase alphanumeric 7 chars max) */
export function normalizeVehiclePlate(value: string = ''): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

/** Formats user input as BRL currency display e.g. R$ 95,00 */
export function maskBRLInput(value: string = ''): string {
  const digits = digitsOnly(value);
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  const formatted = num.toFixed(2).replace('.', ',');
  return `R$ ${formatted}`;
}

/** Validates and clamps service radius in km (1 - 100) */
export function normalizeServiceRadius(value: number | string): number {
  const parsed = typeof value === 'number' ? value : parseInt(digitsOnly(String(value)), 10);
  if (isNaN(parsed) || parsed < 1) return 1;
  if (parsed > 100) return 100;
  return parsed;
}

/** Validates vehicle year (4 digits) */
export function normalizeVehicleYear(value: number | string): number {
  const parsed = typeof value === 'number' ? value : parseInt(digitsOnly(String(value)), 10);
  const currentYear = new Date().getFullYear();
  if (isNaN(parsed)) return currentYear;
  return parsed;
}

/** Formats state UF to 2 uppercase letters */
export function maskStateUF(value: string = ''): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
}
