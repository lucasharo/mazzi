// ============================================================================
// MAZZI DOMAIN — REFUND & PARTIAL REFUND SERVICE (SPRINT 09)
// ============================================================================

import {
  Booking,
  Payment,
  Refund,
  RefundPaymentRequest,
  UserRole,
} from '../../types';
import { PaymentGateway, RefundGatewayRequest } from './gateway-interface';
import { FinancialLedgerService, globalFinancialLedger } from './financial-ledger';
import { calculateCancellationPolicy } from '../cancellation';

export interface ProcessRefundResult {
  refund: Refund;
  payment: Payment;
  booking: Booking;
  isExisting: boolean;
}

export class RefundService {
  constructor(
    private gateway: PaymentGateway,
    private ledger: FinancialLedgerService = globalFinancialLedger
  ) {}

  /**
   * Processes a refund (total or partial) for a paid booking.
   */
  async requestRefund(params: {
    request: RefundPaymentRequest;
    payment: Payment;
    booking: Booking;
    existingRefunds?: Refund[];
    hoursUntilLesson?: number;
    cancelledBy?: 'STUDENT' | 'PROVIDER' | 'NO_SHOW_STUDENT' | 'NO_SHOW_PROVIDER';
    now?: Date;
  }): Promise<ProcessRefundResult> {
    const { request, payment, booking, existingRefunds = [], hoursUntilLesson, cancelledBy } = params;
    const now = params.now || new Date();

    // 1. Idempotency Check: if refund with this key exists, return it
    const existingWithKey = existingRefunds.find((r) => r.idempotencyKey === request.idempotencyKey);
    if (existingWithKey) {
      return {
        refund: existingWithKey,
        payment,
        booking,
        isExisting: true,
      };
    }

    // 2. Validate Payment Status
    if (payment.status !== 'PAID' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new Error(`Não é possível reembolsar um pagamento com status ${payment.status}.`);
    }

    // 3. Calculate Refund Amount
    let amountToRefundInCents: number;

    if (request.amountInCents && request.amountInCents > 0) {
      amountToRefundInCents = request.amountInCents;
    } else if (cancelledBy && typeof hoursUntilLesson === 'number') {
      // Use policy engine
      const policyResult = calculateCancellationPolicy({
        cancelledBy,
        hoursUntilLesson,
        totalPaidInCents: payment.amountInCents,
        lessonPriceInCents: payment.providerAmountInCents,
        platformFeeInCents: payment.platformFeeInCents,
      });
      amountToRefundInCents = policyResult.refundAmountInCents;
    } else {
      // Default to 100% total refund of remaining balance
      const alreadyRefundedInCents = existingRefunds
        .filter((r) => r.status === 'PROCESSED' && r.paymentId === payment.id)
        .reduce((sum, r) => sum + r.amountInCents, 0);
      amountToRefundInCents = payment.amountInCents - alreadyRefundedInCents;
    }

    if (amountToRefundInCents <= 0) {
      throw new Error('O valor do reembolso calculado é zero ou negativo.');
    }

    // 4. Validate remaining refundable balance
    const priorRefundedInCents = existingRefunds
      .filter((r) => r.status === 'PROCESSED' && r.paymentId === payment.id)
      .reduce((sum, r) => sum + r.amountInCents, 0);

    if (priorRefundedInCents + amountToRefundInCents > payment.amountInCents) {
      throw new Error(
        `Valor de reembolso solicitado (R$ ${(amountToRefundInCents / 100).toFixed(
          2
        )}) excede o saldo restante reembolsável (R$ ${((payment.amountInCents - priorRefundedInCents) / 100).toFixed(2)}).`
      );
    }

    // 5. Execute Gateway Refund
    const gatewayReq: RefundGatewayRequest = {
      externalPaymentId: payment.externalPaymentId || payment.id,
      amountInCents: amountToRefundInCents,
      reason: request.reason,
      idempotencyKey: request.idempotencyKey,
    };

    const gatewayRes = await this.gateway.refundPayment(gatewayReq);

    // 6. Build Refund Entity
    const refund: Refund = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      paymentId: payment.id,
      bookingId: booking.id,
      amountInCents: amountToRefundInCents,
      reason: request.reason,
      externalRefundId: gatewayRes.externalRefundId,
      idempotencyKey: request.idempotencyKey,
      status: gatewayRes.status,
      createdAt: now.toISOString(),
      completedAt: gatewayRes.status === 'PROCESSED' ? now.toISOString() : undefined,
    };

    // 7. Update Payment & Booking Status
    const totalRefundedSoFar = priorRefundedInCents + amountToRefundInCents;
    const isFullRefund = totalRefundedSoFar >= payment.amountInCents;

    const updatedPayment: Payment = {
      ...payment,
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      refundedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    let nextBookingStatus = booking.status;
    if (cancelledBy === 'STUDENT') {
      nextBookingStatus = 'CANCELLED_BY_STUDENT';
    } else if (cancelledBy === 'PROVIDER') {
      nextBookingStatus = 'CANCELLED_BY_PROVIDER';
    } else if (isFullRefund) {
      nextBookingStatus = 'REFUNDED';
    } else {
      nextBookingStatus = 'PARTIALLY_REFUNDED';
    }

    const updatedBooking: Booking = {
      ...booking,
      status: nextBookingStatus,
      cancelledAt: booking.cancelledAt || now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // 8. Record in Financial Ledger
    this.ledger.recordEvent({
      eventType: 'REFUND_COMPLETED',
      bookingId: booking.id,
      paymentId: payment.id,
      providerId: payment.providerId,
      studentId: payment.studentId,
      amountInCents: amountToRefundInCents,
      metadata: {
        reason: request.reason,
        isFullRefund,
        externalRefundId: gatewayRes.externalRefundId,
      },
    });

    return {
      refund,
      payment: updatedPayment,
      booking: updatedBooking,
      isExisting: false,
    };
  }
}
