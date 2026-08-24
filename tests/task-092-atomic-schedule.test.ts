import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/20260824021413_task_092_atomic_schedule_mutations.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');
const dbService = fs.readFileSync(path.join(root, 'src/lib/db-service.ts'), 'utf8');
const errorMapper = fs.readFileSync(path.join(root, 'src/lib/error-mapper.ts'), 'utf8');

describe('TASK-092 atomic schedule mutations', () => {
  it('reconciles TASK-091 filename without changing its SQL content', () => {
    expect(fs.existsSync(path.join(root, 'supabase/migrations/20260824010806_task_091_exception_active_and_override_parity.sql'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/20260824020000_task_091_exception_active_and_override_parity.sql'))).toBe(false);
  });

  it('uses the canonical provider lock in every schedule mutation and booking path', () => {
    const lock = "hashtextextended('provider-schedule:' ||";
    expect(migration.split(lock).length - 1).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("'instructor-schedule:' || NEW.instructor_id::TEXT");
    expect(migration).toContain("PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_quote.provider_id::TEXT, 0));");
  });

  it('revalidates stale quotes immediately before creating a booking', () => {
    expect(migration).toContain('public.is_offering_slot_available(v_quote.offering_id,v_quote.scheduled_start_at)');
    expect(migration).toContain("RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE'");
    expect(migration).toContain("UPDATE public.quotes SET status='CONSUMED'");
  });

  it('centralizes exception mutations in protected RPCs and revokes direct authenticated writes', () => {
    expect(migration).toContain('provider_save_availability_exception');
    expect(migration).toContain('provider_set_availability_exception_active');
    expect(migration).toContain('provider_delete_availability_exception');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.availability_exceptions FROM authenticated');
    expect(dbService).not.toMatch(/from\(['"]availability_exceptions['"]\)\.(insert|update|delete)/);
    expect(dbService).toContain("rpc('provider_save_availability_exception'");
  });

  it('protects active blocks and booking ingress with scoped interval overlap checks', () => {
    expect(migration).toContain('AVAILABILITY_BLOCK_BOOKING_CONFLICT');
    expect(migration).toContain("e.type='BLOCK' AND e.is_active IS TRUE");
    expect(migration).toContain('NEW.scheduled_start_at < e.end_at AND e.start_at < NEW.scheduled_end_at');
    expect(migration).toContain("b.status IN ('CONFIRMED','IN_PROGRESS')");
    expect(migration).toContain("b.status = 'PENDING_PAYMENT'");
    expect(migration).toContain("hold_expires_at IS NULL OR b.hold_expires_at > NOW()");
  });

  it('maps concurrency errors to user-safe messages', () => {
    expect(errorMapper).toContain('AVAILABILITY_BLOCK_BOOKING_CONFLICT');
    expect(errorMapper).toContain('SLOT_NO_LONGER_AVAILABLE');
  });
});
