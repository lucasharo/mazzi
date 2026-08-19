import { describe, it, expect } from 'vitest';
import { validateLicensePlate, maskLicensePlate, parseBrlToCents, createVehicleDraft } from '../src/domain/vehicles-offerings';
import { maskVehiclePlate, normalizeVehiclePlate, maskBRLInput, normalizeServiceRadius } from '../src/lib/input-masks';

describe('INSTRUCTOR VEHICLE & OFFERING MANAGEMENT DOMAIN TESTS', () => {
  describe('1. License Plate Validation (Traditional & Mercosul)', () => {
    it('accepts Traditional plate ABC-1234 / ABC1234', () => {
      const res = validateLicensePlate('abc1234');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('ABC1234');
    });

    it('accepts Mercosul plate ABC1D23', () => {
      const res = validateLicensePlate('abc1d23');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('ABC1D23');
    });

    it('rejects invalid plate formats', () => {
      expect(validateLicensePlate('ABC12D3').isValid).toBe(false);
      expect(validateLicensePlate('ABC123').isValid).toBe(false);
    });

    it('formats visual plate mask', () => {
      expect(maskVehiclePlate('abc1234')).toBe('ABC-1234');
      expect(maskVehiclePlate('abc1d23')).toBe('ABC1D23');
      expect(normalizeVehiclePlate('ABC-1234')).toBe('ABC1234');
    });
  });

  describe('2. Monetary Input & Cents Conversion', () => {
    it('parses BRL input strings into integer cents', () => {
      expect(parseBrlToCents('95')).toBe(9500);
      expect(parseBrlToCents('R$ 95,00')).toBe(9500);
      expect(parseBrlToCents('123,50')).toBe(12350);
    });

    it('applies BRL mask on typing', () => {
      expect(maskBRLInput('9500')).toBe('R$ 95,00');
      expect(maskBRLInput('12350')).toBe('R$ 123,50');
    });
  });

  describe('3. Vehicle Year & Attribute Invariants', () => {
    const currentYear = new Date().getFullYear();

    it('creates draft with valid year between 1990 and currentYear + 1', () => {
      const draft = createVehicleDraft({
        providerId: 'prov-123',
        brand: 'Volkswagen',
        model: 'Polo',
        year: currentYear,
        licensePlate: 'ABC1D23',
        category: 'B',
        vehicleType: 'CAR',
        transmission: 'MANUAL',
      });
      expect(draft.year).toBe(currentYear);
      expect(draft.licensePlate).toBe('ABC1D23');
    });

    it('throws domain error when vehicle year is outside valid bounds', () => {
      expect(() =>
        createVehicleDraft({
          providerId: 'prov-123',
          brand: 'Volkswagen',
          model: 'Polo',
          year: 1985,
          licensePlate: 'ABC1D23',
          category: 'B',
          vehicleType: 'CAR',
          transmission: 'MANUAL',
        })
      ).toThrow();
    });
  });

  describe('4. Service Radius Normalization', () => {
    it('clamps radius values between 1 and 100 km', () => {
      expect(normalizeServiceRadius(6)).toBe(6);
      expect(normalizeServiceRadius(0)).toBe(1);
      expect(normalizeServiceRadius(150)).toBe(100);
    });
  });
});
