import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/20260822022737_compliance_document_type_alignment.sql'),
  'utf8',
);
const dbService = fs.readFileSync(path.join(__dirname, '../src/lib/db-service.ts'), 'utf8');

describe('compliance document type alignment', () => {
  it('supports every document type present in the canonical requirement catalog', () => {
    for (const type of [
      'CNH_EAR',
      'CREDENTIAL_DETRAN_SP',
      'CREDENTIAL_HISTORICAL',
      'MAZZI_TERMS_ACCEPTANCE',
      'COMPANY_REGISTRATION',
      'CFC_AUTHORIZATION',
      'CFC_AUTHORIZATION_STATE',
    ]) {
      expect(migration).toContain(`'${type}'`);
    }
  });

  it('persists the canonical type and only normalizes legacy CNH on read', () => {
    expect(dbService).toContain('document_type: doc.type as any');
    expect(dbService).toContain("row.document_type === 'CNH' ? 'CNH_EAR' : row.document_type");
  });
});
