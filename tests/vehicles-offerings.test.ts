import { describe, it, expect } from 'vitest';
import {
  validateLicensePlate,
  maskLicensePlate,
  sanitizeVehicleForPublic,
  createVehicleDraft,
  createServiceOffering,
  evaluateOfferingEligibility,
  parseBrlToCents,
  enforceVehicleOwnership,
  enforceOfferingOwnership,
  validateVehicleActivationPermission,
  validateOfferingActivationPermission,
  validateOfferingData,
  isVehicleAwaitingAdminReview,
} from '../src/domain/vehicles-offerings';
import { Provider, Vehicle, ServiceOffering } from '../src/types';
import { maskBRLInput } from '../src/lib/input-masks';

describe('Domain: Sprint 05 — Vehicles & Service Offerings', () => {
  it('classifies new and material-review vehicles in the admin approval queue', () => {
    expect(isVehicleAwaitingAdminReview('PENDING')).toBe(true);
    expect(isVehicleAwaitingAdminReview('IN_REVIEW')).toBe(true);
    expect(isVehicleAwaitingAdminReview('ACTIVE')).toBe(false);
    expect(isVehicleAwaitingAdminReview('INACTIVE')).toBe(false);
    expect(isVehicleAwaitingAdminReview('BLOCKED')).toBe(false);
  });

  const mockProvider: Provider = {
    id: 'prov_100',
    type: 'INSTRUCTOR',
    name: 'Instrutor Fernando',
    status: 'ACTIVE',
    ratingAverage: 5.0,
    ratingCount: 10,
    neighborhood: 'Moema',
    city: 'São Paulo',
    categories: ['A', 'B'],
    transmissions: ['MANUAL'],
    startingPriceInCents: 9500,
    isVerified: true,
  };

  const activeVehicle: Vehicle = {
    id: 'veh_1',
    providerId: 'prov_100',
    brand: 'Hyundai',
    model: 'HB20',
    year: 2023,
    licensePlate: 'ABC1D23',
    licensePlateMasked: 'ABC-***3',
    category: 'B',
    vehicleType: 'CAR',
    transmission: 'MANUAL',
    status: 'ACTIVE',
    photos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const offering: ServiceOffering = {
    id: 'off_1',
    providerId: 'prov_100',
    vehicleId: 'veh_1',
    category: 'B',
    durationMinutes: 50,
    priceInCents: 9500,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('validates and sanitizes license plates (Mercosul and old format)', () => {
    expect(validateLicensePlate('ABC1D23').isValid).toBe(true);
    expect(validateLicensePlate('ABC-1234').isValid).toBe(true);
    expect(validateLicensePlate('INVALID').isValid).toBe(false);

    expect(maskLicensePlate('ABC1D23')).toBe('ABC-***3');
    expect(maskLicensePlate('ABC1234')).toBe('ABC-***4');
  });

  it('ensures vehicle privacy by stripping license plates completely in public representation', () => {
    const publicProfile = sanitizeVehicleForPublic(activeVehicle);
    expect((publicProfile as any).licensePlate).toBeUndefined();
    expect((publicProfile as any).licensePlateMasked).toBeUndefined();
    expect(publicProfile.displayTitle).toBe('Hyundai HB20 (2023) - Manual');
  });

  it('validates vehicle draft creation rules and category/type consistency', () => {
    // Motorcycle must be category A
    expect(() =>
      createVehicleDraft({
        providerId: 'prov_100',
        brand: 'Honda',
        model: 'CG 160',
        year: 2022,
        licensePlate: 'ABC1D23',
        category: 'B',
        vehicleType: 'MOTORCYCLE',
        transmission: 'NOT_APPLICABLE',
      })
    ).toThrowError(/Veículos de Categoria B devem ser do tipo CAR/i);

    // Car must be category B
    expect(() =>
      createVehicleDraft({
        providerId: 'prov_100',
        brand: 'Fiat',
        model: 'Mobi',
        year: 2022,
        licensePlate: 'ABC1D23',
        category: 'A',
        vehicleType: 'CAR',
        transmission: 'MANUAL',
      })
    ).toThrowError(/Veículos de Categoria A devem ser do tipo MOTORCYCLE/i);
  });

  it('validates service offering creation with positive price in cents and duration', () => {
    const createdOffering = createServiceOffering({
      providerId: 'prov_100',
      instructorId: 'inst_100',
      vehicle: activeVehicle,
      category: 'B',
      durationMinutes: 50,
      priceInCents: 9500,
    });

    expect(createdOffering.priceInCents).toBe(9500);
    expect(createdOffering.durationMinutes).toBe(50);
    expect(createdOffering.status).toBe('ACTIVE');

    expect(() =>
      createServiceOffering({
        providerId: 'prov_100',
        instructorId: 'inst_100',
        vehicle: activeVehicle,
        category: 'B',
        durationMinutes: 50,
        priceInCents: 0,
      })
    ).toThrowError(/Preço da aula deve ser um valor inteiro em centavos maior que zero/i);

    expect(() =>
      createServiceOffering({
        providerId: 'prov_100',
        instructorId: 'inst_100',
        vehicle: activeVehicle,
        category: 'B',
        durationMinutes: 60,
        priceInCents: 9500,
      })
    ).toThrowError(/duração.*50 minutos/i);
  });

  it('keeps offerings prepared by a non-active provider inactive until backend approval', () => {
    const draftOffering = createServiceOffering({
      providerId: 'prov_100',
      instructorId: 'inst_draft',
      vehicle: activeVehicle,
      category: 'B',
      durationMinutes: 50,
      priceInCents: 9500,
      initialStatus: 'INACTIVE',
    });

    expect(draftOffering.status).toBe('INACTIVE');

    const activeOffering = createServiceOffering({
      providerId: 'prov_100',
      instructorId: 'inst_active',
      vehicle: activeVehicle,
      category: 'B',
      durationMinutes: 50,
      priceInCents: 9500,
      initialStatus: 'ACTIVE',
    });

    expect(activeOffering.status).toBe('ACTIVE');
  });

  it('derives category and transmission from the selected vehicle without a manual fallback', () => {
    const automaticVehicle = { ...activeVehicle, id: 'city', brand: 'Honda', model: 'City', transmission: 'AUTOMATIC' as const };
    const manualVehicle = { ...activeVehicle, id: 'byd', brand: 'BYD', model: 'Song', transmission: 'MANUAL' as const };

    const automaticOffering = createServiceOffering({
      providerId: 'prov_100', instructorId: 'inst_100', vehicle: automaticVehicle, category: 'B', durationMinutes: 50, priceInCents: 9500,
    });
    const manualOffering = createServiceOffering({
      providerId: 'prov_100', instructorId: 'inst_100', vehicle: manualVehicle, category: 'B', durationMinutes: 50, priceInCents: 9500,
    });

    expect(automaticOffering.vehicleId).toBe('city');
    expect(automaticOffering.category).toBe('B');
    expect(automaticOffering.transmission).toBe('AUTOMATIC');
    expect(manualOffering.vehicleId).toBe('byd');
    expect(manualOffering.transmission).toBe('MANUAL');
    expect(automaticOffering.durationMinutes).toBe(50);
    expect(automaticOffering.priceInCents).toBe(9500);
    expect(() => validateOfferingData({ providerId: 'prov_100', vehicleId: 'city', category: 'B', durationMinutes: 50, priceInCents: 9500 })).toThrowError(/Transmissão da oferta/);
  });

  it('keeps browser currency masking aligned with integer cents', () => {
    expect(maskBRLInput('15000')).toBe('R$ 150,00');
    expect(parseBrlToCents('R$ 150,00')).toBe(15000);
  });

  it('evaluates offering eligibility accurately based on provider status and vehicle status', () => {
    const result = evaluateOfferingEligibility(mockProvider, activeVehicle, offering);
    expect(result.isEligible).toBe(true);

    const inactiveVehicle = { ...activeVehicle, status: 'INACTIVE' as const };
    const inactiveResult = evaluateOfferingEligibility(mockProvider, inactiveVehicle, offering);
    expect(inactiveResult.isEligible).toBe(false);
    expect(inactiveResult.reasons[0]).toMatch(/veículo/i);
  });

  it('parses Brazilian Real (pt-BR) currency inputs into integer cents deterministically', () => {
    expect(parseBrlToCents('100')).toBe(10000);
    expect(parseBrlToCents('100,00')).toBe(10000);
    expect(parseBrlToCents('99,90')).toBe(9990);
    expect(parseBrlToCents('1.250,50')).toBe(125050);
    expect(parseBrlToCents('R$ 1.250,50')).toBe(125050);

    expect(() => parseBrlToCents('')).toThrowError(/Valor monetário inválido/i);
    expect(() => parseBrlToCents('abc')).toThrowError(/Valor monetário inválido/i);
    expect(() => parseBrlToCents('-50')).toThrowError(/Valor monetário inválido/i);
    expect(() => parseBrlToCents('100,00,00')).toThrowError(/separador decimal/i);
  });

  it('denies write and administrative access to SUPPORT role for vehicles and offerings', () => {
    expect(() => enforceVehicleOwnership(activeVehicle, 'prov_100', 'SUPPORT')).toThrowError(
      /SUPPORT não possui permissão/i
    );

    expect(() => enforceOfferingOwnership(offering, 'prov_100', 'SUPPORT')).toThrowError(
      /SUPPORT não possui permissão/i
    );

    expect(() => validateVehicleActivationPermission(activeVehicle, 'SUPPORT')).toThrowError(
      /SUPPORT não possui permissão/i
    );

    expect(() =>
      validateOfferingActivationPermission(mockProvider, activeVehicle, offering, 'SUPPORT')
    ).toThrowError(/perfil Suporte não possui permissão/i);
  });

  it('denies direct vehicle activation by provider from DRAFT or IN_REVIEW state', () => {
    const draftVehicle = { ...activeVehicle, status: 'DRAFT' as const };
    const underReviewVehicle = { ...activeVehicle, status: 'IN_REVIEW' as const };

    expect(() => validateVehicleActivationPermission(draftVehicle, 'INSTRUCTOR')).toThrowError(
      /Prestadores não podem ativar diretamente/i
    );

    expect(() => validateVehicleActivationPermission(underReviewVehicle, 'INSTRUCTOR')).toThrowError(
      /Prestadores não podem ativar diretamente/i
    );

    // Platform admin CAN approve/activate
    expect(() => validateVehicleActivationPermission(underReviewVehicle, 'PLATFORM_ADMIN')).not.toThrow();
  });

  it('enforces multi-tenant cross-provider access isolation', () => {
    expect(() => enforceVehicleOwnership(activeVehicle, 'prov_OTHER', 'INSTRUCTOR')).toThrowError(
      /Acesso negado: Prestador não é proprietário/i
    );

    expect(() => enforceOfferingOwnership(offering, 'prov_OTHER', 'INSTRUCTOR')).toThrowError(
      /Acesso negado: Prestador não é proprietário/i
    );
  });
});
