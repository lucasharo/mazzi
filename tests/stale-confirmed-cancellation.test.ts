import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260911010711_allow_provider_cancel_stale_confirmed_booking.sql',
);

describe('stale confirmed booking cancellation migration', () => {
  it('allows an unresolved confirmed booking to be cancelled after its scheduled time when it never started', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain("v_booking.lesson_started_at IS NOT NULL");
    expect(migration).toContain("v_user_role <> 'STUDENT'");
    expect(migration).toContain("v_replacement CONSTANT text := $sql$IF v_booking.lesson_started_at IS NOT NULL THEN$sql$");
  });

  it('keeps provider cancellation authorization tied to the canonical professional role and provider', () => {
    const migration = fs.readFileSync(
      path.resolve(
        process.cwd(),
        'supabase/migrations/20260911011451_reconcile_cancel_booking_role_authorization.sql',
      ),
      'utf8',
    );

    expect(migration).toContain("ur.role::TEXT = 'INSTRUCTOR'");
    expect(migration).toContain('p.id = v_booking.provider_id');
    expect(migration).toContain("p.type::TEXT = 'INSTRUCTOR'");
    expect(migration).toContain("THEN 'INSTRUCTOR'");
  });
});
