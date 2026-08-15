// ============================================================================
// MAZZI DOMAIN — PAYMENT ORCHESTRATION SERVICE (SPRINT 09)
// ============================================================================

import {
  Booking,
  Payment,
  PaymentMethodType,
  MazziPaymentStatus,
  User,
  Provider,
  ProviderPaymentAccount,
  CreatePaymentRequest,
} from '../../types';
import { PaymentGateway, CreatePaymentGatewayRequest } from './gateway-interface';
import { FinancialLedgerService, globalFinancialLedger } from './financial-ledger';

export interface CreatePaymentOptions {
  booking: Booking;
  student: User;
  provider: Provider;
  providerPaymentAccount?: ProviderPaymentAccount;
  enforceAccountReadiness?: boolean;
  method: PaymentMethodType;
  idempotencyKey: string;
  gatewayToken?: string; // Tokenized card token (NEVER raw PAN/CVV)
  cardHolderName?: string;
  cardInstallments?: number;
  now?: Date;
}

export interface ConfirmPaymentResult {
  booking: Booking;
  payment: Payment;
  isAlreadyPaid: boolean;
  isLatePaymentOnExpiredBooking: boolean;
  refundPending: boolean;
}

import { MercadoPagoCredentialResolver } from './credential-resolver';

export class PaymentService {
  private credentialResolver: MercadoPagoCredentialResolver;

  constructor(
    private gateway: PaymentGateway,
    private ledger: FinancialLedgerService = globalFinancialLedger
  ) {
    this.credentialResolver = new MercadoPagoCredentialResolver(gateway);
  }

  /**
   * Alias method accepting CreatePaymentRequest and Booking.
   */
  async createPayment(params: {
    request: CreatePaymentRequest;
    booking: Booking;
    student?: Partial<User>;
    provider?: Partial<Provider>;
    payerEmail?: string;
    payerName?: string;
    payerDocument?: string;
    existingPayments?: Payment[];
    now?: Date;
  }): Promise<{ payment: Payment; isExisting: boolean }> {
    const { request, booking, student, provider, payerEmail, payerName, existingPayments = [], now } = params;
    const studentObj: User = {
      id: booking.studentId,
      name: payerName || student?.name || 'Aluno Mazzi',
      email: payerEmail || student?.email || 'aluno@mazzi.com.br',
      phone: student?.phone || '11999999999',
      role: 'STUDENT',
      createdAt: new Date().toISOString(),
      ...student,
    };

    const providerObj: Provider = {
      id: booking.providerId,
      userId: booking.instructorId || '11111111-1111-1111-1111-111111111102',
      name: provider?.name || 'Autoescola Parceira',
      legalName: provider?.legalName || 'Autoescola Parceira LTDA',
      documentNumber: provider?.documentNumber || '00000000000100',
      phone: provider?.phone || '11988888888',
      type: 'DRIVING_SCHOOL',
      status: 'ACTIVE',
      ratingAverage: 5,
      ratingCount: 10,
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      categories: ['B'],
      transmissions: ['MANUAL'],
      startingPriceInCents: 10000,
      isVerified: true,
      ...provider,
    };

    return this.createPaymentForBooking(
      {
        booking,
        student: studentObj,
        provider: providerObj,
        method: request.method,
        idempotencyKey: request.idempotencyKey,
        gatewayToken: request.gatewayToken,
        cardHolderName: request.cardHolderName,
        cardInstallments: request.cardInstallments,
        now,
      },
      existingPayments
    );
  }

