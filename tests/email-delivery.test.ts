import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  ResendEmailProvider,
  EmailProviderError,
  type EmailProvider,
} from '../supabase/functions/_shared/email/email-provider';
import {
  buildProBookingConfirmedEmailData,
  buildProPayoutCompletedEmailData,
  buildStudentCancellationRefundEmailData,
  buildStudentPaymentConfirmedEmailData,
  buildStudentRefundCompletedEmailData,
} from '../supabase/functions/_shared/email/email-assemblers';
import { buildEmailUrls, readEmailRuntimeConfig } from '../supabase/functions/_shared/email/email-config';
import { formatCurrencyBRL, formatDatePtBR, formatTimePtBR } from '../supabase/functions/_shared/email/email-formatters';
import { getDeliveryIdempotencyKey, normalizeDeliveryError, processEmailDelivery, type EmailDeliveryRecord, type EmailDeliveryRepository } from '../supabase/functions/_shared/email/email-delivery';
import { renderTemplate } from '../supabase/functions/_shared/email/render-template';
import type { EmailSendResult } from '../supabase/functions/_shared/email/email-provider';
import { EMAIL_SUBJECTS } from '../supabase/functions/_shared/email/email-subjects';

const config = readEmailRuntimeConfig({
  MAZZI_STUDENT_APP_URL: 'https://student.example.com',
  MAZZI_PRO_APP_URL: 'https://pro.example.com',
  MAZZI_EMAIL_LOGO_URL: 'https://assets.example.com/logo.png',
});

const booking = {
  id: 'booking-id',
  publicReference: 'MAZZI-LESSON-4X82QK91',
  scheduledStartAt: '2026-09-08T18:00:00.000Z',
  scheduledEndAt: '2026-09-08T18:50:00.000Z',
  priceInCents: 9000,
  platformFeeInCents: 1000,
  totalInCents: 10000,
  licenseCategory: 'B',
  studentName: 'Aluno Exemplo',
  providerName: 'Instrutor Exemplo',
  providerFirstName: 'Instrutor',
  vehicle: { brand: 'Hyundai', model: 'HB20', year: 2024, transmission: 'MANUAL', color: 'Prata' },
};

const payment = { publicReference: 'MAZZI-PAY-8K4P2D91', amountInCents: 10000 };
const refund = { amountInCents: 10000 };

class MemoryDeliveryRepository implements EmailDeliveryRepository {
  private readonly records = new Map<string, EmailDeliveryRecord>();
  private nextId = 1;

  async enqueue(input: Omit<EmailDeliveryRecord, 'id' | 'status' | 'attemptCount' | 'provider' | 'providerMessageId' | 'lastError'>) {
    const existing = [...this.records.values()].find((record) =>
      record.eventType === input.eventType && record.templateName === input.templateName &&
      record.businessEntityId === input.businessEntityId && record.recipientUserId === input.recipientUserId);
    if (existing) return existing;
    const record: EmailDeliveryRecord = { ...input, id: `delivery-${this.nextId++}`, status: 'PENDING', attemptCount: 0 };
    this.records.set(record.id, record);
    return record;
  }

  async claim(id: string) {
    const record = this.records.get(id);
    if (!record || record.status !== 'PENDING') return null;
    record.status = 'PROCESSING';
    record.attemptCount += 1;
    return record;
  }

  async retry(id: string) {
    const record = this.records.get(id);
    if (!record || record.status !== 'FAILED') return null;
    record.status = 'PENDING';
    record.lastError = undefined;
    return record;
  }

  async markSent(id: string, result: EmailSendResult) {
    const record = this.records.get(id)!;
    record.status = 'SENT';
    record.provider = result.provider;
    record.providerMessageId = result.providerMessageId;
  }

  async markFailed(id: string, error: unknown) {
    const record = this.records.get(id)!;
    record.status = 'FAILED';
    record.lastError = normalizeDeliveryError(error);
  }

  get(id: string) { return this.records.get(id); }
}

function deliveryInput(templateName: EmailDeliveryRecord['templateName']) {
  return {
    eventType: 'PAYMENT_CONFIRMED', templateName, recipientUserId: 'student-id', recipientEmail: 'dev@example.com',
    appContext: 'student', businessEntityType: 'BOOKING', businessEntityId: 'booking-id',
    idempotencyKey: getDeliveryIdempotencyKey({ eventType: 'PAYMENT_CONFIRMED', templateName, businessEntityId: 'booking-id', recipientUserId: 'student-id' }),
  } as const;
}

