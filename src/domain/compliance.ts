// ============================================================================
// MAZZI PLATFORM — SPRINT 04: COMPLIANCE DOMAIN, REGULATORY SOURCES & ELIGIBILITY ENGINE
// File: src/domain/compliance.ts
// ============================================================================

import {
  ComplianceDocument,
  ComplianceRequirement,
  DocumentStatus,
  JurisdictionLevel,
  Provider,
  ProviderType,
  RegulatorySourceType,
  RegulatoryValidationStatus,
  VehicleCategory,
} from '../types';

export class ComplianceDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ComplianceDomainError';
  }
}

/**
 * REGULATORY BASELINE SNAPSHOT DATE
 * Represents the date of last statutory validation of national and state legal sources.
 */
export const REGULATORY_BASELINE_DATE = '2026-08-14';

/**
 * DEFAULT COMPLIANCE REQUIREMENTS CATALOG
 * Differentiated by country, jurisdiction, provider type, legal source, and versioning.
 * 
 * Regra Arquitetural: Requisitos nunca devem atribuir genericamente a Lei Federal
 * o que é regulamento estadual ou política interna de segurança da MAZZI.
 */
export const DEFAULT_COMPLIANCE_REQUIREMENTS: ComplianceRequirement[] = [
  // --- INSTRUCTOR REQUIREMENTS (INSTRUCTOR) ---
  {
    id: 'req_cnh_ear',
    country: 'BR',
    jurisdiction: 'FEDERAL',
    providerType: 'INSTRUCTOR',
    documentType: 'CNH_EAR',
    title: 'Anotação de Exerce Atividade Remunerada (EAR)',
    description: 'Anotação oficial de Exerce Atividade Remunerada (EAR) na CNH do instrutor, requisito estritamente independente da compatibilidade de categoria da aula (CTB, Art. 147, § 5º).',
    isMandatory: true,
    sourceType: 'FEDERAL_LAW',
    sourceReference: 'Lei Federal nº 9.503/1997 (CTB), Art. 147, § 5º',
    sourceIdentifier: 'LEI_9503_ART147_PAR5_EAR',
    regulatoryStatus: 'OFFICIALLY_VALIDATED',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    validityPeriodDays: 1825, // 5 anos padrão
    effectiveFrom: '2026-01-01T00:00:00Z',
  },
  {
    id: 'req_instrutor_formacao_fed',
    country: 'BR',
    jurisdiction: 'FEDERAL',
    providerType: 'INSTRUCTOR',
    documentType: 'CREDENTIAL_DETRAN',
    title: 'Certificado e Requisitos Profissionais de Instrutor de Trânsito',
    description: 'Comprovação de curso de formação e atendimento aos requisitos profissionais de instrutor de trânsito conforme art. 4º da Lei nº 12.302/2010 e art. 110 da Resolução CONTRAN nº 1.020/2025.',
    isMandatory: true,
    sourceType: 'FEDERAL_LAW',
    sourceReference: 'Lei Federal nº 12.302/2010, Art. 4º e Resolução CONTRAN nº 1.020/2025, Art. 110',
    sourceIdentifier: 'LEI_12302_ART4_CONTRAN_1020_ART110',
    regulatoryStatus: 'OFFICIALLY_VALIDATED',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    validityPeriodDays: 730, // 2 anos
    effectiveFrom: '2026-01-01T00:00:00Z',
  },
  {
    id: 'req_antecedentes_instrutor_fed',
    country: 'BR',
    jurisdiction: 'FEDERAL',
    providerType: 'INSTRUCTOR',
    documentType: 'CRIMINAL_BACKGROUND',
    title: 'Certidão Negativa de Antecedentes Criminais (Requisito Regulatório Federal)',
    description: 'Certidão negativa de antecedentes criminais exigida para o exercício da profissão de instrutor de trânsito conforme art. 110 da Resolução CONTRAN nº 1.020/2025 e art. 4º, VI da Lei nº 12.302/2010.',
    isMandatory: true,
    sourceType: 'CONTRAN_RESOLUTION',
    sourceReference: 'Resolução CONTRAN nº 1.020/2025, Art. 110 e Lei Federal nº 12.302/2010, Art. 4º, VI',
    sourceIdentifier: 'CONTRAN_1020_ART110_ANTECEDENTES',
    regulatoryStatus: 'OFFICIALLY_VALIDATED',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    validityPeriodDays: 90,
    effectiveFrom: '2026-01-01T00:00:00Z',
  },
  {
    id: 'req_credencial_detran_sp',
    country: 'BR',
    state: 'SP',
    jurisdiction: 'STATE',
    providerType: 'INSTRUCTOR',
    documentType: 'CREDENTIAL_DETRAN_SP',
    title: 'Credenciamento e Cadastro Operacional no DETRAN-SP',
    description: 'Registro e credenciamento ativo no cadastro operacional do DETRAN-SP conforme portarias estaduais de regulação.',
    isMandatory: true,
    sourceType: 'DETRAN_STATE_REGULATION',
    sourceReference: 'Portaria DETRAN-SP de Credenciamento e Cadastro Operacional de Instrutores',
    sourceIdentifier: 'DETRAN_SP_PORTARIA_INSTRUTOR',
    regulatoryStatus: 'REQUIRES_REGULATORY_VALIDATION',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    validityPeriodDays: 730,
    effectiveFrom: '2026-01-01T00:00:00Z',
  },
  {
    id: 'req_contran_789_historico',
    country: 'BR',
    jurisdiction: 'FEDERAL',
    providerType: 'INSTRUCTOR',
    documentType: 'CREDENTIAL_HISTORICAL',
    title: 'Regulamentação Histórica de Instrutores (CONTRAN 789/2020)',
    description: 'Normativa histórica de credenciamento superada e consolidada pela Resolução CONTRAN nº 1.020/2025 (Arts. 109-111).',
    isMandatory: false,
    sourceType: 'CONTRAN_RESOLUTION',
    sourceReference: 'Resolução CONTRAN nº 789/2020 (Superada pela Resolução CONTRAN nº 1.020/2025)',
    sourceIdentifier: 'CONTRAN_789_2020_SUPERSEDED',
    regulatoryStatus: 'SUPERSEDED',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    effectiveFrom: '2020-06-01T00:00:00Z',
    effectiveTo: '2025-12-31T23:59:59Z',
  },
  {
    id: 'req_termo_conduta_mazzi',
    country: 'BR',
    jurisdiction: 'INTERNAL_PLATFORM',
    providerType: 'INSTRUCTOR',
    documentType: 'MAZZI_TERMS_ACCEPTANCE',
    title: 'Código de Ética e Segurança da Plataforma MAZZI',
    description: 'Termo de adesão às diretrizes de qualidade, assiduidade e conduta profissional do marketplace MAZZI (norma comercial e de integridade interna, sem natureza de obrigação legal).',
    isMandatory: true,
    sourceType: 'INTERNAL_MAZZI_RULE',
    sourceReference: 'Política de Confiança e Segurança MAZZI v1.0 (Regra Interna de Marketplace)',
    sourceIdentifier: 'MAZZI_SAFETY_POLICY_SEC_2',
    regulatoryStatus: 'REQUIRES_REGULATORY_VALIDATION',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    effectiveFrom: '2026-01-01T00:00:00Z',
  },

  // --- DRIVING SCHOOL (CFC) REQUIREMENTS ---
  {
    id: 'req_cnpj_contrato_fed',
    country: 'BR',
    jurisdiction: 'FEDERAL',
    providerType: 'DRIVING_SCHOOL',
    documentType: 'COMPANY_REGISTRATION',
    title: 'Comprovante de Inscrição CNPJ e Atos Constitutivos',
    description: 'Comprovante de Inscrição e de Situação Cadastral no CNPJ e registro dos atos constitutivos na Junta Comercial.',
    isMandatory: true,
    sourceType: 'FEDERAL_LAW',
    sourceReference: 'Lei Federal nº 10.406/2002 (Código Civil, Art. 985 e Art. 1.150) e Instrução Normativa RFB nº 2.119/2022',
    sourceIdentifier: 'CC_LEI_10406_IN_RFB_2119',
    regulatoryStatus: 'OFFICIALLY_VALIDATED',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    validityPeriodDays: undefined, // Sem expiração intrínseca
    effectiveFrom: '2026-01-01T00:00:00Z',
  },
  {
    id: 'req_credenciamento_cfc_fed',
    country: 'BR',
    jurisdiction: 'FEDERAL',
    providerType: 'DRIVING_SCHOOL',
    documentType: 'CFC_AUTHORIZATION',
    title: 'Diretrizes Federais de Credenciamento de CFC (CONTRAN)',
    description: 'Requisitos e diretrizes federais de credenciamento e funcionamento de Centro de Formação de Condutores conforme a Resolução CONTRAN nº 1.020/2025, especificamente Arts. 118, 119 e 120.',
    isMandatory: true,
    sourceType: 'CONTRAN_RESOLUTION',
    sourceReference: 'Resolução CONTRAN nº 1.020/2025, Art. 118, Art. 119 e Art. 120',
    sourceIdentifier: 'CONTRAN_1020_ARTS_118_120',
    regulatoryStatus: 'OFFICIALLY_VALIDATED',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    effectiveFrom: '2026-01-01T00:00:00Z',
  },
  {
    id: 'req_portaria_cfc_sp',
    country: 'BR',
    state: 'SP',
    jurisdiction: 'STATE',
    providerType: 'DRIVING_SCHOOL',
    documentType: 'CFC_AUTHORIZATION_STATE',
    title: 'Portaria de Credenciamento de CFC no DETRAN-SP',
    description: 'Ato de credenciamento operacional e autorização de funcionamento expedido pelo DETRAN-SP conforme delegado pelo Art. 120 da Resolução CONTRAN nº 1.020/2025.',
    isMandatory: true,
    sourceType: 'DETRAN_STATE_REGULATION',
    sourceReference: 'Portaria DETRAN-SP de Credenciamento de CFC e Art. 120 da Resolução CONTRAN nº 1.020/2025',
    sourceIdentifier: 'DETRAN_SP_PORTARIA_CFC',
    regulatoryStatus: 'REQUIRES_REGULATORY_VALIDATION',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    validityPeriodDays: 365, // Renovação anual
    effectiveFrom: '2026-01-01T00:00:00Z',
  },
  {
    id: 'req_alvara_funcionamento_mun',
    country: 'BR',
    state: 'SP',
    jurisdiction: 'MUNICIPAL',
    providerType: 'DRIVING_SCHOOL',
    documentType: 'CFC_ALVARA',
    title: 'Alvará Municipal de Funcionamento e Localização',
    description: 'Alvará municipal vigente emitido pela Prefeitura Municipal da sede do CFC.',
    isMandatory: true,
    sourceType: 'MUNICIPAL_REGULATION',
    sourceReference: 'Lei Municipal de Uso e Ocupação do Solo / Código de Posturas Municipal',
    sourceIdentifier: 'ALVARA_POSTURAS_MUNICIPAL',
    regulatoryStatus: 'REQUIRES_REGULATORY_VALIDATION',
    lastValidatedAt: '2026-08-14T00:00:00Z',
    validityPeriodDays: 365,
    effectiveFrom: '2026-01-01T00:00:00Z',
  },
];

