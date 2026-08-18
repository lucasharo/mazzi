import { describe, expect, it } from 'vitest';
import { formatCpf, isValidCpf, maskCpf, normalizeCpf } from '../src/utils/cpf';
import { formatDateMask, isAtLeastAge, parseCivilDate, toISODateString, validateBirthDate } from '../src/utils/age';
import { formatPhone, isValidPhone, normalizePhone } from '../src/utils/phone';

describe('CPF Utilities & Mathematical Validation', () => {
  const validCpf1 = '52998224725';
  const validCpf2 = '11144477735';
  const validCpf3 = '12345678909';

  it('normalizes CPF correctly removing non-digits and truncating at 11', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizeCpf('  111 444 777-35  ')).toBe('11144477735');
    expect(normalizeCpf('1234567890912345')).toBe('12345678909');
    expect(normalizeCpf('')).toBe('');
    expect(normalizeCpf(null)).toBe('');
  });

  it('formats CPF progressively with mask 000.000.000-00', () => {
    expect(formatCpf('529')).toBe('529');
    expect(formatCpf('529982')).toBe('529.982');
    expect(formatCpf('529982247')).toBe('529.982.247');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });

  it('validates mathematically correct CPFs', () => {
    expect(isValidCpf(validCpf1)).toBe(true);
    expect(isValidCpf(validCpf2)).toBe(true);
    expect(isValidCpf(validCpf3)).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
  });

  it('rejects repeating sequences', () => {
    expect(isValidCpf('00000000000')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('22222222222')).toBe(false);
    expect(isValidCpf('33333333333')).toBe(false);
    expect(isValidCpf('44444444444')).toBe(false);
    expect(isValidCpf('55555555555')).toBe(false);
    expect(isValidCpf('66666666666')).toBe(false);
    expect(isValidCpf('77777777777')).toBe(false);
    expect(isValidCpf('88888888888')).toBe(false);
    expect(isValidCpf('99999999999')).toBe(false);
  });

  it('rejects invalid check digits', () => {
    expect(isValidCpf('52998224715')).toBe(false);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('1234567890')).toBe(false);
    expect(isValidCpf('123456789012')).toBe(false);
    expect(isValidCpf('abcdefghijk')).toBe(false);
  });

  it('masks CPF correctly for privacy', () => {
    expect(maskCpf('52998224725')).toBe('***.***.***-25');
    expect(maskCpf('529.982.247-25')).toBe('***.***.***-25');
    expect(maskCpf('123')).toBe('***.***.***-**');
  });
});

describe('Age & Birth Date Civil 18-Year Validation', () => {
  const referenceDate = new Date(2026, 7, 17); // 17 de Agosto de 2026

  it('parses civil ISO and BR date strings without timezone displacement', () => {
    expect(parseCivilDate('2008-08-17')).toEqual({ year: 2008, month: 8, day: 17 });
    expect(parseCivilDate('17/08/2008')).toEqual({ year: 2008, month: 8, day: 17 });
    expect(parseCivilDate('invalid')).toBeNull();
    expect(parseCivilDate('2008-02-30')).toBeNull();
  });

  it('formats birth date progressively with DD/MM/AAAA mask', () => {
    expect(formatDateMask('17')).toBe('17');
    expect(formatDateMask('1708')).toBe('17/08');
    expect(formatDateMask('17082008')).toBe('17/08/2008');
    expect(formatDateMask('17/08/2008')).toBe('17/08/2008');
  });

  it('converts formatted BR date to ISO YYYY-MM-DD', () => {
    expect(toISODateString('17/08/2008')).toBe('2008-08-17');
    expect(toISODateString('2008-08-17')).toBe('2008-08-17');
    expect(toISODateString('invalid')).toBeNull();
  });

  it('accepts person turning exactly 18 on the reference date', () => {
    expect(isAtLeastAge('2008-08-17', 18, referenceDate)).toBe(true);
    expect(validateBirthDate('17/08/2008', referenceDate).valid).toBe(true);
  });

  it('blocks person who will turn 18 tomorrow', () => {
    expect(isAtLeastAge('2008-08-18', 18, referenceDate)).toBe(false);
    const result = validateBirthDate('18/08/2008', referenceDate);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Para utilizar o MAZZI, você precisa ter pelo menos 18 anos.');
  });

  it('accepts adults over 18', () => {
    expect(isAtLeastAge('2000-01-01', 18, referenceDate)).toBe(true);
    expect(isAtLeastAge('1990-12-31', 18, referenceDate)).toBe(true);
  });

  it('blocks minors and future dates', () => {
    expect(isAtLeastAge('2010-05-10', 18, referenceDate)).toBe(false);
    expect(isAtLeastAge('2030-01-01', 18, referenceDate)).toBe(false);

    const futureResult = validateBirthDate('01/01/2030', referenceDate);
    expect(futureResult.valid).toBe(false);
    expect(futureResult.error).toBe('A data de nascimento não pode ser no futuro.');
  });

  it('handles leap day (Feb 29) birth dates deterministically', () => {
    const refFeb28 = new Date(2026, 1, 28);
    const refFeb27 = new Date(2026, 1, 27);

    expect(isAtLeastAge('2008-02-29', 18, refFeb28)).toBe(true);
    expect(isAtLeastAge('2008-02-29', 18, refFeb27)).toBe(false);
  });
});

describe('Phone Masking & Validation', () => {
  it('normalizes and formats Brazilian phone numbers progressively', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('11987654321');
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('119876')).toBe('(11) 9876');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('validates 10 and 11 digit phones', () => {
    expect(isValidPhone('11987654321')).toBe(true);
    expect(isValidPhone('1133334444')).toBe(true);
    expect(isValidPhone('119876543')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});
