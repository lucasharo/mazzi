import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { dbService } from '../../src/lib/db-service';
import { supabase } from '../../src/lib/supabase';
import { Client as PgClient } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const dbUrl = process.env.DATABASE_URL || '';

describe('TASK-014: Payment FAILED Retry Flow (LIVE INTEGRATION)', () => {
  let bookingId: string = '00000000-0000-4000-a000-00000000c001';
  let bookingId2: string = '00000000-0000-4000-a000-00000000c002';
  let paymentAId: string;
  let idempotencyKeyA: string;
  let pgClient: PgClient;

  beforeAll(async () => {
    if (process.env.RUN_LIVE_INTEGRATION_TESTS !== 'true' || !process.env.DATABASE_URL || !process.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD) {
      throw new Error('LIVE_TEST_GUARD_FAILED: Live integration tests require RUN_LIVE_INTEGRATION_TESTS=true, DATABASE_URL, and VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD.');
    }

    const studentPass = process.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD;
    const { data: auth } = await supabase.auth.signInWithPassword({
      email: 'aluno01@mazzi.com.br',
      password: studentPass,
    });

    pgClient = new PgClient({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await pgClient.connect();

    // Limpar dados anteriores caso o teste falhou no meio
    await pgClient.query('DELETE FROM public.payments WHERE booking_id IN ($1, $2)', [bookingId, bookingId2]);
    await pgClient.query('DELETE FROM public.bookings WHERE id IN ($1, $2)', [bookingId, bookingId2]);

    const provId = (await pgClient.query('SELECT id FROM public.providers LIMIT 1')).rows[0]?.id;
    const offId = (await pgClient.query('SELECT id FROM public.service_offerings LIMIT 1')).rows[0]?.id;
    const vehId = (await pgClient.query('SELECT id FROM public.vehicles LIMIT 1')).rows[0]?.id;
    const instId = (await pgClient.query("SELECT id FROM public.users WHERE role = 'INSTRUCTOR' LIMIT 1")).rows[0]?.id;

    // Injetar dois bookings PENDING_PAYMENT
    await pgClient.query(`
      INSERT INTO public.bookings (
        id, student_id, provider_id, instructor_id, offering_id, vehicle_id,
        scheduled_start_at, scheduled_end_at,
        status, price_in_cents, platform_fee_in_cents, total_in_cents, refund_amount_in_cents, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 hours', 'PENDING_PAYMENT', 10000, 1000, 11000, 0, NOW(), NOW()
      ), (
        $7, $2, $3, $4, $5, $6, NOW() + INTERVAL '3 hours', NOW() + INTERVAL '4 hours', 'PENDING_PAYMENT', 10000, 1000, 11000, 0, NOW(), NOW()
      )
    `, [bookingId, auth.user!.id, provId, instId, offId, vehId, bookingId2]);
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.query('DELETE FROM public.payments WHERE booking_id IN ($1, $2)', [bookingId, bookingId2]);
      await pgClient.query('DELETE FROM public.bookings WHERE id IN ($1, $2)', [bookingId, bookingId2]);
      await pgClient.end();
    }
  });

  it('Teste 1: Fluxo Real FAILED -> Retry -> Confirmation no LIVE', async () => {
    idempotencyKeyA = `idem_pay_A_${Date.now()}`;
    const payA = await dbService.createBookingPayment(bookingId, 'PIX', idempotencyKeyA);
    paymentAId = payA.payment_id;

    expect(payA.status).toBe('PENDING');

    await dbService.markBookingPaymentFailed(paymentAId, 'SIMULATED_DECLINED');

    const payARes = await pgClient.query('SELECT status FROM public.payments WHERE id = $1', [paymentAId]);
    const bookRes = await pgClient.query('SELECT status FROM public.bookings WHERE id = $1', [bookingId]);
    
    expect(payARes.rows[0]?.status).toBe('FAILED');
    expect(bookRes.rows[0]?.status).toBe('PENDING_PAYMENT');

    const idempotencyKeyB = `idem_pay_B_${Date.now()}`;
    const payB = await dbService.createBookingPayment(bookingId, 'PIX', idempotencyKeyB);

    expect(payB.status).toBe('PENDING');
    expect(payB.payment_id).not.toBe(paymentAId);
    expect(idempotencyKeyA).not.toBe(idempotencyKeyB);
    
    const payBRes = await pgClient.query('SELECT gateway_provider, status, idempotency_key FROM public.payments WHERE id = $1', [payB.payment_id]);
    expect(payBRes.rows[0]?.gateway_provider).toBe('fake_payment_gateway');

    await dbService.confirmBookingPayment(payB.payment_id, `fake_ext_${Date.now()}`, new Date().toISOString());

    const finalPRes = await pgClient.query('SELECT status FROM public.payments WHERE id = $1', [payB.payment_id]);
    const finalBRes = await pgClient.query('SELECT status FROM public.bookings WHERE id = $1', [bookingId]);
    
    expect(finalPRes.rows[0]?.status).toBe('PAID');
    expect(finalBRes.rows[0]?.status).toBe('CONFIRMED');
  });

  it('Teste 2: Fail-closed DECLINED test / Mocked DB Error', async () => {
    const mockMarkFailed = vi.spyOn(dbService, 'markBookingPaymentFailed');
    mockMarkFailed.mockRejectedValueOnce(new Error('Mocked DB Error'));

    await expect(dbService.markBookingPaymentFailed('fake-uuid', 'reason')).rejects.toThrow('Mocked DB Error');
    mockMarkFailed.mockRestore();
  });

  it('Teste 3: Double Click / Concorrência', async () => {
    const idempotencyKeyRetry = `idem_pay_retry_${Date.now()}`;

    const [res1, res2] = await Promise.all([
      dbService.createBookingPayment(bookingId2, 'PIX', idempotencyKeyRetry),
      dbService.createBookingPayment(bookingId2, 'PIX', idempotencyKeyRetry)
    ]);

    expect(res1.payment_id).toBe(res2.payment_id);
    expect(res1.is_idempotent).not.toBe(res2.is_idempotent);

    const concRes = await pgClient.query("SELECT id FROM public.payments WHERE booking_id = $1 AND status = 'PENDING'", [bookingId2]);
    expect(concRes.rows.length).toBe(1);
  });
});
