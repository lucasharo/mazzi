// ==========================================
// MAZZI DOMAIN — BOOKING & HOLD ENGINE (SPRINT 08)
// ==========================================

import {
  Booking,
  BookingSnapshot,
  BookingStatus,
  Quote,
  Provider,
  Vehicle,
  ServiceOffering,
} from '../types';
import { validateQuoteForBooking, QuoteDomainError } from './quote';

export const DEFAULT_HOLD_EXPIRATION_MINUTES = 10;

/**
 * Statuses that actively occupy resource schedules (Instructor or Vehicle)
 */
export const BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
];

export function getBookingEndTimestamp(booking: Booking): number {
  const endIso = booking.scheduledEndAt || (booking.snapshot as any)?.scheduledEndAt;
  if (endIso) {
    const ts = new Date(endIso).getTime();
    if (Number.isFinite(ts) && ts > 0) return ts;
  }
  if (booking.scheduledDate && booking.endTime) {
    const ts = new Date(`${booking.scheduledDate}T${booking.endTime}:00`).getTime();
    if (Number.isFinite(ts) && ts > 0) return ts;
  }
  if (booking.scheduledDate && booking.startTime) {
    const startTs = new Date(`${booking.scheduledDate}T${booking.startTime}:00`).getTime();
    if (Number.isFinite(startTs) && startTs > 0) {
      const duration = booking.snapshot?.durationMinutes || 50;
      return startTs + duration * 60 * 1000;
    }
  }
  if (booking.scheduledStartAt) {
    const startTs = new Date(booking.scheduledStartAt).getTime();
    if (Number.isFinite(startTs) && startTs > 0) {
      const duration = booking.snapshot?.durationMinutes || 50;
      return startTs + duration * 60 * 1000;
    }
  }
  return 0;
}

export function isBookingEnded(booking: Booking, nowMs = Date.now()): boolean {
  const endTs = getBookingEndTimestamp(booking);
  return endTs > 0 && endTs <= nowMs;
}

export class BookingDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'BookingDomainError';
  }
}

export interface CreateBookingHoldInput {
  quote: Quote;
  studentId: string;
  studentName?: string;
  provider: Provider;
  vehicle: Vehicle;
  offering: ServiceOffering;
  existingBookings: Booking[];
  idempotencyKey?: string;
  holdDurationMinutes?: number;
  now?: Date;
}

export interface CreateBookingHoldResult {
  booking: Booking;
  consumedQuote: Quote;
  isIdempotent: boolean;
}

/**
 * Checks if two half-open time intervals [start1, end1) and [start2, end2) overlap.
 * Half-open interval rules:
 * - [10:00, 11:00) and [11:00, 12:00) DO NOT OVERLAP (adjacent slot allowed).
 * - [10:00, 11:00) and [10:30, 11:30) OVERLAP (conflict).
 */
export function hasTimeIntervalOverlap(
  start1Iso: string,
  end1Iso: string,
  start2Iso: string,
  end2Iso: string
): boolean {
  const s1 = new Date(start1Iso).getTime();
  const e1 = new Date(end1Iso).getTime();
  const s2 = new Date(start2Iso).getTime();
  const e2 = new Date(end2Iso).getTime();

  return s1 < e2 && s2 < e1;
}

/**
 * Sweeps and expires stale PENDING_PAYMENT holds whose holdExpiresAt <= now.
 * Ensures stale holds do not permanently block subsequent students from booking.
 */
