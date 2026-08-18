import { describe, it, expect } from 'vitest';
import { isValidCpf, maskCpf } from '../src/utils/cpf';
import { validateBirthDate, formatDateMask, formatBirthDateForDisplay, toISODateString } from '../src/utils/age';

describe('Student Identity & Profile Validation Rules', () => {

  it('validates mathematical correctness of synthetic demo CPFs', () => {
    const demoCpfs = [
      '52901000088',
      '52902000022',
      '52903000077',
      '52904000011',
      '52905000066',
      '52906000000',
      '52907000055',
      '52908000008',
      '52909000044',
      '52910000079',
    ];

    demoCpfs.forEach((cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
    });

    // Ensure all 10 synthetic CPFs are unique
    const uniqueCpfs = new Set(demoCpfs);
    expect(uniqueCpfs.size).toBe(10);
  });

  it('masks CPF for privacy preservation displaying first 3 and last 2 digits', () => {
    expect(maskCpf('52901000088')).toBe('529.***.***-88');
    expect(maskCpf('52902000022')).toBe('529.***.***-22');
    expect(maskCpf('12345678909')).toBe('123.***.***-09');
    expect(maskCpf('123.456.789-09')).toBe('123.***.***-09');
    expect(maskCpf('12345')).toBe('CPF indisponível');
    expect(maskCpf(null)).toBe('CPF indisponível');
  });

  it('rejects invalid or missing CPFs', () => {
    expect(isValidCpf(null)).toBe(false);
    expect(isValidCpf('')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('12345678900')).toBe(false);
  });

  it('validates birth date civil rules (>= 18 years, non-future)', () => {
    const today = new Date();
    const futureYear = today.getFullYear() + 1;
    const under18Year = today.getFullYear() - 17;
    const exactly18Year = today.getFullYear() - 18;
    const adultYear = 1995;

    // Format dates as DD/MM/AAAA
    const futureDateStr = `15/05/${futureYear}`;
    const under18DateStr = `15/05/${under18Year}`;
    const adultDateStr = `15/05/${adultYear}`;

    expect(validateBirthDate(futureDateStr).valid).toBe(false);
    expect(validateBirthDate(under18DateStr).valid).toBe(false);
    expect(validateBirthDate(adultDateStr).valid).toBe(true);
  });

  it('converts DD/MM/AAAA date mask safely to ISO YYYY-MM-DD', () => {
    expect(toISODateString('15/05/1995')).toBe('1995-05-15');
    expect(toISODateString('20/08/1998')).toBe('1998-08-20');
  });

  it('B13. Formats ISO YYYY-MM-DD birth dates to DD/MM/AAAA without digit concatenation corruption', () => {
    expect(formatBirthDateForDisplay('1992-03-12')).toBe('12/03/1992');
    expect(formatBirthDateForDisplay('2000-01-31')).toBe('31/01/2000');
    expect(formatBirthDateForDisplay('1985-12-05')).toBe('05/12/1985');
    expect(formatBirthDateForDisplay(null)).toBe('Não informada');
    expect(formatBirthDateForDisplay('')).toBe('Não informada');
    expect(formatDateMask('1992-03-12')).toBe('12/03/1992');
  });

  it('B14. Performs complete round trip DB -> DISPLAY -> EDIT -> SAVE -> RELOAD without corruption', () => {
    // 1. DB value: ISO
    const dbValue = '1992-03-12';

    // 2. Display value: DD/MM/AAAA
    const displayValue = formatBirthDateForDisplay(dbValue);
    expect(displayValue).toBe('12/03/1992');

    // 3. Edit input value
    const editInputValue = formatDateMask(dbValue);
    expect(editInputValue).toBe('12/03/1992');

    // 4. Save to DB: ISO
    const saveValue = toISODateString(editInputValue);
    expect(saveValue).toBe('1992-03-12');

    // 5. Reload display: DD/MM/AAAA
    const reloadedDisplay = formatBirthDateForDisplay(saveValue);
    expect(reloadedDisplay).toBe('12/03/1992');
  });
});
