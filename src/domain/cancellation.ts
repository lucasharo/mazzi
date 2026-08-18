// ============================================================================
// MAZZI DOMAIN — MVP CANCELLATION & REFUND POLICY (DEC-013)
// ============================================================================

import { AuditLog, Booking, UserRole } from '../types';

export class CancellationDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'CancellationDomainError';
  }
}

export interface CancellationPolicyRule {
  minHoursBeforeLesson: number; // e.g. 24 for >=24h, 6 for 6h to <24h, 0 for <6h
  studentRefundPercentage: number; // 0 to 100
  providerCompensationPercentage: number; // 0 to 100
  platformFeeRetainedPercentage: number; // 0 to 100
  description: string;
}

export interface CancellationPolicyConfig {
  version: string;
  providerInitiatedRefundPercentage: number; // 100%
  studentInitiatedRules: CancellationPolicyRule[];
  noShowStudentRefundPercentage: number; // 0%
  noShowProviderRefundPercentage: number; // 100%
}

/**
 * MVP_CANCELLATION_POLICY (DEC-013):
 * Official commercial cancellation policy approved for MAZZI MVP.
 */
export const MVP_CANCELLATION_POLICY: CancellationPolicyConfig = {
  version: 'MVP_2026_08_DEC_013',
  providerInitiatedRefundPercentage: 100,
  noShowStudentRefundPercentage: 0,
  noShowProviderRefundPercentage: 100,
  studentInitiatedRules: [
    {
      minHoursBeforeLesson: 24,
      studentRefundPercentage: 100,
      providerCompensationPercentage: 0,
      platformFeeRetainedPercentage: 0,
      description: 'Cancelamento com 24h ou mais de antecedência: Reembolso integral (100%).',
    },
    {
      minHoursBeforeLesson: 6,
      studentRefundPercentage: 50,
      providerCompensationPercentage: 50,
      platformFeeRetainedPercentage: 0,
      description: 'Cancelamento entre 6h e 24h de antecedência: Reembolso parcial (50%).',
    },
    {
      minHoursBeforeLesson: 0,
      studentRefundPercentage: 0,
      providerCompensationPercentage: 100,
      platformFeeRetainedPercentage: 100,
      description: 'Cancelamento com menos de 6h de antecedência: Sem reembolso (0%).',
    },
  ],
};

/**
 * Legacy alias for backwards compatibility.
 */
export const DEFAULT_DEVELOPMENT_POLICY = MVP_CANCELLATION_POLICY;

export const PROVIDER_CANCELLATION_REASONS = [
  { code: 'VEHICLE_ISSUE', label: 'Problema no veículo' },
  { code: 'PERSONAL_EMERGENCY', label: 'Emergência pessoal' },
  { code: 'SCHEDULE_CONFLICT', label: 'Conflito de agenda' },
  { code: 'WEATHER_OR_SAFETY', label: 'Condições climáticas / Segurança' },
  { code: 'OPERATIONAL_ISSUE', label: 'Questão operacional' },
  { code: 'OTHER', label: 'Outro motivo' },
] as const;

export type ProviderCancellationReasonCode = (typeof PROVIDER_CANCELLATION_REASONS)[number]['code'];

export interface CancellationResult {
  refundPercentage: number; // 0 to 100
  refundAmountInCents: number;
  providerCompensationInCents: number;
  platformFeeRetainedInCents: number;
  policyDescription: string;
  policyVersion: string;
  isLegalOverride?: boolean;
}

/**
 * Calculates refund and compensation according to DEC-013 official policy.
 * Supports LEGAL_OVERRIDE for consumer protection rights.
 */
