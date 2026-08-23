import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mapFriendlyErrorMessage } from '../src/lib/error-mapper';

const migration = readFileSync('supabase/migrations/20260823011635_task_080_emergency_schedule_block.sql', 'utf8');

describe('TASK-080 emergency schedule block contract', () => {
  it('exposes only the authenticated instructor emergency RPC', () => {
    expect(migration).toContain('create_instructor_emergency_block_if_free');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain("ur.role = 'INSTRUCTOR'");
    expect(migration).toContain("u.status = 'ACTIVE'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.create_instructor_emergency_block_if_free");
    expect(migration).toContain('TO authenticated');
    expect(migration).not.toContain('service_role');
  });

  it('uses the same instructor advisory lock for block and booking paths', () => {
    const lock = "hashtextextended('instructor-schedule:'";
    expect(migration.split(lock).length - 1).toBe(2);
    expect(migration).toContain('SLOT_NO_LONGER_AVAILABLE');
    expect(migration).toContain('EMERGENCY_BLOCK_BOOKING_CONFLICT');
  });

  it('treats active holds and live bookings as conflicts while allowing expired holds', () => {
    expect(migration).toContain("b.status IN ('CONFIRMED', 'IN_PROGRESS')");
    expect(migration).toContain("b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > v_now)");
    expect(migration).toContain('b.scheduled_start_at < p_end_at');
    expect(migration).toContain('p_start_at < b.scheduled_end_at');
  });

  it('maps emergency errors to friendly UI messages', () => {
    expect(mapFriendlyErrorMessage({ message: 'EMERGENCY_BLOCK_BOOKING_CONFLICT' }, 'fallback')).toContain('aula ou reserva ativa');
    expect(mapFriendlyErrorMessage({ message: 'EMERGENCY_BLOCK_IN_PAST' }, 'fallback')).toContain('horário futuro');
  });
});
