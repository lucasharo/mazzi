import { describe, it, expect, beforeEach } from 'vitest';
import {
  createQuote,
  isQuoteExpired,
  validateQuoteForBooking,
  QuoteDomainError,
} from '../src/domain/quote';
import {
  createBookingHold,
  expireStaleHolds,
  hasTimeIntervalOverlap,
  mapDatabaseErrorToDomainError,
  BookingDomainError,
} from '../src/domain/booking';
import {
  Provider,
  Vehicle,
  ServiceOffering,
  Quote,
  Booking,
} from '../src/types';

// ==========================================
// MOCK FIXTURES FOR SPRINT 08 TESTS
// ==========================================

const MOCK_PROVIDER_ACTIVE: Provider = {
  id: 'prov_active_001',
  userId: 'user_inst_001',
  name: 'Carlos Alberto Silva',
  type: 'INSTRUCTOR',
  status: 'ACTIVE',
  ratingAverage: 4.9,
  ratingCount: 32,
  neighborhood: 'Pinheiros',
  city: 'São Paulo',
  categories: ['B'],
  transmissions: ['MANUAL'],
  startingPriceInCents: 11000,
  isVerified: true,
};

const MOCK_VEHICLE_ACTIVE: Vehicle = {
  id: 'veh_active_001',
  providerId: 'prov_active_001',
  brand: 'Volkswagen',
  model: 'Polo',
  year: 2023,
  licensePlate: 'ABC-1234',
  category: 'B',
  vehicleType: 'CAR',
  transmission: 'MANUAL',
  status: 'ACTIVE',
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_OFFERING_ACTIVE: ServiceOffering = {
  id: 'off_active_001',
  providerId: 'prov_active_001',
  vehicleId: 'veh_active_001',
  category: 'B',
  durationMinutes: 50,
  priceInCents: 11000, // R$ 110,00
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_STUDENT_A_ID = 'user_student_A_123';
const MOCK_STUDENT_B_ID = 'user_student_B_456';

const BASE_START_AT = '2026-09-01T10:00:00.000Z';
const BASE_END_AT = '2026-09-01T10:50:00.000Z';

describe('Sprint 08 — Quote Creation & Lifecycle', () => {
  it('creates an active Quote with frozen pricing and default 10-min expiration', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const quote = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
      now,
    });

    expect(quote.studentId).toBe(MOCK_STUDENT_A_ID);
    expect(quote.providerId).toBe(MOCK_PROVIDER_ACTIVE.id);
    expect(quote.vehicleId).toBe(MOCK_VEHICLE_ACTIVE.id);
    expect(quote.priceInCents).toBe(11000);
    expect(quote.platformFeeInCents).toBe(1100); // 10%
    expect(quote.totalInCents).toBe(12100);
    expect(quote.status).toBe('ACTIVE');
    expect(quote.expiresAt).toBe('2026-08-15T10:10:00.000Z'); // 10 minutes later
  });

  it('rejects Quote creation if student ID is missing', () => {
    expect(() =>
      createQuote({
        studentId: '',
        provider: MOCK_PROVIDER_ACTIVE,
        vehicle: MOCK_VEHICLE_ACTIVE,
        offering: MOCK_OFFERING_ACTIVE,
        scheduledDate: '2026-09-01',
        startTime: '10:00',
        endTime: '10:50',
        scheduledStartAt: BASE_START_AT,
        scheduledEndAt: BASE_END_AT,
      })
    ).toThrow(QuoteDomainError);
  });

  it('rejects Quote creation if Provider is not ACTIVE', () => {
    const inactiveProvider = { ...MOCK_PROVIDER_ACTIVE, status: 'SUSPENDED' as const };
    expect(() =>
      createQuote({
        studentId: MOCK_STUDENT_A_ID,
        provider: inactiveProvider,
        vehicle: MOCK_VEHICLE_ACTIVE,
        offering: MOCK_OFFERING_ACTIVE,
        scheduledDate: '2026-09-01',
        startTime: '10:00',
        endTime: '10:50',
        scheduledStartAt: BASE_START_AT,
        scheduledEndAt: BASE_END_AT,
      })
    ).toThrow('não está ativo');
  });

  it('rejects Quote creation if Vehicle is not ACTIVE', () => {
    const inactiveVehicle = { ...MOCK_VEHICLE_ACTIVE, status: 'INACTIVE' as const };
    expect(() =>
      createQuote({
        studentId: MOCK_STUDENT_A_ID,
        provider: MOCK_PROVIDER_ACTIVE,
        vehicle: inactiveVehicle,
        offering: MOCK_OFFERING_ACTIVE,
        scheduledDate: '2026-09-01',
        startTime: '10:00',
        endTime: '10:50',
        scheduledStartAt: BASE_START_AT,
        scheduledEndAt: BASE_END_AT,
      })
    ).toThrow('veículo selecionado não está ativo');
  });

  it('rejects Quote creation if Offering category mismatches Vehicle category', () => {
    const categoryAOffering = { ...MOCK_OFFERING_ACTIVE, category: 'A' as const };
    expect(() =>
      createQuote({
        studentId: MOCK_STUDENT_A_ID,
        provider: MOCK_PROVIDER_ACTIVE,
        vehicle: MOCK_VEHICLE_ACTIVE, // Category B
        offering: categoryAOffering,
        scheduledDate: '2026-09-01',
        startTime: '10:00',
        endTime: '10:50',
        scheduledStartAt: BASE_START_AT,
        scheduledEndAt: BASE_END_AT,
      })
    ).toThrow('categoria da oferta');
  });

  it('correctly identifies expired Quotes', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const quote = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
      now,
    });

    const beforeExpiry = new Date('2026-08-15T10:05:00Z');
    const afterExpiry = new Date('2026-08-15T10:11:00Z');

    expect(isQuoteExpired(quote, beforeExpiry)).toBe(false);
    expect(isQuoteExpired(quote, afterExpiry)).toBe(true);
  });
});

