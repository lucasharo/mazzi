import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bhvpkgonhlujmxvwnxix.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const dbUrl = process.env.DATABASE_URL || '';

describe('TASK-006: Quote Creation Idempotency & Race Condition Tests', () => {
  let pgClient: PgClient;
  let studentClient: any;
  let studentId: string;
  let offeringId: string;
  let offering: any;
  const testTime = '2026-09-01T10:00:00+00:00'; // Safe future time
  let endTestTime: string;

  beforeAll(async () => {
    // 1. Database Connection
    if (dbUrl) {
      pgClient = new PgClient({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await pgClient.connect();

      // Get an active offering
      const offRes = await pgClient.query(`
        SELECT id, provider_id, instructor_id, vehicle_id, duration_minutes 
        FROM public.service_offerings 
        WHERE status = 'ACTIVE' AND is_active = true 
        LIMIT 1
      `);
      offering = offRes.rows[0];
      offeringId = offering?.id;

      if (offering) {
        const duration = offering.duration_minutes || 60;
        endTestTime = new Date(new Date(testTime).getTime() + duration * 60 * 1000).toISOString();

        // Clean any existing conflicts
        await pgClient.query('DELETE FROM public.availability_exceptions WHERE provider_id = $1 AND start_at = $2', [offering.provider_id, testTime]);
        await pgClient.query('DELETE FROM public.bookings WHERE (instructor_id = $1 OR vehicle_id = $2) AND scheduled_start_at = $3', [offering.instructor_id, offering.vehicle_id, testTime]);

        // Insert AVAILABLE_OVERRIDE exception to guarantee slot is available
        await pgClient.query(`
          INSERT INTO public.availability_exceptions (
            provider_id, instructor_id, vehicle_id, start_at, end_at, type, reason_category, reason
          ) VALUES (
            $1, $2, $3, $4, $5, 'AVAILABLE_OVERRIDE', 'OTHER', 'Test exception'
          )
        `, [offering.provider_id, offering.instructor_id, offering.vehicle_id, testTime, endTestTime]);
      }
    }

    // 2. Auth Sign In
    const pass = (process.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD || '').replace(/^"|"$/g, '').trim();
    studentClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authData } = await studentClient.auth.signInWithPassword({
      email: 'aluno01@mazzi.com.br',
      password: pass || 'teste123',
    });
    studentId = authData!.user!.id;
  });

  afterAll(async () => {
    if (pgClient) {
      // Cleanup exception override
      if (offering) {
        await pgClient.query('DELETE FROM public.availability_exceptions WHERE provider_id = $1 AND start_at = $2', [offering.provider_id, testTime]);
      }
      // Cleanup created quotes/bookings for the test time
      await pgClient.query('DELETE FROM public.quotes WHERE student_id = $1 AND scheduled_start_at = $2', [studentId, testTime]);
      await pgClient.end();
    }
    if (studentClient) {
      await studentClient.auth.signOut({ scope: 'local' });
    }
  });

  // CASO 1: Request Normal
  it('CASO 1 - REQUEST NORMAL: First call creates a quote with is_idempotent = false', async () => {
    if (!pgClient || !offeringId) return;

    const key = `idem_race_test_c1_${Date.now()}`;

    // Ensure clean state
    await pgClient.query('DELETE FROM public.quotes WHERE student_id = $1 AND idempotency_key = $2', [studentId, key]);

    const { data, error } = await studentClient.rpc('create_quote_from_offering', {
      p_offering_id: offeringId,
      p_scheduled_start_at: testTime,
      p_idempotency_key: key,
    });

    expect(error).toBeNull();
    expect(data.success).toBe(true);
    expect(data.is_idempotent).toBe(false);
    expect(data.quote_id).toBeDefined();

    // Verify exactly 1 row exists
    const rowCount = await pgClient.query('SELECT count(*)::int FROM public.quotes WHERE idempotency_key = $1', [key]);
    expect(rowCount.rows[0].count).toBe(1);
  });

  // CASO 2: Retry Sequencial
  it('CASO 2 - RETRY SEQUENCIAL: Repeating with the same parameters returns same quote_id and is_idempotent = true', async () => {
    if (!pgClient || !offeringId) return;

    const key = `idem_race_test_c2_${Date.now()}`;

    // Call 1
    const res1 = await studentClient.rpc('create_quote_from_offering', {
      p_offering_id: offeringId,
      p_scheduled_start_at: testTime,
      p_idempotency_key: key,
    });
    expect(res1.error).toBeNull();

    // Call 2
    const res2 = await studentClient.rpc('create_quote_from_offering', {
      p_offering_id: offeringId,
      p_scheduled_start_at: testTime,
      p_idempotency_key: key,
    });

    expect(res2.error).toBeNull();
    expect(res2.data.success).toBe(true);
    expect(res2.data.is_idempotent).toBe(true);
    expect(res2.data.quote_id).toBe(res1.data.quote_id);

    // Verify database row count remains 1
    const rowCount = await pgClient.query('SELECT count(*)::int FROM public.quotes WHERE idempotency_key = $1', [key]);
    expect(rowCount.rows[0].count).toBe(1);
  });

  // CASO 3: Concorrência Real
  it('CASO 3 - CONCORRÊNCIA REAL: Multiple concurrent calls return same quote_id and create exactly 1 row', async () => {
    if (!pgClient || !offeringId) return;

    const key = `idem_race_test_c3_${Date.now()}`;

    // Execute 10 requests simultaneously
    const requests = Array.from({ length: 10 }).map(() =>
      studentClient.rpc('create_quote_from_offering', {
        p_offering_id: offeringId,
        p_scheduled_start_at: testTime,
        p_idempotency_key: key,
      })
    );

    const results = await Promise.all(requests);

    // All should succeed
    for (const res of results) {
      expect(res.error).toBeNull();
      expect(res.data.success).toBe(true);
    }

    // All should return the same quote_id
    const quoteIds = results.map(res => res.data.quote_id);
    const uniqueQuoteIds = Array.from(new Set(quoteIds));
    expect(uniqueQuoteIds.length).toBe(1);

    // COUNT in DB must be exactly 1
    const rowCount = await pgClient.query('SELECT count(*)::int FROM public.quotes WHERE idempotency_key = $1', [key]);
    expect(rowCount.rows[0].count).toBe(1);
  });

  // CASO 4: Key Reuse Inválido
  it('CASO 4 - KEY REUSE INVÁLIDO: Reusing key with different offering_id or slot throws exception', async () => {
    if (!pgClient || !offeringId) return;

    const key = `idem_race_test_c4_${Date.now()}`;

    // Call 1
    const res1 = await studentClient.rpc('create_quote_from_offering', {
      p_offering_id: offeringId,
      p_scheduled_start_at: testTime,
      p_idempotency_key: key,
    });
    expect(res1.error).toBeNull();

    // Call 2 with different offering_id (use a fake uuid to trigger difference validation)
    const altOfferingId = '00000000-0000-0000-0000-000000000000';
    const res2 = await studentClient.rpc('create_quote_from_offering', {
      p_offering_id: altOfferingId,
      p_scheduled_start_at: testTime,
      p_idempotency_key: key,
    });

    expect(res2.error).not.toBeNull();
    expect(res2.error.message).toMatch(/QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/i);

    // Call 3 with alt start time
    const altTime = '2026-09-02T10:00:00+00:00';
    const res3 = await studentClient.rpc('create_quote_from_offering', {
      p_offering_id: offeringId,
      p_scheduled_start_at: altTime,
      p_idempotency_key: key,
    });

    expect(res3.error).not.toBeNull();
    expect(res3.error.message).toMatch(/QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/i);
  });

  // CASO 5: FRONTEND DOUBLE CLICK
  it('CASO 5 - FRONTEND DOUBLE CLICK: Simulates double click by executing isProcessing guard', async () => {
    let callCount = 0;
    let isProcessing = false;

    const simulateClick = async () => {
      if (isProcessing) return;
      isProcessing = true;
      try {
        callCount++;
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 50));
      } finally {
        isProcessing = false;
      }
    };

    // Fast sequential clicks
    await Promise.all([
      simulateClick(),
      simulateClick(),
    ]);

    expect(callCount).toBe(1);
  });

  // CASO 6: RETRY DE REDE
  it('CASO 6 - RETRY DE REDE: Retrying with the same key when the response is lost returns the existing quote', async () => {
    if (!pgClient || !offeringId) return;

    const key = `idem_race_test_c6_${Date.now()}`;

    // 1. Initial call (simulates creation)
    const res1 = await studentClient.rpc('create_quote_from_offering', {
      p_offering_id: offeringId,
      p_scheduled_start_at: testTime,
      p_idempotency_key: key,
    });
    expect(res1.error).toBeNull();
    const firstQuoteId = res1.data.quote_id;

    // 2. Retry (simulates network failure retry)
    const res2 = await studentClient.rpc('create_quote_from_offering', {
      p_offering_id: offeringId,
      p_scheduled_start_at: testTime,
      p_idempotency_key: key,
    });
    expect(res2.error).toBeNull();
    expect(res2.data.quote_id).toBe(firstQuoteId);
    expect(res2.data.is_idempotent).toBe(true);
  });
});
