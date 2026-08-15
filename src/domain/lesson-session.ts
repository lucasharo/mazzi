// ============================================================================
// MAZZI DOMAIN — LESSON SESSION & LIFECYCLE ENGINE (SPRINT 11)
// ============================================================================

import { Booking, BookingStatus, UserRole, AuditLog } from '../types';
import { FinancialLedgerService } from './payments/financial-ledger';

export type LessonSessionState =
  | 'NOT_STARTED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED';

export interface LessonSession {
  id: string;
  bookingId: string;
  providerId: string;
  instructorId: string;
  studentId: string;
  state: LessonSessionState;
  instructorCheckedInAt?: string;
  studentCheckedInAt?: string;
  startedAt?: string;
  completedAt?: string;
  meetingPoint: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export const LESSON_CHECKIN_WINDOW_BEFORE_MINUTES = 30;
export const LESSON_CHECKIN_WINDOW_AFTER_MINUTES = 60;
export const DEFAULT_DEVELOPMENT_PAYOUT_SAFETY_PERIOD_HOURS = 24;

export class LessonSessionDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'LessonSessionDomainError';
  }
}

export interface CheckInParams {
  booking: Booking;
  providerId: string;
  actorUserId: string;
  actorRole: UserRole;
  now?: Date;
}

export interface StartLessonParams {
  session: LessonSession;
  booking: Booking;
  providerId: string;
  actorUserId: string;
  actorRole: UserRole;
  now?: Date;
}

export interface CompleteLessonParams {
  session: LessonSession;
  booking: Booking;
  providerId: string;
  actorUserId: string;
  actorRole: UserRole;
  idempotencyKey?: string;
  ledger?: FinancialLedgerService;
  now?: Date;
}

export interface CompleteLessonResult {
  session: LessonSession;
  booking: Booking;
  payoutScheduledAt: string;
  auditLog: AuditLog;
  isIdempotent: boolean;
}

/**
 * Validates check-in eligibility and executes provider check-in.
 */
