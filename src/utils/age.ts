/**
 * ============================================================================
 * MAZZI PLATFORM — AGE & BIRTH DATE UTILITIES (CIVIL 18-YEAR VERIFICATION)
 * ============================================================================
 */

export interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

/**
 * Parses YYYY-MM-DD or DD/MM/YYYY string into a civil date object without timezone shifts.
 */
export function parseCivilDate(dateStr: string | null | undefined): CivilDate | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();

  // Pattern 1: YYYY-MM-DD (standard ISO / HTML date input)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidCivilCalendarDate(year, month, day)) {
      return { year, month, day };
    }
    return null;
  }

  // Pattern 2: DD/MM/YYYY (BR standard formatted)
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10);
    const year = parseInt(brMatch[3], 10);
    if (isValidCivilCalendarDate(year, month, day)) {
      return { year, month, day };
    }
    return null;
  }

  return null;
}

/**
 * Checks if a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Checks if year/month/day is a real calendar date (e.g. rejects 2000-02-30).
 */
export function isValidCivilCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

/**
 * Extracts civil date from reference Date object or ISO string.
 */
function getReferenceCivilDate(refDate?: Date | string): CivilDate {
  if (!refDate) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }
  if (typeof refDate === 'string') {
    const parsed = parseCivilDate(refDate);
    if (parsed) return parsed;
    const d = new Date(refDate);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
  }
  return {
    year: refDate.getFullYear(),
    month: refDate.getMonth() + 1,
    day: refDate.getDate(),
  };
}

/**
 * Verifies if the birth date completes at least `minAge` full civil years on `referenceDate`.
 *
 * Leap Day (Feb 29) handling:
 * For a person born on Feb 29 (e.g., 2008-02-29), in a non-leap year (e.g. 2026),
 * the legal age anniversary is reached on Feb 28 (the final day of February).
 */
export function isAtLeastAge(
  birthDate: string | CivilDate | null | undefined,
  minAge = 18,
  referenceDate?: Date | string
): boolean {
  const birth = typeof birthDate === 'string' ? parseCivilDate(birthDate) : birthDate;
  if (!birth) return false;

  const ref = getReferenceCivilDate(referenceDate);

  // Reject future birth dates
  if (
    birth.year > ref.year ||
    (birth.year === ref.year && birth.month > ref.month) ||
    (birth.year === ref.year && birth.month === ref.month && birth.day > ref.day)
  ) {
    return false;
  }

  // Calculate year difference
  let age = ref.year - birth.year;

  // Adjust if the birthday has not yet occurred in the reference year
  let effectiveBirthDay = birth.day;
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(ref.year)) {
    // In a non-leap year, Feb 29 anniversary is reached on Feb 28
    effectiveBirthDay = 28;
  }

  if (
    ref.month < birth.month ||
    (ref.month === birth.month && ref.day < effectiveBirthDay)
  ) {
    age--;
  }

  return age >= minAge;
}

/**
 * Validates birth date string and returns a user-friendly error message if invalid.
 */
export function validateBirthDate(
  birthDateStr: string | null | undefined,
  referenceDate?: Date | string
): { valid: boolean; error?: string } {
  if (!birthDateStr || !birthDateStr.trim()) {
    return { valid: false, error: 'Informe sua data de nascimento.' };
  }

  const parsed = parseCivilDate(birthDateStr);
  if (!parsed) {
    return { valid: false, error: 'Data de nascimento inválida.' };
  }

  const ref = getReferenceCivilDate(referenceDate);

  // Check future date
  if (
    parsed.year > ref.year ||
    (parsed.year === ref.year && parsed.month > ref.month) ||
    (parsed.year === ref.year && parsed.month === ref.month && parsed.day > ref.day)
  ) {
    return { valid: false, error: 'A data de nascimento não pode ser no futuro.' };
  }

  // Check 18 years
  if (!isAtLeastAge(parsed, 18, referenceDate)) {
    return {
      valid: false,
      error: 'Para utilizar o MAZZI, você precisa ter pelo menos 18 anos.',
    };
  }

  return { valid: true };
}

/**
 * Applies progressive DD/MM/AAAA mask to raw digits
 */
export function formatDateMask(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';

  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

/**
 * Converts a DD/MM/AAAA or YYYY-MM-DD string to a canonical ISO YYYY-MM-DD string
 */
export function toISODateString(dateStr: string | null | undefined): string | null {
  const parsed = parseCivilDate(dateStr);
  if (!parsed) return null;
  const y = String(parsed.year).padStart(4, '0');
  const m = String(parsed.month).padStart(2, '0');
  const d = String(parsed.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

