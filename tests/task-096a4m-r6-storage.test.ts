import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260825140036_task_096a4m_r6_provider_compliance_storage.sql',
  'utf8',
);
const providerApp = readFileSync('src/apps/provider/ProviderApp.tsx', 'utf8');
const dbService = readFileSync('src/lib/db-service.ts', 'utf8');
const adminComponents = readFileSync('src/apps/admin/AdminComponents.tsx', 'utf8');
const adminApp = readFileSync('src/apps/admin/AdminApp.tsx', 'utf8');

describe('TASK-096A4M-R6 private compliance storage contract', () => {
  it('provisions the exact private bucket with the current upload limits', () => {
    expect(migration).toContain("'provider-compliance-docs'");
    expect(migration).toContain('public,');
    expect(migration).toContain('FALSE');
    expect(migration).toContain('10485760');
    expect(migration).toContain("ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']");
  });

  it('keeps the browser upload contract and cleanup path unchanged', () => {
    expect(providerApp).toContain(".from('provider-compliance-docs')");
    expect(providerApp).toContain('providers/${currentProvider.id}/compliance/${documentId}/${safeFileName}');
    expect(providerApp).toContain('.remove([storagePath])');
  });

  it('requires authenticated active ownership for uploads', () => {
    expect(migration).toContain('FOR INSERT TO authenticated');
    expect(migration).toContain('public.is_current_user_active()');
    expect(migration).toContain('public.is_provider_owner(((storage.foldername(name))[2])::uuid)');
    expect(migration).toContain("name ~ '^providers/[^/]+/compliance/[^/]+/[^/]+$'");
  });

  it('does not trust a client-supplied provider outside the owned prefix', () => {
    expect(migration).toContain("(storage.foldername(name))[1] = 'providers'");
    expect(migration).toContain("(storage.foldername(name))[3] = 'compliance'");
    expect(migration).toContain("~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'");
  });

  it('allows only owner/reviewer reads and no anonymous access', () => {
    expect(migration).toContain('FOR SELECT TO authenticated');
    expect(migration).toContain('public.is_compliance_reviewer()');
    expect(migration).not.toMatch(/FOR SELECT TO[^\n]*anon/i);
    expect(migration).not.toContain('public = TRUE');
  });

  it('limits deletion and intentionally has no client UPDATE policy', () => {
    expect(migration).toContain('FOR DELETE TO authenticated');
    expect(migration).toContain('R6 compliance storage provider delete');
    expect(migration).toContain('R6 compliance storage reviewer delete');
    expect(migration.split("name ~ '^providers/[^/]+/compliance/[^/]+/[^/]+$'").length - 1).toBe(4);
    expect(migration).not.toMatch(/FOR UPDATE\s+TO/i);
  });

  it('keeps private paths out of the Admin UX and uses them only to create short signed URLs', () => {
    expect(migration).not.toMatch(/INSERT\s+INTO\s+public\.compliance_documents/i);
    expect(migration).not.toMatch(/UPDATE\s+public\.compliance_documents/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.compliance_documents/i);
    const adminRead = dbService.match(/async getAdminComplianceDocs\(\)[\s\S]{0,500}/)?.[0] || '';
    expect(adminRead).toContain('storage_path');
    expect(adminComponents).not.toContain('selectedDoc.storagePath');
    expect(dbService).toContain(".createSignedUrl(document.storagePath, 300)");
  });

  it('presents compliance review status as PENDING in the Admin app', () => {
    expect(adminComponents).toContain("{ value: 'IN_REVIEW', label: `Pendentes (");
    expect(adminComponents).toContain("filterStatus === 'IN_REVIEW'");
    expect(adminComponents).toContain("d.status === 'PENDING' || d.status === 'IN_REVIEW'");
    expect(adminComponents).not.toContain("{ value: 'DRAFT'");
    expect(adminApp).toContain("d.status === 'PENDING' || d.status === 'IN_REVIEW'");
  });

  it('does not contain live credentials or an instruction to execute DDL remotely', () => {
    expect(migration).not.toMatch(/service[_ -]?role|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL/i);
    expect(migration).not.toMatch(/apply_migration|supabase db push|curl/i);
  });
});
