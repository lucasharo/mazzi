import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260823135907_task_084_harden_global_block_mutations.sql'), 'utf8');

describe('TASK-084 global block mutation hardening', () => {
  it('hardens the legacy save RPC with the canonical instructor lock and conflict matrix', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.save_instructor_global_block');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path TO public, pg_temp');
    expect(migration).toContain("hashtextextended('instructor-schedule:' || v_uid::text, 0)");
    expect(migration).toContain('b.scheduled_start_at < p_end_at');
    expect(migration).toContain('p_start_at < b.scheduled_end_at');
    expect(migration).toContain("b.status IN ('CONFIRMED', 'IN_PROGRESS')");
    expect(migration).toContain("b.status = 'PENDING_PAYMENT'");
    expect(migration).toContain('b.hold_expires_at IS NULL OR b.hold_expires_at > v_now');
    expect(migration).toContain("EMERGENCY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01'");
    expect(migration).toContain('p_block_id IS NULL');
    expect(migration).toContain('b.id = p_block_id AND b.instructor_id = v_uid');
  });

  it('keeps RPC ACLs and closes direct browser table mutations', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.save_instructor_global_block');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.save_instructor_global_block');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.instructor_global_blocks FROM authenticated');
    expect(migration).not.toContain('CREATE POLICY');
  });
});
