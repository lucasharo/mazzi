import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPLIANCE_REQUIREMENTS,
  requiresComplianceDocumentExpiration,
} from '../src/domain/compliance';

describe('Matriz de validade dos documentos de compliance', () => {
  it('exige data para todos os requisitos com período de validade finito', () => {
    const expiringTypes = DEFAULT_COMPLIANCE_REQUIREMENTS
      .filter((requirement) => requirement.validityPeriodDays !== undefined)
      .map((requirement) => requirement.documentType);

    expect(expiringTypes).toEqual([
      'CNH_EAR',
      'CREDENTIAL_DETRAN',
      'CRIMINAL_BACKGROUND',
      'CREDENTIAL_DETRAN_SP',
      'CFC_AUTHORIZATION_STATE',
      'CFC_ALVARA',
    ]);
    expect(expiringTypes.every((type) => requiresComplianceDocumentExpiration(type))).toBe(true);
  });

  it('mantém documentos permanentes, históricos e tipos sem requisito sem data obrigatória', () => {
    expect(requiresComplianceDocumentExpiration('CNH')).toBe(true);
    expect(requiresComplianceDocumentExpiration('MAZZI_TERMS_ACCEPTANCE')).toBe(false);
    expect(requiresComplianceDocumentExpiration('COMPANY_REGISTRATION')).toBe(false);
    expect(requiresComplianceDocumentExpiration('CFC_AUTHORIZATION')).toBe(false);
    expect(requiresComplianceDocumentExpiration('CREDENTIAL_HISTORICAL')).toBe(false);
    expect(requiresComplianceDocumentExpiration('DOCUMENTO_NAO_CATALOGADO')).toBe(false);
  });
});
