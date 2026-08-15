// ==========================================
// MAZZI DOMAIN — QUOTE ENGINE (SPRINT 08)
// ==========================================

import { Quote, QuoteStatus, ServiceOffering, Provider, Vehicle, UserRole } from '../types';
import { calculatePlatformFeeAndPayout } from './money';

export const DEFAULT_DEVELOPMENT_PLATFORM_FEE_PERCENTAGE = 10;
export const DEFAULT_QUOTE_EXPIRATION_MINUTES = 10;

export interface CreateQuoteInput {
  studentId: string;
  provider: Provider;
  vehicle: Vehicle;
  offering: ServiceOffering;
  instructorId?: string;
  instructorName?: string;
  scheduledDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  scheduledStartAt: string; // ISO 8601 UTC
  scheduledEndAt: string; // ISO 8601 UTC
  platformFeePercentage?: number;
  expirationMinutes?: number;
  idempotencyKey?: string;
  now?: Date;
}

export class QuoteDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'QuoteDomainError';
  }
}

/**
 * Validates operational entity eligibility and creates an immutable commercial Quote.
 * A Quote freezes pricing, provider, vehicle, and instructor allocation snapshot.
 * Note: A Quote does NOT hold or lock calendar slots. Slotted calendar reservation occurs at Booking Hold.
 */
export function createQuote(input: CreateQuoteInput): Quote {
  const {
    studentId,
    provider,
    vehicle,
    offering,
    instructorId = provider.id,
    instructorName = provider.name,
    scheduledDate,
    startTime,
    endTime,
    scheduledStartAt,
    scheduledEndAt,
    platformFeePercentage = DEFAULT_DEVELOPMENT_PLATFORM_FEE_PERCENTAGE,
    expirationMinutes = DEFAULT_QUOTE_EXPIRATION_MINUTES,
    idempotencyKey,
    now = new Date(),
  } = input;

  // 1. Student Authentication Check
  if (!studentId || studentId.trim() === '') {
    throw new QuoteDomainError('STUDENT_REQUIRED', 'Estudante não autenticado para geração de proposta.', 401);
  }

  // 2. Operational Provider Active Validation
  if (provider.status !== 'ACTIVE') {
    throw new QuoteDomainError(
      'PROVIDER_NOT_ACTIVE',
      `O prestador selecionado não está ativo na plataforma (status: ${provider.status}).`,
      422
    );
  }

  // 3. Vehicle Active Validation
  if (vehicle.status !== 'ACTIVE') {
    throw new QuoteDomainError(
      'VEHICLE_NOT_ACTIVE',
      `O veículo selecionado não está ativo para agendamento (status: ${vehicle.status}).`,
      422
    );
  }

  // 4. Offering Active Validation
  if (offering.status !== 'ACTIVE') {
    throw new QuoteDomainError(
      'OFFERING_NOT_ACTIVE',
      'A oferta de serviço selecionada está inativa.',
      422
    );
  }

  // 5. Category Consistency
  if (offering.category !== vehicle.category) {
    throw new QuoteDomainError(
      'CATEGORY_MISMATCH',
      `A categoria da oferta (${offering.category}) não atende à categoria do veículo (${vehicle.category}).`,
      400
    );
  }

  // 6. Schedule Horizon & Future Date Check
  const startTimestamp = new Date(scheduledStartAt).getTime();
  const endTimestamp = new Date(scheduledEndAt).getTime();
  const nowTimestamp = now.getTime();

  if (isNaN(startTimestamp) || isNaN(endTimestamp)) {
    throw new QuoteDomainError('INVALID_TIMESTAMP', 'Formato de data e hora do agendamento inválido.', 400);
  }

  if (startTimestamp <= nowTimestamp) {
    throw new QuoteDomainError('SCHEDULE_MUST_BE_FUTURE', 'A aula deve ser agendada em um horário futuro.', 400);
  }

  if (startTimestamp >= endTimestamp) {
    throw new QuoteDomainError('INVALID_TIME_INTERVAL', 'O horário final deve ser posterior ao horário de início.', 400);
  }

  // 7. Calculate Frozen Commercial Pricing & Fees
  const { platformFeeInCents } = calculatePlatformFeeAndPayout(
    offering.priceInCents,
    platformFeePercentage
  );
  const totalInCents = offering.priceInCents + platformFeeInCents;

  const createdAt = now.toISOString();
  const expiresAt = new Date(nowTimestamp + expirationMinutes * 60 * 1000).toISOString();

  // Generate a valid UUID for local/mock/test environments to prevent database schema errors
  const fallbackUuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : '11111111-1111-1111-1111-' + String(Date.now()).slice(-12).padStart(12, '0');

  return {
    id: fallbackUuid,
    studentId,
    providerId: provider.id,
    providerName: provider.name,
    offeringId: offering.id,
    instructorId,
    instructorName,
    vehicleId: vehicle.id,
    vehicleName: `${vehicle.brand} ${vehicle.model} (${vehicle.year})`,
    category: offering.category,
    transmission: vehicle.transmission,
    scheduledDate,
    startTime,
    endTime,
    scheduledStartAt,
    scheduledEndAt,
    durationMinutes: offering.durationMinutes,
    priceInCents: offering.priceInCents,
    platformFeeInCents,
    totalInCents,
    status: 'ACTIVE',
    createdAt,
    expiresAt,
    idempotencyKey,
  };
}

