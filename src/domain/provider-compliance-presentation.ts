import { ComplianceDocument, DocumentStatus, Provider } from '../types';
import { ProviderEligibilityResult } from './compliance';

export interface ProviderCompliancePresentation {
  status: string;
  title: string;
  description: string;
  verified: boolean;
}

/**
 * Resolves the document/compliance state independently from the provider
 * lifecycle state. An APPROVED compliance result must not promote a DRAFT
 * provider to ACTIVE; it only describes the document gates.
 */
export function resolveComplianceDocumentStatus(
  eligibility: ProviderEligibilityResult,
  documents: ComplianceDocument[] = [],
): DocumentStatus {
  const hasExpiredDocument = eligibility.expiredDocuments.length > 0 || documents.some((document) => document.status === 'EXPIRED');
  if (hasExpiredDocument) return 'EXPIRED';
  if (eligibility.isEligible) return 'APPROVED';
  if (eligibility.rejectedDocuments.length > 0) return 'REJECTED';
  if (eligibility.pendingSubmissionDocuments.length > 0 || eligibility.missingRequirements.length > 0) return 'PENDING';
  if (eligibility.inReviewDocuments.length > 0) return 'IN_REVIEW';
  return 'PENDING';
}

export function resolveProviderCompliancePresentation(
  provider: Provider,
  eligibility: ProviderEligibilityResult,
  documents: ComplianceDocument[] = [],
): ProviderCompliancePresentation {
  const hasExpiredDocument = eligibility.expiredDocuments.length > 0 || documents.some((document) => document.status === 'EXPIRED');
  if (provider.status === 'BLOCKED') {
    return { status: 'BLOCKED', title: 'Cadastro bloqueado', description: 'O cadastro está bloqueado. Entre em contato com o suporte da MAZZI.', verified: false };
  }
  if (provider.status === 'SUSPENDED') {
    return { status: 'SUSPENDED', title: 'Cadastro suspenso', description: 'O cadastro está suspenso e não pode receber novos agendamentos.', verified: false };
  }
  if (provider.status === 'REJECTED') {
    return { status: 'REJECTED', title: 'Cadastro rejeitado', description: `Motivo: ${provider.rejectionReason || 'Documentação não conforme.'}`, verified: false };
  }
  if (provider.status === 'PENDING_REVIEW') {
    return { status: 'PENDING_REVIEW', title: 'Cadastro em análise', description: 'Seus documentos foram recebidos e estão na fila de auditoria da equipe de moderação.', verified: false };
  }
  if (provider.status === 'ACTIVE' && eligibility.isEligible && !hasExpiredDocument) {
    return { status: 'ACTIVE', title: 'Credenciamento Ativo • Verificado pela MAZZI', description: 'Suas ofertas e horários estão visíveis para agendamentos de alunos em São Paulo.', verified: true };
  }
  if (hasExpiredDocument) {
    return { status: 'EXPIRED', title: 'Documentos vencidos: atualização necessária', description: 'Atualize os documentos vencidos para concluir a verificação.', verified: false };
  }
  if (eligibility.rejectedDocuments.length > 0) {
    return { status: 'REJECTED', title: 'Documentos rejeitados: correção necessária', description: 'Corrija e envie novamente os documentos rejeitados para concluir a verificação.', verified: false };
  }
  if (eligibility.missingRequirements.length > 0) {
    return { status: 'PENDING', title: 'Documentação pendente para verificação', description: 'Envie e aguarde a aprovação de todos os documentos obrigatórios para receber o selo de verificação.', verified: false };
  }
  if (eligibility.pendingSubmissionDocuments.length > 0) {
    return { status: 'PENDING', title: 'Documentação pendente para verificação', description: 'Envie e aguarde a aprovação de todos os documentos obrigatórios para receber o selo de verificação.', verified: false };
  }
  if (eligibility.inReviewDocuments.length > 0) {
    return { status: 'IN_REVIEW', title: 'Documentos em análise pelo Compliance', description: 'Os documentos enviados estão em análise pela equipe de Compliance.', verified: false };
  }
  return { status: 'PENDING', title: 'Documentação pendente para verificação', description: 'A verificação do cadastro ainda não foi concluída.', verified: false };
}
