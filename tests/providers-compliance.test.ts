// ============================================================================
// MAZZI PLATFORM — SPRINT 04: PROVIDERS & COMPLIANCE TEST SUITE
// File: tests/providers-compliance.test.ts
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  createDrivingSchoolDraftModel,
  createInstructorDraftModel,
  normalizeCnpj,
  normalizeCpf,
  sanitizeCnpj,
  sanitizeCpf,
  toPublicProviderProfile,
  validateCnpj,
  validateCpf,
  validateProviderStatusTransition,
  canTransitionProviderStatus,
} from '../src/domain/providers';
import {
  DEFAULT_COMPLIANCE_REQUIREMENTS,
  evaluateProviderEligibility,
  evaluateStorageAccess,
  generateComplianceStoragePath,
  getComplianceRequirements,
  getVerificationBadgeTooltip,
  isComplianceDocumentExpired,
  validateComplianceFile,
} from '../src/domain/compliance';
import {
  approveProvider,
  rejectProvider,
  reviewComplianceDocument,
  startDrivingSchoolOnboarding,
  startInstructorOnboarding,
  submitProviderForReview,
  suspendProvider,
  uploadProviderComplianceDocument,
} from '../src/domain/provider-lifecycle-service';
import { AuthContext } from '../src/domain/rbac';
import { ComplianceDocument, ComplianceRequirement, Provider } from '../src/types';

