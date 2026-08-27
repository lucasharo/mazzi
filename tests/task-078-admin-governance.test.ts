import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getComplianceDocumentTypeLabel, getStatusPresentation } from '../src/domain/status-presentation';

const adminApp = readFileSync('src/apps/admin/AdminApp.tsx', 'utf8');
const adminComponents = readFileSync('src/apps/admin/AdminComponents.tsx', 'utf8');
const dbService = readFileSync('src/lib/db-service.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260826233000_admin_multi_role_governance.sql', 'utf8');
const edgeFunction = readFileSync('supabase/functions/admin-invite-administrative-user/index.ts', 'utf8');

describe('TASK-078 Admin governance and presentation contracts', () => {
  it('maps real database statuses to friendly labels without raw fallback values', () => {
    expect(getStatusPresentation('PENDING_REVIEW', 'provider').label).toBe('Aguardando análise');
    expect(getStatusPresentation('IN_REVIEW', 'compliance').label).toBe('Em análise');
    expect(getStatusPresentation('IN_REVIEW', 'vehicle').label).toBe('Em análise');
    expect(getStatusPresentation('CANCELLED_BY_STUDENT', 'booking').label).toBe('Cancelada pelo aluno');
    expect(getStatusPresentation('UNKNOWN_STATUS', 'vehicle').label).toBe('Status não disponível');
    expect(getComplianceDocumentTypeLabel('CNH_EAR')).toBe('CNH com EAR');
  });

  it('keeps review filter values separate and never reintroduces UNDER_REVIEW', () => {
    expect(adminComponents).toContain("{ value: 'IN_REVIEW', label: `Em análise (");
    expect(adminComponents).toContain("{ value: 'DRAFT', label: `Rascunhos (");
    expect(adminComponents).not.toContain('UNDER_REVIEW');
  });

  it('keeps visible data in place during a background refresh and uses shared toast feedback', () => {
    expect(adminApp).not.toContain('{isRefreshingRealData && <ContentSkeleton');
    expect(adminApp).toContain('<ToastContainer');
    expect(adminApp).not.toContain('alert(');
  });

  it('uses a private short-lived storage URL for the compliance viewer', () => {
    expect(dbService).toContain(".from('provider-compliance-docs')");
    expect(dbService).toContain('.createSignedUrl(document.storagePath, 300)');
    expect(adminComponents).toContain('Visualizar documento');
    expect(adminComponents).not.toContain('getPublicUrl');
  });

  it('adds only administrative secondary roles and keeps the authority server-side', () => {
    expect(migration).toContain("p_role NOT IN ('PLATFORM_ADMIN', 'SUPPORT')");
    expect(migration).toContain('ON CONFLICT (user_id, role) DO NOTHING');
    expect(migration).toContain("'ADMINISTRATIVE_ROLE_GRANTED'");
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.admin_add_administrative_role');
    expect(dbService).toContain("sp.rpc('admin_add_administrative_role'");
    expect(edgeFunction).toContain('auth.getUser(token)');
    expect(edgeFunction).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(edgeFunction).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
  });
});
