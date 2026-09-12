import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  'supabase/migrations/20260912053738_fix_push_device_account_isolation.sql',
  'utf8',
);
const registry = fs.readFileSync('src/lib/push-device-registry.ts', 'utf8');
const auth = fs.readFileSync('src/components/auth/AuthContext.tsx', 'utf8');

describe('push device account isolation', () => {
  it('transfers an active destination atomically and enforces one active owner', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('uq_user_push_devices_active_endpoint');
    expect(migration).toContain('uq_user_push_devices_active_fingerprint');
    expect(migration).toContain('AND NOT (user_id = v_uid AND device_fingerprint = v_device_fingerprint)');
  });

  it('provides an authenticated context-wide logout RPC', () => {
    expect(migration).toContain('disable_my_push_devices_for_context');
    expect(migration).toContain('WHERE user_id = v_uid');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.disable_my_push_devices_for_context(TEXT) FROM PUBLIC, anon');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.disable_my_push_devices_for_context(TEXT) TO authenticated');
  });

  it('clears backend and native push state from the shared logout path', () => {
    expect(registry).toContain('dbService.disableMyPushDevicesForContext(appContext)');
    expect(registry).toContain('PushNotifications.unregister()');
    expect(auth).toContain('disableStoredPushDevice(pushAppContext, authState.user.id)');
  });
});