export function calculateCancellationPolicy(params: {
  cancelledBy: 'STUDENT' | 'PROVIDER' | 'NO_SHOW_STUDENT' | 'NO_SHOW_PROVIDER';
  hoursUntilLesson: number;
  totalPaidInCents: number;
  lessonPriceInCents: number;
  platformFeeInCents: number;
  policyConfig?: CancellationPolicyConfig;
  isLegalOverride?: boolean;
}): CancellationResult {
  const {
    cancelledBy,
    hoursUntilLesson,
    totalPaidInCents,
    lessonPriceInCents,
    platformFeeInCents,
    policyConfig = MVP_CANCELLATION_POLICY,
    isLegalOverride = false,
  } = params;

  // 1. Legal Override Precedence
  if (isLegalOverride) {
    return {
      refundPercentage: 100,
      refundAmountInCents: totalPaidInCents,
      providerCompensationInCents: 0,
      platformFeeRetainedInCents: 0,
      policyDescription: 'Reembolso integral por direito legal obrigatório do consumidor (LEGAL_OVERRIDE).',
      policyVersion: policyConfig.version,
      isLegalOverride: true,
    };
  }

  // 2. Provider cancelled the lesson
  if (cancelledBy === 'PROVIDER' || cancelledBy === 'NO_SHOW_PROVIDER') {
    const refundPct = policyConfig.providerInitiatedRefundPercentage;
    const refundAmountInCents = Math.round((totalPaidInCents * refundPct) / 100);
    return {
      refundPercentage: refundPct,
      refundAmountInCents,
      providerCompensationInCents: 0,
      platformFeeRetainedInCents: 0,
      policyDescription: 'Cancelamento realizado pelo prestador: Reembolso integral (100%) ao aluno.',
      policyVersion: policyConfig.version,
    };
  }

  // 3. Student no-show
  if (cancelledBy === 'NO_SHOW_STUDENT') {
    return {
      refundPercentage: policyConfig.noShowStudentRefundPercentage,
      refundAmountInCents: 0,
      providerCompensationInCents: lessonPriceInCents,
      platformFeeRetainedInCents: platformFeeInCents,
      policyDescription: 'Não comparecimento do aluno (No-show): Sem reembolso.',
      policyVersion: policyConfig.version,
    };
  }

  // 4. Find matching rule based on exact boundaries
  // >= 24h -> 100%
  // 6h <= t < 24h -> 50%
  // < 6h -> 0%
  const sortedRules = [...policyConfig.studentInitiatedRules].sort(
    (a, b) => b.minHoursBeforeLesson - a.minHoursBeforeLesson
  );

  const matchedRule =
    sortedRules.find((rule) => hoursUntilLesson >= rule.minHoursBeforeLesson) ||
    sortedRules[sortedRules.length - 1];

  if (!matchedRule) {
    return {
      refundPercentage: 0,
      refundAmountInCents: 0,
      providerCompensationInCents: lessonPriceInCents,
      platformFeeRetainedInCents: platformFeeInCents,
      policyDescription: 'Cancelamento sem regra aplicável: Sem reembolso.',
      policyVersion: policyConfig.version,
    };
  }

  const refundAmountInCents = Math.round(
    (totalPaidInCents * matchedRule.studentRefundPercentage) / 100
  );
  const providerCompensationInCents = Math.round(
    (lessonPriceInCents * matchedRule.providerCompensationPercentage) / 100
  );
  const platformFeeRetainedInCents =
    totalPaidInCents - refundAmountInCents - providerCompensationInCents;

  return {
    refundPercentage: matchedRule.studentRefundPercentage,
    refundAmountInCents,
    providerCompensationInCents,
    platformFeeRetainedInCents: Math.max(0, platformFeeRetainedInCents),
    policyDescription: matchedRule.description,
    policyVersion: policyConfig.version,
  };
}

export interface CancelBookingByStudentParams {
  booking: Booking;
  studentId: string;
  actorUserId: string;
  actorRole: UserRole;
  reasonText?: string;
  isLegalOverride?: boolean;
  now?: Date;
}

export interface CancelBookingByProviderParams {
  booking: Booking;
  providerId: string;
  actorUserId: string;
  actorRole: UserRole;
  reasonCode: ProviderCancellationReasonCode;
  reasonText?: string;
  idempotencyKey?: string;
  now?: Date;
}

