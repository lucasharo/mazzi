import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('TASK-086 local database contract', () => {
  it('keeps navigation and devices behind security-definer RPCs', () => {
    const migration = fs.readFileSync('supabase/migrations/20260902040000_task_086_earnings_notifications_push.sql', 'utf8');
    expect(migration).toContain('navigation_action');
    expect(migration).toContain('user_push_devices');
    expect(migration).toContain('ALTER TABLE public.user_push_devices ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE public.user_push_devices');
    expect(migration).toContain('register_my_push_device');
    expect(migration).toContain('get_my_provider_payout_detail');
    expect(migration).toContain('SET search_path = public, pg_temp');
    expect(migration).not.toContain('GRANT SELECT ON TABLE public.payouts');
  });
});