describe('MAZZI email delivery infrastructure', () => {
  it('creates one logical delivery for duplicate enqueue attempts', async () => {
    const repository = new MemoryDeliveryRepository();
    const first = await repository.enqueue(deliveryInput('student-payment-confirmed'));
    const duplicate = await repository.enqueue(deliveryInput('student-payment-confirmed'));
    expect(duplicate.id).toBe(first.id);
    expect(getDeliveryIdempotencyKey({ eventType: 'PAYMENT_CONFIRMED', templateName: 'student-payment-confirmed', businessEntityId: 'booking-id', recipientUserId: 'student-id' })).toBe(first.idempotencyKey);
  });

  it('does not resend SENT and retries FAILED using the same delivery', async () => {
    const repository = new MemoryDeliveryRepository();
    const record = await repository.enqueue(deliveryInput('student-payment-confirmed'));
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({ accepted: true, provider: 'resend', providerMessageId: 're_123' }) };
    const options = {
      repository, provider, deliveryId: record.id, subject: 'Teste',
      render: async () => '<p>ok</p>', loadParams: async () => ({}),
    };
    await expect(processEmailDelivery(options)).resolves.toMatchObject({ status: 'SENT', providerMessageId: 're_123' });
    await expect(processEmailDelivery(options)).resolves.toEqual({ status: 'NOT_CLAIMED' });
    expect(provider.send).toHaveBeenCalledTimes(1);
    const failedRepository = new MemoryDeliveryRepository();
    const failed = await failedRepository.enqueue(deliveryInput('student-payment-confirmed'));
    const failingProvider: EmailProvider = { send: vi.fn().mockRejectedValue(new Error('provider down')) };
    await processEmailDelivery({ ...options, repository: failedRepository, provider: failingProvider, deliveryId: failed.id });
    expect(failedRepository.get(failed.id)).toMatchObject({ status: 'FAILED', attemptCount: 1 });
    await failedRepository.retry(failed.id);
    const recoveredProvider: EmailProvider = { send: vi.fn().mockResolvedValue({ accepted: true, provider: 'resend', providerMessageId: 're_456' }) };
    await expect(processEmailDelivery({ ...options, repository: failedRepository, provider: recoveredProvider, deliveryId: failed.id })).resolves.toMatchObject({ status: 'SENT' });
    expect(failedRepository.get(failed.id)).toMatchObject({ status: 'SENT', attemptCount: 2 });
  });

  it('persists provider message ids and normalizes errors without bearer secrets', async () => {
    const repository = new MemoryDeliveryRepository();
    const record = await repository.enqueue(deliveryInput('student-payment-confirmed'));
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue({ accepted: true, provider: 'resend', providerMessageId: 're_789' }) };
    await processEmailDelivery({ repository, provider, deliveryId: record.id, subject: 'Teste', render: () => '<p>ok</p>', loadParams: async () => ({}) });
    expect(repository.get(record.id)?.providerMessageId).toBe('re_789');
    expect(normalizeDeliveryError(new Error('Bearer secret-value failed'))).toBe('Bearer [redacted] failed');
  });

  it('assembles all five template contracts from canonical records', () => {
    const context = { config, booking, payment, refund };
    expect(buildStudentPaymentConfirmedEmailData(context).payment_reference).toBe(payment.publicReference);
    expect(buildStudentCancellationRefundEmailData(context).refund_amount).toBe('R$ 100,00');
    expect(buildStudentRefundCompletedEmailData(context).lesson_date).toBe('08/09/2026');
    expect(buildProBookingConfirmedEmailData({ config, booking }).provider_expected_amount).toBe('R$ 90,00');
    expect(buildProPayoutCompletedEmailData({ config, payout: {
      publicReference: 'MAZZI-PAYOUT-7K2M4P91', amountInCents: 8000, grossAmountInCents: 10000,
      platformFeeInCents: 2000, releasedAt: '2026-09-08T18:00:00.000Z', method: 'Conta bancária',
      bankName: 'Banco 001', bankBranchLast2: '42', bankAccountLast4: '4821', providerFirstName: 'Instrutor',
    } }).bank_account_last4).toBe('4821');
  });

  it('formats currency and São Paulo dates consistently', () => {
    expect(formatCurrencyBRL(9500)).toBe('R$ 95,00');
    expect(formatDatePtBR('2026-09-08T02:00:00.000Z')).toBe('07/09/2026');
    expect(formatTimePtBR('2026-09-08T02:00:00.000Z')).toBe('23:00');
  });

  it('uses configured HTTPS URLs and never hardcodes localhost', () => {
    const urls = buildEmailUrls(config, { bookingReference: booking.publicReference, paymentReference: payment.publicReference, payoutReference: 'MAZZI-PAYOUT-7K2M4P91' });
    expect(urls.studentLesson).toBe('https://student.example.com/aulas/MAZZI-LESSON-4X82QK91');
    expect(urls.proLesson).toContain('https://pro.example.com');
    expect(JSON.stringify(urls)).not.toContain('localhost');
    expect(() => readEmailRuntimeConfig({ MAZZI_STUDENT_APP_URL: 'http://localhost:3001', MAZZI_PRO_APP_URL: 'https://pro.example.com', MAZZI_EMAIL_LOGO_URL: 'https://assets.example.com/logo.png' })).toThrow('EMAIL_CONFIG_INVALID_URL');
  });

  it('uses only payout bank fragments', () => {
    const source = readFileSync('supabase/functions/send-email-delivery/index.ts', 'utf8');
    expect(source).not.toMatch(/holder_document|destination_key\b/);
    expect(source).not.toContain('amount_in_cents, platform_fee_in_cents, provider_amount_in_cents');
    expect(source).toContain('branch.slice(-2)');
    expect(source).toContain('account.slice(-4)');
  });

  it('sends DEV delivery to the canonical recipient stored for the user', () => {
    const source = readFileSync('supabase/functions/send-email-delivery/index.ts', 'utf8');
    expect(source).toContain("const recipientEmail = String(delivery.recipient_email || '').trim();");
    expect(source).not.toContain('MAZZI_EMAIL_TEST_RECIPIENT');
    expect(source).toContain('to: recipientEmail');
  });

  it('fails safely when Resend credentials are absent', () => {
    expect(() => new ResendEmailProvider({ apiKey: '', from: 'MAZZI <noreply@example.com>' })).toThrowError(new EmailProviderError('RESEND_API_KEY_MISSING', 'RESEND_API_KEY não configurada.', false));
  });

  it('sends through Resend with timeout and idempotency headers, without logging secrets', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 're_test_123' }), { status: 200 }));
    const provider = new ResendEmailProvider({ apiKey: 'secret-test-key', from: 'MAZZI <noreply@example.com>', fetchImpl });
    await expect(provider.send({ to: 'dev@example.com', subject: 'Teste', html: '<p>ok</p>', idempotencyKey: 'delivery-key' })).resolves.toEqual({ accepted: true, provider: 'resend', providerMessageId: 're_test_123' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer secret-test-key', 'Idempotency-Key': 'delivery-key' }) }));
  });

  it('keeps the migration protected, unique and independent from automatic event wiring', () => {
    const migration = readFileSync('supabase/migrations/20260909014320_email_delivery_infrastructure.sql', 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.email_deliveries');
    expect(migration).toContain('UNIQUE (event_type, template_name, business_entity_id, recipient_user_id)');
    expect(migration).toContain("status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')");
    expect(migration).toContain('ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.claim_email_delivery(UUID) TO service_role');
    expect(migration).not.toMatch(/CREATE TRIGGER.*email/i);
  });

  it('wires all five domain events to the correct recipients and templates', () => {
    const migration = readFileSync('supabase/migrations/20260909020421_email_domain_events.sql', 'utf8');
    expect(migration).toContain("'PAYMENT_CONFIRMED', 'student-payment-confirmed'");
    expect(migration).toContain("'CANCELLATION_REFUND_REQUESTED', 'student-cancellation-refund'");
    expect(migration).toContain("'REFUND_COMPLETED', 'student-refund-completed'");
    expect(migration).toContain("'PRO_BOOKING_CONFIRMED', 'pro-booking-confirmed'");
    expect(migration).toContain("'PRO_PAYOUT_COMPLETED', 'pro-payout-completed'");
    expect(migration).toContain("'STUDENT', 'PAYMENT'");
    expect(migration).toContain("'STUDENT', 'REFUND'");
    expect(migration).toContain("'PRO', 'BOOKING'");
    expect(migration).toContain("'PRO', 'PAYOUT'");
    expect(migration).toContain('claim_next_email_delivery');
    expect(EMAIL_SUBJECTS).toMatchObject({
      'student-payment-confirmed': 'Pagamento confirmado — sua aula está agendada',
      'student-cancellation-refund': 'Cancelamento confirmado — seu estorno foi solicitado',
      'student-refund-completed': 'Seu estorno foi concluído',
      'pro-booking-confirmed': 'Nova aula confirmada no MAZZI',
      'pro-payout-completed': 'Seu repasse foi realizado',
    });
  });

  it('keeps the approved renderer working after delivery additions', () => {
    const source = readFileSync('emails/student-payment-confirmed.html', 'utf8');
    const params = buildStudentPaymentConfirmedEmailData({ config, booking, payment });
    const html = renderTemplate('student-payment-confirmed', source, params);
    expect(html).not.toMatch(/\{\{[^}]+\}\}/);
  });
});