/**
 * Validates eligibility and executes student cancellation with idempotency.
 */
export function performStudentCancellation(params: CancelBookingByStudentParams): {
  booking: Booking;
  cancellationResult: CancellationResult;
  auditLog: AuditLog;
  isIdempotent: boolean;
} {
  const { booking, studentId, actorUserId, actorRole, reasonText, isLegalOverride, now = new Date() } = params;

  // 1. Role / Ownership validation
  if (booking.studentId !== studentId && actorUserId !== studentId && actorRole !== 'PLATFORM_ADMIN') {
    throw new CancellationDomainError(
      'UNAUTHORIZED_STUDENT',
      'Acesso negado: este agendamento pertence a outro aluno.',
      403
    );
  }

  // 2. Idempotency Check
  if (booking.status === 'CANCELLED_BY_STUDENT') {
    const result = calculateCancellationPolicy({
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 24,
      totalPaidInCents: booking.totalInCents,
      lessonPriceInCents: booking.priceInCents,
      platformFeeInCents: booking.platformFeeInCents,
      isLegalOverride,
    });

    return {
      booking,
      cancellationResult: result,
      auditLog: {
        id: `audit_cancel_student_idem_${booking.id}`,
        actorId: actorUserId,
        actorName: 'Aluno',
        actorRole,
        action: 'BOOKING_CANCEL_STUDENT_IDEMPOTENT',
        entityType: 'Booking',
        entityId: booking.id,
        timestamp: now.toISOString(),
        ipAddress: '127.0.0.1',
      },
      isIdempotent: true,
    };
  }

  // 3. Status checks
  if (booking.status === 'COMPLETED' || booking.status === 'EXPIRED') {
    throw new CancellationDomainError(
      'INVALID_STATUS',
      'Não é possível cancelar um agendamento já concluído ou expirado.',
      422
    );
  }

  if (booking.status === 'CANCELLED_BY_PROVIDER' || booking.status === 'NO_SHOW_STUDENT') {
    throw new CancellationDomainError(
      'ALREADY_CANCELLED',
      'Este agendamento já se encontra cancelado.',
      422
    );
  }

  // 4. Compute hours remaining
  const startStr = booking.lessonDateTime || booking.scheduledStartAt || (booking.scheduledDate && booking.startTime ? `${booking.scheduledDate}T${booking.startTime}:00` : '');
  const lessonDate = new Date(startStr);
  const diffMs = lessonDate.getTime() - now.getTime();
  const hoursUntilLesson = diffMs / (1000 * 60 * 60);

  const cancellationResult = calculateCancellationPolicy({
    cancelledBy: 'STUDENT',
    hoursUntilLesson,
    totalPaidInCents: booking.totalInCents,
    lessonPriceInCents: booking.priceInCents,
    platformFeeInCents: booking.platformFeeInCents,
    isLegalOverride,
  });

  const nowISO = now.toISOString();
  const updatedBooking: Booking = {
    ...booking,
    status: 'CANCELLED_BY_STUDENT',
    cancelledAt: nowISO,
    cancellationReason: reasonText || 'Cancelamento realizado pelo aluno',
    updatedAt: nowISO,
  };

  const auditLog: AuditLog = {
    id: `audit_cancel_student_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    actorId: actorUserId,
    actorName: 'Aluno',
    actorRole,
    action: 'BOOKING_CANCELLED_BY_STUDENT',
    entityType: 'Booking',
    entityId: booking.id,
    previousValue: booking.status,
    newValue: 'CANCELLED_BY_STUDENT',
    timestamp: nowISO,
    ipAddress: '127.0.0.1',
  };

  return {
    booking: updatedBooking,
    cancellationResult,
    auditLog,
    isIdempotent: false,
  };
}

/**
 * Validates eligibility and executes provider cancellation with idempotency and audit logs.
 */
export function performProviderCancellation(params: CancelBookingByProviderParams): {
  booking: Booking;
  cancellationResult: CancellationResult;
  auditLog: AuditLog;
  isIdempotent: boolean;
} {
  const { booking, providerId, actorUserId, actorRole, reasonCode, reasonText, idempotencyKey, now = new Date() } = params;

  // 1. Role validation
  if (actorRole === 'STUDENT' || actorRole === 'SUPPORT') {
    throw new CancellationDomainError(
      'UNAUTHORIZED_ROLE',
      'Somente prestadores de serviço ou instrutores autorizados podem cancelar agendamentos.',
      403
    );
  }

  // 2. Ownership / Tenant validation
  if (booking.providerId !== providerId && booking.instructorId !== providerId && actorRole !== 'PLATFORM_ADMIN') {
    throw new CancellationDomainError(
      'UNAUTHORIZED_PROVIDER',
      'Acesso negado: este agendamento pertence a outro prestador.',
      403
    );
  }

  // 3. Reason Code validation for Provider
  if (!reasonCode) {
    throw new CancellationDomainError(
      'REASON_REQUIRED',
      'O motivo do cancelamento é obrigatório para prestadores de serviço.',
      422
    );
  }

  // 4. Idempotency Check
  if (booking.status === 'CANCELLED_BY_PROVIDER') {
    const result = calculateCancellationPolicy({
      cancelledBy: 'PROVIDER',
      hoursUntilLesson: 24,
      totalPaidInCents: booking.totalInCents,
      lessonPriceInCents: booking.priceInCents,
      platformFeeInCents: booking.platformFeeInCents,
    });

    return {
      booking,
      cancellationResult: result,
      auditLog: {
        id: `audit_cancel_idem_${booking.id}`,
        actorId: actorUserId,
        actorName: 'Prestador',
        actorRole,
        action: 'CANCEL_BOOKING_IDEMPOTENT',
        entityType: 'Booking',
        entityId: booking.id,
        timestamp: now.toISOString(),
        ipAddress: '127.0.0.1',
      },
      isIdempotent: true,
    };
  }

  // 5. Invalid status checks
  if (booking.status === 'COMPLETED' || booking.status === 'EXPIRED') {
    throw new CancellationDomainError(
      'INVALID_STATUS',
      'Não é possível cancelar uma aula concluída ou expirada.',
      422
    );
  }

  if (
    booking.status === 'CANCELLED_BY_STUDENT' ||
    booking.status === 'NO_SHOW_STUDENT' ||
    booking.status === 'NO_SHOW_PROVIDER'
  ) {
    throw new CancellationDomainError(
      'ALREADY_CANCELLED',
      'Este agendamento já se encontra cancelado.',
      422
    );
  }

  // 6. Calculate cancellation policy
  const cancellationResult = calculateCancellationPolicy({
    cancelledBy: 'PROVIDER',
    hoursUntilLesson: 24,
    totalPaidInCents: booking.totalInCents,
    lessonPriceInCents: booking.priceInCents,
    platformFeeInCents: booking.platformFeeInCents,
  });

  const fullReason = reasonText ? `${reasonCode}: ${reasonText}` : reasonCode;
  const nowISO = now.toISOString();

  const updatedBooking: Booking = {
    ...booking,
    status: 'CANCELLED_BY_PROVIDER',
    cancelledAt: nowISO,
    cancellationReason: fullReason,
    updatedAt: nowISO,
  };

  const auditLog: AuditLog = {
    id: `audit_cancel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    actorId: actorUserId,
    actorName: 'Prestador Credenciado',
    actorRole,
    action: 'BOOKING_CANCELLED_BY_PROVIDER',
    entityType: 'Booking',
    entityId: booking.id,
    previousValue: booking.status,
    newValue: 'CANCELLED_BY_PROVIDER',
    timestamp: nowISO,
    ipAddress: '127.0.0.1',
  };

  return {
    booking: updatedBooking,
    cancellationResult,
    auditLog,
    isIdempotent: false,
  };
}