export interface ComplianceRequirementFilter {
  providerType: ProviderType;
  country?: string;
  state?: string;
  jurisdiction?: JurisdictionLevel;
  category?: VehicleCategory;
  referenceDate?: Date;
  includeInactive?: boolean;
}

/**
 * Queries and filters compliance requirements based on jurisdiction, state, category and active temporal window.
 * Avoids hardcoding SP rules into the national domain engine.
 */
export function getComplianceRequirements(
  filter: ComplianceRequirementFilter,
  catalog: ComplianceRequirement[] = DEFAULT_COMPLIANCE_REQUIREMENTS
): ComplianceRequirement[] {
  const refTime = (filter.referenceDate || new Date()).getTime();
  const country = filter.country || 'BR';

  return catalog.filter((req) => {
    // Check provider type
    if (req.providerType !== filter.providerType) {
      return false;
    }
    // Check country
    if (req.country !== country) {
      return false;
    }
    // Check jurisdiction & state
    if (req.jurisdiction === 'STATE' && filter.state && req.state && req.state !== filter.state) {
      return false;
    }
    if (filter.jurisdiction && req.jurisdiction !== filter.jurisdiction) {
      return false;
    }
    // Check vehicle category if specified
    if (req.category && filter.category && req.category !== filter.category) {
      return false;
    }
    // Check inactive or superseded unless requested
    if (!filter.includeInactive && (req.regulatoryStatus === 'INACTIVE' || req.regulatoryStatus === 'SUPERSEDED')) {
      return false;
    }
    // Check temporal window
    const effectiveFromTime = new Date(req.effectiveFrom).getTime();
    if (refTime < effectiveFromTime) {
      return false;
    }
    if (req.effectiveTo) {
      const effectiveToTime = new Date(req.effectiveTo).getTime();
      if (refTime > effectiveToTime) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Evaluates whether a compliance document is expired as of a given timestamp
 */
export function isComplianceDocumentExpired(
  doc: ComplianceDocument,
  referenceDate: Date = new Date()
): boolean {
  if (!doc.expiresAt) {
    return false;
  }
  const expiry = new Date(doc.expiresAt);
  return expiry.getTime() < referenceDate.getTime();
}

/**
 * Secure Storage Path Generator
 * Prevents object collision and ensures private directory segmentation.
 * Path pattern: providers/{providerId}/compliance/{documentId}/{sanitizedFilename}
 */
export function generateComplianceStoragePath(
  providerId: string,
  documentId: string,
  rawFilename: string
): string {
  if (!providerId || !documentId) {
    throw new ComplianceDomainError(
      'ProviderId e DocumentId são obrigatórios para geração de storage path.',
      'INVALID_STORAGE_PATH_PARAMS'
    );
  }
  // Sanitize filename removing dangerous chars or path traversals
  const sanitized = rawFilename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase()
    .replace(/_{2,}/g, '_');

  return `providers/${providerId}/compliance/${documentId}/${sanitized}`;
}

export interface StorageAccessContext {
  userId?: string;
  userRoles?: string[];
  userProviderId?: string; // Provider owned by the current user (if any)
  isReviewer?: boolean;
}

export interface StorageAccessDecision {
  allowed: boolean;
  code: 'ALLOWED' | 'UNAUTHENTICATED' | 'FORBIDDEN_STORAGE_ACCESS' | 'INVALID_STORAGE_PATH';
  reason?: string;
}

/**
 * Evaluates storage authorization for private compliance documents.
 * Enforces multi-tenant isolation and prevents path traversal / provider tampering.
 */
export function evaluateStorageAccess(
  storagePath: string,
  context: StorageAccessContext
): StorageAccessDecision {
  if (!context.userId) {
    return {
      allowed: false,
      code: 'UNAUTHENTICATED',
      reason: 'Acesso anônimo a documentos de compliance é estritamente proibido.',
    };
  }

  // Path format validation: providers/{providerId}/compliance/{documentId}/{filename}
  const pathParts = storagePath.split('/');
  if (
    pathParts.length < 5 ||
    pathParts[0] !== 'providers' ||
    pathParts[2] !== 'compliance' ||
    pathParts.some((p) => p.includes('..') || p.includes('\\') || !p.trim())
  ) {
    return {
      allowed: false,
      code: 'INVALID_STORAGE_PATH',
      reason: 'Caminho de armazenamento inválido ou tentativa de path traversal detectada.',
    };
  }

  const targetProviderId = pathParts[1];

  // Reviewers (Admins/Support) are allowed to access for compliance audit
  if (context.isReviewer || context.userRoles?.includes('PLATFORM_ADMIN') || context.userRoles?.includes('SUPPORT')) {
    return {
      allowed: true,
      code: 'ALLOWED',
    };
  }

  // Providers can ONLY access files residing inside their own provider folder
  if (context.userProviderId && context.userProviderId === targetProviderId) {
    return {
      allowed: true,
      code: 'ALLOWED',
    };
  }

  return {
    allowed: false,
    code: 'FORBIDDEN_STORAGE_ACCESS',
    reason: 'Usuário não possui autorização para acessar documentos deste prestador.',
  };
}

/**
 * File validation parameters
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface FileValidationInput {
  filename: string;
  mimeType: string;
  sizeInBytes: number;
}

/**
 * Interface prepared for future deep inspection (e.g. Magic Bytes / AntiVirus Scan).
 * NOTA TÉCNICA: O MIME-Type e a extensão declarados pelo browser são apenas validações prévias
 * e NÃO constituem prova definitiva do tipo ou segurança do arquivo.
 */
export interface FileSecurityScanner {
  scan(fileBuffer: ArrayBuffer | Uint8Array, declaredMimeType: string): Promise<{
    isClean: boolean;
    detectedMimeType: string;
    threatsDetected?: string[];
  }>;
}

/**
 * Validates uploaded file MIME, size and extension
 */
export function validateComplianceFile(input: FileValidationInput): void {
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType.toLowerCase())) {
    throw new ComplianceDomainError(
      `Tipo de arquivo não permitido (${input.mimeType}). Formatos aceitos: PDF, JPEG, PNG, WEBP.`,
      'INVALID_FILE_TYPE',
      415
    );
  }

  if (input.sizeInBytes <= 0) {
    throw new ComplianceDomainError('O arquivo enviado está vazio.', 'EMPTY_FILE', 400);
  }

  if (input.sizeInBytes > MAX_FILE_SIZE_BYTES) {
    throw new ComplianceDomainError(
      `O arquivo excede o limite máximo permitido de 10MB (tamanho enviado: ${(input.sizeInBytes / (1024 * 1024)).toFixed(2)}MB).`,
      'FILE_TOO_LARGE',
      413
    );
  }

  const extension = input.filename.split('.').pop()?.toLowerCase();
  const validExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
  if (!extension || !validExtensions.includes(extension)) {
    throw new ComplianceDomainError(
      `Extensão de arquivo inválida (.${extension || 'desconhecida'}).`,
      'INVALID_FILE_EXTENSION',
      400
    );
  }
}

export interface ProviderEligibilityResult {
  isEligible: boolean;
  providerId: string;
  providerType: ProviderType;
  mandatoryRequirementsCount: number;
  approvedCount: number;
  missingRequirements: ComplianceRequirement[];
  rejectedDocuments: ComplianceDocument[];
  expiredDocuments: ComplianceDocument[];
  pendingDocuments: ComplianceDocument[];
  approvedDocuments: ComplianceDocument[];
  ineligibilityReasons: string[];
}

/**
 * CENTRAL ELIGIBILITY ENGINE: evaluateProviderEligibility
 * Evaluates whether a Provider satisfies all mandatory compliance requirements to become or remain ACTIVE.
 */
export function evaluateProviderEligibility(
  provider: Provider,
  documents: ComplianceDocument[],
  requirements: ComplianceRequirement[] = DEFAULT_COMPLIANCE_REQUIREMENTS,
  referenceDate: Date = new Date()
): ProviderEligibilityResult {
  // Use state & jurisdiction filtered active requirements
  const activeRequirements = getComplianceRequirements(
    {
      providerType: provider.type,
      state: provider.state || 'SP',
      country: 'BR',
      referenceDate,
      includeInactive: false,
    },
    requirements
  );

  const providerReqs = activeRequirements.filter((r) => r.isMandatory);

  const missingRequirements: ComplianceRequirement[] = [];
  const rejectedDocuments: ComplianceDocument[] = [];
  const expiredDocuments: ComplianceDocument[] = [];
  const pendingDocuments: ComplianceDocument[] = [];
  const approvedDocuments: ComplianceDocument[] = [];
  const ineligibilityReasons: string[] = [];

  // Categorize submitted documents
  for (const doc of documents) {
    if (doc.providerId !== provider.id) {
      continue;
    }

    if (isComplianceDocumentExpired(doc, referenceDate)) {
      expiredDocuments.push(doc);
      ineligibilityReasons.push(`Documento '${doc.title}' está vencido (expirou em ${doc.expiresAt}).`);
    } else if (doc.status === 'REJECTED') {
      rejectedDocuments.push(doc);
      ineligibilityReasons.push(`Documento '${doc.title}' foi rejeitado: ${doc.rejectionReason || 'Correção necessária'}.`);
    } else if (doc.status === 'PENDING' || doc.status === 'UNDER_REVIEW') {
      pendingDocuments.push(doc);
      ineligibilityReasons.push(`Documento '${doc.title}' ainda está em análise.`);
    } else if (doc.status === 'APPROVED') {
      approvedDocuments.push(doc);
    }
  }

  // Check that every mandatory requirement has an active, approved document
  for (const req of providerReqs) {
    const hasApproved = approvedDocuments.some(
      (doc) => doc.type === req.documentType && !isComplianceDocumentExpired(doc, referenceDate)
    );

    if (!hasApproved) {
      missingRequirements.push(req);
      const isPending = pendingDocuments.some((doc) => doc.type === req.documentType);
      const isRejected = rejectedDocuments.some((doc) => doc.type === req.documentType);

      if (!isPending && !isRejected) {
        ineligibilityReasons.push(`Requisito obrigatório não enviado: '${req.title}'.`);
      }
    }
  }

  const isEligible =
    missingRequirements.length === 0 &&
    rejectedDocuments.length === 0 &&
    expiredDocuments.length === 0 &&
    pendingDocuments.length === 0 &&
    approvedDocuments.length >= providerReqs.length;

  return {
    isEligible,
    providerId: provider.id,
    providerType: provider.type,
    mandatoryRequirementsCount: providerReqs.length,
    approvedCount: approvedDocuments.length,
    missingRequirements,
    rejectedDocuments,
    expiredDocuments,
    pendingDocuments,
    approvedDocuments,
    ineligibilityReasons,
  };
}

/**
 * Explains verification badge semantics for compliance transparency.
 * Explicitly states that verification means MAZZI internal platform criteria check,
 * and does NOT represent governmental certification unless officially validated.
 */
export function getVerificationBadgeTooltip(): string {
  return 'Selo "Verificado pela MAZZI": Atesta conformidade exclusiva com as regras internas de compliance e segurança da plataforma MAZZI. Não constitui homologação ou credenciamento governamental direto pelo DETRAN/SENATRAN.';
}
