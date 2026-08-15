// ============================================================================
// MAZZI TESTS — SPRINT 09 PAYMENTS & FINANCIAL SETTLEMENT TEST SUITE
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Booking,
  Payment,
  Refund,
  CreatePaymentRequest,
  RefundPaymentRequest,
} from '../types';
import {
  DevelopmentPaymentGateway,
  MercadoPagoPaymentGateway,
  PaymentService,
  PaymentWebhookService,
  RefundService,
  FinancialLedgerService,
} from '../domain/payments';

describe('Sprint 09: Payment Domain & Gateway Architecture', () => {
  let devGateway: DevelopmentPaymentGateway;
  let mpGateway: MercadoPagoPaymentGateway;
  let ledger: FinancialLedgerService;
  let paymentService: PaymentService;
  let webhookService: PaymentWebhookService;
  let refundService: RefundService;

  const mockBooking: Booking = {
    id: 'book_test_001',
    studentId: 'usr_student_01',
    providerId: 'prov_school_01',
    providerName: 'Autoescola Modelo',
    instructorId: 'usr_instructor_01',
    instructorName: 'Roberto Instrutor',
    vehicleId: 'veh_01',
    vehicleName: 'Gol 1.0',
    offeringId: 'off_01',
    category: 'B',
    scheduledDate: '2026-09-20',
    startTime: '10:00',
    endTime: '10:50',
    scheduledStartAt: '2026-09-20T10:00:00Z',
    scheduledEndAt: '2026-09-20T10:50:00Z',
    status: 'PENDING_PAYMENT',
    priceInCents: 10000,
    platformFeeInCents: 1000,
    totalInCents: 11000,
    meetingPoint: 'Ponto Central - Av Paulista 1000',
    snapshot: {
      providerId: 'prov_school_01',
      providerName: 'Autoescola Modelo',
      providerType: 'DRIVING_SCHOOL',
      instructorId: 'usr_instructor_01',
      instructorName: 'Roberto Instrutor',
      vehicleId: 'veh_01',
      vehicleName: 'Gol 1.0',
      category: 'B',
      durationMinutes: 50,
      priceInCents: 10000,
      platformFeeInCents: 1000,
      totalInCents: 11000,
      meetingPoint: 'Ponto Central - Av Paulista 1000',
    },
    createdAt: '2026-08-15T10:00:00Z',
    updatedAt: '2026-08-15T10:00:00Z',
  };

  beforeEach(() => {
    devGateway = new DevelopmentPaymentGateway();
    mpGateway = new MercadoPagoPaymentGateway({
      accessToken: 'TEST-ACCESS-TOKEN-123',
      webhookSecret: 'test_webhook_secret_key',
      isSandbox: true,
    });
    ledger = new FinancialLedgerService();
    paymentService = new PaymentService(devGateway, ledger);
    webhookService = new PaymentWebhookService(devGateway, paymentService);
    refundService = new RefundService(devGateway, ledger);
  });

  describe('1. Payment Creation & Snapshot Immutability', () => {
    it('creates PIX payment using snapshot prices (integer cents only, no floats)', async () => {
      const request: CreatePaymentRequest = {
        bookingId: mockBooking.id,
        method: 'PIX',
        idempotencyKey: 'idem_pix_001',
      };

      const result = await paymentService.createPayment({
        request,
        booking: mockBooking,
        payerEmail: 'aluno@teste.com',
        payerName: 'Carlos Aluno',
        payerDocument: '12345678909',
      });

      expect(result.payment.status).toBe('PENDING');
      expect(result.payment.amountInCents).toBe(11000);
      expect(result.payment.platformFeeInCents).toBe(1000);
      expect(result.payment.providerAmountInCents).toBe(10000);
      expect(result.payment.method).toBe('PIX');
      expect(result.payment.pixQrCode).toBeDefined();
      expect(result.isExisting).toBe(false);

      // Verify financial event recorded
      const events = ledger.getEventsForBooking(mockBooking.id);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('PAYMENT_CREATED');
      expect(events[0].amountInCents).toBe(11000);
    });

    it('returns existing payment on idempotent retry with same key', async () => {
      const request: CreatePaymentRequest = {
        bookingId: mockBooking.id,
        method: 'PIX',
        idempotencyKey: 'idem_pix_002',
      };

      const firstCall = await paymentService.createPayment({
        request,
        booking: mockBooking,
      });

      const secondCall = await paymentService.createPayment({
        request,
        booking: mockBooking,
        existingPayments: [firstCall.payment],
      });

      expect(secondCall.isExisting).toBe(true);
      expect(secondCall.payment.id).toBe(firstCall.payment.id);
    });

    it('rejects payment creation if booking is not in PENDING_PAYMENT status', async () => {
      const confirmedBooking: Booking = {
        ...mockBooking,
        status: 'CONFIRMED',
      };

      await expect(
        paymentService.createPayment({
          request: { bookingId: confirmedBooking.id, method: 'PIX', idempotencyKey: 'idem_03' },
          booking: confirmedBooking,
        })
      ).rejects.toThrow('Não é possível iniciar pagamento');
    });
  });

  describe('2. Payment Confirmation & Late Payment Defense', () => {
    it('confirms payment, transitions booking to CONFIRMED and records accounting ledger', async () => {
      const request: CreatePaymentRequest = {
        bookingId: mockBooking.id,
        method: 'PIX',
        idempotencyKey: 'idem_pix_004',
      };

      const { payment } = await paymentService.createPayment({
        request,
        booking: mockBooking,
      });

      const confirmResult = await paymentService.confirmBookingPayment({
        payment,
        booking: mockBooking,
        externalPaymentId: 'ext_tx_12345',
      });

      expect(confirmResult.payment.status).toBe('PAID');
      expect(confirmResult.booking.status).toBe('CONFIRMED');
      expect(confirmResult.isAlreadyPaid).toBe(false);
      expect(confirmResult.isLatePaymentOnExpiredBooking).toBe(false);

      // Verify Ledger entries
      const events = ledger.getEventsForBooking(mockBooking.id);
      expect(events.map((e) => e.eventType)).toEqual([
        'PAYMENT_CREATED',
        'PAYMENT_PAID',
        'PLATFORM_FEE_RECORDED',
        'PAYOUT_PENDING',
      ]);
    });

    it('defends against late payment on EXPIRED booking: marks payment as PAID, flags refund, does NOT confirm booking', async () => {
      const expiredBooking: Booking = {
        ...mockBooking,
        status: 'EXPIRED',
      };

      const request: CreatePaymentRequest = {
        bookingId: expiredBooking.id,
        method: 'PIX',
        idempotencyKey: 'idem_late_01',
      };

      // Force creation for test
      const payment: Payment = {
        id: 'pay_late_01',
        gateway: 'DEVELOPMENT_MOCK',
        bookingId: expiredBooking.id,
        studentId: expiredBooking.studentId,
        providerId: expiredBooking.providerId,
        method: 'PIX',
        status: 'PENDING',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        idempotencyKey: 'idem_late_01',
        createdAt: '2026-08-15T10:00:00Z',
        updatedAt: '2026-08-15T10:00:00Z',
      };

      const confirmResult = await paymentService.confirmBookingPayment({
        payment,
        booking: expiredBooking,
        externalPaymentId: 'ext_late_pay',
      });

      expect(confirmResult.isLatePaymentOnExpiredBooking).toBe(true);
      expect(confirmResult.refundPending).toBe(true);
      expect(confirmResult.booking.status).toBe('EXPIRED'); // Never revived
      expect(confirmResult.payment.status).toBe('PAID');
    });
  });

  describe('3. Webhook Ingestion & Monotonic State Protection', () => {
    it('authenticates valid webhook signature and confirms booking', async () => {
      const payment: Payment = {
        id: 'pay_hook_01',
        gateway: 'DEVELOPMENT_MOCK',
        externalPaymentId: 'ext_hook_999',
        bookingId: mockBooking.id,
        studentId: mockBooking.studentId,
        providerId: mockBooking.providerId,
        method: 'PIX',
        status: 'PENDING',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        idempotencyKey: 'idem_hook_01',
        createdAt: '2026-08-15T10:00:00Z',
        updatedAt: '2026-08-15T10:00:00Z',
      };

      const rawPayload = JSON.stringify({
        id: 'evt_123',
        type: 'payment.updated',
        data: { id: 'ext_hook_999', status: 'approved' },
      });

      const res = await webhookService.processWebhook({
        rawPayload,
        headers: { 'x-signature': 'dev-mock-signature' },
        existingPayments: [payment],
        existingBookings: [mockBooking],
      });

      expect(res.status).toBe('PROCESSED');
      expect(res.booking?.status).toBe('CONFIRMED');
      expect(res.payment?.status).toBe('PAID');
    });

    it('rejects webhook with invalid signature', async () => {
      await expect(
        webhookService.processWebhook({
          rawPayload: '{"type":"payment"}',
          headers: { 'x-signature': 'invalid-tampered-signature' },
          existingPayments: [],
          existingBookings: [],
        })
      ).rejects.toThrow('Falha na autenticação da assinatura');
    });

    it('safely ignores out-of-order webhook delivery (pending after paid)', async () => {
      const paidPayment: Payment = {
        id: 'pay_paid_01',
        gateway: 'DEVELOPMENT_MOCK',
        externalPaymentId: 'ext_paid_999',
        bookingId: mockBooking.id,
        studentId: mockBooking.studentId,
        providerId: mockBooking.providerId,
        method: 'PIX',
        status: 'PAID',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        idempotencyKey: 'idem_paid_01',
        createdAt: '2026-08-15T10:00:00Z',
        updatedAt: '2026-08-15T10:00:00Z',
      };

      const latePendingPayload = JSON.stringify({
        id: 'evt_late_pending',
        type: 'payment.updated',
        data: { id: 'ext_paid_999', status: 'pending' },
      });

      const res = await webhookService.processWebhook({
        rawPayload: latePendingPayload,
        headers: { 'x-signature': 'dev-mock-signature' },
        existingPayments: [paidPayment],
        existingBookings: [{ ...mockBooking, status: 'CONFIRMED' }],
      });

      expect(res.status).toBe('IGNORED');
      expect(res.message).toContain('fora de ordem');
    });
  });

  describe('4. Refunds & Dynamic Policy Safeguards', () => {
    it('executes partial refund according to cancellation policy rules', async () => {
      const paidPayment: Payment = {
        id: 'pay_ref_01',
        gateway: 'DEVELOPMENT_MOCK',
        externalPaymentId: 'ext_ref_111',
        bookingId: mockBooking.id,
        studentId: mockBooking.studentId,
        providerId: mockBooking.providerId,
        method: 'PIX',
        status: 'PAID',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        idempotencyKey: 'idem_ref_01',
        createdAt: '2026-08-15T10:00:00Z',
        updatedAt: '2026-08-15T10:00:00Z',
      };

      const paidBooking: Booking = {
        ...mockBooking,
        status: 'CONFIRMED',
      };

      // Student cancels 10 hours before lesson -> 50% total paid refund (R$ 55,00)
      const res = await refundService.requestRefund({
        request: {
          paymentId: paidPayment.id,
          idempotencyKey: 'idem_ref_partial_req',
          reason: 'Cancelamento com 10h de antecedência',
        },
        payment: paidPayment,
        booking: paidBooking,
        cancelledBy: 'STUDENT',
        hoursUntilLesson: 10,
      });

      expect(res.refund.amountInCents).toBe(5500); // 50% of 11000
      expect(res.payment.status).toBe('PARTIALLY_REFUNDED');
      expect(res.booking.status).toBe('CANCELLED_BY_STUDENT');
      expect(res.refund.status).toBe('PROCESSED');
    });

    it('rejects refund request that exceeds payment amount', async () => {
      const paidPayment: Payment = {
        id: 'pay_ref_02',
        gateway: 'DEVELOPMENT_MOCK',
        externalPaymentId: 'ext_ref_222',
        bookingId: mockBooking.id,
        studentId: mockBooking.studentId,
        providerId: mockBooking.providerId,
        method: 'PIX',
        status: 'PAID',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        idempotencyKey: 'idem_ref_02',
        createdAt: '2026-08-15T10:00:00Z',
        updatedAt: '2026-08-15T10:00:00Z',
      };

      await expect(
        refundService.requestRefund({
          request: {
            paymentId: paidPayment.id,
            amountInCents: 15000, // Exceeds 11000
            idempotencyKey: 'idem_excess_ref',
            reason: 'Tentativa excesso',
          },
          payment: paidPayment,
          booking: mockBooking,
        })
      ).rejects.toThrow('excede o saldo restante reembolsável');
    });
  });
});