describe('Sprint 04 — Providers & Compliance Domain Engine', () => {
  const studentContext: AuthContext = {
    userId: 'usr_student_123',
    email: 'candidato@mazzi.com.br',
    roles: ['STUDENT'],
    status: 'ACTIVE',
  };

  const otherStudentContext: AuthContext = {
    userId: 'usr_student_999',
    email: 'hacker@mazzi.com.br',
    roles: ['STUDENT'],
    status: 'ACTIVE',
  };

  const adminContext: AuthContext = {
    userId: 'usr_admin_ops',
    email: 'admin.ops@mazzi.com.br',
    roles: ['PLATFORM_ADMIN'],
    status: 'ACTIVE',
  };

  // ==========================================================================
  // 1. CPF VALIDATION & NORMALIZATION (FORMAT_AND_CHECK_DIGIT_VALIDATION)
  // ==========================================================================
  describe('1. CPF Normalization & Modulo 11 Validation', () => {
    it('normalizes CPF by removing masks, spaces, and punctuation', () => {
      expect(normalizeCpf(' 123.456.789-09 ')).toBe('12345678909');
      expect(normalizeCpf('12345678909')).toBe('12345678909');
    });

    it('validates a mathematically correct CPF and returns formatted representation', () => {
      const result = validateCpf('123.456.789-09');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('12345678909');
      expect(result.formatted).toBe('123.456.789-09');
      expect(result.classification).toBe('FORMAT_AND_CHECK_DIGIT_VALIDATION');
    });

    it('rejects CPF with invalid length', () => {
      const result = validateCpf('12345');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('11 dígitos');
    });

    it('rejects CPF with repeated identical digits (e.g. 111.111.111-11)', () => {
      const result = validateCpf('111.111.111-11');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('dígitos repetidos');
    });

    it('rejects CPF with incorrect check digits', () => {
      const result = validateCpf('123.456.789-99'); // Wrong check digits
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('dígito verificador');
    });
  });

  // ==========================================================================
  // 2. CNPJ VALIDATION & NORMALIZATION (LEGACY NUMERIC & ALPHANUMERIC RFB)
  // ==========================================================================
  describe('2. CNPJ Normalization & Modulo 11 Validation (Legacy Numeric & Alphanumeric RFB)', () => {
    it('normalizes CNPJ stripping special characters and converting to uppercase', () => {
      expect(normalizeCnpj(' 12.345.678/0001-95 ')).toBe('12345678000195');
      expect(normalizeCnpj('12abc345/0001-de')).toBe('12ABC3450001DE');
    });

    it('validates a valid Legacy Numeric CNPJ (e.g. Banco do Brasil 00.000.000/0001-91)', () => {
      const result = validateCnpj('00.000.000/0001-91');
      expect(result.isValid).toBe(true);
      expect(result.formatType).toBe('LEGACY_NUMERIC');
      expect(result.normalized).toBe('00000000000191');
      expect(result.formatted).toBe('00.000.000/0001-91');
    });

    it('validates a valid Alphanumeric CNPJ under RFB 2026 specification', () => {
      // Construct an alphanumeric CNPJ with calculated check digits:
      // Root & branch: '12ABC3450001'
      // Character values: 1(1), 2(2), A(17), B(18), C(19), 3(3), 4(4), 5(5), 0(0), 0(0), 0(0), 1(1)
      // DV1 weights: [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      // sum1 = 1*5 + 2*4 + 17*3 + 18*2 + 19*9 + 3*8 + 4*7 + 5*6 + 0 + 0 + 0 + 1*2
      //      = 5 + 8 + 51 + 36 + 171 + 24 + 28 + 30 + 0 + 0 + 0 + 2 = 355
      // rest1 = 355 % 11 = 3 -> dv1 = 11 - 3 = 8.
      // DV2 weights: [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      // sum2 = 1*6 + 2*5 + 17*4 + 18*3 + 19*2 + 3*9 + 4*8 + 5*7 + 0 + 0 + 0 + 1*3 + 8*2
      //      = 6 + 10 + 68 + 54 + 38 + 27 + 32 + 35 + 0 + 0 + 0 + 3 + 16 = 289
      // rest2 = 289 % 11 = 3 -> dv2 = 11 - 3 = 8.
      // Valid alphanumeric CNPJ: '12.ABC.345/0001-88'
      const result = validateCnpj('12.ABC.345/0001-88');
      expect(result.isValid).toBe(true);
      expect(result.formatType).toBe('ALPHANUMERIC');
      expect(result.normalized).toBe('12ABC345000188');
      expect(result.formatted).toBe('12.ABC.345/0001-88');
    });

    it('rejects CNPJ with invalid check digits', () => {
      const result = validateCnpj('12.345.678/0001-00'); // Wrong DVs
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('dígito verificador');
    });

    it('rejects CNPJ with non-numeric check digits', () => {
      const result = validateCnpj('12.ABC.345/0001-AB');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('estritamente numéricos');
    });

    it('rejects CNPJ with invalid length or identical repeated characters', () => {
      expect(validateCnpj('12345').isValid).toBe(false);
      expect(validateCnpj('AAAAAAAAAAAAAA').isValid).toBe(false);
      expect(validateCnpj('00000000000000').isValid).toBe(false);
    });
  });

  // ==========================================================================
  // 3. REGULATORY SOURCE CATALOG & VERSIONING ENGINE
  // ==========================================================================
  describe('3. Regulatory Sources, Jurisdiction & Versioning Engine', () => {
    it('contains exact statutory and administrative regulatory metadata for all requirements', () => {
      const earReq = DEFAULT_COMPLIANCE_REQUIREMENTS.find((r) => r.id === 'req_cnh_ear')!;
      expect(earReq.sourceType).toBe('FEDERAL_LAW');
      expect(earReq.sourceReference).toContain('Lei Federal nº 9.503/1997 (CTB), Art. 147, § 5º');
      expect(earReq.jurisdiction).toBe('FEDERAL');
      expect(earReq.regulatoryStatus).toBe('OFFICIALLY_VALIDATED');
      expect(earReq.lastValidatedAt).toBeDefined();

      const formacaoReq = DEFAULT_COMPLIANCE_REQUIREMENTS.find((r) => r.id === 'req_instrutor_formacao_fed')!;
      expect(formacaoReq.sourceType).toBe('FEDERAL_LAW');
      expect(formacaoReq.sourceReference).toContain('Lei Federal nº 12.302/2010, Art. 4º');
      expect(formacaoReq.sourceReference).toContain('Resolução CONTRAN nº 1.020/2025, Art. 110');
      expect(formacaoReq.jurisdiction).toBe('FEDERAL');
      expect(formacaoReq.regulatoryStatus).toBe('OFFICIALLY_VALIDATED');

      const antecedentesFedReq = DEFAULT_COMPLIANCE_REQUIREMENTS.find((r) => r.id === 'req_antecedentes_instrutor_fed')!;
      expect(antecedentesFedReq.sourceType).toBe('CONTRAN_RESOLUTION');
      expect(antecedentesFedReq.sourceReference).toContain('Resolução CONTRAN nº 1.020/2025, Art. 110');
      expect(antecedentesFedReq.jurisdiction).toBe('FEDERAL');
      expect(antecedentesFedReq.regulatoryStatus).toBe('OFFICIALLY_VALIDATED');

      const spCredReq = DEFAULT_COMPLIANCE_REQUIREMENTS.find((r) => r.id === 'req_credencial_detran_sp')!;
      expect(spCredReq.sourceType).toBe('DETRAN_STATE_REGULATION');
      expect(spCredReq.sourceReference).toContain('Portaria DETRAN-SP');
      expect(spCredReq.jurisdiction).toBe('STATE');
      expect(spCredReq.state).toBe('SP');
      expect(spCredReq.regulatoryStatus).toBe('REQUIRES_REGULATORY_VALIDATION');

      const cfcFedReq = DEFAULT_COMPLIANCE_REQUIREMENTS.find((r) => r.id === 'req_credenciamento_cfc_fed')!;
      expect(cfcFedReq.sourceType).toBe('CONTRAN_RESOLUTION');
      expect(cfcFedReq.sourceReference).toContain('Resolução CONTRAN nº 1.020/2025, Art. 118, Art. 119 e Art. 120');
      expect(cfcFedReq.jurisdiction).toBe('FEDERAL');

      const termoMazzi = DEFAULT_COMPLIANCE_REQUIREMENTS.find((r) => r.id === 'req_termo_conduta_mazzi')!;
      expect(termoMazzi.sourceType).toBe('INTERNAL_MAZZI_RULE');
      expect(termoMazzi.jurisdiction).toBe('INTERNAL_PLATFORM');
      expect(termoMazzi.sourceReference).toContain('Política de Confiança e Segurança MAZZI');
    });

    it('ensures every catalog requirement possesses a sourceReference and validated rules have lastValidatedAt', () => {
      DEFAULT_COMPLIANCE_REQUIREMENTS.forEach((req) => {
        expect(req.sourceReference).toBeDefined();
        expect(req.sourceReference.trim().length).toBeGreaterThan(0);
        if (req.regulatoryStatus === 'OFFICIALLY_VALIDATED') {
          expect(req.lastValidatedAt).toBeDefined();
        }
      });
    });

    it('filters out SUPERSEDED rules (e.g. CONTRAN 789/2020) from active query', () => {
      const historicalReq = DEFAULT_COMPLIANCE_REQUIREMENTS.find((r) => r.id === 'req_contran_789_historico')!;
      expect(historicalReq).toBeDefined();
      expect(historicalReq.regulatoryStatus).toBe('SUPERSEDED');

      const activeList = getComplianceRequirements({
        providerType: 'INSTRUCTOR',
        country: 'BR',
        state: 'SP',
      });
      expect(activeList.some((r) => r.id === 'req_contran_789_historico')).toBe(false);
    });

    it('keeps federal and state requirements separated without blending', () => {
      const spRequirements = getComplianceRequirements({
        providerType: 'INSTRUCTOR',
        state: 'SP',
        country: 'BR',
      });
      expect(spRequirements.some((r) => r.id === 'req_credencial_detran_sp')).toBe(true);

      const rjRequirements = getComplianceRequirements({
        providerType: 'INSTRUCTOR',
        state: 'RJ',
        country: 'BR',
      });
      // Should not contain SP-specific state requirement
      expect(rjRequirements.some((r) => r.id === 'req_credencial_detran_sp')).toBe(false);
      // But should contain Federal requirements
      expect(rjRequirements.some((r) => r.id === 'req_cnh_ear')).toBe(true);
      expect(rjRequirements.some((r) => r.id === 'req_instrutor_formacao_fed')).toBe(true);
    });

    it('guarantees INTERNAL_MAZZI_RULE is not presented as a statutory legal obligation', () => {
      const mazziRules = DEFAULT_COMPLIANCE_REQUIREMENTS.filter((r) => r.sourceType === 'INTERNAL_MAZZI_RULE');
      mazziRules.forEach((rule) => {
        expect(rule.jurisdiction).toBe('INTERNAL_PLATFORM');
        expect(rule.sourceType).not.toBe('FEDERAL_LAW');
        expect(rule.sourceType).not.toBe('CONTRAN_RESOLUTION');
      });
    });
  });

  // ==========================================================================
  // 4. STORAGE ACCESS SECURITY & ATTACK VECTOR DEFENSE
  // ==========================================================================
  describe('4. Storage Access Security & Multi-Tenant Isolation', () => {
    const validPath = 'providers/prov_instructor_1/compliance/doc_123/cnh_ear.pdf';

    it('ATTACK VECTOR A: Denies anonymous/unauthenticated access to compliance storage', () => {
      const decision = evaluateStorageAccess(validPath, { userId: undefined });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('UNAUTHENTICATED');
    });

    it('ATTACK VECTOR B: Denies Provider A from accessing Provider B compliance documents (IDOR / Multi-tenant isolation)', () => {
      const decision = evaluateStorageAccess(validPath, {
        userId: 'usr_attacker',
        userProviderId: 'prov_attacker_999',
        userRoles: ['INSTRUCTOR'],
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('FORBIDDEN_STORAGE_ACCESS');
    });

    it('ATTACK VECTOR C: Detects and blocks path traversal attempts', () => {
      const maliciousPath = 'providers/prov_1/compliance/../../../etc/passwd';
      const decision = evaluateStorageAccess(maliciousPath, {
        userId: 'usr_provider_1',
        userProviderId: 'prov_1',
      });
      expect(decision.allowed).toBe(false);
      expect(decision.code).toBe('INVALID_STORAGE_PATH');
    });

    it('Allows Provider owner to access their own compliance documents', () => {
      const decision = evaluateStorageAccess(validPath, {
        userId: 'usr_carlos',
        userProviderId: 'prov_instructor_1',
        userRoles: ['INSTRUCTOR'],
      });
      expect(decision.allowed).toBe(true);
      expect(decision.code).toBe('ALLOWED');
    });

    it('Allows Compliance Reviewer / Platform Admin to access documents for audit', () => {
      const decision = evaluateStorageAccess(validPath, {
        userId: 'usr_admin',
        userRoles: ['PLATFORM_ADMIN'],
        isReviewer: true,
      });
      expect(decision.allowed).toBe(true);
      expect(decision.code).toBe('ALLOWED');
    });
  });

  // ==========================================================================
  // 5. ONBOARDING & DRAFT CREATION
  // ==========================================================================
  describe('5. Onboarding & Draft Creation', () => {
    it('creates an Instructor draft with sanitized valid CPF and default DRAFT status', () => {
      const result = startInstructorOnboarding(
        {
          userId: studentContext.userId,
          displayName: 'Instrutor Carlos Silva',
          legalName: 'Carlos Alberto da Silva',
          cpf: '123.456.789-09',
          phone: '(11) 98765-4321',
          categories: ['B'],
          neighborhood: 'Pinheiros',
          city: 'São Paulo',
          state: 'SP',
          bio: 'Especialista em baliza e perda do medo de dirigir.',
        },
        studentContext
      );

      expect(result.provider.status).toBe('DRAFT');
      expect(result.provider.type).toBe('INSTRUCTOR');
      expect(result.provider.documentNumber).toBe('123.456.789-09');
      expect(result.provider.isVerified).toBe(false);
      expect(result.auditLogs).toHaveLength(1);
      expect(result.auditLogs[0].action).toBe('PROVIDER_CREATED');
    });

    it('creates a Driving School draft with sanitized valid CNPJ and default DRAFT status', () => {
      const result = startDrivingSchoolOnboarding(
        {
          userId: studentContext.userId,
          tradeName: 'Autoescola Modelo Paulista',
          legalName: 'Auto Escola Modelo Paulista Ltda ME',
          cnpj: '12.345.678/0001-95',
          phone: '(11) 3214-5678',
          categories: ['A', 'B'],
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        },
        studentContext
      );

      expect(result.provider.status).toBe('DRAFT');
      expect(result.provider.type).toBe('DRIVING_SCHOOL');
      expect(result.provider.documentNumber).toBe('12.345.678/0001-95');
      expect(result.auditLogs[0].action).toBe('PROVIDER_CREATED');
    });

    it('rejects invalid CPF and CNPJ with clear domain errors', () => {
      expect(() => sanitizeCpf('11111111111')).toThrow('dígitos repetidos');
      expect(() => sanitizeCpf('12345')).toThrow('11 dígitos');
      expect(() => sanitizeCnpj('12345678900000')).toThrow('dígito verificador');
    });

    it('blocks blocked users from starting onboarding', () => {
      const blockedUser: AuthContext = { ...studentContext, status: 'BLOCKED' };
      expect(() =>
        startInstructorOnboarding(
          {
            userId: blockedUser.userId,
            displayName: 'Instrutor Fraudulento',
            legalName: 'Nome Fraudulento',
            cpf: '123.456.789-09',
            phone: '11999999999',
            categories: ['B'],
            neighborhood: 'Centro',
            city: 'SP',
            state: 'SP',
          },
          blockedUser
        )
      ).toThrow('Usuário bloqueado');
    });
  });

  // ==========================================================================
  // 6. DOCUMENT UPLOAD & PRIVATE STORAGE PATH
  // ==========================================================================
  describe('6. Document Upload & File Validation', () => {
    it('generates secure private object storage paths and disallows public permanent URLs', () => {
      const path = generateComplianceStoragePath('prov_123', 'doc_456', 'Minha CNH EAR 2026.pdf');
      expect(path).toBe('providers/prov_123/compliance/doc_456/minha_cnh_ear_2026.pdf');
      expect(path).not.toContain('https://');
      expect(path).not.toContain('public');
    });

    it('validates file MIME types, sizes, and extensions strictly', () => {
      expect(() =>
        validateComplianceFile({
          filename: 'cnh.pdf',
          mimeType: 'application/pdf',
          sizeInBytes: 2 * 1024 * 1024,
        })
      ).not.toThrow();

      expect(() =>
        validateComplianceFile({
          filename: 'script.exe',
          mimeType: 'application/x-msdownload',
          sizeInBytes: 1024,
        })
      ).toThrow('Tipo de arquivo não permitido');
    });
  });

  // ==========================================================================
  // 7. ELIGIBILITY ENGINE: evaluateProviderEligibility
  // ==========================================================================
  describe('7. Eligibility Engine (evaluateProviderEligibility)', () => {
    const instructorProvider: Provider = {
      id: 'prov_inst_1',
      userId: 'usr_carlos',
      name: 'Carlos Silva',
      type: 'INSTRUCTOR',
      status: 'PENDING_REVIEW',
      ratingAverage: 0,
      ratingCount: 0,
      neighborhood: 'Pinheiros',
      city: 'São Paulo',
      state: 'SP',
      categories: ['B'],
      transmissions: ['MANUAL'],
      startingPriceInCents: 9000,
      isVerified: false,
    };

    const validCnh: ComplianceDocument = {
      id: 'doc_cnh',
      providerId: 'prov_inst_1',
      type: 'CNH_EAR',
      title: 'CNH EAR',
      status: 'APPROVED',
      fileName: 'cnh.pdf',
      storagePath: 'path/cnh.pdf',
      uploadedAt: '2026-08-14T10:00:00Z',
      expiresAt: '2030-01-01T00:00:00Z',
    };

    const validCredencial: ComplianceDocument = {
      id: 'doc_cred',
      providerId: 'prov_inst_1',
      type: 'CREDENTIAL_DETRAN',
      title: 'Credencial DETRAN',
      status: 'APPROVED',
      fileName: 'cred.pdf',
      storagePath: 'path/cred.pdf',
      uploadedAt: '2026-08-14T10:00:00Z',
      expiresAt: '2028-01-01T00:00:00Z',
    };

    const validAntecedentes: ComplianceDocument = {
      id: 'doc_ant',
      providerId: 'prov_inst_1',
      type: 'CRIMINAL_BACKGROUND',
      title: 'Certidão Antecedentes',
      status: 'APPROVED',
      fileName: 'ant.pdf',
      storagePath: 'path/ant.pdf',
      uploadedAt: '2026-08-14T10:00:00Z',
      expiresAt: '2026-11-14T00:00:00Z',
    };

    const validCredencialSp: ComplianceDocument = {
      id: 'doc_cred_sp',
      providerId: 'prov_inst_1',
      type: 'CREDENTIAL_DETRAN_SP',
      title: 'Credencial DETRAN-SP',
      status: 'APPROVED',
      fileName: 'cred_sp.pdf',
      storagePath: 'path/cred_sp.pdf',
      uploadedAt: '2026-08-14T10:00:00Z',
      expiresAt: '2028-01-01T00:00:00Z',
    };

    const validTermoMazzi: ComplianceDocument = {
      id: 'doc_termo',
      providerId: 'prov_inst_1',
      type: 'MAZZI_TERMS_ACCEPTANCE',
      title: 'Termo de Conduta MAZZI',
      status: 'APPROVED',
      fileName: 'termo.pdf',
      storagePath: 'path/termo.pdf',
      uploadedAt: '2026-08-14T10:00:00Z',
    };

    it('declares eligible when all mandatory requirements are approved and valid', () => {
      const result = evaluateProviderEligibility(
        instructorProvider,
        [validCnh, validCredencial, validAntecedentes, validCredencialSp, validTermoMazzi],
        DEFAULT_COMPLIANCE_REQUIREMENTS,
        new Date('2026-08-15T00:00:00Z')
      );

      expect(result.isEligible).toBe(true);
      expect(result.missingRequirements).toHaveLength(0);
      expect(result.rejectedDocuments).toHaveLength(0);
      expect(result.expiredDocuments).toHaveLength(0);
    });

    it('declares ineligible if any mandatory document is missing', () => {
      const result = evaluateProviderEligibility(
        instructorProvider,
        [validCnh, validCredencial, validCredencialSp, validTermoMazzi],
        DEFAULT_COMPLIANCE_REQUIREMENTS
      );

      expect(result.isEligible).toBe(false);
      expect(result.missingRequirements).toHaveLength(1);
      expect(result.missingRequirements[0].documentType).toBe('CRIMINAL_BACKGROUND');
    });

    it('declares ineligible if a document is rejected', () => {
      const rejectedCnh: ComplianceDocument = {
        ...validCnh,
        status: 'REJECTED',
        rejectionReason: 'Falta anotação EAR',
      };

      const result = evaluateProviderEligibility(
        instructorProvider,
        [rejectedCnh, validCredencial, validAntecedentes, validCredencialSp, validTermoMazzi],
        DEFAULT_COMPLIANCE_REQUIREMENTS
      );

      expect(result.isEligible).toBe(false);
      expect(result.rejectedDocuments).toHaveLength(1);
      expect(result.ineligibilityReasons.join(' ')).toContain('rejeitado');
    });
  });

  // ==========================================================================
  // 8. APPROVAL & ROLE ELEVATION
  // ==========================================================================
  describe('8. Provider Approval, Role Elevation & Verification Transparency', () => {
    const pendingProvider: Provider = {
      id: 'prov_pending_1',
      userId: 'usr_instructor_candidate',
      name: 'Carlos Alberto Silva',
      type: 'INSTRUCTOR',
      status: 'PENDING_REVIEW',
      ratingAverage: 0,
      ratingCount: 0,
      neighborhood: 'Pinheiros',
      city: 'São Paulo',
      state: 'SP',
      categories: ['B'],
      transmissions: ['MANUAL'],
      startingPriceInCents: 9000,
      isVerified: false,
    };

    const approvedDocs: ComplianceDocument[] = [
      {
        id: 'doc_1',
        providerId: 'prov_pending_1',
        type: 'CNH_EAR',
        title: 'CNH EAR',
        status: 'APPROVED',
        fileName: 'cnh.pdf',
        storagePath: 'path/cnh.pdf',
        uploadedAt: '2026-08-14T10:00:00Z',
        expiresAt: '2030-01-01T00:00:00Z',
      },
      {
        id: 'doc_2',
        providerId: 'prov_pending_1',
        type: 'CREDENTIAL_DETRAN',
        title: 'Credencial DETRAN',
        status: 'APPROVED',
        fileName: 'cred.pdf',
        storagePath: 'path/cred.pdf',
        uploadedAt: '2026-08-14T10:00:00Z',
        expiresAt: '2028-01-01T00:00:00Z',
      },
      {
        id: 'doc_3',
        providerId: 'prov_pending_1',
        type: 'CRIMINAL_BACKGROUND',
        title: 'Antecedentes',
        status: 'APPROVED',
        fileName: 'ant.pdf',
        storagePath: 'path/ant.pdf',
        uploadedAt: '2026-08-14T10:00:00Z',
        expiresAt: '2026-11-14T00:00:00Z',
      },
      {
        id: 'doc_4',
        providerId: 'prov_pending_1',
        type: 'CREDENTIAL_DETRAN_SP',
        title: 'Credencial DETRAN-SP',
        status: 'APPROVED',
        fileName: 'cred_sp.pdf',
        storagePath: 'path/cred_sp.pdf',
        uploadedAt: '2026-08-14T10:00:00Z',
        expiresAt: '2028-01-01T00:00:00Z',
      },
      {
        id: 'doc_5',
        providerId: 'prov_pending_1',
        type: 'MAZZI_TERMS_ACCEPTANCE',
        title: 'Termo de Conduta MAZZI',
        status: 'APPROVED',
        fileName: 'termo.pdf',
        storagePath: 'path/termo.pdf',
        uploadedAt: '2026-08-14T10:00:00Z',
      },
    ];

    it('approves an eligible provider, transitions status to ACTIVE and promotes role to INSTRUCTOR', () => {
      const result = approveProvider(pendingProvider, adminContext, approvedDocs);

      expect(result.provider.status).toBe('ACTIVE');
      expect(result.provider.isVerified).toBe(true);
      expect(result.provider.approvedBy).toBe(adminContext.userId);
      expect(result.promotedRoles).toContain('INSTRUCTOR');
      expect(result.auditLogs).toHaveLength(2);
    });

    it('provides clear transparency disclaimer on verification badge tooltip', () => {
      const tooltip = getVerificationBadgeTooltip();
      expect(tooltip).toContain('Não constitui homologação ou credenciamento governamental direto');
      expect(tooltip).toContain('regras internas de compliance');
    });
  });

  // ==========================================================================
  // 9. DATA BOUNDARY & PRIVACY PROJECTION
  // ==========================================================================
  describe('9. Data Boundary & Privacy Projection', () => {
    it('sanitizes public provider profile by masking private data (CPF/CNPJ, address, internal phone)', () => {
      const privateProvider: Provider = {
        id: 'prov_secure_1',
        userId: 'usr_private_1',
        name: 'Carlos Alberto Silva',
        legalName: 'Carlos Alberto da Silva Filgueiras',
        documentNumber: '123.456.789-09',
        phone: '(11) 98765-4321',
        type: 'INSTRUCTOR',
        status: 'ACTIVE',
        ratingAverage: 4.9,
        ratingCount: 50,
        neighborhood: 'Pinheiros',
        city: 'São Paulo',
        state: 'SP',
        serviceRadiusKm: 6,
        latitude: -23.5615,
        longitude: -46.6560,
        categories: ['B'],
        transmissions: ['MANUAL'],
        startingPriceInCents: 9500,
        isVerified: true,
      };

      const publicProfile = toPublicProviderProfile(privateProvider);

      expect(publicProfile.id).toBe('prov_secure_1');
      expect(publicProfile.displayName).toBe('Carlos Alberto Silva');
      expect(publicProfile.isVerified).toBe(true);
      expect(publicProfile.serviceAreaDescription).toContain('Pinheiros, São Paulo');

      expect((publicProfile as any).documentNumber).toBeUndefined();
      expect((publicProfile as any).legalName).toBeUndefined();
      expect((publicProfile as any).phone).toBeUndefined();
    });
  });
});
