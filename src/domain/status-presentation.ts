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
    IN_REVIEW: { label: 'Em reanálise', tone: 'info' },
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
    EXPIRED: { label: 'Expirado', tone: 'danger' },
  },
  booking: {
    DRAFT: { label: 'Rascunho', tone: 'neutral' },
    PENDING_PAYMENT: { label: 'Aguardando pagamento', tone: 'warning' },
    ON_THE_WAY: { label: 'A caminho', tone: 'warning' },
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
    // O banco mantém EXPIRED para liberar o horário; na interface, significa que o pagamento não foi concluído.
    EXPIRED: { label: 'Pagamento não realizado', tone: 'warning' },
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
    AVAILABLE: { label: 'Disponível', tone: 'info' },
    PROCESSING: { label: 'Em processamento', tone: 'info', isPulsing: true },
    PAID: { label: 'Pago', tone: 'success' },
    FAILED: { label: 'Não processado', tone: 'danger' },
    BLOCKED: { label: 'Bloqueado', tone: 'danger' },
  },
};

const defaultStatusDomainOrder: Exclude<StatusPresentationDomain, 'default'>[] = [
  'booking', 'provider', 'vehicle', 'compliance', 'payment', 'payout',
];

export function getStatusPresentation(
  status: string | null | undefined,
  domain: StatusPresentationDomain = 'default',
  context?: { instructorCheckedIn?: boolean; studentCheckedIn?: boolean }
): StatusPresentation {
  if (!status) return neutral;
  if (status === 'ON_THE_WAY' && context?.instructorCheckedIn) {
    return { label: 'No local', tone: 'info' };
  }
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
  MAZZI_TERMS_ACCEPTANCE: 'Termos de ética e segurança da plataforma MAZZI',
  COMPANY_REGISTRATION: 'Cadastro da empresa',
  CFC_AUTHORIZATION: 'Autorização da Autoescola / CFC',
  CFC_AUTHORIZATION_STATE: 'Portaria de credenciamento do CFC no DETRAN-SP',
  CFC_ALVARA: 'Alvará municipal de funcionamento e localização',
  CONTRACT_SOCIAL: 'Contrato social e atos constitutivos da empresa',
  DUAL_PEDAL_INSPECTION: 'Laudo de inspeção do sistema de pedal duplo',
  CRLV: 'Documento do veículo (CRLV)',
  CRLV_E: 'Documento do veículo (CRLV-e)',
  CREDENTIAL_DETRAN: 'Credencial profissional de instrutor de trânsito',
  CREDENTIAL_DETRAN_SP: 'Credenciamento operacional no DETRAN-SP',
  CREDENTIAL_HISTORICAL: 'Registro histórico de credenciamento',
  CRIMINAL_BACKGROUND: 'Certidão de antecedentes criminais',
};

export function getComplianceDocumentTypeLabel(type: string | null | undefined): string {
  return type ? complianceDocumentTypeLabels[type] || 'Documento de compliance' : 'Documento de compliance';
}

const userRoleLabels: Record<string, string> = {
  STUDENT: 'Aluno',
  INSTRUCTOR: 'Instrutor',
  DRIVING_SCHOOL: 'Autoescola',
  SCHOOL_ADMIN: 'Gestor da autoescola',
  SCHOOL_STAFF: 'Equipe da autoescola',
  PLATFORM_ADMIN: 'Administrador da plataforma',
  SUPPORT: 'Suporte',
};