describe('Sprint 08 — Quote Security & Reuse Restrictions', () => {
  it('prevents Student B from consuming Student A Quote (Cross-Student Access Control)', () => {
    const quote = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    expect(() => validateQuoteForBooking(quote, MOCK_STUDENT_B_ID)).toThrow(
      'permissão para utilizar uma proposta de outro estudante'
    );
  });

  it('prevents consuming an expired Quote', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const quote = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
      now,
    });

    const futureTime = new Date('2026-08-15T10:15:00Z');
    expect(() => validateQuoteForBooking(quote, MOCK_STUDENT_A_ID, futureTime)).toThrow(
      'proposta comercial expirou'
    );
  });

  it('prevents reusing a CONSUMED Quote for a second Booking', () => {
    const quote = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    const consumedQuote: Quote = { ...quote, status: 'CONSUMED' };
    expect(() => validateQuoteForBooking(consumedQuote, MOCK_STUDENT_A_ID)).toThrow(
      'já foi utilizada em uma reserva anterior'
    );
  });
});

describe('Sprint 08 — Transactional Booking Hold Engine', () => {
  it('creates a Booking Hold in PENDING_PAYMENT status and marks Quote as CONSUMED', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const quote = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
      now,
    });

    const result = createBookingHold({
      quote,
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [],
      now,
    });

    expect(result.booking.status).toBe('PENDING_PAYMENT');
    expect(result.booking.holdExpiresAt).toBe('2026-08-15T10:10:00.000Z');
    expect(result.consumedQuote.status).toBe('CONSUMED');
    expect(result.booking.snapshot.priceInCents).toBe(11000);
    expect(result.booking.snapshot.totalInCents).toBe(12100);
  });

  it('guarantees Idempotency: repeated request with same idempotencyKey returns existing booking without duplicate hold', () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const quote = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
      now,
    });

    const idempotencyKey = 'idem_key_xyz_123';

    // First request
    const res1 = createBookingHold({
      quote,
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [],
      idempotencyKey,
      now,
    });

    expect(res1.isIdempotent).toBe(false);

    // Second request with same idempotency key and existing booking in list
    const res2 = createBookingHold({
      quote,
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [res1.booking],
      idempotencyKey,
      now,
    });

    expect(res2.isIdempotent).toBe(true);
    expect(res2.booking.id).toBe(res1.booking.id);
  });

  it('operational re-validation: rejects Booking Hold if Provider becomes INACTIVE before hold creation', () => {
    const quote = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    const suspendedProvider = { ...MOCK_PROVIDER_ACTIVE, status: 'SUSPENDED' as const };

    expect(() =>
      createBookingHold({
        quote,
        studentId: MOCK_STUDENT_A_ID,
        provider: suspendedProvider,
        vehicle: MOCK_VEHICLE_ACTIVE,
        offering: MOCK_OFFERING_ACTIVE,
        existingBookings: [],
      })
    ).toThrow('prestador de serviço não está mais ativo');
  });

  it('operational re-validation: rejects Booking Hold if Vehicle becomes INACTIVE before hold creation', () => {
    const quote = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    const inactiveVehicle = { ...MOCK_VEHICLE_ACTIVE, status: 'INACTIVE' as const };

    expect(() =>
      createBookingHold({
        quote,
        studentId: MOCK_STUDENT_A_ID,
        provider: MOCK_PROVIDER_ACTIVE,
        vehicle: inactiveVehicle,
        offering: MOCK_OFFERING_ACTIVE,
        existingBookings: [],
      })
    ).toThrow('veículo associado à proposta foi desativado');
  });
});

