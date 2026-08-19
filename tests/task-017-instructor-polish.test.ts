import { describe, it, expect } from 'vitest';
import {
  getTodayInSaoPaulo,
  isLessonEnded,
  getCanonicalTimestamp,
  calculateLessonDurationMinutes,
  formatTransmissionLabel,
} from '../src/lib/date-format';
import {
  maskBrazilianPhone,
  normalizePhone,
  maskCpf,
  maskCnpj,
  maskCpfCnpj,
  normalizeDocument,
  maskVehiclePlate,
  normalizeVehiclePlate,
  maskBRLInput,
  normalizeServiceRadius,
} from '../src/lib/input-masks';

describe('TASK-017 — INSTRUCTOR APP POLISH & SECURITY TESTS', () => {
  describe('1. Timezone & Temporal Classification (America/Sao_Paulo)', () => {
    it('getTodayInSaoPaulo returns YYYY-MM-DD in America/Sao_Paulo timezone', () => {
      const today = getTodayInSaoPaulo();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('getCanonicalTimestamp handles date + time without assuming UTC Z', () => {
      const ts = getCanonicalTimestamp(null, '2026-08-19', '14:30');
      expect(ts).not.toBeNull();
      // Should interpret as 2026-08-19T14:30:00-03:00
      const date = new Date(ts!);
      expect(date.toISOString()).toBe('2026-08-19T17:30:00.000Z');
    });

    it('isLessonEnded correctly identifies ended lessons when scheduledEndAt <= NOW', () => {
      const now = new Date('2026-08-19T15:00:00.000Z');
      const pastBooking = { scheduledEndAt: '2026-08-19T14:59:00.000Z' };
      const futureBooking = { scheduledEndAt: '2026-08-19T15:01:00.000Z' };

      expect(isLessonEnded(pastBooking, now)).toBe(true);
      expect(isLessonEnded(futureBooking, now)).toBe(false);
    });
  });

  describe('2. Dynamic Duration & Transmission Mapping', () => {
    it('calculateLessonDurationMinutes calculates dynamic duration from timestamps', () => {
      const booking1 = {
        scheduledStartAt: '2026-08-19T14:00:00.000Z',
        scheduledEndAt: '2026-08-19T15:00:00.000Z',
      };
      expect(calculateLessonDurationMinutes(booking1)).toBe(60);

      const booking2 = {
        durationMinutes: 100,
      };
      expect(calculateLessonDurationMinutes(booking2)).toBe(100);
    });

    it('formatTransmissionLabel handles MANUAL, AUTOMATIC, NOT_APPLICABLE and unknown safely', () => {
      expect(formatTransmissionLabel('MANUAL')).toBe('Manual');
      expect(formatTransmissionLabel('AUTOMATIC')).toBe('Automática');
      expect(formatTransmissionLabel('NOT_APPLICABLE')).toBe('Não se aplica');
      expect(formatTransmissionLabel(null)).toBe('Não se aplica');
      expect(formatTransmissionLabel(undefined)).toBe('Não se aplica');
      expect(formatTransmissionLabel('UNKNOWN_VAL')).toBe('Não se aplica');
    });
  });

  describe('3. Input Masks & Normalization', () => {
    it('maskBrazilianPhone formats phone and normalizePhone extracts digits only', () => {
      expect(maskBrazilianPhone('11987654321')).toBe('(11) 98765-4321');
      expect(maskBrazilianPhone('1133334444')).toBe('(11) 3333-4444');
      expect(normalizePhone('(11) 98765-4321')).toBe('11987654321');
    });

    it('maskCpf and maskCnpj format correctly', () => {
      expect(maskCpf('12345678901')).toBe('123.456.789-01');
      expect(maskCnpj('12345678000195')).toBe('12.345.678/0001-95');
      expect(normalizeDocument('123.456.789-01')).toBe('12345678901');
    });

    it('maskCpfCnpj adapts to INSTRUCTOR vs DRIVING_SCHOOL', () => {
      expect(maskCpfCnpj('12345678901', 'INSTRUCTOR')).toBe('123.456.789-01');
      expect(maskCpfCnpj('12345678000195', 'DRIVING_SCHOOL')).toBe('12.345.678/0001-95');
    });

    it('maskVehiclePlate formats Mercosul and Legacy plates to uppercase', () => {
      expect(maskVehiclePlate('abc1d23')).toBe('ABC1D23');
      expect(maskVehiclePlate('abc1234')).toBe('ABC-1234');
      expect(normalizeVehiclePlate('ABC-1234')).toBe('ABC1234');
    });

    it('maskBRLInput formats monetary amounts', () => {
      expect(maskBRLInput('9500')).toContain('95,00');
    });

    it('normalizeServiceRadius clamps integer values between 1 and 100', () => {
      expect(normalizeServiceRadius(6)).toBe(6);
      expect(normalizeServiceRadius(0)).toBe(1);
      expect(normalizeServiceRadius(150)).toBe(100);
      expect(normalizeServiceRadius('25km')).toBe(25);
    });
  });
});
