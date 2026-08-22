import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const adminRoot = readFileSync('src/entrypoints/admin/AdminRoot.tsx', 'utf8');
const adminApp = readFileSync('src/apps/admin/AdminApp.tsx', 'utf8');
const adminComponents = readFileSync('src/apps/admin/AdminComponents.tsx', 'utf8');
const dbService = readFileSync('src/lib/db-service.ts', 'utf8');
const rbac = readFileSync('src/domain/rbac.ts', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20260822164851_task_077a_admin_access_hardening.sql',
  'utf8',
);

describe('TASK-077A static contracts', () => {
  it('mounts the Admin MVP only for PLATFORM_ADMIN, including multi-role users', () => {
    expect(adminRoot).toContain("roles.includes('PLATFORM_ADMIN')");
    expect(adminRoot).not.toContain("'SUPPORT'");
    expect(adminApp).toContain('roles: user?.roles || []');
    expect(adminApp).toContain('status: user?.status || \'ACTIVE\'');
    expect(adminApp).not.toContain('currentRole');
    expect(adminApp).not.toContain('setCurrentRole');
  });

  it('does not turn Admin read failures into empty lists', () => {
    expect(adminApp).not.toMatch(/dbService\.get(?:Providers|Vehicles|Bookings|AdminComplianceDocs|AuditLogs|PlatformConfigs|Users)\(\)\.catch/);
    expect(adminApp).toContain('Falha ao carregar Admin real:');
  });

  it('uses an explicit Admin compliance projection without exposing storage paths', () => {
    expect(dbService).toContain('async getAdminComplianceDocs()');
    expect(dbService).toContain('id,provider_id,user_id,document_type,status,rejection_reason,expires_at,reviewed_by,reviewed_at,created_at');
    expect(dbService).not.toMatch(/getAdminComplianceDocs[\s\S]*?select\('\*'\)/);
    expect(adminApp).toContain('dbService.getAdminComplianceDocs()');
    expect(adminComponents).not.toContain('StoragePath');
    expect(adminComponents).not.toContain('selectedDoc.storagePath');
  });

  it('uses current Sao Paulo date and real booking timestamps', () => {
    expect(adminComponents).not.toContain('2026-08-15');
    expect(adminComponents).toContain("timeZone: 'America/Sao_Paulo'");
    expect(adminComponents).toContain('new Date(b.scheduledStartAt)');
    expect(adminComponents).not.toContain('100% de conformidade regulatória');
  });

  it('aligns compliance review with the canonical permission matrix', () => {
    expect(migration).toContain("'admin.compliance.review'::public.app_permission");
    expect(migration).toContain('auth.uid() IS NOT NULL');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.is_compliance_reviewer() FROM PUBLIC');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.is_compliance_reviewer() TO authenticated');
    expect(rbac).toMatch(/PLATFORM_ADMIN:\s*\[[\s\S]*?'admin\.compliance\.review'/);
    expect(rbac).toMatch(/SUPPORT:\s*\[[\s\S]*?'support\.user\.read_limited'/);
    const supportBlock = rbac.slice(rbac.indexOf('SUPPORT:'), rbac.indexOf('],\n};', rbac.indexOf('SUPPORT:')));
    expect(supportBlock).not.toContain('admin.compliance.review');
  });
});
