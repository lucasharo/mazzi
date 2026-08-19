import { describe, it, expect } from 'vitest';
import { validateLicensePlate, maskLicensePlate, parseBrlToCents } from '../src/domain/vehicles-offerings';
import { mapFriendlyErrorMessage } from '../src/lib/error-mapper';
import { getCanonicalTimestamp, getTodayInSaoPaulo } from '../src/lib/date-format';
import { isUuid } from '../src/lib/db-service';
import { maskVehiclePlate, normalizeVehiclePlate, maskBRLInput } from '../src/lib/input-masks';

describe('TASK-018 — INSTRUCTOR APP FIXES & CONTRACT TESTS', () => {
  describe('1. Vehicle Plate Validation & Formatting (Traditional vs Mercosul)', () => {
    it('validates Traditional plate ABC-1234 / ABC1234', () => {
      const res1 = validateLicensePlate('abc1234');
      expect(res1.isValid).toBe(true);
      expect(res1.normalized).toBe('ABC1234');

      const res2 = validateLicensePlate('ABC-1234');
      expect(res2.isValid).toBe(true);
      expect(res2.normalized).toBe('ABC1234');
    });

    it('validates Mercosul plate ABC1D23', () => {
      const res = validateLicensePlate('abc1d23');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('ABC1D23');
    });

    it('rejects invalid plate formats', () => {
      expect(validateLicensePlate('ABC12D3').isValid).toBe(false);
      expect(validateLicensePlate('ABC123').isValid).toBe(false);
      expect(validateLicensePlate('1234567').isValid).toBe(false);
    });

    it('masks plates correctly', () => {
      expect(maskLicensePlate('ABC1234')).toBe('ABC-***4');
      expect(maskLicensePlate('ABC1D23')).toBe('ABC-***3');
    });
  });

  describe('2. BRL Money Input & Cents Conversion', () => {
    it('parses BRL string inputs to integer cents', () => {
      expect(parseBrlToCents('95')).toBe(9500);
      expect(parseBrlToCents('95,00')).toBe(9500);
      expect(parseBrlToCents('123,50')).toBe(12350);
      expect(parseBrlToCents('R$ 1.250,50')).toBe(125050);
    });

    it('formats BRL input mask', () => {
      expect(maskBRLInput('9500')).toBe('R$ 95,00');
      expect(maskBRLInput('12350')).toBe('R$ 123,50');
    });
  });

  describe('3. UUID Validation Helper for Database Operations', () => {
    it('correctly identifies valid UUIDs vs non-UUID string IDs', () => {
      expect(isUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
      expect(isUuid('veh_1771489000_abcde')).toBe(false);
      expect(isUuid('off_123456')).toBe(false);
      expect(isUuid('rule_123')).toBe(false);
      expect(isUuid(undefined)).toBe(false);
    });
  });

  describe('4. Human-Friendly Error Mapper', () => {
    it('maps RLS / 403 authorization errors cleanly', () => {
      const err = { code: '42501', message: 'new row violates row-level security policy for table "providers"' };
      expect(mapFriendlyErrorMessage(err)).toBe('Você não tem permissão para realizar esta ação neste perfil.');
    });

    it('maps 400 invalid UUID syntax errors cleanly', () => {
      const err = { code: '22P02', message: 'invalid input syntax for type uuid: "veh_1771489000"' };
      expect(mapFriendlyErrorMessage(err)).toBe('Identificador de registro inválido ou dados corrompidos.');
    });

    it('maps domain license plate errors cleanly', () => {
      const err = { message: 'INVALID_LICENSE_PLATE: Placa do veículo inválida.' };
      expect(mapFriendlyErrorMessage(err)).toBe('Informe uma placa de veículo válida (Padrão Mercosul ou Tradicional BR).');
    });
  });

  describe('5. Timezone Civil Date Resolution (America/Sao_Paulo)', () => {
    it('correctly resolves 2026-08-20T01:00:00.000Z to 2026-08-19 in São Paulo (-03:00)', () => {
      const utcTimestamp = '2026-08-20T01:00:00.000Z';
      const spDate = new Date(utcTimestamp).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      expect(spDate).toBe('2026-08-19');
    });
  });
});
