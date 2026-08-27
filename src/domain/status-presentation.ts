export type StatusPresentationDomain =
  | 'default'
  | 'provider'
  | 'vehicle'
  | 'compliance'
  | 'booking'
  | 'payment'
  | 'payout';

export interface StatusPresentation {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'warningOrange' | 'danger' | 'neutral';
  isPulsing?: boolean;
}

const neutral: StatusPresentation = { label: 'Status não disponível', tone: 'neutral' };

const byDomain: Record<Exclude<StatusPresentationDomain, 'default'>, Record<string, StatusPresentation>> = {
  provider: {
    DRAFT: { label: 'Cadastro incompleto', tone: 'neutral' },
    PENDING_REVIEW: { label: 'Aguardando análise', tone: 'warning' },
    ACTIVE: { label: 'Ativo', tone: 'success' },
    SUSPENDED: { label: 'Suspenso', tone: 'warning' },
    BLOCKED: { label: 'Bloqueado', tone: 'danger' },
    REJECTED: { label: 'Reprovado', tone: 'danger' },
  },
  vehicle: {
    DRAFT: { label: 'Rascunho', tone: 'neutral' },
    PENDING: { label: 'Pendente', tone: 'warning' },
    IN_REVIEW: { label: 'Em análise', tone: 'info' },
    ACTIVE: { label: 'Ativo', tone: 'success' },
    INACTIVE: { label: 'Inativo', tone: 'neutral' },
    EXPIRED: { label: 'Documento vencido', tone: 'danger' },
    BLOCKED: { label: 'Bloqueado', tone: 'danger' },
  },
  compliance: {
    OFFICIALLY_VALIDATED: { label: 'Regulamentado', tone: 'success' },
    REQUIRES_REGULATORY_VALIDATION: { label: 'Em análise', tone: 'warning' },
    SUPERSEDED: { label: 'Pendente', tone: 'warningOrange' },
    INACTIVE: { label: 'Não aprovado', tone: 'danger' },
    PENDING: { label: 'Pendente', tone: 'warningOrange' },
    IN_REVIEW: { label: 'Em análise', tone: 'info' },
    APPROVED: { label: 'Aprovado', tone: 'success' },
    REJECTED: { label: 'Reprovado', tone: 'danger' },
    EXPIRED: { label: 'Vencido', tone: 'danger' },
  },
  booking: {
    DRAFT: { label: 'Rascunho', tone: 'neutral' },
    PENDING_PAYMENT: { label: 'Aguardando pagamento', tone: 'warning' },
    PAYMENT_FAILED: { label: 'Pagamento não aprovado', tone: 'danger' },
    CONFIRMED: { label: 'Confirmada', tone: 'success' },
    IN_PROGRESS: { label: 'Em andamento', tone: 'info', isPulsing: true },
    COMPLETED: { label: 'Concluída', tone: 'success' },
    CANCELLED_BY_STUDENT: { label: 'Cancelada pelo aluno', tone: 'danger' },
    CANCELLED_BY_PROVIDER: { label: 'Cancelada pelo instrutor', tone: 'danger' },
    NO_SHOW_STUDENT: { label: 'Aluno ausente', tone: 'warning' },
    NO_SHOW_PROVIDER: { label: 'Instrutor ausente', tone: 'warning' },
    DISPUTED: { label: 'Em contestação', tone: 'warning' },
    REFUNDED: { label: 'Reembolsada', tone: 'neutral' },
    PARTIALLY_REFUNDED: { label: 'Reembolso parcial', tone: 'neutral' },
    EXPIRED: { label: 'Expirada', tone: 'neutral' },
  },
  payment: {
    PENDING: { label: 'Pendente', tone: 'warning' },
    AUTHORIZED: { label: 'Autorizado', tone: 'info' },
    PAID: { label: 'Pago', tone: 'success' },
    FAILED: { label: 'Não aprovado', tone: 'danger' },
    REFUNDED: { label: 'Reembolsado', tone: 'neutral' },
    CHARGEBACK: { label: 'Contestação recebida', tone: 'danger' },
  },
  payout: {
    PENDING: { label: 'Pendente', tone: 'warning' },
    AVAILABLE: { label: 'Disponível', tone: 'success' },
    PROCESSING: { label: 'Em processamento', tone: 'info', isPulsing: true },
    PAID: { label: 'Pago', tone: 'success' },
    FAILED: { label: 'Não processado', tone: 'danger' },
    BLOCKED: { label: 'Bloqueado', tone: 'danger' },
  },
};

const defaultStatusDomainOrder: Exclude<StatusPresentationDomain, 'default'>[] = [
  'booking', 'provider', 'vehicle', 'compliance', 'payment', 'payout',
];

export function getStatusPresentation(status: string | null | undefined, domain: StatusPresentationDomain = 'default'): StatusPresentation {
  if (!status) return neutral;
  if (domain !== 'default') return byDomain[domain][status] || neutral;
  for (const candidate of defaultStatusDomainOrder) {
    const presentation = byDomain[candidate][status];
    if (presentation) return presentation;
  }
  return neutral;
}

export const complianceDocumentTypeLabels: Record<string, string> = {
  CNH: 'CNH com EAR',
  CNH_EAR: 'CNH com EAR',
  MAZZI_TERMS_ACCEPTANCE: 'Termos e condições do MAZZI',
  COMPANY_REGISTRATION: 'Cadastro da empresa',
  CFC_AUTHORIZATION: 'Autorização da Autoescola / CFC',
  CRLV: 'Documento do veículo (CRLV)',
  CRLV_E: 'Documento do veículo (CRLV-e)',
  CRIMINAL_BACKGROUND: 'Certidão de antecedentes',
};

export function getComplianceDocumentTypeLabel(type: string | null | undefined): string {
  return type ? complianceDocumentTypeLabels[type] || 'Documento de compliance' : 'Documento de compliance';
}

export function getFriendlyAdminError(error: unknown, fallback: string): string {
  const code = String((error as { code?: string })?.code || (error as { message?: string })?.message || '');
  if (/FORBIDDEN|42501|AUTH_REQUIRED|permission/i.test(code)) return 'Você não tem permissão para realizar esta ação.';
  if (/LAST_PLATFORM_ADMIN|LAST_ADMIN/i.test(code)) return 'A plataforma precisa manter pelo menos um administrador ativo.';
  if (/DOCUMENT_NOT_FOUND/i.test(code)) return 'Este documento não está mais disponível.';
  if (/INVALID_|UNSUPPORTED_|VALUE_MUST_BE_NUMBER/i.test(code)) return 'Revise os valores informados e tente novamente.';
  return fallback;
}
