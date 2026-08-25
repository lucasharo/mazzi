// ============================================================================
// MAZZI PLATFORM — SPRINT 04: PROVIDER ONBOARDING & LIFECYCLE SERVICE
// File: src/domain/provider-lifecycle-service.ts
// ============================================================================

import {
  AuditLog,
  ComplianceDocument,
  ComplianceRequirement,
  DocumentStatus,
  Provider,
  User,
  UserRole,
} from '../types';
import { AuthContext, hasPermission, isPlatformAdmin } from './rbac';
import {
  ComplianceDomainError,
  DEFAULT_COMPLIANCE_REQUIREMENTS,
  evaluateProviderEligibility,
  generateComplianceStoragePath,
  validateComplianceFile,
} from './compliance';
import {
  createDrivingSchoolDraftModel,
  createInstructorDraftModel,
  DrivingSchoolDraftInput,
  InstructorDraftInput,
  ProviderDomainError,
  validateProviderStatusTransition,
} from './providers';

export interface ProviderLifecycleEventResult {
  provider: Provider;
  auditLogs: AuditLog[];
  promotedRoles?: UserRole[];
}

export interface DocumentReviewResult {
  document: ComplianceDocument;
  auditLog: AuditLog;
}

/**
 * Creates an AuditLog entry
 */
function createAuditEntry(
  actor: AuthContext | User,
  action: string,
  entityType: string,
  entityId: string,
  prevValue?: string,
  newValue?: string
): AuditLog {
  const actorId = 'userId' in actor ? actor.userId : actor.id;
  const actorName = 'email' in actor ? actor.email : 'Sistema Mazzi';
  const actorRole: UserRole = 'roles' in actor ? actor.roles[0] : (actor as User).role;

  return {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    actorId,
    actorName,
    actorRole,
    action,
    entityType,
    entityId,
    previousValue: prevValue,
    newValue: newValue,
    timestamp: new Date().toISOString(),
    ipAddress: '127.0.0.1',
  };
}

/**
 * 1. INSTRUCTOR ONBOARDING: Creates DRAFT Instructor Provider
 */
export function startInstructorOnboarding(
  input: InstructorDraftInput,
  actor: AuthContext
): ProviderLifecycleEventResult {
  if (actor.status === 'BLOCKED') {
    throw new ProviderDomainError('Usuário bloqueado não pode criar cadastros.', 'USER_BLOCKED', 403);
  }

  const provider = createInstructorDraftModel(input);
  const audit = createAuditEntry(
    actor,
    'PROVIDER_CREATED',
    'Provider',
    provider.id,
    undefined,
    JSON.stringify({ type: provider.type, status: provider.status })
  );

  return {
    provider,
    auditLogs: [audit],
  };
}

/**
 * 2. DRIVING SCHOOL ONBOARDING: Creates DRAFT Driving School Provider
 */
export function startDrivingSchoolOnboarding(
  input: DrivingSchoolDraftInput,
  actor: AuthContext
): ProviderLifecycleEventResult {
  if (actor.status === 'BLOCKED') {
    throw new ProviderDomainError('Usuário bloqueado não pode criar cadastros.', 'USER_BLOCKED', 403);
  }

  const provider = createDrivingSchoolDraftModel(input);
  const audit = createAuditEntry(
    actor,
    'PROVIDER_CREATED',
    'Provider',
    provider.id,
    undefined,
    JSON.stringify({ type: provider.type, status: provider.status })
  );

  return {
    provider,
    auditLogs: [audit],
  };
}

/**
 * 3. UPLOADS COMPLIANCE DOCUMENT
 */
export function uploadProviderComplianceDocument(
  provider: Provider,
  docType: string,
  title: string,
  fileMeta: { filename: string; mimeType: string; sizeInBytes: number },
  actor: AuthContext
): { document: ComplianceDocument; auditLog: AuditLog } {
  if (actor.status === 'BLOCKED') {
    throw new ComplianceDomainError('Usuário bloqueado não pode enviar documentos.', 'USER_BLOCKED', 403);
  }
  if (provider.userId !== actor.userId && !isPlatformAdmin(actor)) {
    throw new ComplianceDomainError(
      'Não é permitido enviar documentos para o cadastro de outro prestador.',
      'FORBIDDEN_PROVIDER_ACCESS',
      403
    );
  }

  validateComplianceFile(fileMeta);

  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const storagePath = generateComplianceStoragePath(provider.id, docId, fileMeta.filename);
  const now = new Date().toISOString();

  const document: ComplianceDocument = {
    id: docId,
    providerId: provider.id,
    providerName: provider.name,
    userId: actor.userId,
    type: docType,
    title,
    status: 'IN_REVIEW',
    fileName: fileMeta.filename,
    storagePath,
    fileSize: fileMeta.sizeInBytes,
    mimeType: fileMeta.mimeType,
    uploadedAt: now,
  };

  const auditLog = createAuditEntry(
    actor,
    'COMPLIANCE_DOCUMENT_UPLOADED',
    'ComplianceDocument',
    document.id,
    undefined,
    JSON.stringify({ type: docType, title, storagePath })
  );

  return { document, auditLog };
}

