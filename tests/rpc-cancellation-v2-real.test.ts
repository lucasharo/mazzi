import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bhvpkgonhlujmxvwnxix.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const dbUrl = process.env.DATABASE_URL || '';

describe('Real Supabase RPC cancel_booking_v2 Final Security & Order Tests', () => {
  let pgClient: PgClient;

  beforeAll(async () => {
    if (dbUrl) {
      pgClient = new PgClient({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await pgClient.connect();

      // SECURITY GUARD: DDL (migrations) must NEVER run automatically during npm test.
      // This block is intentionally disabled unless MAZZI_LIVE_DDL_TESTS=true is explicitly set.
      // Source of schema drift identified in TASK-008 HOTFIX audit.
      if (process.env.MAZZI_LIVE_DDL_TESTS === 'true') {
        // Apply Migration 37 via official PostgreSQL client
        const migration37Path = path.resolve(process.cwd(), 'supabase/migrations/20260818000037_fix_cancellation_authorization_order.sql');
        const sql37 = fs.readFileSync(migration37Path, 'utf8');
        await pgClient.query(sql37);

        // Reconcile schema_migrations ledger
        await pgClient.query(`
          INSERT INTO supabase_migrations.schema_migrations (version, name)
          VALUES ('20260818000037', 'fix_cancellation_authorization_order')
          ON CONFLICT (version) DO NOTHING;
        `);
      }
    }
  });

  afterAll(async () => {
    if (pgClient) {
      await pgClient.end();
    }
  });

  it('A10-1. pg_proc catalog contains exactly 1 instance of cancel_booking_v2(uuid, text, text)', async () => {
    if (!pgClient) return;

    const res = await pgClient.query(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'cancel_booking_v2';
    `);

    expect(res.rows.length).toBe(1);
    expect(res.rows[0].args).toBe('p_booking_id uuid, p_reason text, p_reason_code text');
  });

  it('A10-2. Old 4-argument signature with boolean is absent from pg_proc catalog', async () => {
    if (!pgClient) return;

    const res = await pgClient.query(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' 
        AND p.proname = 'cancel_booking_v2'
        AND pg_get_function_identity_arguments(p.oid) LIKE '%boolean%';
    `);

    expect(res.rows.length).toBe(0);
  });

  it('A14. Migration ledger contains versions 34, 35, 36, 37 in order', async () => {
    if (!pgClient) return;

    const res = await pgClient.query(`
      SELECT version FROM supabase_migrations.schema_migrations
      WHERE version IN ('20260818000034', '20260818000035', '20260818000036', '20260818000037')
      ORDER BY version ASC;
    `);

    expect(res.rows.length).toBe(4);
    expect(res.rows.map(r => r.version)).toEqual(['20260818000034', '20260818000035', '20260818000036', '20260818000037']);
  });

  it('Real Supabase RPC cancel_booking_v2: Authorization BEFORE Idempotency (No Leaks) & Security Scenarios', async () => {
    const student1Pass = (process.env.VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD || '').replace(/^"|"$/g, '').trim();
    const instructorPass = (process.env.VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD || '').replace(/^"|"$/g, '').trim();

    if (!student1Pass || !instructorPass) {
      console.warn('Skipping remote RPC execution due to missing local passwords.');
      return;
    }

    // Authenticate Student 1 (Owner)
    const student1Client = createClient(supabaseUrl, supabaseAnonKey);
    const { data: authStudent1 } = await student1Client.auth.signInWithPassword({
      email: 'aluno01@mazzi.com.br',
      password: student1Pass,
    });
    const student1Id = authStudent1!.user!.id;

    // Authenticate Student 2 (Cross-user / Attacker)
    const student2Client = createClient(supabaseUrl, supabaseAnonKey);

    const { data: authStudent2 } = await student2Client.auth.signInWithPassword({
      email: 'aluno02@mazzi.com.br',
      password: student1Pass,
    });

    const testCancelledId = '00000000-0000-4000-a000-00000000c007';
    const testPastId = '00000000-0000-4000-a000-00000000c008';

    if (pgClient) {
      await pgClient.query('DELETE FROM public.audit_logs WHERE entity_id IN ($1, $2)', [testCancelledId, testPastId]);
      await pgClient.query('DELETE FROM public.bookings WHERE id IN ($1, $2)', [testCancelledId, testPastId]);

      const provId = (await pgClient.query('SELECT id FROM public.providers LIMIT 1')).rows[0]?.id;
      const offId = (await pgClient.query('SELECT id FROM public.service_offerings LIMIT 1')).rows[0]?.id;
      const vehId = (await pgClient.query('SELECT id FROM public.vehicles LIMIT 1')).rows[0]?.id;
      const instId = (await pgClient.query("SELECT id FROM public.users WHERE role = 'INSTRUCTOR' LIMIT 1")).rows[0]?.id;

      // 1. Insert CANCELLED booking owned by Student 1
      await pgClient.query(`
        INSERT INTO public.bookings (
          id, student_id, provider_id, instructor_id, offering_id, vehicle_id,
          scheduled_start_at, scheduled_end_at,
          status, price_in_cents, platform_fee_in_cents, total_in_cents, refund_amount_in_cents, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          NOW() + INTERVAL '48 hours', NOW() + INTERVAL '48 hours 50 minutes',
          'CANCELLED_BY_STUDENT', 10000, 1000, 11000, 11000, NOW(), NOW()
        )
      `, [testCancelledId, student1Id, provId, instId, offId, vehId]);

      // 2. Insert PAST booking owned by Student 1
      await pgClient.query(`
        INSERT INTO public.bookings (
          id, student_id, provider_id, instructor_id, offering_id, vehicle_id,
          scheduled_start_at, scheduled_end_at,
          status, price_in_cents, platform_fee_in_cents, total_in_cents, refund_amount_in_cents, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 10 minutes',
          'CONFIRMED', 10000, 1000, 11000, 0, NOW(), NOW()
        )
      `, [testPastId, student1Id, provId, instId, offId, vehId]);
    }

    try {
      // CENÁRIO 1: Student B (Student 2) tenta cancelar booking CANCELADO de Student A (Student 1)
      const { data: resS2, error: errS2 } = await student2Client.rpc('cancel_booking_v2', {
        p_booking_id: testCancelledId,
      });

      // MUST BE REJECTED WITH UNAUTHORIZED (NO IDEMPOTENCY / STATE LEAK!)
      expect(resS2).toBeNull();
      expect(errS2).not.toBeNull();
      expect(errS2?.message).toMatch(/pertence a outro aluno/i);

      // CENÁRIO 2: Student B (Student 2) tenta cancelar booking PASSADO de Student A (Student 1)
      const { data: resPastS2, error: errPastS2 } = await student2Client.rpc('cancel_booking_v2', {
        p_booking_id: testPastId,
      });

      // MUST BE REJECTED WITH UNAUTHORIZED (NOT CANCELLATION_WINDOW_CLOSED!)
      expect(resPastS2).toBeNull();
      expect(errPastS2).not.toBeNull();
      expect(errPastS2?.message).toMatch(/pertence a outro aluno/i);

      // CENÁRIO 3: Authorized Student A (Owner) chama booking que ele próprio já cancelou
      const { data: resS1, error: errS1 } = await student1Client.rpc('cancel_booking_v2', {
        p_booking_id: testCancelledId,
      });

      expect(errS1).toBeNull();
      expect(resS1.success).toBe(true);
      expect(resS1.is_idempotent).toBe(true);
      expect(resS1.status).toBe('CANCELLED_BY_STUDENT');

    } finally {
      if (pgClient) {
        await pgClient.query('DELETE FROM public.audit_logs WHERE entity_id IN ($1, $2)', [testCancelledId, testPastId]);
        await pgClient.query('DELETE FROM public.bookings WHERE id IN ($1, $2)', [testCancelledId, testPastId]);
      }
      await student1Client.auth.signOut({ scope: 'local' });
      await student2Client.auth.signOut({ scope: 'local' });
    }
  });
});