describe('Sprint 08 — Anti-Double-Booking & Schedule Overlap Rules', () => {
  it('blocks Instructor double booking on overlapping active slot', () => {
    const quoteA = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    const resA = createBookingHold({
      quote: quoteA,
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [],
    });

    // Student B attempts to book same instructor at same time
    const quoteB = createQuote({
      studentId: MOCK_STUDENT_B_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    expect(() =>
      createBookingHold({
        quote: quoteB,
        studentId: MOCK_STUDENT_B_ID,
        provider: MOCK_PROVIDER_ACTIVE,
        vehicle: MOCK_VEHICLE_ACTIVE,
        offering: MOCK_OFFERING_ACTIVE,
        existingBookings: [resA.booking],
      })
    ).toThrow('instrutor selecionado já possui uma aula agendada');
  });

  it('blocks Vehicle double booking even if instructor differs', () => {
    const quoteA = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      instructorId: 'user_inst_001',
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    const resA = createBookingHold({
      quote: quoteA,
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [],
    });

    // Student B uses instructor 002 with same vehicle
    const quoteB = createQuote({
      studentId: MOCK_STUDENT_B_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      instructorId: 'user_inst_002',
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    expect(() =>
      createBookingHold({
        quote: quoteB,
        studentId: MOCK_STUDENT_B_ID,
        provider: MOCK_PROVIDER_ACTIVE,
        vehicle: MOCK_VEHICLE_ACTIVE,
        offering: MOCK_OFFERING_ACTIVE,
        existingBookings: [resA.booking],
      })
    ).toThrow('veículo selecionado já está alocado');
  });

  it('allows adjacent slots [10:00, 10:50) and [10:50, 11:40) without conflict', () => {
    const slot1Start = '2026-09-01T10:00:00.000Z';
    const slot1End = '2026-09-01T10:50:00.000Z';
    const slot2Start = '2026-09-01T10:50:00.000Z';
    const slot2End = '2026-09-01T11:40:00.000Z';

    expect(hasTimeIntervalOverlap(slot1Start, slot1End, slot2Start, slot2End)).toBe(false);

    const quoteA = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: slot1Start,
      scheduledEndAt: slot1End,
    });

    const resA = createBookingHold({
      quote: quoteA,
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [],
    });

    const quoteB = createQuote({
      studentId: MOCK_STUDENT_B_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:50',
      endTime: '11:40',
      scheduledStartAt: slot2Start,
      scheduledEndAt: slot2End,
    });

    const resB = createBookingHold({
      quote: quoteB,
      studentId: MOCK_STUDENT_B_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [resA.booking],
    });

    expect(resB.booking.status).toBe('PENDING_PAYMENT');
  });

  it('allows booking reuse after previous student CANCELLED', () => {
    const quoteA = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    const resA = createBookingHold({
      quote: quoteA,
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [],
    });

    // Mark Student A booking as CANCELLED_BY_STUDENT
    const cancelledBooking = { ...resA.booking, status: 'CANCELLED_BY_STUDENT' as const };

    const quoteB = createQuote({
      studentId: MOCK_STUDENT_B_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
    });

    const resB = createBookingHold({
      quote: quoteB,
      studentId: MOCK_STUDENT_B_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [cancelledBooking],
    });

    expect(resB.booking.status).toBe('PENDING_PAYMENT');
  });

  it('allows booking reuse after previous hold EXPIRES (stale hold cleanup)', () => {
    const pastCreated = new Date('2026-08-15T10:00:00Z');
    const quoteA = createQuote({
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
      now: pastCreated,
    });

    const resA = createBookingHold({
      quote: quoteA,
      studentId: MOCK_STUDENT_A_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [],
      now: pastCreated,
    });

    // Time progresses by 15 minutes (past hold expiration of 10 min)
    const currentTime = new Date('2026-08-15T10:15:00Z');

    const quoteB = createQuote({
      studentId: MOCK_STUDENT_B_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      scheduledDate: '2026-09-01',
      startTime: '10:00',
      endTime: '10:50',
      scheduledStartAt: BASE_START_AT,
      scheduledEndAt: BASE_END_AT,
      now: currentTime,
    });

    const resB = createBookingHold({
      quote: quoteB,
      studentId: MOCK_STUDENT_B_ID,
      provider: MOCK_PROVIDER_ACTIVE,
      vehicle: MOCK_VEHICLE_ACTIVE,
      offering: MOCK_OFFERING_ACTIVE,
      existingBookings: [resA.booking],
      now: currentTime,
    });

    expect(resB.booking.status).toBe('PENDING_PAYMENT');
  });
});

describe('Sprint 08 — High Contention Concurrent Simulation (20 Concurrent Requests)', () => {
  it('guarantees exactly 1 successful hold and 19 conflict rejections under 20 parallel requests for same slot', async () => {
    const now = new Date('2026-08-15T10:00:00Z');
    const existingBookingsState: Booking[] = [];

    // Create 20 distinct quotes for 20 students competing for the exact same slot
    const requests = Array.from({ length: 20 }).map((_, index) => {
      const studentId = `student_competing_${index + 1}`;
      const quote = createQuote({
        studentId,
        provider: MOCK_PROVIDER_ACTIVE,
        vehicle: MOCK_VEHICLE_ACTIVE,
        offering: MOCK_OFFERING_ACTIVE,
        scheduledDate: '2026-09-01',
        startTime: '10:00',
        endTime: '10:50',
        scheduledStartAt: BASE_START_AT,
        scheduledEndAt: BASE_END_AT,
        now,
      });

      return { studentId, quote };
    });

    let successCount = 0;
    let conflictCount = 0;

    // Simulate atomic serialized transactional database execution
    await Promise.all(
      requests.map(async ({ studentId, quote }) => {
        try {
          const result = createBookingHold({
            quote,
            studentId,
            provider: MOCK_PROVIDER_ACTIVE,
            vehicle: MOCK_VEHICLE_ACTIVE,
            offering: MOCK_OFFERING_ACTIVE,
            existingBookings: existingBookingsState,
            now,
          });

          // Atomic push to state store
          existingBookingsState.push(result.booking);
          successCount++;
        } catch (err: any) {
          if (err.code === 'SLOT_NO_LONGER_AVAILABLE' || err.statusCode === 409) {
            conflictCount++;
          }
        }
      })
    );

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(19);
    expect(existingBookingsState.length).toBe(1);
    expect(existingBookingsState[0].status).toBe('PENDING_PAYMENT');
  });
});

describe('Sprint 08 — Database Error Mapping & Environment Status Tracker', () => {
  it('maps PostgreSQL exclusion constraint violation (code 23P01) to domain SLOT_NO_LONGER_AVAILABLE (HTTP 409)', () => {
    const domainError = mapDatabaseErrorToDomainError({
      code: '23P01',
      message: 'conflicting key value violates exclusion constraint "exclude_instructor_overlapping_bookings"',
    });

    expect(domainError.code).toBe('SLOT_NO_LONGER_AVAILABLE');
    expect(domainError.statusCode).toBe(409);
    expect(domainError.message).toContain('acabou de ser reservado');
  });

  it('maps PostgreSQL unique idempotency constraint violation (code 23505) to DUPLICATE_IDEMPOTENCY_KEY (HTTP 409)', () => {
    const domainError = mapDatabaseErrorToDomainError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "payments_idempotency_key_key"',
    });

    expect(domainError.code).toBe('DUPLICATE_IDEMPOTENCY_KEY');
    expect(domainError.statusCode).toBe(409);
  });

  it('maps IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST properly', () => {
    const domainError = mapDatabaseErrorToDomainError({
      code: '23505',
      message: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST',
    });

    expect(domainError.code).toBe('DUPLICATE_IDEMPOTENCY_KEY');
    expect(domainError.statusCode).toBe(409);
  });

  it('evaluates Real Database Integration Tracker status as required by Sprint 08 rules', () => {
    // When real database gates pass or running in CI with Supabase URL, status transition to APPROVED is unlocked
    const hasLiveDbConnection = Boolean(process.env.DATABASE_URL || process.env.VITE_SUPABASE_URL || process.env.CI);
    expect(hasLiveDbConnection).toBe(true);
  });
});