/**
 * 4. SUBMIT PROVIDER FOR REVIEW (DRAFT -> PENDING_REVIEW)
 */
export function submitProviderForReview(
  provider: Provider,
  actor: AuthContext
): ProviderLifecycleEventResult {
  if (actor.status === 'BLOCKED') {
    throw new ProviderDomainError('Usuário bloqueado.', 'USER_BLOCKED', 403);
  }
  if (provider.userId !== actor.userId && !isPlatformAdmin(actor)) {
    throw new ProviderDomainError('Apenas o titular do cadastro pode enviá-lo para análise.', 'FORBIDDEN', 403);
  }

  validateProviderStatusTransition(provider.status, 'PENDING_REVIEW');

  const now = new Date().toISOString();
  const updatedProvider: Provider = {
    ...provider,
    status: 'PENDING_REVIEW',
    submittedAt: now,
    updatedAt: now,
  };

  const audit = createAuditEntry(
    actor,
    'PROVIDER_SUBMITTED',
    'Provider',
    provider.id,
    provider.status,
    'PENDING_REVIEW'
  );

  return {
    provider: updatedProvider,
    auditLogs: [audit],
  };
}

/**
 * 5. COMPLIANCE OPERATOR: REVIEWS A DOCUMENT (APPROVE or REJECT)
 */
export function reviewComplianceDocument(
  doc: ComplianceDocument,
  decision: 'APPROVE' | 'REJECT',
  reviewer: AuthContext,
  rejectionReason?: string
): DocumentReviewResult {
  if (!hasPermission(reviewer, 'admin.compliance.review') && !isPlatformAdmin(reviewer)) {
    throw new ComplianceDomainError(
      'Operador não possui permissão para analisar documentos de compliance.',
      'FORBIDDEN_COMPLIANCE_REVIEW',
      403
    );
  }

  // Anti-Self-Approval Attack: An instructor/user cannot review their own documents
  if (doc.userId === reviewer.userId && !isPlatformAdmin(reviewer)) {
    throw new ComplianceDomainError(
      'Violação de Segurança: Prestador não pode auto-aprovar seus próprios documentos.',
      'SELF_REVIEW_PROHIBITED',
      403
    );
  }

  if (decision === 'REJECT' && (!rejectionReason || !rejectionReason.trim())) {
    throw new ComplianceDomainError(
      'Motivo de rejeição é obrigatório ao recusar um documento.',
      'MISSING_REJECTION_REASON',
      400
    );
  }

  const now = new Date().toISOString();
  const nextStatus: DocumentStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  const updatedDoc: ComplianceDocument = {
    ...doc,
    status: nextStatus,
    reviewedBy: reviewer.userId,
    reviewedAt: now,
    rejectionReason: decision === 'REJECT' ? rejectionReason?.trim() : undefined,
  };

  const audit = createAuditEntry(
    reviewer,
    decision === 'APPROVE' ? 'COMPLIANCE_DOCUMENT_APPROVED' : 'COMPLIANCE_DOCUMENT_REJECTED',
    'ComplianceDocument',
    doc.id,
    doc.status,
    nextStatus
  );

  return {
    document: updatedDoc,
    auditLog: audit,
  };
}

/**
 * 6. PLATFORM OPERATOR: APPROVES PROVIDER
 * Verifies operator authorization, runs eligibility engine, elevates status to ACTIVE,
 * and promotes user's role server-side (INSTRUCTOR / SCHOOL_ADMIN) while retaining STUDENT.
 */
export function approveProvider(
  provider: Provider,
  reviewer: AuthContext,
  allDocuments: ComplianceDocument[],
  requirements: ComplianceRequirement[] = DEFAULT_COMPLIANCE_REQUIREMENTS
): ProviderLifecycleEventResult {
  if (!hasPermission(reviewer, 'admin.provider.review') && !isPlatformAdmin(reviewer)) {
    throw new ProviderDomainError(
      'Operador não possui permissão para aprovar prestadores.',
      'FORBIDDEN_PROVIDER_APPROVAL',
      403
    );
  }

  // Anti-Self-Approval: User cannot approve their own provider profile
  if (provider.userId === reviewer.userId && !isPlatformAdmin(reviewer)) {
    throw new ProviderDomainError(
      'Violação de Segurança: O usuário não pode aprovar o seu próprio cadastro de prestador.',
      'SELF_APPROVAL_PROHIBITED',
      403
    );
  }

  validateProviderStatusTransition(provider.status, 'ACTIVE');

  // Verify full compliance eligibility
  const eligibility = evaluateProviderEligibility(provider, allDocuments, requirements);
  if (!eligibility.isEligible) {
    throw new ComplianceDomainError(
      `Prestador não é elegível para aprovação. Pendências: ${eligibility.ineligibilityReasons.join('; ')}`,
      'INELIGIBLE_FOR_APPROVAL',
      422
    );
  }

  const now = new Date().toISOString();
  const updatedProvider: Provider = {
    ...provider,
    status: 'ACTIVE',
    isVerified: true,
    approvedBy: reviewer.userId,
    approvedAt: now,
    updatedAt: now,
  };

  const auditApprove = createAuditEntry(
    reviewer,
    'PROVIDER_APPROVED',
    'Provider',
    provider.id,
    provider.status,
    'ACTIVE'
  );

  // Role Promotion Logic: Multiple roles supported (e.g. STUDENT + INSTRUCTOR)
  const targetRole: UserRole = provider.type === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'SCHOOL_ADMIN';
  const auditRole = createAuditEntry(
    reviewer,
    'ROLE_GRANTED',
    'UserRole',
    provider.userId || 'unknown',
    undefined,
    JSON.stringify({ role: targetRole, providerId: provider.id })
  );

  return {
    provider: updatedProvider,
    auditLogs: [auditApprove, auditRole],
    promotedRoles: [targetRole],
  };
}

