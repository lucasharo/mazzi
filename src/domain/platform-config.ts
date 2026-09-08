// ============================================================================
// MAZZI PLATFORM — SPRINT 12: PLATFORM CONFIGURATION & GOVERNANCE DOMAIN
// File: src/domain/platform-config.ts
// ============================================================================

import { AuditLog, UserRole } from '../types';
import { AuthContext, isPlatformAdmin } from './rbac';

export class PlatformConfigDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'PlatformConfigDomainError';
  }
}

export interface PlatformConfiguration {
  id: string;
  quoteExpirationMinutes: number; // Default: 10
  availabilityHorizonDays: number; // Default: 90
  minimumBookingNoticeHours: number; // Default: 2
  platformFeeDefaultPercentage: number; // Default: 1
  mercadoPagoFeePercentage: number; // Default: 5, used only by Admin payout calculations
  maxTotalFeePercentage: number; // Default: 10, MAZZI + gateway cap
  payoutSafetyPeriodHours: number; // Default: 72
  searchRadiusDefaultsKm: number; // Default: 15
  checkInWindowBeforeMinutes: number; // Default: 15
  contestationResponseHours: number; // Default: 72
  instantMaxEtaMinutes: number; // Default: 30
  instantOfferExpirationSeconds: number; // Default: 15
  instantLessonExpirationMinutes: number; // Default: 5, payment/search deadline for Aula Agora
  instantRefundOnWayInitialPercent: number; // Default: 90
  instantRefundOnWayMiddlePercent: number; // Default: 80
  instantRefundOnWayLatePercent: number; // Default: 70
  instantRefundAfterArrivalPercent: number; // Default: 60
  instantRefundInitialWindowMinutes: number; // Default: 3
  instantRefundMiddleWindowMinutes: number; // Default: 7
  updatedAt: string;
  updatedBy?: string;
}

/**
 * Configuration that can be consumed by authenticated Student/PRO clients.
 * Financial, payout and dispute settings intentionally stay server-side.
 */
export interface PublicPlatformConfiguration {
  quoteExpirationMinutes: number;
  availabilityHorizonDays: number;
  minimumBookingNoticeHours: number;
  searchRadiusDefaultsKm: number;
  checkInWindowBeforeMinutes: number;
  instantMaxEtaMinutes: number;
  instantOfferExpirationSeconds: number;
  instantLessonExpirationMinutes: number;
}

export function toPublicPlatformConfiguration(config: PlatformConfiguration): PublicPlatformConfiguration {
  return {
    quoteExpirationMinutes: config.quoteExpirationMinutes,
    availabilityHorizonDays: config.availabilityHorizonDays,
    minimumBookingNoticeHours: config.minimumBookingNoticeHours,
    searchRadiusDefaultsKm: config.searchRadiusDefaultsKm,
    checkInWindowBeforeMinutes: config.checkInWindowBeforeMinutes,
    instantMaxEtaMinutes: config.instantMaxEtaMinutes,
    instantOfferExpirationSeconds: config.instantOfferExpirationSeconds,
    instantLessonExpirationMinutes: config.instantLessonExpirationMinutes,
  };
}

export const DEFAULT_PLATFORM_CONFIGURATION: PlatformConfiguration = {
  id: 'cfg_global_default',
  quoteExpirationMinutes: 10,
  availabilityHorizonDays: 90,
  minimumBookingNoticeHours: 2,
  platformFeeDefaultPercentage: 1,
  mercadoPagoFeePercentage: 5,
  maxTotalFeePercentage: 10,
  payoutSafetyPeriodHours: 72,
  searchRadiusDefaultsKm: 15,
  checkInWindowBeforeMinutes: 15,
  contestationResponseHours: 72,
  instantMaxEtaMinutes: 30,
  instantOfferExpirationSeconds: 15,
  instantLessonExpirationMinutes: 5,
  instantRefundOnWayInitialPercent: 90,
  instantRefundOnWayMiddlePercent: 80,
  instantRefundOnWayLatePercent: 70,
  instantRefundAfterArrivalPercent: 60,
  instantRefundInitialWindowMinutes: 3,
  instantRefundMiddleWindowMinutes: 7,
  updatedAt: '2026-08-15T00:00:00.000Z',
  updatedBy: 'system_initializer',
};

export interface UpdatePlatformConfigParams {
  currentConfig: PlatformConfiguration;
  updates: Partial<Omit<PlatformConfiguration, 'id' | 'updatedAt' | 'updatedBy'>>;
  actor: AuthContext;
  now?: Date;
}

/**
  Updates platform configuration parameters with strict PLATFORM_ADMIN validation.
  SUPPORT role is strictly DENIED.
 */