export function expireStaleHolds(bookings: Booking[], now: Date = new Date()): Booking[] {
  const nowTime = now.getTime();
  return bookings.map((b) => {
    if (b.status === 'PENDING_PAYMENT' && b.holdExpiresAt) {
      const holdTime = new Date(b.holdExpiresAt).getTime();
      if (nowTime >= holdTime) {
        return {
          ...b,
          status: 'EXPIRED' as BookingStatus,
          expiredAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
      }
    }
    return b;
  });
}

/**
 * Maps PostgreSQL database codes (e.g., exclusion violation 23P01) to domain error DTOs.
 */
export function mapDatabaseErrorToDomainError(dbError: { code?: string; message?: string }): BookingDomainError {
  const code = dbError.code || '';
  const message = dbError.message || '';

  if (code === '23P01' || message.includes('exclude_') || message.includes('SLOT_NO_LONGER_AVAILABLE')) {
    return new BookingDomainError(
      'SLOT_NO_LONGER_AVAILABLE',
      'O horário ou veículo selecionado acabou de ser reservado por outro aluno.',
      409
    );
  }

  if (code === '23505' || message.includes('idempotency_key')) {
    return new BookingDomainError(
      'DUPLICATE_IDEMPOTENCY_KEY',
      'Requisição duplicada em processamento.',
      409
    );
  }

  if (code === '42501' || message.includes('ACCESS_DENIED') || message.includes('RLS')) {
    return new BookingDomainError(
      'FORBIDDEN',
      'Você não possui autorização para esta operação.',
      403
    );
  }

  return new BookingDomainError(
    'INTERNAL_BOOKING_ERROR',
    'Não foi possível concluir a reserva no momento.',
    500
  );
}

/**
 * Transactional domain creation for Booking Hold.
 * Receives Quote and enforces:
 * 1. Quote ownership and active state validation.
 * 2. Operational Provider, Vehicle, Offering active state re-validation.
 * 3. Idempotency Key check (returns existing booking if duplicate request).
 * 4. Stale hold cleanup.
 * 5. Double booking protection against instructor or vehicle schedule overlap.
 * 6. Frozen commercial snapshot creation.
 * 7. Quote status set to CONSUMED.
 */
export function createBookingHold(input: CreateBookingHoldInput): CreateBookingHoldResult {
  const {
    quote,
    studentId,
    studentName = 'Estudante',
    provider,
    vehicle,
    offering,
    existingBookings,
    idempotencyKey,
    holdDurationMinutes = DEFAULT_HOLD_EXPIRATION_MINUTES,
    now = new Date(),
  } = input;

  // 1. Quote Ownership & Active State Check
  validateQuoteForBooking(quote, studentId, now);

  // 2. Operational Re-validation (Provider, Vehicle, Offering must be active)
  if (provider.status !== 'ACTIVE') {
    throw new BookingDomainError(
      'PROVIDER_NOT_ACTIVE',
      'O prestador de serviço não está mais ativo para agendamento.',
      422
    );
  }

  if (offering.status !== 'ACTIVE') {
    throw new BookingDomainError(
      'OFFERING_NOT_ACTIVE',
      'A oferta de serviço associada foi desativada.',
      422
    );
  }

  if (vehicle.status !== 'ACTIVE') {
    throw new BookingDomainError(
      'VEHICLE_NOT_ACTIVE',
      'O veículo associado à proposta foi desativado.',
      422
    );
  }

  // 3. Idempotency Verification
  if (idempotencyKey) {
    const existingIdempotentBooking = existingBookings.find(
      (b) => b.idempotencyKey === idempotencyKey && b.studentId === studentId
    );
    if (existingIdempotentBooking) {
      return {
        booking: existingIdempotentBooking,
        consumedQuote: { ...quote, status: 'CONSUMED', consumedAt: quote.consumedAt || now.toISOString() },
        isIdempotent: true,
      };
    }
  }

  // 4. Stale Holds Cleanup
  const activeBookingsAfterCleanup = expireStaleHolds(existingBookings, now);

  // 5. Anti-Double-Booking Conflict Check (Instructor OR Vehicle overlap)
  const isBlocking = (b: Booking) => BLOCKING_BOOKING_STATUSES.includes(b.status);

  const instructorConflict = activeBookingsAfterCleanup.find(
    (b) =>
      isBlocking(b) &&
      b.instructorId === quote.instructorId &&
      hasTimeIntervalOverlap(quote.scheduledStartAt, quote.scheduledEndAt, b.scheduledStartAt, b.scheduledEndAt)
  );

  if (instructorConflict) {
    throw new BookingDomainError(
      'SLOT_NO_LONGER_AVAILABLE',
      'O instrutor selecionado já possui uma aula agendada neste horário.',
      409
    );
  }

  const vehicleConflict = activeBookingsAfterCleanup.find(
    (b) =>
      isBlocking(b) &&
      b.vehicleId === quote.vehicleId &&
      hasTimeIntervalOverlap(quote.scheduledStartAt, quote.scheduledEndAt, b.scheduledStartAt, b.scheduledEndAt)
  );

  if (vehicleConflict) {
    throw new BookingDomainError(
      'SLOT_NO_LONGER_AVAILABLE',
      'O veículo selecionado já está alocado para outra aula neste horário.',
      409
    );
  }

  // 6. Construct Frozen Historical Snapshot
  const snapshot: BookingSnapshot = {
    providerId: provider.id,
    providerName: provider.name,
    providerType: provider.type,
    instructorId: quote.instructorId,
    instructorName: quote.instructorName,
    vehicleId: vehicle.id,
    vehicleName: `${vehicle.brand} ${vehicle.model}`,
    vehicleBrand: vehicle.brand,
    vehicleModel: vehicle.model,
    vehicleType: vehicle.vehicleType,
    transmission: vehicle.transmission,
    category: offering.category,
    durationMinutes: offering.durationMinutes,
    priceInCents: quote.priceInCents,
    platformFeeInCents: quote.platformFeeInCents,
    totalInCents: quote.totalInCents,
    meetingPoint: provider.neighborhood || provider.city,
  };

  const holdExpiresAt = new Date(now.getTime() + holdDurationMinutes * 60 * 1000).toISOString();
  
  // Generate a valid UUID for local/mock/test environments to prevent database schema errors
  const bookingId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : '22222222-2222-2222-2222-' + String(Date.now()).slice(-12).padStart(12, '0');

  const booking: Booking = {
    id: bookingId,
    studentId,
    studentName,
    providerId: provider.id,
    providerName: provider.name,
    instructorId: quote.instructorId,
    instructorName: quote.instructorName,
    vehicleId: vehicle.id,
    vehicleName: snapshot.vehicleName,
    offeringId: offering.id,
    quoteId: quote.id,
    category: offering.category,
    scheduledDate: quote.scheduledDate,
    startTime: quote.startTime,
    endTime: quote.endTime,
    scheduledStartAt: quote.scheduledStartAt,
    scheduledEndAt: quote.scheduledEndAt,
    status: 'PENDING_PAYMENT',
    holdExpiresAt,
    snapshot,
    studentCheckedIn: false,
    instructorCheckedIn: false,
    meetingPoint: snapshot.meetingPoint,
    idempotencyKey,
    priceInCents: quote.priceInCents,
    platformFeeInCents: quote.platformFeeInCents,
    totalInCents: quote.totalInCents,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // 7. Consume Quote
  const consumedQuote: Quote = {
    ...quote,
    status: 'CONSUMED',
    consumedAt: now.toISOString(),
  };

  return {
    booking,
    consumedQuote,
    isIdempotent: false,
  };
}
