import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260823192805_task_088_protect_global_block_history.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

describe('TASK-088 — global block history protection', () => {
  it('protects DELETE using ownership, row locking, start_at, and the canonical schedule lock', () => {
    expect(migration).toContain('delete_instructor_global_block(p_block_id uuid)');
    expect(migration).toContain('instructor_id = v_uid');
    expect(migration).toContain('for update');
    expect(migration).toContain('v_block.start_at <= now()');
    expect(migration).toContain('global_block_already_started');
    expect(migration).toContain("'instructor-schedule:' || v_uid::text");
    expect(migration).toContain('pg_advisory_xact_lock');
  });

  it('protects UPDATE based on the existing row, not the proposed new start', () => {
    expect(migration).toContain('save_instructor_global_block');
    expect(migration).toContain('v_existing.start_at <= v_now');
    expect(migration).toContain('select * into v_existing');
    expect(migration).toContain('update public.instructor_global_blocks');
    expect(migration).toContain('if p_block_id is not null');
    expect(migration).not.toContain('end_at > now()');
  });

  it('preserves secure RPC posture and does not add soft-delete fields', () => {
    expect(migration.match(/security definer/g)?.length).toBe(2);
    expect(migration.match(/set search_path to public, pg_temp/g)?.length).toBe(2);
    expect(migration).toContain('grant execute on function public.delete_instructor_global_block(uuid) to authenticated');
    expect(migration).toContain('grant execute on function public.save_instructor_global_block(timestamptz, timestamptz, text, uuid) to authenticated');
    expect(migration).toContain('revoke all on function public.delete_instructor_global_block(uuid) from public, anon');
    expect(migration).toContain('revoke all on function public.save_instructor_global_block(timestamptz, timestamptz, text, uuid) from public, anon');
    expect(migration).not.toContain('deleted_at');
  });
});