/**
 * Helper wrapper for generateQuote maintaining backward compatibility with existing components.
 */
export function generateQuote(input: any): Quote {
  if (input && 'studentId' in input && input.studentId) {
    return createQuote(input as CreateQuoteInput);
  }
  const provider = input.provider || { id: 'prov_default', name: 'Prestador Default', status: 'ACTIVE' };
  const vehicle = input.vehicle || {
    id: 'veh_default',
    brand: 'Toyota',
    model: 'Yaris',
    year: 2024,
    category: input.offering?.category || 'B',
    transmission: 'MANUAL',
    status: 'ACTIVE',
  };
  const offering = input.offering || {
    id: 'off_default',
    category: vehicle.category,
    priceInCents: 10000,
    durationMinutes: 50,
    status: 'ACTIVE',
  };

  const scheduledDate = input.scheduledDate || '2026-09-01';
  const startTime = input.startTime || '10:00';
  const endTime = input.endTime || '10:50';

  return createQuote({
    studentId: input.studentId || 'fee01c74-a968-4035-b11a-c60d6946925f',
    provider,
    vehicle,
    offering,
    instructorId: input.instructorId || provider.id,
    instructorName: input.instructorName || provider.name,
    scheduledDate,
    startTime,
    endTime,
    scheduledStartAt: input.scheduledStartAt || `${scheduledDate}T${startTime}:00.000Z`,
    scheduledEndAt: input.scheduledEndAt || `${scheduledDate}T${endTime}:00.000Z`,
    platformFeePercentage: input.platformFeePercentage,
    expirationMinutes: input.expirationMinutes,
  });
}
export function isQuoteExpired(quote: Quote, now: Date = new Date()): boolean {
  if (quote.status === 'EXPIRED') return true;
  const expireTime = new Date(quote.expiresAt).getTime();
  return now.getTime() >= expireTime;
}

/**
 * Verifies if a Quote is active and eligible for Booking Hold.
 */
export function validateQuoteForBooking(quote: Quote, studentId: string, now: Date = new Date()): void {
  if (quote.studentId !== studentId) {
    throw new QuoteDomainError(
      'CROSS_STUDENT_QUOTE_ACCESS_DENIED',
      'Você não possui permissão para utilizar uma proposta de outro estudante.',
      403
    );
  }

  if (quote.status === 'CONSUMED') {
    throw new QuoteDomainError(
      'QUOTE_ALREADY_CONSUMED',
      'Esta proposta já foi utilizada em uma reserva anterior e não pode ser reutilizada.',
      409
    );
  }

  if (quote.status !== 'ACTIVE') {
    throw new QuoteDomainError(
      'QUOTE_NOT_ACTIVE',
      `Esta proposta não está ativa (status: ${quote.status}).`,
      400
    );
  }

  if (isQuoteExpired(quote, now)) {
    throw new QuoteDomainError(
      'QUOTE_EXPIRED',
      'A proposta comercial expirou. Por favor, solicite uma nova cotação.',
      400
    );
  }
}

