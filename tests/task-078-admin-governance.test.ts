import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAuditActionLabel, getComplianceDocumentTypeLabel, getStatusPresentation, getUserRoleLabel } from '../src/domain/status-presentation';

const adminApp = readFileSync('src/apps/admin/AdminApp.tsx', 'utf8');
const adminComponents = readFileSync('src/apps/admin/AdminComponents.tsx', 'utf8');
const dbService = readFileSync('src/lib/db-service.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260826233000_admin_multi_role_governance.sql', 'utf8');
const edgeFunction = readFileSync('supabase/functions/admin-invite-administrative-user/index.ts', 'utf8');
const bookingNamesMigration = readFileSync('supabase/migrations/20260827023100_admin_booking_names.sql', 'utf8');

describe('TASK-078 Admin governance and presentation contracts', () => {
  it('maps real database statuses to friendly labels without raw fallback values', () => {
    expect(getStatusPresentation('PENDING_REVIEW', 'provider').label).toBe('Aguardando análise');
    expect(getStatusPresentation('IN_REVIEW', 'compliance').label).toBe('Em análise');
    expect(getStatusPresentation('IN_REVIEW', 'vehicle').label).toBe('Em reanálise');
    expect(getStatusPresentation('CANCELLED_BY_STUDENT', 'booking').label).toBe('Cancelada pelo aluno');
    expect(getStatusPresentation('UNKNOWN_STATUS', 'vehicle').label).toBe('Status não disponível');
    expect(getComplianceDocumentTypeLabel('CNH_EAR')).toBe('CNH com EAR');
    expect(getAuditActionLabel('COMPLIANCE_DOCUMENT_SUBMITTED')).toBe('Documento enviado para análise');
    expect(getUserRoleLabel('SCHOOL_ADMIN')).toBe('Gestor da autoescola');
  });

  it('keeps review filter values separate and never reintroduces UNDER_REVIEW', () => {
    expect(adminComponents).toContain("{ value: 'IN_REVIEW', label: `Pendentes (");
    expect(adminComponents).not.toContain("{ value: 'DRAFT'");
    expect(adminComponents).not.toContain('UNDER_REVIEW');
  });

  it('uses only the header control to refresh the current content region', () => {
    expect(adminApp).not.toContain('{isRefreshingRealData && <ContentSkeleton');
    expect(adminApp).toContain('Atualizando conteúdo da tela atual');
    expect(adminApp).not.toContain('setInterval(');
    expect(adminApp).toContain('}, [user?.id]);');
    expect(adminApp).toContain('<ToastContainer');
    expect(adminApp).not.toContain('alert(');
  });

  it('uses a private short-lived storage URL for the compliance viewer', () => {
    expect(dbService).toContain(".from('provider-compliance-docs')");
    expect(dbService).toContain('.createSignedUrl(document.storagePath, 300)');
    expect(adminComponents).toContain('Visualizar documento');
    expect(adminComponents).not.toContain('getPublicUrl');
  });

  it('loads only the student name needed by the administrative booking view', () => {
    expect(dbService).toContain("sp.rpc('get_admin_booking_names'");
    expect(bookingNamesMigration).toContain("'admin.finance.read_all'");
    expect(bookingNamesMigration).toContain("'support.booking.read_limited'");
    expect(bookingNamesMigration).toContain('student.name::text');
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