export function performProviderCheckIn(params: CheckInParams): {
  session: LessonSession;
  booking: Booking;
} {
  const { booking, providerId, actorUserId, actorRole, now = new Date() } = params;

  // 1. Role validation (Student or Support cannot execute provider checkin)
  if (actorRole === 'STUDENT' || actorRole === 'SUPPORT') {
    throw new LessonSessionDomainError(
      'UNAUTHORIZED_ROLE',
      'Somente prestadores de serviço ou instrutores autorizados podem realizar o check-in.',
      403
    );
  }

  // 2. Ownership / Tenant validation
  if (booking.providerId !== providerId && booking.instructorId !== providerId) {
    throw new LessonSessionDomainError(
      'UNAUTHORIZED_PROVIDER',
      'Acesso negado: esta aula pertence a outro prestador.',
      403
    );
  }

  // 3. Status eligibility validation
  if (booking.status !== 'CONFIRMED' && booking.status !== 'IN_PROGRESS') {
    throw new LessonSessionDomainError(
      'INVALID_BOOKING_STATUS_FOR_CHECKIN',
      `Check-in não permitido para reservas com status '${booking.status}'. Somente aulas confirmadas permitem check-in.`,
      422
    );
  }

  // 4. Server clock time-window check
  const scheduledStartMs = new Date(booking.scheduledStartAt).getTime();
  const scheduledEndMs = new Date(booking.scheduledEndAt).getTime();
  const nowMs = now.getTime();

  const minCheckInMs = scheduledStartMs - LESSON_CHECKIN_WINDOW_BEFORE_MINUTES * 60 * 1000;
  const maxCheckInMs = scheduledEndMs + LESSON_CHECKIN_WINDOW_AFTER_MINUTES * 60 * 1000;

  if (nowMs < minCheckInMs) {
    throw new LessonSessionDomainError(
      'CHECKIN_TOO_EARLY',
      `Check-in liberado apenas ${LESSON_CHECKIN_WINDOW_BEFORE_MINUTES} minutos antes do início da aula.`,
      422
    );
  }

  if (nowMs > maxCheckInMs) {
    throw new LessonSessionDomainError(
      'CHECKIN_EXPIRED',
      'Janela de check-in para esta aula foi encerrada.',
      422
    );
  }

  const session: LessonSession = {
    id: `sess_${booking.id}`,
    bookingId: booking.id,
    providerId: booking.providerId,
    instructorId: booking.instructorId,
    studentId: booking.studentId,
    state: 'CHECKED_IN',
    instructorCheckedInAt: now.toISOString(),
    meetingPoint: booking.meetingPoint,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const updatedBooking: Booking = {
    ...booking,
    instructorCheckedIn: true,
    updatedAt: now.toISOString(),
  };

  return { session, booking: updatedBooking };
}

/**
 * Transitions lesson state from CHECKED_IN to IN_PROGRESS.
 */
export function startLesson(params: StartLessonParams): {
  session: LessonSession;
  booking: Booking;
} {
  const { session, booking, providerId, actorRole, now = new Date() } = params;

  if (actorRole === 'STUDENT' || actorRole === 'SUPPORT') {
    throw new LessonSessionDomainError(
      'UNAUTHORIZED_ROLE',
      'Somente o prestador credenciado pode iniciar a aula.',
      403
    );
  }

  if (booking.providerId !== providerId && booking.instructorId !== providerId) {
    throw new LessonSessionDomainError(
      'UNAUTHORIZED_PROVIDER',
      'Acesso negado para este prestador.',
      403
    );
  }

  if (session.state !== 'CHECKED_IN') {
    throw new LessonSessionDomainError(
      'SESSION_NOT_CHECKED_IN',
      'A aula precisa ter check-in realizado antes de ser iniciada.',
      422
    );
  }

  const updatedSession: LessonSession = {
    ...session,
    state: 'IN_PROGRESS',
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const updatedBooking: Booking = {
    ...booking,
    status: 'IN_PROGRESS',
    updatedAt: now.toISOString(),
  };

  return { session: updatedSession, booking: updatedBooking };
}

/**
 * Transitions lesson state from IN_PROGRESS to COMPLETED.
 * Enforces idempotency, server clock completion time, and payout safety hold.
 */
export function completeLesson(params: CompleteLessonParams): CompleteLessonResult {
  const {
    session,
    booking,
    providerId,
    actorUserId,
    actorRole,
    idempotencyKey,
    ledger,
    now = new Date(),
  } = params;

  // 1. Role validation
  if (actorRole === 'STUDENT' || actorRole === 'SUPPORT') {
    throw new LessonSessionDomainError(
      'UNAUTHORIZED_ROLE',
      'Somente o prestador credenciado ou autoescola pode finalizar a aula.',
      403
    );
  }

  // 2. Ownership / Tenant validation
  if (booking.providerId !== providerId && booking.instructorId !== providerId) {
    throw new LessonSessionDomainError(
      'UNAUTHORIZED_PROVIDER',
      'Acesso negado: a aula pertence a outra instituição/prestador.',
      403
    );
  }

  // 3. Idempotency Check
  if (session.state === 'COMPLETED') {
    if (idempotencyKey && session.idempotencyKey === idempotencyKey) {
      const existingPayoutDate = new Date(
        new Date(session.completedAt || now).getTime() +
          DEFAULT_DEVELOPMENT_PAYOUT_SAFETY_PERIOD_HOURS * 60 * 60 * 1000
      ).toISOString();

      return {
        session,
        booking,
        payoutScheduledAt: existingPayoutDate,
        auditLog: {
          id: `audit_idem_${session.id}`,
          actorId: actorUserId,
          actorName: 'Prestador',
          actorRole,
          action: 'COMPLETE_LESSON_IDEMPOTENT',
          entityType: 'Booking',
          entityId: booking.id,
          timestamp: now.toISOString(),
          ipAddress: '127.0.0.1',
        },
        isIdempotent: true,
      };
    }

    throw new LessonSessionDomainError(
      'LESSON_ALREADY_COMPLETED',
      'Esta aula já foi finalizada anteriormente.',
      409
    );
  }

  // 4. Must be IN_PROGRESS
  if (session.state !== 'IN_PROGRESS') {
    throw new LessonSessionDomainError(
      'SESSION_NOT_IN_PROGRESS',
      'Não é possível finalizar uma aula que ainda não foi iniciada.',
      422
    );
  }

  // 5. Cannot complete if booking is cancelled or expired
  if (
    booking.status === 'CANCELLED_BY_STUDENT' ||
    booking.status === 'CANCELLED_BY_PROVIDER' ||
    booking.status === 'EXPIRED'
  ) {
    throw new LessonSessionDomainError(
      'CANNOT_COMPLETE_CANCELLED_BOOKING',
      'Não é possível finalizar uma aula que foi cancelada ou expirou.',
      422
    );
  }

  const completedAtISO = now.toISOString();

  // Calculate 24h Safety Period for Payout Availability
  const payoutScheduledAt = new Date(
    now.getTime() + DEFAULT_DEVELOPMENT_PAYOUT_SAFETY_PERIOD_HOURS * 60 * 60 * 1000
  ).toISOString();

  const updatedSession: LessonSession = {
    ...session,
    state: 'COMPLETED',
    completedAt: completedAtISO,
    idempotencyKey,
    updatedAt: completedAtISO,
  };

  const updatedBooking: Booking = {
    ...booking,
    status: 'COMPLETED',
    completedAt: completedAtISO,
    updatedAt: completedAtISO,
  };

  // Record ledger payout held event if ledger provided
  if (ledger) {
    const providerAmountInCents = booking.priceInCents; // Net instructor payout
    ledger.recordEvent({
      eventType: 'PAYOUT_HELD',
      bookingId: booking.id,
      providerId: booking.providerId,
      studentId: booking.studentId,
      amountInCents: booking.totalInCents,
      platformFeeInCents: booking.platformFeeInCents,
      providerAmountInCents,
      metadata: {
        safetyPeriodHours: DEFAULT_DEVELOPMENT_PAYOUT_SAFETY_PERIOD_HOURS,
        scheduledReleaseAt: payoutScheduledAt,
        simulatedEnvironment: 'DEVELOPMENT_FAKE_PAYMENT',
      },
    });
  }

  const auditLog: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    actorId: actorUserId,
    actorName: 'Prestador Credenciado',
    actorRole,
    action: 'LESSON_COMPLETED',
    entityType: 'Booking',
    entityId: booking.id,
    previousValue: 'IN_PROGRESS',
    newValue: 'COMPLETED',
    timestamp: completedAtISO,
    ipAddress: '127.0.0.1',
  };

  return {
    session: updatedSession,
    booking: updatedBooking,
    payoutScheduledAt,
    auditLog,
    isIdempotent: false,
  };
}
