// ============================================================================
// MAZZI DOMAIN — FAKE PAYMENT GATEWAY & FACTORY TESTS (SPRINT 09)
// ============================================================================

import { describe, it, expect } from 'vitest';
import { FakePaymentGateway } from '../domain/payments/fake-adapter';
import { PaymentGatewayFactory } from '../domain/payments/gateway-factory';
import { CreatePaymentGatewayRequest } from '../domain/payments/gateway-interface';

describe('Sprint 09: Fake Payment Gateway & Factory (MVP Strategy)', () => {
  const fakeGateway = new FakePaymentGateway();

  it('creates payment in fake gateway without real money or real PSP calls', async () => {
    const req: CreatePaymentGatewayRequest = {
      idempotencyKey: 'idemp_fake_100',
      bookingId: 'book_100',
      studentId: 'stud_100',
      studentName: 'Aluno Teste',
      studentEmail: 'aluno@teste.com',
      providerId: 'prov_100',
      amountInCents: 11000,
      platformFeeInCents: 1000,
      providerAmountInCents: 10000,
      method: 'PIX',
      description: 'Aula Prática Cat B',
    };

    const res = await fakeGateway.createPayment(req);

    expect(res.externalPaymentId).toContain('fake_pay_');
    expect(res.gateway).toBe('DEVELOPMENT_MOCK');
    expect(res.status).toBe('PENDING');
    expect(res.pixQrCode).toContain('FAKE_PIX_SIMULATED_PAYMENT_ENV_DEVELOPMENT_');
    expect(res.amountInCents).toBe(11000);
  });

  it('supports deterministic approved, declined, and idempotency scenarios', async () => {
    const approvedReq: CreatePaymentGatewayRequest = {
      idempotencyKey: 'fake-approved-key-1',
      bookingId: 'book_101',
      studentId: 'stud_101',
      studentName: 'Aluno Teste 2',
      studentEmail: 'aluno2@teste.com',
      providerId: 'prov_100',
      amountInCents: 11000,
      platformFeeInCents: 1000,
      providerAmountInCents: 10000,
      method: 'CREDIT_CARD',
      gatewayToken: 'tok_fake_approved',
      description: 'Aula Prática Cat B',
    };

    const resApproved = await fakeGateway.createPayment(approvedReq);
    expect(resApproved.status).toBe('PAID');

    // Test idempotency - repeated call with same key returns cached result
    const resIdempotent = await fakeGateway.createPayment(approvedReq);
    expect(resIdempotent.externalPaymentId).toBe(resApproved.externalPaymentId);

    const declinedReq: CreatePaymentGatewayRequest = {
      idempotencyKey: 'fake-declined-key-2',
      bookingId: 'book_102',
      studentId: 'stud_102',
      studentName: 'Aluno Teste 3',
      studentEmail: 'aluno3@teste.com',
      providerId: 'prov_100',
      amountInCents: 11000,
      platformFeeInCents: 1000,
      providerAmountInCents: 10000,
      method: 'CREDIT_CARD',
      gatewayToken: 'tok_fake_declined',
      description: 'Aula Prática Cat B',
    };

    const resDeclined = await fakeGateway.createPayment(declinedReq);
    expect(resDeclined.status).toBe('FAILED');
  });

  it('supports simulated webhook status changes and refund simulation', async () => {
    const req: CreatePaymentGatewayRequest = {
      idempotencyKey: 'key_sim_1',
      bookingId: 'book_103',
      studentId: 'stud_103',
      studentName: 'Aluno Teste 4',
      studentEmail: 'aluno4@teste.com',
      providerId: 'prov_100',
      amountInCents: 10000,
      platformFeeInCents: 1000,
      providerAmountInCents: 9000,
      method: 'PIX',
      description: 'Aula Prática',
    };

    const created = await fakeGateway.createPayment(req);
    expect(created.status).toBe('PENDING');

    // Simulate status change to PAID
    fakeGateway.simulatePaymentStatusChange(created.externalPaymentId, 'PAID');
    const details = await fakeGateway.getPayment(created.externalPaymentId);
    expect(details.status).toBe('PAID');
    expect(details.paidAt).toBeDefined();

    // Test Refund
    const refundRes = await fakeGateway.refundPayment({
      externalPaymentId: created.externalPaymentId,
      amountInCents: 10000,
      reason: 'Cancelamento dentro do prazo',
      idempotencyKey: 'ref_key_1',
    });

    expect(refundRes.status).toBe('PROCESSED');
    expect(refundRes.externalRefundId).toContain('fake_ref_');
  });

  it('PaymentGatewayFactory resolves FakePaymentGateway by default', () => {
    const gateway = PaymentGatewayFactory.createGateway();
    expect(gateway.gatewayType).toBe('DEVELOPMENT_MOCK');
  });
});
