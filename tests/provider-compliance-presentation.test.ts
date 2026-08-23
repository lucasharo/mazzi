import { describe, expect, it } from 'vitest';
import { Provider, ComplianceDocument } from '../src/types';
import { evaluateProviderEligibility, DEFAULT_COMPLIANCE_REQUIREMENTS } from '../src/domain/compliance';
import { resolveProviderCompliancePresentation } from '../src/domain/provider-compliance-presentation';

const provider: Provider = { id: 'provider-1', userId: 'user-1', name: 'Instrutor', type: 'INSTRUCTOR', status: 'ACTIVE', ratingAverage: 5, ratingCount: 1, neighborhood: 'Pinheiros', city: 'São Paulo', state: 'SP', categories: ['B'], transmissions: ['MANUAL'], startingPriceInCents: 14500, isVerified: true };
const requirement = DEFAULT_COMPLIANCE_REQUIREMENTS.find((item) => item.providerType === 'INSTRUCTOR' && item.isMandatory) || DEFAULT_COMPLIANCE_REQUIREMENTS.find((item) => item.providerType === 'INSTRUCTOR');
const at = new Date('2026-08-22T00:00:00Z');
function doc(status: ComplianceDocument['status'], uploadedAt = '2026-08-20T00:00:00Z', expiresAt = '2027-08-20T00:00:00Z'): ComplianceDocument {
  return { id: `${status}-${uploadedAt}`, providerId: provider.id, type: requirement!.documentType, title: requirement!.title, status, fileName: 'document.pdf', storagePath: 'document.pdf', uploadedAt, expiresAt };
}
function presentation(statuses: ComplianceDocument['status'][], providerStatus: Provider['status'] = 'ACTIVE', expiresAt?: string) {
  const current = { ...provider, status: providerStatus };
  const eligibility = evaluateProviderEligibility(current, statuses.map((status) => doc(status, '2026-08-20T00:00:00Z', expiresAt)), [requirement!], at);
  return resolveProviderCompliancePresentation(current, eligibility);
}

describe('PRO compliance presentation precedence', () => {
  it('shows verified only when ACTIVE is eligible', () => expect(presentation(['APPROVED'])).toMatchObject({ status: 'ACTIVE', verified: true, title: 'Credenciamento Ativo • Verificado pela MAZZI' }));
  it('maps effective pending, rejected, expired and missing documents distinctly', () => {
    expect(presentation(['PENDING']).status).toBe('UNDER_REVIEW');
    expect(presentation(['REJECTED']).status).toBe('REJECTED');
    expect(presentation(['APPROVED'], 'ACTIVE', '2026-08-01T00:00:00Z').status).toBe('EXPIRED');
    expect(presentation([])).toMatchObject({ status: 'PENDING', title: 'Documentação pendente para verificação' });
  });
  it('prioritizes provider operational states and renders one title', () => {
    for (const [status, title] of [['BLOCKED', 'Cadastro bloqueado'], ['SUSPENDED', 'Cadastro suspenso'], ['REJECTED', 'Cadastro rejeitado'], ['PENDING_REVIEW', 'Cadastro em análise']] as const) {
      const result = presentation(['PENDING'], status);
      expect(result.title).toBe(title);
      expect(result.title).not.toContain('Documentos');
    }
  });
  it('preserves TASK-078 replacement precedence for rejected history', () => {
    const current = { ...provider };
    const eligibility = evaluateProviderEligibility(current, [doc('REJECTED', '2026-08-10T00:00:00Z'), doc('APPROVED', '2026-08-21T00:00:00Z')], [requirement!], at);
    expect(resolveProviderCompliancePresentation(current, eligibility).verified).toBe(true);
  });
  it('preserves TASK-078 replacement precedence for expired history', () => {
    const current = { ...provider };
    const eligibility = evaluateProviderEligibility(current, [doc('APPROVED', '2026-08-10T00:00:00Z', '2026-08-01T00:00:00Z'), doc('APPROVED', '2026-08-21T00:00:00Z')], [requirement!], at);
    const result = resolveProviderCompliancePresentation(current, eligibility);
    expect(result.verified).toBe(true);
    expect(result.status).not.toBe('EXPIRED');
  });
});