export function updatePlatformConfiguration(params: UpdatePlatformConfigParams): {
  config: PlatformConfiguration;
  auditLog: AuditLog;
} {
  const { currentConfig, updates, actor, now = new Date() } = params;

  // 1. Strict RBAC Enforcement: ONLY PLATFORM_ADMIN can update platform configuration
  if (!isPlatformAdmin(actor)) {
    throw new PlatformConfigDomainError(
      'FORBIDDEN_CONFIG_UPDATE',
      'Somente administradores da plataforma (PLATFORM_ADMIN) possuem permissão para alterar configurações globais.',
      403
    );
  }

  // 2. Input Validation
  if (
    updates.platformFeeDefaultPercentage !== undefined &&
    (updates.platformFeeDefaultPercentage < 0 || updates.platformFeeDefaultPercentage > 100)
  ) {
    throw new PlatformConfigDomainError(
      'INVALID_FEE_PERCENTAGE',
      'A taxa da plataforma deve estar entre 0% e 100%.',
      400
    );
  }

  if (updates.mercadoPagoFeePercentage !== undefined && (updates.mercadoPagoFeePercentage < 0 || updates.mercadoPagoFeePercentage > 100)) {
    throw new PlatformConfigDomainError('INVALID_GATEWAY_FEE_PERCENTAGE', 'A taxa estimada do Mercado Pago deve estar entre 0% e 100%.', 400);
  }
  if (updates.maxTotalFeePercentage !== undefined && (updates.maxTotalFeePercentage < 0 || updates.maxTotalFeePercentage > 100)) {
    throw new PlatformConfigDomainError('INVALID_TOTAL_FEE_PERCENTAGE', 'O limite de taxas deve estar entre 0% e 100%.', 400);
  }
  const effectiveGatewayFee = updates.mercadoPagoFeePercentage ?? currentConfig.mercadoPagoFeePercentage;
  const effectiveTotalCap = updates.maxTotalFeePercentage ?? currentConfig.maxTotalFeePercentage;
  if (effectiveGatewayFee > effectiveTotalCap) {
    throw new PlatformConfigDomainError('GATEWAY_FEE_EXCEEDS_TOTAL_FEE_CAP', 'A taxa do gateway não pode ultrapassar o limite total de taxas.', 400);
  }

  if (
    updates.quoteExpirationMinutes !== undefined &&
    (!Number.isInteger(updates.quoteExpirationMinutes) || updates.quoteExpirationMinutes <= 0)
  ) {
    throw new PlatformConfigDomainError(
      'INVALID_QUOTE_EXPIRATION',
      'O tempo de expiração da cotação deve ser maior que zero.',
      400
    );
  }

  if (
    updates.availabilityHorizonDays !== undefined &&
    (!Number.isInteger(updates.availabilityHorizonDays) || updates.availabilityHorizonDays < 1 || updates.availabilityHorizonDays > 365)
  ) {
    throw new PlatformConfigDomainError(
      'INVALID_AVAILABILITY_HORIZON',
      'O horizonte de disponibilidade deve estar entre 1 e 365 dias.',
      400
    );
  }

  if (
    updates.payoutSafetyPeriodHours !== undefined &&
    updates.payoutSafetyPeriodHours < 0
  ) {
    throw new PlatformConfigDomainError(
      'INVALID_PAYOUT_SAFETY_PERIOD',
      'O período de segurança de repasse não pode ser negativo.',
      400
    );
  }

  if (
    updates.searchRadiusDefaultsKm !== undefined &&
    (updates.searchRadiusDefaultsKm <= 0 || updates.searchRadiusDefaultsKm > 50)
  ) {
    throw new PlatformConfigDomainError(
      'INVALID_SEARCH_RADIUS',
      'O raio padrão de busca deve estar entre 0 e 50 km.',
      400
    );
  }

  if (
    updates.checkInWindowBeforeMinutes !== undefined &&
    (!Number.isInteger(updates.checkInWindowBeforeMinutes) || updates.checkInWindowBeforeMinutes < 1 || updates.checkInWindowBeforeMinutes > 60)
  ) {
    throw new PlatformConfigDomainError(
      'INVALID_CHECKIN_WINDOW',
      'A abertura do check-in deve estar entre 1 e 60 minutos antes da aula.',
      400
    );
  }

  if (updates.instantMaxEtaMinutes !== undefined && (!Number.isInteger(updates.instantMaxEtaMinutes) || updates.instantMaxEtaMinutes < 1 || updates.instantMaxEtaMinutes > 120)) {
    throw new PlatformConfigDomainError('INVALID_INSTANT_MAX_ETA', 'O tempo máximo de deslocamento da Aula Agora deve estar entre 1 e 120 minutos.', 400);
  }

  if (updates.instantOfferExpirationSeconds !== undefined && (!Number.isInteger(updates.instantOfferExpirationSeconds) || updates.instantOfferExpirationSeconds < 5 || updates.instantOfferExpirationSeconds > 120)) {
    throw new PlatformConfigDomainError('INVALID_INSTANT_OFFER_EXPIRATION', 'A validade da oferta da Aula Agora deve estar entre 5 e 120 segundos.', 400);
  }

  if (updates.instantLessonExpirationMinutes !== undefined && (!Number.isInteger(updates.instantLessonExpirationMinutes) || updates.instantLessonExpirationMinutes < 1 || updates.instantLessonExpirationMinutes > 60)) {
    throw new PlatformConfigDomainError('INVALID_INSTANT_LESSON_EXPIRATION', 'O tempo da Aula Agora deve estar entre 1 e 60 minutos.', 400);
  }

  const nowISO = now.toISOString();
  const updatedConfig: PlatformConfiguration = {
    ...currentConfig,
    ...updates,
    updatedAt: nowISO,
    updatedBy: actor.userId,
  };

  const auditLog: AuditLog = {
    id: `aud_cfg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    actorId: actor.userId,
    actorName: actor.email || 'Administrador',
    actorRole: actor.roles[0] || 'PLATFORM_ADMIN',
    action: 'PLATFORM_CONFIG_UPDATED',
    entityType: 'PlatformConfiguration',
    entityId: currentConfig.id,
    previousValue: JSON.stringify(currentConfig),
    newValue: JSON.stringify(updatedConfig),
    timestamp: nowISO,
    ipAddress: '127.0.0.1',
  };

  return {
    config: updatedConfig,
    auditLog,
  };
}