  /**
   * Creates a payment for a booking that is in PENDING_PAYMENT hold state.
   * STRICT SECURITY: Amounts MUST be taken exclusively from booking.snapshot.
   */
  async createPaymentForBooking(
    options: CreatePaymentOptions,
    existingPayments: Payment[] = []
  ): Promise<{ payment: Payment; isExisting: boolean }> {
    const { booking, student, provider, method, idempotencyKey, gatewayToken, cardHolderName, cardInstallments } = options;
    const now = options.now || new Date();

    // 1. Validate Booking Status
    if (booking.status !== 'PENDING_PAYMENT') {
      throw new Error(`Não é possível iniciar pagamento: a reserva está com status ${booking.status}.`);
    }

    // 2. Validate Booking Hold Expiration
    if (booking.holdExpiresAt) {
      const expiresAt = new Date(booking.holdExpiresAt);
      if (expiresAt.getTime() <= now.getTime()) {
        throw new Error('O tempo de retenção desta reserva expirou. Solicite uma nova reserva.');
      }
    }

    // 3. Check for existing payment with this idempotency key
    const existingWithKey = existingPayments.find((p) => p.idempotencyKey === idempotencyKey);
    if (existingWithKey) {
      if (existingWithKey.bookingId !== booking.id) {
        throw new Error('Chave de idempotência reutilizada para uma reserva diferente.');
      }
      return { payment: existingWithKey, isExisting: true };
    }

    // 4. Double Payment Protection: Check if any payment for this booking is already PAID
    const alreadyPaidPayment = existingPayments.find(
      (p) => p.bookingId === booking.id && (p.status === 'PAID' || p.status === 'AUTHORIZED')
    );
    if (alreadyPaidPayment) {
      throw new Error('Esta reserva já possui um pagamento confirmado ou em processamento.');
    }

    // 4.1 Provider Payment Account Readiness & Credential Resolution (Split 1:1)
    let sellerAccessToken: string | undefined;
    if (options.providerPaymentAccount || options.enforceAccountReadiness) {
      const resolvedCredential = await this.credentialResolver.resolveSellerCredential({
        providerId: provider.id,
        account: options.providerPaymentAccount,
        now,
      });
      sellerAccessToken = resolvedCredential.accessToken;
      if (options.providerPaymentAccount) {
        options.providerPaymentAccount.externalAccountId = resolvedCredential.externalAccountId;
      }
    }

    // 5. Extract amount and snapshot values (Source of Truth is booking.snapshot)
    const amountInCents = booking.snapshot.totalInCents || booking.totalInCents;
    const platformFeeInCents = booking.snapshot.platformFeeInCents || booking.platformFeeInCents;
    const providerAmountInCents = booking.snapshot.priceInCents || (amountInCents - platformFeeInCents);

    if (amountInCents <= 0) {
      throw new Error('O valor total da reserva deve ser maior que zero.');
    }

    // 6. Calculate expiration for PIX (bounded by booking.holdExpiresAt)
    let pixExpirationUtc: string | undefined;
    if (method === 'PIX' && booking.holdExpiresAt) {
      pixExpirationUtc = booking.holdExpiresAt;
    }

    // 7. Request payment creation at gateway (Split 1:1 executed with sellerAccessToken)
    const gatewayReq: CreatePaymentGatewayRequest = {
      idempotencyKey,
      bookingId: booking.id,
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      providerId: provider.id,
      providerExternalAccountId: options.providerPaymentAccount?.externalAccountId,
      sellerAccessToken,
      amountInCents,
      platformFeeInCents,
      providerAmountInCents,
      method,
      description: `Aula Prática MAZZI - Categoria ${booking.snapshot.category} (${booking.scheduledDate} ${booking.startTime})`,
      gatewayToken,
      cardHolderName,
      cardInstallments: cardInstallments || 1,
      expirationTimestampUtc: pixExpirationUtc,
      metadata: {
        bookingId: booking.id,
        offeringId: booking.offeringId,
      },
    };

    const gatewayRes = await this.gateway.createPayment(gatewayReq);

    // 8. Build Payment Entity
    const payment: Payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      bookingId: booking.id,
      studentId: student.id,
      providerId: provider.id,
      gateway: this.gateway.gatewayType,
      externalPaymentId: gatewayRes.externalPaymentId,
      idempotencyKey,
      method,
      status: gatewayRes.status,
      amountInCents,
      platformFeeInCents,
      providerAmountInCents,
      gatewayFeeInCents: gatewayRes.mercadoPagoFeeInCents,
      sellerNetAmountInCents: gatewayRes.sellerNetAmountInCents,
      pixQrCode: gatewayRes.pixQrCode,
      pixQrCodeBase64: gatewayRes.pixQrCodeBase64,
      pixExpiresAt: gatewayRes.pixExpiresAt || booking.holdExpiresAt,
      cardLast4: gatewayRes.cardLast4,
      cardBrand: gatewayRes.cardBrand,
      metadata: {
        rawGatewayResponse: gatewayRes.rawGatewayResponse,
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // 9. Record Payment Created in Financial Ledger
    this.ledger.recordEvent({
      eventType: 'PAYMENT_CREATED',
      bookingId: booking.id,
      paymentId: payment.id,
      providerId: provider.id,
      studentId: student.id,
      amountInCents,
      platformFeeInCents,
      providerAmountInCents,
    });

    return { payment, isExisting: false };
  }

  /**
   * Atomic Payment Confirmation:
   * Called ONLY by verified backend webhook handler or backend polling service.
   * NEVER called directly by client-side buttons.
   */
  async confirmBookingPayment(params: {
    payment: Payment;
    booking: Booking;
    externalPaymentId?: string;
    paidAt?: string;
    now?: Date;
  }): Promise<ConfirmPaymentResult> {
    const { payment, booking, externalPaymentId, paidAt } = params;
    const now = params.now || new Date();
    const effectivePaidAt = paidAt || now.toISOString();

    // Idempotency check: if already PAID, return without side effects
    if (payment.status === 'PAID' && booking.status === 'CONFIRMED') {
      return {
        booking,
        payment,
        isAlreadyPaid: true,
        isLatePaymentOnExpiredBooking: false,
        refundPending: false,
      };
    }

    // Handle Late Payment on Expired / Cancelled Booking:
    // If the booking expired or was cancelled before payment notification arrived:
    // We DO NOT revive the booking! We mark payment as PAID, flag refund pending, and log event.
    if (booking.status === 'EXPIRED' || booking.status === 'CANCELLED_BY_STUDENT' || booking.status === 'CANCELLED_BY_PROVIDER') {
      const updatedPayment: Payment = {
        ...payment,
        status: 'PAID',
        paidAt: effectivePaidAt,
        externalPaymentId: externalPaymentId || payment.externalPaymentId,
        metadata: {
          ...payment.metadata,
          latePaymentReason: `Received payment for booking with status ${booking.status}`,
          autoRefundRequired: true,
        },
        updatedAt: now.toISOString(),
      };

      this.ledger.recordEvent({
        eventType: 'PAYMENT_PAID',
        bookingId: booking.id,
        paymentId: payment.id,
        providerId: payment.providerId,
        studentId: payment.studentId,
        amountInCents: payment.amountInCents,
        platformFeeInCents: 0,
        providerAmountInCents: 0,
        metadata: { latePaymentOnExpiredBooking: true, bookingStatus: booking.status },
      });

      return {
        booking,
        payment: updatedPayment,
        isAlreadyPaid: false,
        isLatePaymentOnExpiredBooking: true,
        refundPending: true,
      };
    }

    // Normal Confirmation Flow:
    const updatedPayment: Payment = {
      ...payment,
      status: 'PAID',
      paidAt: effectivePaidAt,
      externalPaymentId: externalPaymentId || payment.externalPaymentId,
      updatedAt: now.toISOString(),
    };

    const updatedBooking: Booking = {
      ...booking,
      status: 'CONFIRMED',
      confirmedAt: effectivePaidAt,
      updatedAt: now.toISOString(),
    };

    // Record Ledger Events
    this.ledger.recordEvent({
      eventType: 'PAYMENT_PAID',
      bookingId: booking.id,
      paymentId: payment.id,
      providerId: payment.providerId,
      studentId: payment.studentId,
      amountInCents: payment.amountInCents,
      platformFeeInCents: payment.platformFeeInCents,
      providerAmountInCents: payment.providerAmountInCents,
    });

    this.ledger.recordEvent({
      eventType: 'PLATFORM_FEE_RECORDED',
      bookingId: booking.id,
      paymentId: payment.id,
      providerId: payment.providerId,
      amountInCents: payment.platformFeeInCents,
      platformFeeInCents: payment.platformFeeInCents,
      providerAmountInCents: 0,
    });

    this.ledger.recordEvent({
      eventType: 'PAYOUT_PENDING',
      bookingId: booking.id,
      paymentId: payment.id,
      providerId: payment.providerId,
      amountInCents: payment.providerAmountInCents,
      platformFeeInCents: 0,
      providerAmountInCents: payment.providerAmountInCents,
      metadata: {
        payoutStatus: 'HELD_PENDING_LESSON_COMPLETION',
        holdReason: 'Lesson completion required before payout release',
      },
    });

    return {
      booking: updatedBooking,
      payment: updatedPayment,
      isAlreadyPaid: false,
      isLatePaymentOnExpiredBooking: false,
      refundPending: false,
    };
  }

  /**
   * Handles payment failure notification from webhook/gateway.
   */
  async handlePaymentFailure(params: {
    payment: Payment;
    booking: Booking;
    reason?: string;
    now?: Date;
  }): Promise<{ payment: Payment; booking: Booking }> {
    const { payment, booking, reason } = params;
    const now = params.now || new Date();

    const updatedPayment: Payment = {
      ...payment,
      status: 'FAILED',
      failedAt: now.toISOString(),
      metadata: {
        ...payment.metadata,
        failureReason: reason,
      },
      updatedAt: now.toISOString(),
    };

    // If booking was PENDING_PAYMENT, we transition booking to PAYMENT_FAILED
    let updatedBooking = booking;
    if (booking.status === 'PENDING_PAYMENT') {
      updatedBooking = {
        ...booking,
        status: 'PAYMENT_FAILED',
        updatedAt: now.toISOString(),
      };
    }

    this.ledger.recordEvent({
      eventType: 'PAYMENT_FAILED',
      bookingId: booking.id,
      paymentId: payment.id,
      providerId: payment.providerId,
      studentId: payment.studentId,
      amountInCents: payment.amountInCents,
      metadata: { failureReason: reason },
    });

    return { payment: updatedPayment, booking: updatedBooking };
  }
}
