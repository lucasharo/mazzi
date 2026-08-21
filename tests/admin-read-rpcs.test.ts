import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260821190251_admin_read_rpcs.sql'), 'utf8');
const dbService = fs.readFileSync(path.join(__dirname, '../src/lib/db-service.ts'), 'utf8');

describe('Admin read RPC security contract', () => {
  it('routes both Admin reads through their dedicated RPCs', () => {
    expect(dbService).toContain("sp.rpc('get_admin_platform_configurations')");
    expect(dbService).toContain("sp.rpc('get_admin_audit_logs')");
    const platformStart = dbService.indexOf('async getPlatformConfigs');
    const auditStart = dbService.indexOf('async getAuditLogs');
    const platformRead = dbService.slice(platformStart, dbService.indexOf('async savePlatformConfig'));
    const auditRead = dbService.slice(auditStart, dbService.indexOf('async createAuditLog'));
    expect(platformRead).not.toContain("from('platform_configurations')");
    expect(auditRead).not.toContain("from('audit_logs')");
  });

  it('requires authentication and matching RBAC permissions', () => {
    expect(migration).toContain("'admin.audit.read'::public.app_permission");
    expect(migration).toContain("'admin.platform.manage_settings'::public.app_permission");
    expect(migration.match(/IF auth\.uid\(\) IS NULL/g)).toHaveLength(2);
    expect(migration.match(/AUTH_REQUIRED/g)).toHaveLength(2);
    expect(migration.match(/FORBIDDEN/g)).toHaveLength(2);
  });

  it('uses fixed search paths, security definer, bounded audit reads, and no RLS policy changes', () => {
    expect(migration.match(/SECURITY DEFINER/g)).toHaveLength(2);
    expect(migration.match(/SET search_path TO public, pg_temp/g)).toHaveLength(2);
    expect(migration).toContain('ORDER BY al.created_at DESC');
    expect(migration).toContain('LIMIT 500');
    expect(migration).not.toMatch(/CREATE POLICY/i);
    expect(migration).not.toMatch(/DROP POLICY/i);
    expect(migration).not.toMatch(/ALTER TABLE .* ROW LEVEL SECURITY/i);
  });

  it('returns only the approved audit columns', () => {
    const auditSelect = migration.match(/RETURN QUERY[\s\S]*?FROM public\.audit_logs[\s\S]*?LIMIT 500;/)?.[0] || '';
    for (const column of ['id', 'actor_id', 'action', 'entity_type', 'entity_id', 'previous_value', 'new_value', 'ip_address', 'created_at']) {
      expect(auditSelect).toContain(`al.${column}`);
    }
    expect(auditSelect).not.toContain('user_agent');
    expect(auditSelect).not.toContain('severity');
  });

  it('returns only the approved platform configuration columns', () => {
    const configSelect = migration.match(/RETURN QUERY[\s\S]*?FROM public\.platform_configurations[\s\S]*?;/)?.[0] || '';
    expect(configSelect).toContain('pc.key');
    expect(configSelect).toContain('pc.value');
    for (const column of ['pc.id', 'pc.description', 'pc.updated_by', 'pc.updated_at']) {
      expect(configSelect).not.toContain(column);
    }
  });

  it('grants execution only to authenticated users', () => {
    expect(migration.match(/GRANT EXECUTE ON FUNCTION[\s\S]*?TO authenticated/g)).toHaveLength(2);
    expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION[\s\S]*?TO service_role/i);
  });
});
