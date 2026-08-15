import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.cwd();
const adminAppSource = readFileSync(join(rootDir, 'src/apps/admin/AdminApp.tsx'), 'utf8');
const dbServiceSource = readFileSync(join(rootDir, 'src/lib/db-service.ts'), 'utf8');

describe('Sprint 12 — Admin Real Data Gate', () => {
  it('does not initialize Admin state from mock fixtures or local IDs', () => {
    expect(adminAppSource).not.toContain("from '../../data/mockData'");
    expect(adminAppSource).not.toContain('MOCK_');
    expect(adminAppSource).not.toContain('INITIAL_USERS');
    expect(adminAppSource).not.toContain('usr_admin_');
    expect(adminAppSource).not.toContain('usr_support_');
    expect(adminAppSource).not.toContain('usr_student_');
    expect(adminAppSource).not.toContain('prov_1');
    expect(adminAppSource).not.toContain('prov_2');
  });

  it('loads the Admin user directory from public.users via dbService', () => {
    expect(dbServiceSource).toContain('async getUsers()');
    expect(dbServiceSource).toContain(".from('users')");
    expect(adminAppSource).toContain('dbService.getUsers()');
    expect(adminAppSource).toContain('setUsers(u)');
  });

  it('blocks administrative mutations until audited backend transactions exist', () => {
    expect(adminAppSource).toContain('blockPendingAdminMutation');
    expect(adminAppSource).toContain('precisa de RPC/endpoint transacional');
    expect(adminAppSource).not.toContain('Math.random()');
    expect(adminAppSource).not.toContain('setAuditLogs((prev) => [audit, ...prev])');
  });
});