const auditActionLabels: Record<string, string> = {
  ADMIN_MOCK_REFUND: 'Estorno administrativo simulado',
  PLATFORM_CONFIG_UPDATED: 'Configuração da plataforma atualizada',
  CREATE_BOOKING: 'Reserva criada',
  BOOKING_CREATE_HOLD: 'Reserva iniciada',
  BOOKING_PAYMENT_HOLD_EXPIRED: 'Prazo de pagamento expirado',
  BOOKING_CONFIRMED: 'Reserva confirmada',
  BOOKING_CANCELLED: 'Reserva cancelada',
  BOOKING_CANCEL_STUDENT_IDEMPOTENT: 'Cancelamento solicitado pelo aluno',
  BOOKING_CANCELLED_BY_STUDENT: 'Reserva cancelada pelo aluno',
  BOOKING_CANCELLED_BY_PROVIDER: 'Reserva cancelada pelo prestador',
  PROVIDER_AUTO_ACTIVATED: 'Prestador ativado automaticamente',
  APPROVE_PROVIDER_COMPLIANCE: 'Compliance do prestador aprovado',
  COMPLIANCE_DOCUMENT_SUBMITTED: 'Documento enviado para análise',
  REVIEW_COMPLIANCE_DOCUMENT: 'Documento de compliance analisado',
  MAZZI_TERMS_ACCEPTED: 'Termos aceitos',
  REVIEW_VEHICLE: 'Veículo analisado',
  VEHICLE_APPROVED: 'Veículo aprovado',
  VEHICLE_REJECTED: 'Veículo reprovado',
  VEHICLE_UPDATED: 'Veículo atualizado',
  VEHICLE_DEACTIVATED: 'Veículo desativado pelo prestador',
  VEHICLE_ACTIVATION_REQUESTED: 'Reativação do veículo solicitada',
  VEHICLE_ACTIVATED: 'Veículo ativado pelo prestador',
  COMPLETE_LESSON_IDEMPOTENT: 'Conclusão da aula registrada',
  LESSON_COMPLETED: 'Aula concluída',
  ADMINISTRATIVE_ROLE_GRANTED: 'Acesso administrativo concedido',
  ADMINISTRATIVE_ROLE_ALREADY_PRESENT: 'Acesso administrativo já existente',
};

export function getUserRoleLabel(role: string | null | undefined): string {
  return role ? userRoleLabels[role] || 'Perfil não informado' : 'Perfil não informado';
}

export function getAuditActionLabel(action: string | null | undefined): string {
  if (!action) return 'Ação registrada';
  if (auditActionLabels[action]) return auditActionLabels[action];
  const entityLabels: Record<string, string> = {
    users: 'Usuário', providers: 'Prestador', vehicles: 'Veículo', service_offerings: 'Oferta de serviço',
    bookings: 'Reserva', quotes: 'Cotação', payments: 'Pagamento', compliance_documents: 'Documento de compliance',
    reviews: 'Avaliação', availabilities: 'Disponibilidade', instructor_global_blocks: 'Bloqueio de agenda',
    driving_school_staff: 'Equipe da autoescola', driving_school_membership_events: 'Vínculo da autoescola',
    platform_configurations: 'Configuração da plataforma',
  };
  const match = action.match(/^AUDIT_(INSERT|UPDATE|DELETE)_(.+)$/i);
  if (!match) return 'Ação administrativa realizada';
  const operation = { INSERT: 'criado', UPDATE: 'atualizado', DELETE: 'excluído' }[match[1].toUpperCase()] || 'alterado';
  const subject = entityLabels[match[2].toLowerCase()] || 'Registro';
  return `${subject} ${operation}`;
}

export function getFriendlyAdminError(error: unknown, fallback: string): string {
  const code = String((error as { code?: string })?.code || (error as { message?: string })?.message || '');
  if (/FORBIDDEN|42501|AUTH_REQUIRED|permission/i.test(code)) return 'Você não tem permissão para realizar esta ação.';
  if (/LAST_PLATFORM_ADMIN|LAST_ADMIN/i.test(code)) return 'A plataforma precisa manter pelo menos um administrador ativo.';
  if (/DOCUMENT_NOT_FOUND/i.test(code)) return 'Este documento não está mais disponível.';
  if (/INVALID_|UNSUPPORTED_|VALUE_MUST_BE_NUMBER/i.test(code)) return 'Revise os valores informados e tente novamente.';
  return fallback;
}
