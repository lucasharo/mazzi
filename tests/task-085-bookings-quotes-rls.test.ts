import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260823181550_task_085_canonicalize_bookings_quotes_rls.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

describe('TASK-085 — canonical bookings and quotes RLS', () => {
  it('removes the legacy policies and application-role JWT authority', () => {
    expect(migration).toContain('drop policy if exists "parties can read own bookings"');
    expect(migration).toContain('drop policy if exists bookings_provider_select');
    expect(migration).toContain('drop policy if exists bookings_student_select');
    expect(migration).toContain('drop policy if exists quotes_provider_select');
    expect(migration).toContain('drop policy if exists quotes_student_select');
    expect(migration).toContain('drop policy if exists quotes_student_insert');
    expect(migration).not.toContain('auth.jwt()');
  });

  it('consolidates authenticated SELECT access through canonical helpers', () => {
    expect(migration).toContain('create policy bookings_authenticated_select');
    expect(migration).toContain('create policy quotes_authenticated_select');
    expect(migration).toContain('for select');
    expect(migration).toContain('to authenticated');
    expect(migration).toContain('(select auth.uid())');
    expect(migration).toContain('(select public.is_platform_admin())');
    expect(migration).toContain('(select public.is_current_user_active())');
    expect(migration).toContain('p.user_id = (select auth.uid())');
  });

  it('closes direct anonymous booking reads and quote inserts', () => {
    expect(migration).toContain('revoke select on table public.bookings from anon');
    expect(migration).toContain('revoke insert on table public.quotes from authenticated');
    expect(migration).toContain('alter table public.bookings enable row level security');
    expect(migration).toContain('alter table public.quotes enable row level security');
    expect(migration).not.toContain('create policy quotes_student_insert');
  });
});