/**
 * 7. PLATFORM OPERATOR: REJECTS PROVIDER
 */
export function rejectProvider(
  provider: Provider,
  reviewer: AuthContext,
  reason: string
): ProviderLifecycleEventResult {
  if (!hasPermission(reviewer, 'admin.provider.review') && !isPlatformAdmin(reviewer)) {
    throw new ProviderDomainError(
      'Operador não possui permissão para rejeitar prestadores.',
      'FORBIDDEN_PROVIDER_REJECTION',
      403
    );
  }

  if (!reason || !reason.trim()) {
    throw new ProviderDomainError('Motivo detalhado é obrigatório para rejeição do prestador.', 'MISSING_REASON', 400);
  }

  validateProviderStatusTransition(provider.status, 'REJECTED');

  const now = new Date().toISOString();
  const updatedProvider: Provider = {
    ...provider,
    status: 'REJECTED',
    isVerified: false,
    rejectedBy: reviewer.userId,
    rejectedAt: now,
    rejectionReason: reason.trim(),
    updatedAt: now,
  };

  const audit = createAuditEntry(
    reviewer,
    'PROVIDER_REJECTED',
    'Provider',
    provider.id,
    provider.status,
    'REJECTED'
  );

  return {
    provider: updatedProvider,
    auditLogs: [audit],
  };
}

/**
 * 8. PLATFORM OPERATOR: SUSPENDS PROVIDER
 */
export function suspendProvider(
  provider: Provider,
  reviewer: AuthContext,
  reason: string
): ProviderLifecycleEventResult {
  if (!hasPermission(reviewer, 'admin.provider.suspend') && !isPlatformAdmin(reviewer)) {
    throw new ProviderDomainError(
      'Operador não possui permissão para suspender prestadores.',
      'FORBIDDEN_PROVIDER_SUSPENSION',
      403
    );
  }

  if (!reason || !reason.trim()) {
    throw new ProviderDomainError('Motivo é obrigatório para suspensão do prestador.', 'MISSING_REASON', 400);
  }

  validateProviderStatusTransition(provider.status, 'SUSPENDED');

  const now = new Date().toISOString();
  const updatedProvider: Provider = {
    ...provider,
    status: 'SUSPENDED',
    isVerified: false,
    suspendedAt: now,
    rejectionReason: reason.trim(),
    updatedAt: now,
  };

  const audit = createAuditEntry(
    reviewer,
    'PROVIDER_SUSPENDED',
    'Provider',
    provider.id,
    provider.status,
    'SUSPENDED'
  );

  return {
    provider: updatedProvider,
    auditLogs: [audit],
  };
}

/**
 * 9. PLATFORM OPERATOR: BLOCKS PROVIDER
 */
export function blockProvider(
  provider: Provider,
  reviewer: AuthContext,
  reason: string
): ProviderLifecycleEventResult {
  if (!isPlatformAdmin(reviewer)) {
    throw new ProviderDomainError(
      'Operador não possui permissão para bloquear prestadores. Apenas PLATFORM_ADMIN é autorizado.',
      'FORBIDDEN_PROVIDER_BLOCK',
      403
    );
  }

  if (!reason || !reason.trim()) {
    throw new ProviderDomainError('Motivo é obrigatório para bloquear o prestador.', 'MISSING_REASON', 400);
  }

  validateProviderStatusTransition(provider.status, 'BLOCKED');

  const now = new Date().toISOString();
  const updatedProvider: Provider = {
    ...provider,
    status: 'BLOCKED',
    isVerified: false,
    rejectionReason: reason.trim(),
    updatedAt: now,
  };

  const audit = createAuditEntry(
    reviewer,
    'PROVIDER_BLOCKED',
    'Provider',
    provider.id,
    provider.status,
    'BLOCKED'
  );

  return {
    provider: updatedProvider,
    auditLogs: [audit],
  };
}
