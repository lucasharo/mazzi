// ============================================================================
// MAZZI PLATFORM — MERCADO PAGO REAL SANDBOX VALIDATION GATE (SPRINT 09)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  MercadoPagoPaymentGateway,
  MercadoPagoConfig,
  ProviderOAuthService,
  PaymentService,
  PaymentWebhookService,
  RefundService,
  FinancialLedgerService,
} from '../domain/payments';
import {
  Booking,
  Payment,
  Provider,
  User,
  ProviderPaymentAccount,
} from '../types';

describe('SPRINT 09 — Mercado Pago Sandbox Validation Gate', () => {
  const TEST_WEBHOOK_SECRET = 'mp_sec_test_c4d29f8a3e1b0725a690d54f82e1c3b4';
  const TEST_ACCESS_TOKEN = 'APP_USR-7891234567890123-081512-test-sand-123456';
  const TEST_CLIENT_ID = 'MAZZI_MARKETPLACE_TEST_APP';
  const TEST_CLIENT_SECRET = 'TEST_SECRET_c4d29f8a3e1b0725';

  let gateway: MercadoPagoPaymentGateway;
  let oauthService: ProviderOAuthService;
  let ledger: FinancialLedgerService;
  let paymentService: PaymentService;
  let webhookService: PaymentWebhookService;
  let refundService: RefundService;

  const mockProvider: Provider = {
    id: 'prov_cfc_central',
    userId: 'usr_inst_carlos',
    name: 'Autoescola Central Paulista',
    legalName: 'CFC Central Paulista LTDA',
    documentNumber: '12.345.678/0001-90',
    phone: '11988887777',
    type: 'DRIVING_SCHOOL',
    status: 'ACTIVE',
    ratingAverage: 4.9,
    ratingCount: 42,
    neighborhood: 'Consolação',
    city: 'São Paulo',
    categories: ['B'],
    transmissions: ['MANUAL'],
    startingPriceInCents: 11000,
    isVerified: true,
  };

  const mockStudent: User = {
    id: 'usr_student_lucas',
    name: 'Lucas Ferreira',
    email: 'lucas.ferreira@gmail.com',
    phone: '11977778888',
    role: 'STUDENT',
    createdAt: '2026-08-01T10:00:00Z',
  };

  const mockBooking: Booking = {
    id: 'book_mp_gate_001',
    studentId: mockStudent.id,
    providerId: mockProvider.id,
    providerName: mockProvider.name,
    instructorId: 'usr_inst_carlos',
    instructorName: 'Carlos Instrutor',
    vehicleId: 'veh_01',
    vehicleName: 'HB20 1.0 Manual',
    offeringId: 'off_b_60min',
    category: 'B',
    scheduledDate: '2026-08-25',
    startTime: '14:00',
    endTime: '15:00',
    scheduledStartAt: '2026-08-25T14:00:00Z',
    scheduledEndAt: '2026-08-25T15:00:00Z',
    status: 'PENDING_PAYMENT',
    priceInCents: 10000, // R$ 100,00 instructor gross
    platformFeeInCents: 1000, // R$ 10,00 Mazzi marketplace fee
    totalInCents: 11000, // R$ 110,00 total charged to student
    meetingPoint: 'Rua da Consolação, 1000',
    holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    snapshot: {
      providerId: mockProvider.id,
      providerName: mockProvider.name,
      providerType: mockProvider.type,
      instructorId: 'usr_inst_carlos',
      instructorName: 'Carlos Instrutor',
      vehicleId: 'veh_01',
      vehicleName: 'HB20 1.0 Manual',
      category: 'B',
      durationMinutes: 60,
      priceInCents: 10000,
      platformFeeInCents: 1000,
      totalInCents: 11000,
      meetingPoint: 'Rua da Consolação, 1000',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    gateway = new MercadoPagoPaymentGateway({
      accessToken: TEST_ACCESS_TOKEN,
      clientSecret: TEST_CLIENT_SECRET,
      clientId: TEST_CLIENT_ID,
      webhookSecret: TEST_WEBHOOK_SECRET,
      isSandbox: true,
    });
    oauthService = new ProviderOAuthService(gateway);
    ledger = new FinancialLedgerService();
    paymentService = new PaymentService(gateway, ledger);
    webhookService = new PaymentWebhookService(gateway, paymentService);
    refundService = new RefundService(gateway, ledger);
  });

  // ==========================================================================
  // 1. PROVIDER OAUTH & ACCOUNT READINESS
  // ==========================================================================
  describe('1. Provider OAuth & Marketplace Connection', () => {
    it('generates secure OAuth authorization URL with CSRF state parameter', () => {
      const result = oauthService.generateAuthorizationUrl({
        providerId: mockProvider.id,
        redirectUri: 'https://mazzi.app.br/api/oauth/mercadopago/callback',
      });

      expect(result.authorizationUrl).toContain('https://auth.mercadopago.com.br/authorization');
      expect(result.authorizationUrl).toContain(`client_id=${TEST_CLIENT_ID}`);
      expect(result.authorizationUrl).toContain(`state=${result.state}`);
      expect(result.state).toMatch(new RegExp(`^prov_${mockProvider.id}__`));
    });

    it('rejects OAuth callback when CSRF state does not match expected state', async () => {
      await expect(
        oauthService.handleCallback({
          code: 'TG-12345-TEST',
          state: 'prov_hacker_forged',
          expectedState: 'prov_valid_state',
          provider: mockProvider,
          redirectUri: 'https://mazzi.app.br/api/oauth/callback',
        })
      ).rejects.toThrow('OAuth State inválido ou expirado');
    });

    it('exchanges OAuth authorization code and creates active ProviderPaymentAccount', async () => {
      const authInit = oauthService.generateAuthorizationUrl({
        providerId: mockProvider.id,
        redirectUri: 'https://mazzi.app.br/api/oauth/callback',
      });

      const callbackResult = await oauthService.handleCallback({
        code: 'TG-MERCADOPAGO-AUTH-CODE-999',
        state: authInit.state,
        expectedState: authInit.state,
        provider: mockProvider,
        redirectUri: 'https://mazzi.app.br/api/oauth/callback',
      });

      expect(callbackResult.isNewAccount).toBe(true);
      expect(callbackResult.account.status).toBe('ACTIVE');
      expect(callbackResult.account.chargesEnabled).toBe(true);
      expect(callbackResult.account.payoutsEnabled).toBe(true);
      expect(callbackResult.account.providerId).toBe(mockProvider.id);
      expect(callbackResult.account.externalAccountId).toBeDefined();
      // SECURE: tokens never returned in public account structure
      expect((callbackResult.account as any).accessToken).toBeUndefined();
    });

    it('enforces PAYMENT_ACCOUNT_NOT_READY when provider payment account is missing or disabled', async () => {
      const disabledAccount: ProviderPaymentAccount = {
        id: 'ppa_disabled',
        providerId: mockProvider.id,
        gateway: 'MERCADOPAGO',
        externalAccountId: 'mp_disabled_123',
        status: 'DISABLED',
        chargesEnabled: false,
        payoutsEnabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(
        paymentService.createPaymentForBooking({
          booking: mockBooking,
          student: mockStudent,
          provider: mockProvider,
          providerPaymentAccount: disabledAccount,
          method: 'PIX',
          idempotencyKey: 'idemp_not_ready_01',
        })
      ).rejects.toThrow('PAYMENT_ACCOUNT_NOT_READY');

      await expect(
        paymentService.createPaymentForBooking({
          booking: mockBooking,
          student: mockStudent,
          provider: mockProvider,
          enforceAccountReadiness: true,
          method: 'PIX',
          idempotencyKey: 'idemp_not_ready_02',
        })
      ).rejects.toThrow('PAYMENT_ACCOUNT_NOT_READY');
    });
  });

  // ==========================================================================
  // 2. PIX CREATION & OFFICIAL PSP PAYLOAD CONSUMPTION
  // ==========================================================================
  describe('2. PIX Sandbox Creation & Payload Validation', () => {
    it('creates PIX charge consuming official PSP payload fields without manual generation', async () => {
      const activeAccount: ProviderPaymentAccount = {
        id: 'ppa_active_01',
        providerId: mockProvider.id,
        gateway: 'MERCADOPAGO',
        externalAccountId: 'mp_seller_888',
        status: 'ACTIVE',
        chargesEnabled: true,
        payoutsEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await paymentService.createPaymentForBooking({
        booking: mockBooking,
        student: mockStudent,
        provider: mockProvider,
        providerPaymentAccount: activeAccount,
        method: 'PIX',
        idempotencyKey: 'idemp_pix_gate_01',
      });

      expect(result.payment.status).toBe('PENDING');
      expect(result.payment.method).toBe('PIX');
      expect(result.payment.amountInCents).toBe(11000);
      expect(result.payment.platformFeeInCents).toBe(1000);
      expect(result.payment.providerAmountInCents).toBe(10000);
      expect(result.payment.pixQrCode).toBeDefined();
      expect(result.payment.pixQrCode).toContain('00020126580014BR.GOV.BCB.PIX');
      expect(result.payment.pixExpiresAt).toBe(mockBooking.holdExpiresAt);

      // Booking remains PENDING_PAYMENT until webhook confirmation
      expect(mockBooking.status).toBe('PENDING_PAYMENT');
    });
  });

  // ==========================================================================
  // 3. CREDIT CARD TOKENIZATION & APPROVED / DECLINED FLOWS
  // ==========================================================================
  describe('3. Card Tokenization & Processing', () => {
    it('ensures backend accepts only tokenized gatewayToken (never raw PAN/CVV)', async () => {
      const activeAccount: ProviderPaymentAccount = {
        id: 'ppa_active_02',
        providerId: mockProvider.id,
        gateway: 'MERCADOPAGO',
        externalAccountId: 'mp_seller_888',
        status: 'ACTIVE',
        chargesEnabled: true,
        payoutsEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await paymentService.createPaymentForBooking({
        booking: mockBooking,
        student: mockStudent,
        provider: mockProvider,
        providerPaymentAccount: activeAccount,
        method: 'CREDIT_CARD',
        idempotencyKey: 'idemp_card_token_01',
        gatewayToken: 'card_tok_test_987654321',
        cardHolderName: 'LUCAS FERREIRA',
        cardInstallments: 1,
      });

      expect(result.payment.method).toBe('CREDIT_CARD');
      expect(result.payment.cardLast4).toBeDefined();
      // Ensure raw card numbers never exist in payment entity
      expect((result.payment as any).cardNumber).toBeUndefined();
      expect((result.payment as any).cvv).toBeUndefined();
    });

    it('processes card declined scenario leaving booking in unconfirmed state', async () => {
      const payment: Payment = {
        id: 'pay_card_fail_01',
        gateway: 'MERCADOPAGO',
        externalPaymentId: 'mp_ext_fail_999',
        bookingId: mockBooking.id,
        studentId: mockStudent.id,
        providerId: mockProvider.id,
        idempotencyKey: 'idemp_card_fail_01',
        method: 'CREDIT_CARD',
        status: 'PENDING',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await paymentService.handlePaymentFailure({
        payment,
        booking: mockBooking,
        reason: 'cc_rejected_insufficient_amount',
      });

      expect(result.payment.status).toBe('FAILED');
      expect(result.booking.status).toBe('PAYMENT_FAILED');
      expect(result.booking.status).not.toBe('CONFIRMED');
    });
  });

  // ==========================================================================
  // 4. WEBHOOK MANIFEST, CRYPTOGRAPHIC SIGNATURE & IDEMPOTENCY
  // ==========================================================================
  describe('4. Webhook Manifest & Cryptographic Signature Verification', () => {
    function generateValidMpSignature(dataId: string, requestId: string, ts: string, secret: string): string {
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
      return `ts=${ts},v1=${hash}`;
    }

    it('authenticates valid Mercado Pago signature following exact manifest format', async () => {
      const dataId = '9988776655';
      const requestId = 'req_mp_uuid_001';
      const ts = String(Math.floor(Date.now() / 1000));
      const validSig = generateValidMpSignature(dataId, requestId, ts, TEST_WEBHOOK_SECRET);

      const payload = JSON.stringify({
        id: 'evt_mp_1001',
        type: 'payment.updated',
        data: { id: dataId, status: 'approved', transaction_amount: 110.0 },
      });

      const headers = {
        'x-signature': validSig,
        'x-request-id': requestId,
      };

      const isValid = gateway.verifyWebhookSignature(payload, headers);
      expect(isValid).toBe(true);
    });

    it('rejects tampered or invalid webhook signature with unauthorized error', async () => {
      const payload = JSON.stringify({
        id: 'evt_mp_forged',
        type: 'payment.updated',
        data: { id: '9988776655', status: 'approved' },
      });

      const headers = {
        'x-signature': 'ts=1700000000,v1=forged_invalid_sha256_hash_value',
        'x-request-id': 'req_forged_999',
      };

      const payment: Payment = {
        id: 'pay_valid_01',
        gateway: 'MERCADOPAGO',
        externalPaymentId: '9988776655',
        bookingId: mockBooking.id,
        studentId: mockStudent.id,
        providerId: mockProvider.id,
        idempotencyKey: 'idemp_sig_test',
        method: 'PIX',
        status: 'PENDING',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(
        webhookService.processWebhook({
          rawPayload: payload,
          headers,
          existingPayments: [payment],
          existingBookings: [mockBooking],
        })
      ).rejects.toThrow('Falha na autenticação da assinatura do webhook (UNAUTHORIZED)');

      // Payment and booking remain untouched
      expect(payment.status).toBe('PENDING');
      expect(mockBooking.status).toBe('PENDING_PAYMENT');
    });

    it('executes end-to-end PIX payment confirmation and verifies idempotency on duplicate delivery', async () => {
      const dataId = 'mp_pay_real_999';
      const requestId = 'req_uuid_pix_01';
      const ts = String(Math.floor(Date.now() / 1000));
      const validSig = generateValidMpSignature(dataId, requestId, ts, TEST_WEBHOOK_SECRET);

      const payload = JSON.stringify({
        id: 'evt_mp_pix_paid_01',
        type: 'payment.updated',
        data: { id: dataId, status: 'approved', transaction_amount: 110.0, date_approved: new Date().toISOString() },
      });

      const headers = {
        'x-signature': validSig,
        'x-request-id': requestId,
      };

      const payment: Payment = {
        id: 'pay_pix_gate_01',
        gateway: 'MERCADOPAGO',
        externalPaymentId: dataId,
        bookingId: mockBooking.id,
        studentId: mockStudent.id,
        providerId: mockProvider.id,
        idempotencyKey: 'idemp_pix_gate_01',
        method: 'PIX',
        status: 'PENDING',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const targetBooking = { ...mockBooking };

      // First webhook delivery
      const res1 = await webhookService.processWebhook({
        rawPayload: payload,
        headers,
        existingPayments: [payment],
        existingBookings: [targetBooking],
      });

      expect(res1.status).toBe('PROCESSED');
      expect(res1.booking?.status).toBe('CONFIRMED');
      expect(res1.payment?.status).toBe('PAID');

      // Duplicate delivery replay
      const res2 = await webhookService.processWebhook({
        rawPayload: payload,
        headers,
        existingPayments: [res1.payment!],
        existingBookings: [res1.booking!],
      });

      expect(res2.status).toBe('REPLAY');
      expect(res2.eventRecord.status).toBe('PROCESSED');
    });

    it('safely ignores out-of-order webhook delivery (pending webhook arriving after payment is already paid)', async () => {
      const dataId = 'mp_pay_ooo_999';
      const requestId = 'req_uuid_ooo_01';
      const ts = String(Math.floor(Date.now() / 1000));
      const validSig = generateValidMpSignature(dataId, requestId, ts, TEST_WEBHOOK_SECRET);

      const latePendingPayload = JSON.stringify({
        id: 'evt_mp_late_pending',
        type: 'payment.updated',
        data: { id: dataId, status: 'pending', transaction_amount: 110.0 },
      });

      const headers = {
        'x-signature': validSig,
        'x-request-id': requestId,
      };

      const paidPayment: Payment = {
        id: 'pay_already_paid',
        gateway: 'MERCADOPAGO',
        externalPaymentId: dataId,
        bookingId: mockBooking.id,
        studentId: mockStudent.id,
        providerId: mockProvider.id,
        idempotencyKey: 'idemp_ooo',
        method: 'PIX',
        status: 'PAID',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await webhookService.processWebhook({
        rawPayload: latePendingPayload,
        headers,
        existingPayments: [paidPayment],
        existingBookings: [mockBooking],
      });

      expect(res.status).toBe('IGNORED');
      expect(paidPayment.status).toBe('PAID'); // MUST NOT downgrade to PENDING
    });
  });

  // ==========================================================================
  // 5. LATE PAYMENT & DOUBLE PAYMENT DEFENSES
  // ==========================================================================
  describe('5. Late Payment & Double Payment Defenses', () => {
    it('defends against late payment on expired booking: flags refund without reviving booking', async () => {
      const expiredBooking: Booking = {
        ...mockBooking,
        id: 'book_expired_001',
        status: 'EXPIRED',
        expiredAt: '2026-08-20T10:00:00Z',
      };

      const payment: Payment = {
        id: 'pay_late_mp_01',
        gateway: 'MERCADOPAGO',
        externalPaymentId: 'mp_late_888',
        bookingId: expiredBooking.id,
        studentId: expiredBooking.studentId,
        providerId: expiredBooking.providerId,
        idempotencyKey: 'idemp_late_mp',
        method: 'PIX',
        status: 'PENDING',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await paymentService.confirmBookingPayment({
        payment,
        booking: expiredBooking,
        externalPaymentId: 'mp_late_888',
      });

      expect(result.isLatePaymentOnExpiredBooking).toBe(true);
      expect(result.refundPending).toBe(true);
      expect(result.payment.status).toBe('PAID');
      expect(result.payment.metadata?.autoRefundRequired).toBe(true);
      // Booking MUST NOT be resurrected
      expect(result.booking.status).toBe('EXPIRED');
    });

    it('prevents double payment when duplicate charge attempt is made on already confirmed booking', async () => {
      const confirmedBooking: Booking = {
        ...mockBooking,
        status: 'CONFIRMED',
        confirmedAt: new Date().toISOString(),
      };

      const paidPayment: Payment = {
        id: 'pay_first_01',
        gateway: 'MERCADOPAGO',
        externalPaymentId: 'mp_first_111',
        bookingId: confirmedBooking.id,
        studentId: mockStudent.id,
        providerId: mockProvider.id,
        idempotencyKey: 'idemp_first_pay',
        method: 'PIX',
        status: 'PAID',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await expect(
        paymentService.createPaymentForBooking(
          {
            booking: confirmedBooking,
            student: mockStudent,
            provider: mockProvider,
            method: 'CREDIT_CARD',
            idempotencyKey: 'idemp_second_pay',
          },
          [paidPayment]
        )
      ).rejects.toThrow('Não é possível iniciar pagamento: a reserva está com status CONFIRMED');
    });
  });

  // ==========================================================================
  // 6. REFUNDS & IDEMPOTENCY
  // ==========================================================================
  describe('6. Total & Partial Refunds with Replay Protection', () => {
    it('executes partial and total refunds according to cancellation policy rules', async () => {
      const paidPayment: Payment = {
        id: 'pay_refund_mp_01',
        gateway: 'MERCADOPAGO',
        externalPaymentId: 'mp_ref_target_999',
        bookingId: mockBooking.id,
        studentId: mockStudent.id,
        providerId: mockProvider.id,
        idempotencyKey: 'idemp_ref_target',
        method: 'PIX',
        status: 'PAID',
        amountInCents: 11000,
        platformFeeInCents: 1000,
        providerAmountInCents: 10000,
        paidAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1. Partial refund of 50% (5500 cents)
      const partialRes = await refundService.requestRefund({
        request: {
          paymentId: paidPayment.id,
          amountInCents: 5500,
          reason: 'Cancelamento com retenção parcial de 50%',
          idempotencyKey: 'ref_idemp_part_01',
        },
        payment: paidPayment,
        booking: mockBooking,
      });

      expect(partialRes.refund.status).toBe('PROCESSED');
      expect(partialRes.refund.amountInCents).toBe(5500);
      expect(partialRes.payment.status).toBe('PARTIALLY_REFUNDED');

      // 2. Reject refund exceeding remaining balance
      await expect(
        refundService.requestRefund({
          request: {
            paymentId: partialRes.payment.id,
            amountInCents: 6000, // 6000 > 5500
            reason: 'Excess refund',
            idempotencyKey: 'ref_idemp_excess',
          },
          payment: partialRes.payment,
          booking: mockBooking,
          existingRefunds: [partialRes.refund],
        })
      ).rejects.toThrow('excede o saldo restante reembolsável');

      // 3. Idempotent replay of same refund request
      const replayRes = await refundService.requestRefund({
        request: {
          paymentId: partialRes.payment.id,
          amountInCents: 5500,
          reason: 'Cancelamento com retenção parcial de 50%',
          idempotencyKey: 'ref_idemp_part_01',
        },
        payment: partialRes.payment,
        booking: mockBooking,
        existingRefunds: [partialRes.refund],
      });

      expect(replayRes.isExisting).toBe(true);
      expect(replayRes.refund.id).toBe(partialRes.refund.id);
    });
  });

  // ==========================================================================
  // 7. 4-TIER FEE BREAKDOWN & SPLIT PAYMENTS
  // ==========================================================================
  describe('7. 4-Tier Marketplace Fee Breakdown', () => {
    it('computes gross, marketplaceFee, mercadoPagoFee, and sellerNetAmount cleanly', async () => {
      const activeAccount: ProviderPaymentAccount = {
        id: 'ppa_split_01',
        providerId: mockProvider.id,
        gateway: 'MERCADOPAGO',
        externalAccountId: 'mp_seller_split_999',
        status: 'ACTIVE',
        chargesEnabled: true,
        payoutsEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await paymentService.createPaymentForBooking({
        booking: mockBooking,
        student: mockStudent,
        provider: mockProvider,
        providerPaymentAccount: activeAccount,
        method: 'PIX',
        idempotencyKey: 'idemp_split_fees_01',
      });

      expect(result.payment.amountInCents).toBe(11000); // gross
      expect(result.payment.platformFeeInCents).toBe(1000); // marketplace fee
      expect(result.payment.providerAmountInCents).toBe(10000); // provider gross
      expect(result.payment.gatewayFeeInCents).toBeDefined(); // MP fee (e.g. 0.99% for PIX = ~109 cents)
      expect(result.payment.sellerNetAmountInCents).toBeDefined();
      expect(result.payment.sellerNetAmountInCents).toBe(
        result.payment.amountInCents - result.payment.platformFeeInCents - result.payment.gatewayFeeInCents!
      );
    });
  });

  // ==========================================================================
  // 8. SECRETS AUDIT & SENSITIVE DATA DEFENSE
  // ==========================================================================
  describe('8. Secrets Audit & Security Safeguards', () => {
    it('ensures secret credentials never leak into payment or booking objects', async () => {
      const activeAccount: ProviderPaymentAccount = {
        id: 'ppa_sec_01',
        providerId: mockProvider.id,
        gateway: 'MERCADOPAGO',
        externalAccountId: 'mp_seller_sec_888',
        status: 'ACTIVE',
        chargesEnabled: true,
        payoutsEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = await paymentService.createPaymentForBooking({
        booking: mockBooking,
        student: mockStudent,
        provider: mockProvider,
        providerPaymentAccount: activeAccount,
        method: 'PIX',
        idempotencyKey: 'idemp_sec_audit',
      });

      const paymentJson = JSON.stringify(result.payment);
      expect(paymentJson).not.toContain(TEST_ACCESS_TOKEN);
      expect(paymentJson).not.toContain(TEST_WEBHOOK_SECRET);
      expect(paymentJson).not.toContain(TEST_CLIENT_SECRET);
    });
  });
});
