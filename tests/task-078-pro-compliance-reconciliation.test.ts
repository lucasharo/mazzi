import { describe, expect, it } from 'vitest';
import { doesDocumentSatisfyRequirement, evaluateProviderEligibility } from '../src/domain/compliance';
import { ComplianceDocument, ComplianceRequirement, Provider } from '../src/types';

const provider: Provider = { id: 'provider-1', userId: 'user-1', name: 'Instrutor', type: 'INSTRUCTOR', status: 'ACTIVE', ratingAverage: 5, ratingCount: 1, neighborhood: 'Pinheiros', city: 'São Paulo', state: 'SP', categories: ['B'], transmissions: ['MANUAL'], startingPriceInCents: 14500, isVerified: true };
const requirement: ComplianceRequirement = { id: 'req-cnh', country: 'BR', jurisdiction: 'FEDERAL', providerType: 'INSTRUCTOR', documentType: 'CNH_EAR', title: 'CNH com EAR', description: 'Teste', isMandatory: true, sourceType: 'FEDERAL_LAW', sourceReference: 'Teste', regulatoryStatus: 'OFFICIALLY_VALIDATED', effectiveFrom: '2026-01-01T00:00:00Z' };
const at = '2026-08-22T00:00:00Z';
function doc(overrides: Partial<ComplianceDocument>): ComplianceDocument { return { id: crypto.randomUUID(), providerId: provider.id, scope: 'PROVIDER', type: 'CNH_EAR', title: 'CNH com EAR', status: 'PENDING', fileName: 'document.pdf', storagePath: 'document.pdf', uploadedAt: '2026-08-20T00:00:00Z', expiresAt: '2027-08-20T00:00:00Z', ...overrides }; }
function evaluate(documents: ComplianceDocument[]) { return evaluateProviderEligibility(provider, documents, [requirement], new Date(at)); }

describe('TASK-078 PRO compliance reconciliation', () => {
  it.each([
    ['old rejected + new approved', ['REJECTED', 'APPROVED'], true], ['old expired + new approved', ['EXPIRED', 'APPROVED'], true], ['old pending + new approved', ['PENDING', 'APPROVED'], true], ['old approved + new pending', ['APPROVED', 'PENDING'], true], ['old approved + new rejected', ['APPROVED', 'REJECTED'], true], ['only pending', ['PENDING'], false], ['only rejected', ['REJECTED'], false], ['only expired approved', ['APPROVED_EXPIRED'], false], ['no document', [], false],
  ])('%s resolves from effective requirement state', (_label, states, expected) => {
    const documents = (states as string[]).map((status, index) => doc({ id: `doc-${index}`, status: status === 'APPROVED_EXPIRED' ? 'APPROVED' : status as ComplianceDocument['status'], uploadedAt: `2026-08-${String(10 + index).padStart(2, '0')}T00:00:00Z`, expiresAt: status === 'APPROVED_EXPIRED' ? '2026-08-01T00:00:00Z' : '2027-08-20T00:00:00Z' }));
    const result = evaluate(documents); expect(result.isEligible).toBe(expected); expect(result.approvedCount).toBe(expected ? 1 : 0); expect(result.approvedDocuments.length).toBe(expected ? 1 : 0);
  });
  it('uses newest relevant submission rather than array order', () => { const result = evaluate([doc({ id: 'new', status: 'REJECTED', uploadedAt: '2026-08-21T00:00:00Z' }), doc({ id: 'old', status: 'PENDING', uploadedAt: '2026-08-10T00:00:00Z' })]); expect(result.rejectedDocuments.map((item) => item.id)).toEqual(['new']); expect(result.pendingDocuments).toHaveLength(0); });
  it('does not count duplicate approved files as duplicate requirements', () => { const result = evaluate([doc({ id: 'approved-1', status: 'APPROVED' }), doc({ id: 'approved-2', status: 'APPROVED', uploadedAt: '2026-08-21T00:00:00Z' })]); expect(result.approvedCount).toBe(1); expect(result.approvedDocuments).toHaveLength(1); });
  it('accepts legacy aliases for CNH and DETRAN credentials', () => { expect(doesDocumentSatisfyRequirement('CNH', 'CNH_EAR')).toBe(true); expect(doesDocumentSatisfyRequirement('CREDENTIAL_DETRAN', 'CREDENTIAL_DETRAN_SP')).toBe(true); expect(doesDocumentSatisfyRequirement('OTHER', 'CNH_EAR')).toBe(false); });
  it('includes only the instructor matching USER_GLOBAL documents', () => { const globalApproved = doc({ id: 'global-cnh', providerId: '', userId: provider.userId, scope: 'USER_GLOBAL', status: 'APPROVED' }); expect(evaluate([globalApproved]).isEligible).toBe(true); expect(evaluate([{ ...globalApproved, id: 'other-user', userId: 'other-user' }]).isEligible).toBe(false); });
});
