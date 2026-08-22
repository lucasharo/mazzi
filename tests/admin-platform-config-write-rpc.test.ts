import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260822033624_admin_platform_config_write_rpc.sql',
  'utf8',
);
const dbService = readFileSync('src/lib/db-service.ts', 'utf8');
const adminApp = readFileSync('src/apps/admin/AdminApp.tsx', 'utf8');

describe('Admin platform configuration write contract', () => {
  it('uses a transactional RPC with authentication, RBAC and audit logging', () => {
    expect(migration).toContain('update_admin_platform_configurations');
    expect(migration).toContain('IF v_uid IS NULL');
    expect(migration).toContain("'admin.platform.manage_settings'::public.app_permission");
    expect(migration).toContain("'PLATFORM_CONFIG_UPDATED'");
    expect(migration).toContain('INSERT INTO public.audit_logs');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.update_admin_platform_configurations(JSONB) FROM PUBLIC');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.update_admin_platform_configurations(JSONB) TO authenticated');
  });

  it('routes Admin writes through the RPC instead of direct table upsert', () => {
    expect(dbService).toContain("sp.rpc('update_admin_platform_configurations'");
    expect(dbService).not.toContain("from('platform_configurations')");
    expect(adminApp).toContain('dbService.updatePlatformConfigs(persistedUpdates)');
    expect(adminApp).not.toContain("blockPendingAdminMutation('Alteração de configuração da plataforma')");
  });
});
