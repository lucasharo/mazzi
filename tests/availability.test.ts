import { describe, it, expect } from 'vitest';
import {
  timeStringToMinutes,
  doIntervalsOverlap,
  hasBookingConflict,
  generateAvailableSlots,
  enforceAvailabilityOwnership,
  validateAvailabilityRule,
  validateAvailabilityException,
  getDayOfWeekFromDateString,
  sanitizeSlotForPublic,
  ACTIVE_CONFLICT_BOOKING_STATUSES,
} from '../src/domain/availability';
import {
  Provider,
  Vehicle,
  ServiceOffering,
  AvailabilityRule,
  AvailabilityException,
  Booking,
} from '../src/types';
import { afterAll, beforeAll, vi } from 'vitest';

describe('Domain: Availability & Scheduling Engine', () => {
  // Keep date-sensitive domain tests deterministic as the calendar advances.
  // Production code must continue to use the real clock.
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T10:00:00.000Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const mockProvider: Provider = {
    id: 'prov_100',
    name: 'Carlos Silva Instrutor',
    type: 'INSTRUCTOR',
    status: 'ACTIVE',
    ratingAverage: 4.9,
    ratingCount: 28,
    neighborhood: 'Pinheiros',
    city: 'São Paulo',
    categories: ['B'],
    transmissions: ['MANUAL'],
    startingPriceInCents: 9500,
    isVerified: true,
  };

  const mockVehicle: Vehicle = {
    id: 'veh_hb20',
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

  const mockOffering: ServiceOffering = {
    id: 'off_60m',
    providerId: 'prov_100',
    vehicleId: 'veh_hb20',
    category: 'B',
    durationMinutes: 60,
    priceInCents: 10000,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('converts time string to minutes accurately', () => {
    expect(timeStringToMinutes('00:00')).toBe(0);
    expect(timeStringToMinutes('08:30')).toBe(510);
    expect(timeStringToMinutes('14:00')).toBe(840);
    expect(timeStringToMinutes('23:59')).toBe(1439);
  });

  it('detects overlapping and non-overlapping time intervals using semi-open [start, end) bounds', () => {
    expect(doIntervalsOverlap('14:00', '15:00', '14:30', '15:30')).toBe(true);
    expect(doIntervalsOverlap('14:00', '15:00', '14:00', '15:00')).toBe(true);
    expect(doIntervalsOverlap('14:00', '16:00', '14:30', '15:30')).toBe(true);

    // Contiguous adjacent intervals do NOT overlap
    expect(doIntervalsOverlap('14:00', '15:00', '15:00', '16:00')).toBe(false);
    expect(doIntervalsOverlap('08:00', '09:00', '07:00', '08:00')).toBe(false);

    // Disjoint intervals do NOT overlap
    expect(doIntervalsOverlap('10:00', '11:00', '14:00', '15:00')).toBe(false);
  });

  it('generates exactly 4 slots for 08:00-12:00 window with 60 minute offering', () => {
    // Determine day of week for target date 2026-09-01
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    const slots = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions: [],
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });

    expect(slots.length).toBe(4);
    expect(slots[0].startTime).toBe('08:00');
    expect(slots[0].endTime).toBe('09:00');
    expect(slots[1].startTime).toBe('09:00');
    expect(slots[1].endTime).toBe('10:00');
    expect(slots[2].startTime).toBe('10:00');
    expect(slots[2].endTime).toBe('11:00');
    expect(slots[3].startTime).toBe('11:00');
    expect(slots[3].endTime).toBe('12:00');
  });

  it('generates slots for 90 minute duration offering fitting window bounds', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const offering90m = { ...mockOffering, durationMinutes: 90 };
    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    const slots = generateAvailableSlots({
      offering: offering90m,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions: [],
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });

    // Starts use the fixed hourly grid; duration remains 90 minutes.
    expect(slots.length).toBe(3);
    expect(slots[0].startTime).toBe('08:00');
    expect(slots[0].endTime).toBe('09:30');
    expect(slots[1].startTime).toBe('09:00');
    expect(slots[1].endTime).toBe('10:30');
    expect(slots[2].startTime).toBe('10:00');
    expect(slots[2].endTime).toBe('11:30');
  });

  it('removes slot covered by a BLOCK exception', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    // Block from 09:00 to 10:00 (e.g. personal appointment or vehicle maintenance)
    const exceptions: AvailabilityException[] = [
      {
        id: 'ex_1',
        providerId: 'prov_100',
        type: 'BLOCK',
        reasonCategory: 'PERSONAL',
        reason: 'Consulta Médica Privada',
        startAt: `${targetDate}T09:00:00.000-03:00`,
        endAt: `${targetDate}T10:00:00.000-03:00`,
      },
    ];

    const slots = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions,
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });

    // 09:00-10:00 should be removed -> 3 slots remain
    expect(slots.length).toBe(3);
    expect(slots.some((s) => s.startTime === '09:00')).toBe(false);
  });

  it('removes slot when vehicle or instructor is busy in an active booking', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    const activeBookings: any[] = [
      {
        id: 'bk_1',
        studentId: 'st_1',
        studentName: 'Ana Maria',
        providerId: 'prov_100',
        providerName: 'Carlos Silva',
        instructorId: 'prov_100',
        instructorName: 'Carlos Silva',
        vehicleId: 'veh_hb20',
        vehicleName: 'Hyundai HB20',
        category: 'B',
        scheduledDate: targetDate,
        startTime: '10:00',
        endTime: '11:00',
        status: 'CONFIRMED' as const,
      },
    ];

    const slots = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions: [],
      existingBookings: activeBookings,
      minimumNoticeMinutes: 0,
    });

    // 10:00-11:00 slot is occupied -> 3 slots remain
    expect(slots.length).toBe(3);
    expect(slots.some((s) => s.startTime === '10:00')).toBe(false);
  });

  it('re-enables slot when booking is CANCELLED or EXPIRED', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    const cancelledBookings: any[] = [
      {
        id: 'bk_cancelled',
        scheduledDate: targetDate,
        startTime: '10:00',
        endTime: '11:00',
        instructorId: 'prov_100',
        vehicleId: 'veh_hb20',
        status: 'CANCELLED_BY_STUDENT' as const,
      },
    ];

    const slots = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions: [],
      existingBookings: cancelledBookings,
      minimumNoticeMinutes: 0,
    });

    // Cancelled booking does NOT block -> all 4 slots generated
    expect(slots.length).toBe(4);
    expect(slots.some((s) => s.startTime === '10:00')).toBe(true);
  });

  it('handles multiple daily windows correctly (e.g. 08:00-12:00 and 14:00-18:00)', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_morning',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
      {
        id: 'rule_afternoon',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '14:00',
        endTime: '18:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    const slots = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions: [],
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });

    // 4 morning + 4 afternoon = 8 slots; NO slots generated between 12:00 and 14:00
    expect(slots.length).toBe(8);
    expect(slots.some((s) => s.startTime === '12:00')).toBe(false);
    expect(slots.some((s) => s.startTime === '13:00')).toBe(false);
    expect(slots.some((s) => s.startTime === '14:00')).toBe(true);
  });

  it('enforces BLOCK precedence over AVAILABLE_OVERRIDE when both overlap', () => {
    const targetDate = '2026-09-01';

    // Override opens Sunday 09:00-12:00
    const exceptions: AvailabilityException[] = [
      {
        id: 'ex_override',
        providerId: 'prov_100',
        type: 'AVAILABLE_OVERRIDE',
        reasonCategory: 'MANUAL_BLOCK',
        reason: 'Abertura Excepcional',
        startAt: `${targetDate}T09:00:00.000-03:00`,
        endAt: `${targetDate}T12:00:00.000-03:00`,
      },
      {
        id: 'ex_block',
        providerId: 'prov_100',
        type: 'BLOCK',
        reasonCategory: 'PERSONAL',
        reason: 'Bloqueio de Emergência',
        startAt: `${targetDate}T10:00:00.000-03:00`,
        endAt: `${targetDate}T11:00:00.000-03:00`,
      },
    ];

    const slots = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: [],
      exceptions,
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });

    // Override produced 09:00-10:00, 10:00-11:00, 11:00-12:00, but BLOCK removed 10:00-11:00 -> 2 slots remain
    expect(slots.length).toBe(2);
    expect(slots.some((s) => s.startTime === '10:00')).toBe(false);
  });

  it('returns zero slots if provider, vehicle, or offering is inactive', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);
    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    // Inactive Provider
    const inactiveProvider = { ...mockProvider, status: 'SUSPENDED' as const };
    expect(
      generateAvailableSlots({
        offering: mockOffering,
        provider: inactiveProvider,
        vehicles: [mockVehicle],
        startDate: targetDate,
        endDate: targetDate,
        availabilityRules: rules,
        exceptions: [],
        existingBookings: [],
        minimumNoticeMinutes: 0,
      }).length
    ).toBe(0);

    // Inactive Vehicle
    const inactiveVehicle = { ...mockVehicle, status: 'INACTIVE' as const };
    expect(
      generateAvailableSlots({
        offering: mockOffering,
        provider: mockProvider,
        vehicles: [inactiveVehicle],
        startDate: targetDate,
        endDate: targetDate,
        availabilityRules: rules,
        exceptions: [],
        existingBookings: [],
        minimumNoticeMinutes: 0,
      }).length
    ).toBe(0);

    // Inactive Offering
    const inactiveOffering = { ...mockOffering, status: 'INACTIVE' as const };
    expect(
      generateAvailableSlots({
        offering: inactiveOffering,
        provider: mockProvider,
        vehicles: [mockVehicle],
        startDate: targetDate,
        endDate: targetDate,
        availabilityRules: rules,
        exceptions: [],
        existingBookings: [],
        minimumNoticeMinutes: 0,
      }).length
    ).toBe(0);
  });

  it('sanitizes public slot data and hides internal exception notes', () => {
    const candidate = {
      startAt: '2026-09-01T08:00:00.000-03:00',
      endAt: '2026-09-01T09:00:00.000-03:00',
      date: '2026-09-01',
      startTime: '08:00',
      endTime: '09:00',
      providerId: 'prov_100',
      offeringId: 'off_1',
      instructorId: 'prov_100',
      instructorName: 'Carlos Silva',
      vehicleId: 'veh_hb20',
      vehicleName: 'Hyundai HB20',
      durationMinutes: 60,
      priceInCents: 10000,
      category: 'B' as const,
    };

    const publicSlot = sanitizeSlotForPublic(candidate);
    expect((publicSlot as any).reason).toBeUndefined();
    expect((publicSlot as any).reasonCategory).toBeUndefined();
    expect(publicSlot.startTime).toBe('08:00');
    expect(publicSlot.endTime).toBe('09:00');
  });

  // DIRECT ATTACK MATRIX TESTS
  it('denies write access to STUDENT role for availability management', () => {
    expect(() =>
      enforceAvailabilityOwnership({
        targetProviderId: 'prov_100',
        actorProviderId: 'prov_100',
        actorRole: 'STUDENT',
      })
    ).toThrowError(/Alunos não possuem permissão/);
  });

  it('denies write access to SUPPORT role for availability management', () => {
    expect(() =>
      enforceAvailabilityOwnership({
        targetProviderId: 'prov_100',
        actorProviderId: 'prov_100',
        actorRole: 'SUPPORT',
      })
    ).toThrowError(/SUPPORT não possui permissão/);
  });

  it('denies cross-provider access when Provider A attempts to modify Provider B availability', () => {
    expect(() =>
      enforceAvailabilityOwnership({
        targetProviderId: 'prov_OTHER',
        actorProviderId: 'prov_100',
        actorRole: 'INSTRUCTOR',
      })
    ).toThrowError(/Não é permitido gerenciar a agenda de outro prestador/);
  });

  it('denies availability rule creation for an alien vehicle not belonging to provider', () => {
    expect(() =>
      enforceAvailabilityOwnership({
        targetProviderId: 'prov_100',
        actorProviderId: 'prov_100',
        actorRole: 'INSTRUCTOR',
        targetVehicleId: 'veh_alien',
        providerVehicles: [mockVehicle],
      })
    ).toThrowError(/O veículo informado não pertence a este prestador/);
  });

  it('denies availability management for suspended or blocked providers', () => {
    expect(() =>
      enforceAvailabilityOwnership({
        targetProviderId: 'prov_100',
        actorProviderId: 'prov_100',
        actorRole: 'INSTRUCTOR',
        providerStatus: 'SUSPENDED',
      })
    ).toThrowError(/Prestador suspenso ou bloqueado/);
  });

  it('validates rule time boundaries and rejects overlapping recurring rules', () => {
    expect(() =>
      validateAvailabilityRule({
        startTime: '18:00',
        endTime: '08:00',
        dayOfWeek: 'MONDAY',
      })
    ).toThrowError(/Horário inicial/);

    const existing: AvailabilityRule[] = [
      {
        id: 'r1',
        providerId: 'prov_100',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    expect(() =>
      validateAvailabilityRule(
        {
          id: 'r2',
          providerId: 'prov_100',
          dayOfWeek: 'MONDAY',
          startTime: '10:00',
          endTime: '14:00',
          timezone: 'America/Sao_Paulo',
          isActive: true,
        },
        existing
      )
    ).toThrowError(/sobrepõe a regra existente/);
  });

  it('validates exception window bounds', () => {
    expect(() =>
      validateAvailabilityException({
        startAt: '2026-09-01T12:00:00Z',
        endAt: '2026-09-01T08:00:00Z',
        type: 'BLOCK',
        reasonCategory: 'PERSONAL',
      })
    ).toThrowError(/estritamente anterior/);
  });

  it('generates slots for AVAILABLE_OVERRIDE on a day without any base AvailabilityRule (e.g. Sunday)', () => {
    const sundayDate = '2026-09-06'; // Sunday
    expect(getDayOfWeekFromDateString(sundayDate)).toBe('SUNDAY');

    const overrides: AvailabilityException[] = [
      {
        id: 'ex_sun_override',
        providerId: 'prov_100',
        type: 'AVAILABLE_OVERRIDE',
        reasonCategory: 'MANUAL_BLOCK',
        reason: 'Plantão Especial de Domingo',
        startAt: `${sundayDate}T09:00:00.000-03:00`,
        endAt: `${sundayDate}T12:00:00.000-03:00`,
      },
    ];

    const slots = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: sundayDate,
      endDate: sundayDate,
      availabilityRules: [], // No recurring rules on Sunday
      exceptions: overrides,
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });

    expect(slots.length).toBe(3);
    expect(slots[0].startTime).toBe('09:00');
    expect(slots[1].startTime).toBe('10:00');
    expect(slots[2].startTime).toBe('11:00');
  });

  it('applies vehicle-specific BLOCK exception without affecting other vehicles', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const vehicleA: Vehicle = { ...mockVehicle, id: 'veh_A' };
    const vehicleB: Vehicle = { ...mockVehicle, id: 'veh_B', brand: 'Fiat', model: 'Mobi' };

    const offeringA: ServiceOffering = { ...mockOffering, id: 'off_A', vehicleId: 'veh_A' };
    const offeringB: ServiceOffering = { ...mockOffering, id: 'off_B', vehicleId: 'veh_B' };

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    // BLOCK only Vehicle A
    const exceptions: AvailabilityException[] = [
      {
        id: 'ex_block_vehA',
        providerId: 'prov_100',
        vehicleId: 'veh_A',
        type: 'BLOCK',
        reasonCategory: 'MAINTENANCE',
        reason: 'Manutenção Preventiva de Vehicle A',
        startAt: `${targetDate}T08:00:00.000-03:00`,
        endAt: `${targetDate}T12:00:00.000-03:00`,
      },
    ];

    // Offering A (Vehicle A) -> 0 slots
    const slotsA = generateAvailableSlots({
      offering: offeringA,
      provider: mockProvider,
      vehicles: [vehicleA, vehicleB],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions,
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });
    expect(slotsA.length).toBe(0);

    // Offering B (Vehicle B) -> 4 slots available!
    const slotsB = generateAvailableSlots({
      offering: offeringB,
      provider: mockProvider,
      vehicles: [vehicleA, vehicleB],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions,
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });
    expect(slotsB.length).toBe(4);
  });

  it('applies instructor-specific BLOCK exception without affecting other instructors in a Driving School', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const schoolProvider: Provider = {
      ...mockProvider,
      id: 'prov_school_1',
      name: 'Autoescola Modelo',
      type: 'DRIVING_SCHOOL',
    };

    const schoolOffering: ServiceOffering = {
      ...mockOffering,
      providerId: 'prov_school_1',
      vehicleId: 'veh_hb20',
    };

    const schoolVehicle: Vehicle = {
      ...mockVehicle,
      providerId: 'prov_school_1',
    };

    const instructors = [
      { id: 'inst_A', name: 'Instrutor Carlos', isAvailable: true, categories: ['B' as const] },
      { id: 'inst_B', name: 'Instrutora Ana', isAvailable: true, categories: ['B' as const] },
    ];

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_school_1',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    // BLOCK only Instructor A
    const exceptions: AvailabilityException[] = [
      {
        id: 'ex_block_instA',
        providerId: 'prov_school_1',
        instructorId: 'inst_A',
        type: 'BLOCK',
        reasonCategory: 'PERSONAL',
        reason: 'Folga do Instrutor Carlos',
        startAt: `${targetDate}T08:00:00.000-03:00`,
        endAt: `${targetDate}T12:00:00.000-03:00`,
      },
    ];

    const slots = generateAvailableSlots({
      offering: schoolOffering,
      provider: schoolProvider,
      vehicles: [schoolVehicle],
      instructors,
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions,
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });

    // All generated candidates must belong to Instructor B (Ana), and none to Instructor A
    expect(slots.length).toBe(4);
    expect(slots.every((s) => s.instructorId === 'inst_B')).toBe(true);
    expect(slots.some((s) => s.instructorId === 'inst_A')).toBe(false);
  });

  it('re-enables slot for EXPIRED and COMPLETED booking statuses', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    const inactiveBookings: any[] = [
      {
        id: 'bk_expired',
        scheduledDate: targetDate,
        startTime: '08:00',
        endTime: '09:00',
        instructorId: 'prov_100',
        vehicleId: 'veh_hb20',
        status: 'EXPIRED' as const,
      },
      {
        id: 'bk_completed',
        scheduledDate: targetDate,
        startTime: '09:00',
        endTime: '10:00',
        instructorId: 'prov_100',
        vehicleId: 'veh_hb20',
        status: 'COMPLETED' as const,
      },
    ];

    const slots = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: targetDate,
      endDate: targetDate,
      availabilityRules: rules,
      exceptions: [],
      existingBookings: inactiveBookings,
      minimumNoticeMinutes: 0,
    });

    // Neither EXPIRED nor COMPLETED blocks availability -> all 4 slots generated
    expect(slots.length).toBe(4);
  });

  it('respects effectiveFrom and effectiveTo boundaries on recurring rules', () => {
    const dayOfWeek = getDayOfWeekFromDateString('2026-09-01');

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_effective',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '12:00',
        timezone: 'America/Sao_Paulo',
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-30',
        isActive: true,
      },
    ];

    // Search on 2026-08-31 (before effectiveFrom) -> 0 slots
    const slotsBefore = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: '2026-08-31',
      endDate: '2026-08-31',
      availabilityRules: rules,
      exceptions: [],
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });
    expect(slotsBefore.length).toBe(0);

    // Search on 2026-09-01 (within effective range) -> 4 slots
    const slotsDuring = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      availabilityRules: rules,
      exceptions: [],
      existingBookings: [],
      minimumNoticeMinutes: 0,
    });
    expect(slotsDuring.length).toBe(4);
  });

  it('rejects past slots using an injected reference clock (options.now) and minimum notice', () => {
    const targetDate = '2026-09-01';
    const dayOfWeek = getDayOfWeekFromDateString(targetDate);

    const rules: AvailabilityRule[] = [
      {
        id: 'rule_1',
        providerId: 'prov_100',
        dayOfWeek,
        startTime: '08:00',
        endTime: '18:00',
        timezone: 'America/Sao_Paulo',
        isActive: true,
      },
    ];

    // Inject reference clock at 2026-09-01 10:30 BRT
    const injectedClock = new Date('2026-09-01T10:30:00.000-03:00');
    // Notice = 120 minutes (2h) -> Earliest allowed slot start is 12:30 BRT

    const slots = generateAvailableSlots({
      offering: mockOffering,
      provider: mockProvider,
      vehicles: [mockVehicle],
      startDate: targetDate,
      endDate: targetDate,
      now: injectedClock,
      minimumNoticeMinutes: 120,
      availabilityRules: rules,
      exceptions: [],
      existingBookings: [],
    });

    // Slots at 08:00, 09:00, 10:00, 11:00, 12:00 are rejected (before 12:30).
    // Slots at 13:00, 14:00, 15:00, 16:00, 17:00 are generated.
    expect(slots.some((s) => s.startTime === '08:00')).toBe(false);
    expect(slots.some((s) => s.startTime === '12:00')).toBe(false);
    expect(slots.some((s) => s.startTime === '13:00')).toBe(true);
  });

  it('asserts TypeScript active conflict booking statuses match PostgreSQL migration contract', () => {
    expect(ACTIVE_CONFLICT_BOOKING_STATUSES).toEqual(['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS']);
  });
});
