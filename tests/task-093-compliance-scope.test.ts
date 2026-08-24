import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { doesComplianceDocumentApplyToProvider, evaluateProviderEligibility, USER_GLOBAL_COMPLIANCE_DOCUMENT_TYPES } from '../src/domain/compliance';
import { ComplianceDocument, ComplianceRequirement, Provider } from '../src/types';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260824121513_task_093_compliance_scope_and_submission.sql'), 'utf8');
const provider: Provider = { id: 'provider-a', userId: 'user-a', name: 'Instrutor', type: 'INSTRUCTOR', status: 'ACTIVE', ratingAverage: 0, ratingCount: 0, neighborhood: 'Centro', city: 'São Paulo', state: 'SP', categories: ['B'], transmissions: ['MANUAL'], startingPriceInCents: 10000, isVerified: false };
const doc = (overrides: Partial<ComplianceDocument>): ComplianceDocument => ({ id: crypto.randomUUID(), providerId: provider.id, scope: 'PROVIDER', type: 'CNH_EAR', title: 'CNH', status: 'APPROVED', fileName: 'cnh.pdf', storagePath: 'x', uploadedAt: '2026-08-20T00:00:00Z', ...overrides });

describe('TASK-093 compliance scope and submission authority', () => {
  it('accepts only matching PROVIDER scope and rejects VEHICLE/MEMBERSHIP collisions', () => {
    expect(doesComplianceDocumentApplyToProvider(doc({}), provider)).toBe(true);
    expect(doesComplianceDocumentApplyToProvider(doc({ scope: 'VEHICLE', vehicleId: 'vehicle-a' } as any), provider)).toBe(false);
    expect(doesComplianceDocumentApplyToProvider(doc({ scope: 'MEMBERSHIP', membershipId: 'membership-a' } as any), provider)).toBe(false);
  });

  it('allows only the closed USER_GLOBAL instructor document catalog', () => {
    expect(USER_GLOBAL_COMPLIANCE_DOCUMENT_TYPES.has('CNH_EAR')).toBe(true);
    expect(USER_GLOBAL_COMPLIANCE_DOCUMENT_TYPES.has('MAZZI_TERMS_ACCEPTANCE')).toBe(false);
    expect(doesComplianceDocumentApplyToProvider(doc({ scope: 'USER_GLOBAL', providerId: '', userId: provider.userId, type: 'CNH_EAR' }), provider)).toBe(true);
    expect(doesComplianceDocumentApplyToProvider(doc({ scope: 'USER_GLOBAL', providerId: '', userId: 'user-b', type: 'CNH_EAR' }), provider)).toBe(false);
  });

  it('prevents a VEHICLE or MEMBERSHIP document from increasing approvedCount', () => {
    const requirement: ComplianceRequirement = { id: 'req', country: 'BR', jurisdiction: 'FEDERAL', providerType: 'INSTRUCTOR', documentType: 'CNH_EAR', title: 'CNH', description: '', isMandatory: true, sourceType: 'FEDERAL_LAW', sourceReference: 'test', sourceIdentifier: 'test', regulatoryStatus: 'OFFICIALLY_VALIDATED', lastValidatedAt: '2026-08-20', effectiveFrom: '2026-01-01' };
    const result = evaluateProviderEligibility(provider, [doc({ scope: 'VEHICLE', vehicleId: 'vehicle-a' } as any)], [requirement], new Date('2026-08-21T00:00:00Z'));
    expect(result.approvedCount).toBe(0);
    expect(result.isEligible).toBe(false);
  });

  it('defines authoritative provider and terms RPCs and removes direct table writes', () => {
    expect(migration).toContain('provider_submit_compliance_document');
    expect(migration).toContain('provider_accept_mazzi_terms');
    expect(migration).toContain("'PENDING',p_expires_at");
    expect(migration).toContain("'MAZZI_TERMS_ACCEPTANCE',v_path,'APPROVED'");
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.compliance_documents FROM authenticated');
    expect(migration).toContain("d.document_type::TEXT IN ('CNH_EAR','CREDENTIAL_DETRAN','CREDENTIAL_DETRAN_SP','CRIMINAL_BACKGROUND')");
  });
});
