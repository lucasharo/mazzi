// ============================================================================
// MAZZI DOMAIN — CONFIGURABLE CANCELLATION & REFUND POLICY
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
  minHoursBeforeLesson: number; // e.g. 24 for >24h, 6 for 6h to 24h, 0 for <6h
  studentRefundPercentage: number; // 0 to 100
  providerCompensationPercentage: number; // 0 to 100
  platformFeeRetainedPercentage: number; // 0 to 100
  description: string;
}

export interface CancellationPolicyConfig {
  providerInitiatedRefundPercentage: number; // Usually 100%
  studentInitiatedRules: CancellationPolicyRule[];
  noShowStudentRefundPercentage: number; // 0%
  noShowProviderRefundPercentage: number; // 100%
}

/**
 * DEFAULT_DEVELOPMENT_POLICY:
 * Configuration used ONLY for tests and development demo.
 * [DECISÃO PENDENTE]: The official commercial policy is to be configured
 * administratively by MAZZI management in future production sprints.
 */
export const DEFAULT_DEVELOPMENT_POLICY: CancellationPolicyConfig = {
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
      description: 'Cancelamento com menos de 6h de antecedência ou não comparecimento: Sem reembolso.',
    },
  ],
};

export interface CancellationResult {
  refundPercentage: number; // 0 to 100
  refundAmountInCents: number;
  providerCompensationInCents: number;
  platformFeeRetainedInCents: number;
  policyDescription: string;
}

/**
 * Calculates refund and compensation according to the provided (or default development) policy.
 * NEVER hard-codes percentages directly in the calculation logic.
 */
export function calculateCancellationPolicy(params: {
  cancelledBy: 'STUDENT' | 'PROVIDER' | 'NO_SHOW_STUDENT' | 'NO_SHOW_PROVIDER';
  hoursUntilLesson: number;
  totalPaidInCents: number;
  lessonPriceInCents: number;
  platformFeeInCents: number;
  policyConfig?: CancellationPolicyConfig;
}): CancellationResult {
  const {
    cancelledBy,
    hoursUntilLesson,
    totalPaidInCents,
    lessonPriceInCents,
    platformFeeInCents,
    policyConfig = DEFAULT_DEVELOPMENT_POLICY,
  } = params;

  // Provider cancelled the lesson
  if (cancelledBy === 'PROVIDER' || cancelledBy === 'NO_SHOW_PROVIDER') {
    const refundPct = policyConfig.providerInitiatedRefundPercentage;
    const refundAmountInCents = Math.round((totalPaidInCents * refundPct) / 100);
    return {
      refundPercentage: refundPct,
      refundAmountInCents,
      providerCompensationInCents: 0,
      platformFeeRetainedInCents: 0,
      policyDescription:
        'Cancelamento realizado pelo fornecedor: Reembolso integral (100%) imediato ao aluno.',
    };
  }

  // Student no-show
  if (cancelledBy === 'NO_SHOW_STUDENT') {
    return {
      refundPercentage: policyConfig.noShowStudentRefundPercentage,
      refundAmountInCents: 0,
      providerCompensationInCents: lessonPriceInCents,
      platformFeeRetainedInCents: platformFeeInCents,
      policyDescription: 'Não comparecimento do aluno (No-show): Sem reembolso.',
    };
  }

  // Find matching rule sorted descending by minHoursBeforeLesson
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
  };
}

export interface CancelBookingByProviderParams {
  booking: Booking;
  providerId: string;
  actorUserId: string;
  actorRole: UserRole;
  idempotencyKey?: string;
  now?: Date;
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
  const { booking, providerId, actorUserId, actorRole, idempotencyKey, now = new Date() } = params;

  // 1. Role validation
  if (actorRole === 'STUDENT' || actorRole === 'SUPPORT') {
    throw new CancellationDomainError(
      'UNAUTHORIZED_ROLE',
      'Somente prestadores de serviço ou instrutores autorizados podem cancelar agendamentos.',
      403
    );
  }

  // 2. Ownership / Tenant validation
  if (booking.providerId !== providerId && booking.instructorId !== providerId) {
    throw new CancellationDomainError(
      'UNAUTHORIZED_PROVIDER',
      'Acesso negado: este agendamento pertence a outro prestador.',
      403
    );
  }

  // 3. Idempotency Check
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

  // 4. Invalid status checks
  if (booking.status === 'COMPLETED') {
    throw new CancellationDomainError(
      'INVALID_STATUS_COMPLETED',
      'Não é possível cancelar uma aula que já foi concluída.',
      422
    );
  }

  if (booking.status === 'EXPIRED') {
    throw new CancellationDomainError(
      'INVALID_STATUS_EXPIRED',
      'Não é possível cancelar um agendamento que expirou.',
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

  // 5. Calculate cancellation policy
  const cancellationResult = calculateCancellationPolicy({
    cancelledBy: 'PROVIDER',
    hoursUntilLesson: 24,
    totalPaidInCents: booking.totalInCents,
    lessonPriceInCents: booking.priceInCents,
    platformFeeInCents: booking.platformFeeInCents,
  });

  const nowISO = now.toISOString();
  const updatedBooking: Booking = {
    ...booking,
    status: 'CANCELLED_BY_PROVIDER',
    cancelledAt: nowISO,
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

