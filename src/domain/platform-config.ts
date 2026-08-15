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
  availabilityHorizonDays: number; // Default: 30
  minimumBookingNoticeHours: number; // Default: 2
  platformFeeDefaultPercentage: number; // Default: 10
  payoutSafetyPeriodHours: number; // Default: 24
  searchRadiusDefaultsKm: number; // Default: 15
  checkInWindowBeforeMinutes: number; // Default: 30
  checkInWindowAfterMinutes: number; // Default: 60
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_PLATFORM_CONFIGURATION: PlatformConfiguration = {
  id: 'cfg_global_default',
  quoteExpirationMinutes: 10,
  availabilityHorizonDays: 30,
  minimumBookingNoticeHours: 2,
  platformFeeDefaultPercentage: 10,
  payoutSafetyPeriodHours: 24,
  searchRadiusDefaultsKm: 15,
  checkInWindowBeforeMinutes: 30,
  checkInWindowAfterMinutes: 60,
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

  if (
    updates.quoteExpirationMinutes !== undefined &&
    updates.quoteExpirationMinutes <= 0
  ) {
    throw new PlatformConfigDomainError(
      'INVALID_QUOTE_EXPIRATION',
      'O tempo de expiração da cotação deve ser maior que zero.',
      400
    );
  }

  if (
    updates.availabilityHorizonDays !== undefined &&
    (updates.availabilityHorizonDays < 1 || updates.availabilityHorizonDays > 365)
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
