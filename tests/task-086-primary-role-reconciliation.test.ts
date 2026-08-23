import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260823182840_task_086_reconcile_primary_user_roles.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

describe('TASK-086 — primary role reconciliation', () => {
  it('backfills only the primary role and remains idempotent', () => {
    expect(migration).toContain('select u.id, u.role, null');
    expect(migration).toContain('where u.role is not null');
    expect(migration).toContain('ur.user_id = u.id');
    expect(migration).toContain('ur.role = u.role');
    expect(migration).toContain('on conflict (user_id, role) do nothing');
    expect(migration).not.toContain('delete from public.user_roles');
    expect(migration).not.toContain('user_metadata');
    expect(migration).not.toContain('raw_user_meta_data');
  });

  it('preserves multirole and installs a defensive primary-role trigger', () => {
    expect(migration).toContain('create or replace function public.sync_primary_user_role()');
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path to public, pg_temp');
    expect(migration).toContain('after insert or update of role on public.users');
    expect(migration).toContain('create trigger trg_sync_primary_user_role');
    expect(migration).toContain('values (new.id, new.role, null)');
    expect(migration).toContain('revoke all on function public.sync_primary_user_role() from public');
    expect(migration).toContain('revoke all on function public.sync_primary_user_role() from anon');
    expect(migration).toContain('revoke all on function public.sync_primary_user_role() from authenticated');
    expect(migration).not.toContain('role <>');
    expect(migration).not.toContain('delete');
  });
});
