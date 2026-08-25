import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260825151539_enforce_current_mazzi_terms_for_instructor_activation.sql'),
  'utf8',
);

describe('TASK-096A4M-R10D canonical terms gate', () => {
  it('normalizes the mandatory terms requirement to provider scope', () => {
    expect(sql).toContain("id = 'req_termo_conduta_mazzi'");
    expect(sql).toContain("scope = 'PROVIDER'::public.compliance_document_scope");
  });

  it('enforces the server-owned current terms version', () => {
    expect(sql).toContain('current_mazzi_terms_version');
    expect(sql).toContain("SELECT 'v1'::text");
    expect(sql).toContain('TERMS_VERSION_NOT_CURRENT');
    expect(sql).toContain('p_terms_version IS DISTINCT FROM v_current_version');
  });

  it('requires owner/provider-scoped approved terms for eligibility', () => {
    expect(sql).toContain("terms.scope = 'PROVIDER'::public.compliance_document_scope");
    expect(sql).toContain("terms.document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type");
    expect(sql).toContain("terms.status = 'APPROVED'::public.compliance_status");
    expect(sql).toContain("terms.storage_path = 'acceptance://mazzi-ethics/' || public.current_mazzi_terms_version()");
  });

  it('keeps acceptance idempotent and reconciles active providers without fabricating terms', () => {
    expect(sql).toContain('IF FOUND THEN');
    expect(sql).toContain("status = 'DRAFT'::public.provider_status");
    expect(sql).toContain('PROVIDER_TERMS_REQUIRED_RECONCILIATION');
    expect(sql).toContain('INSERT INTO public.compliance_documents');
  });
});
