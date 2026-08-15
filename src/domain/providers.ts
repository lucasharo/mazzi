// ============================================================================
// MAZZI PLATFORM — SPRINT 04: PROVIDERS DOMAIN ENGINE
// File: src/domain/providers.ts
// ============================================================================

import {
  Provider,
  ProviderStatus,
  ProviderType,
  PublicProviderProfile,
  VehicleCategory,
} from '../types';

export class ProviderDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ProviderDomainError';
  }
}

/**
 * Valid state transitions for Provider lifecycle
 */
export const ALLOWED_PROVIDER_STATUS_TRANSITIONS: Record<
  ProviderStatus,
  readonly ProviderStatus[]
> = {
  DRAFT: ['PENDING_REVIEW', 'BLOCKED'],
  PENDING_REVIEW: ['ACTIVE', 'REJECTED', 'DRAFT', 'BLOCKED'],
  ACTIVE: ['SUSPENDED', 'BLOCKED'],
  SUSPENDED: ['ACTIVE', 'BLOCKED'],
  REJECTED: ['DRAFT', 'PENDING_REVIEW', 'BLOCKED'],
  BLOCKED: [], // Terminal administrative lockdown
};

/**
 * Validates if a transition between Provider states is permitted
 */
export function canTransitionProviderStatus(
  currentStatus: ProviderStatus,
  nextStatus: ProviderStatus
): boolean {
  const allowed = ALLOWED_PROVIDER_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

/**
 * Validates and enforces Provider state transition
 */
export function validateProviderStatusTransition(
  currentStatus: ProviderStatus,
  nextStatus: ProviderStatus
): void {
  if (currentStatus === nextStatus) {
    return;
  }
  if (!canTransitionProviderStatus(currentStatus, nextStatus)) {
    throw new ProviderDomainError(
      `Transição de status inválida para o Provider: de '${currentStatus}' para '${nextStatus}'.`,
      'INVALID_PROVIDER_STATUS_TRANSITION',
      422
    );
  }
}

export interface CpfValidationResult {
  isValid: boolean;
  normalized: string; // 11 unmasked digits
  formatted: string; // 000.000.000-00
  classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION';
  reason?: string;
}

/**
 * Normalizes CPF by stripping masks and whitespace.
 * Persists purely as normalized string (NEVER number/bigint).
 */
export function normalizeCpf(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

/**
 * Validates CPF format and Check Digits (Modulo 11).
 * NOTA TÉCNICA: Esta validação é estritamente FORMAT_AND_CHECK_DIGIT_VALIDATION.
 * Não constitui consulta cadastral ativa na base da Receita Federal do Brasil.
 */
export function validateCpf(raw: string): CpfValidationResult {
  const digits = normalizeCpf(raw);

  if (digits.length !== 11) {
    return {
      isValid: false,
      normalized: digits,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: 'CPF deve conter exatamente 11 dígitos numéricos.',
    };
  }

  // Reject all-same digits (e.g., 00000000000, 11111111111)
  if (/^(\d)\1{10}$/.test(digits)) {
    return {
      isValid: false,
      normalized: digits,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: 'CPF não pode ser composto por dígitos repetidos.',
    };
  }

  // Calculate Check Digit 1 (DV1)
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(digits[i], 10) * (10 - i);
  }
  let rest1 = (sum1 * 10) % 11;
  if (rest1 === 10 || rest1 === 11) rest1 = 0;

  if (rest1 !== parseInt(digits[9], 10)) {
    return {
      isValid: false,
      normalized: digits,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: 'Primeiro dígito verificador do CPF inválido.',
    };
  }

  // Calculate Check Digit 2 (DV2)
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(digits[i], 10) * (11 - i);
  }
  let rest2 = (sum2 * 10) % 11;
  if (rest2 === 10 || rest2 === 11) rest2 = 0;

  if (rest2 !== parseInt(digits[10], 10)) {
    return {
      isValid: false,
      normalized: digits,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: 'Segundo dígito verificador do CPF inválido.',
    };
  }

  const formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  return {
    isValid: true,
    normalized: digits,
    formatted,
    classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
  };
}

export type CnpjFormatType = 'LEGACY_NUMERIC' | 'ALPHANUMERIC';

export interface CnpjValidationResult {
  isValid: boolean;
  formatType?: CnpjFormatType;
  normalized: string; // 14 unmasked alphanumeric chars (uppercase)
  formatted: string; // XX.XXX.XXX/XXXX-XX
  classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION';
  reason?: string;
}

/**
 * Normalizes CNPJ by stripping masks, converting to uppercase and trimming.
 * Supports both legacy numeric and new alphanumeric formats.
 */
export function normalizeCnpj(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

/**
 * Validates CNPJ supporting both:
 * 1. LEGACY_NUMERIC_CNPJ (14 numeric digits)
 * 2. ALPHANUMERIC_CNPJ (RFB standard: 12 alphanumeric chars [0-9A-Z] + 2 numeric check digits [0-9])
 * 
 * Check Digits Algorithm (RFB Modulo 11 for Alphanumeric & Numeric):
 * - Character value V(c) = ASCII(c) - 48 ('0'=0..'9'=9, 'A'=17..'Z'=42)
 * - Weights for DV1: [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
 * - Weights for DV2: [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
 * - Rest = Sum % 11; DV = Rest < 2 ? 0 : 11 - Rest
 */
export function validateCnpj(raw: string): CnpjValidationResult {
  const normalized = normalizeCnpj(raw);

  if (normalized.length !== 14) {
    return {
      isValid: false,
      normalized,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: 'CNPJ deve conter exatamente 14 caracteres alfanuméricos.',
    };
  }

  // Reject all-same characters
  if (/^(.)\1{13}$/.test(normalized)) {
    return {
      isValid: false,
      normalized,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: 'CNPJ não pode ser composto por caracteres idênticos repetidos.',
    };
  }

  // Check structure: first 12 chars [0-9A-Z], last 2 chars [0-9]
  const rootAndBranch = normalized.slice(0, 12);
  const checkDigits = normalized.slice(12, 14);

  if (!/^[0-9A-Z]{12}$/.test(rootAndBranch)) {
    return {
      isValid: false,
      normalized,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: 'A raiz e ordem do CNPJ devem conter apenas caracteres alfanuméricos (0-9 e A-Z).',
    };
  }

  if (!/^[0-9]{2}$/.test(checkDigits)) {
    return {
      isValid: false,
      normalized,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: 'Os dois dígitos verificadores do CNPJ devem ser estritamente numéricos (0-9).',
    };
  }

  const isLegacy = /^[0-9]{14}$/.test(normalized);
  const formatType: CnpjFormatType = isLegacy ? 'LEGACY_NUMERIC' : 'ALPHANUMERIC';

  // Calculate Check Digit 1 (DV1)
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum1 = 0;
  for (let i = 0; i < 12; i++) {
    const charCodeVal = normalized.charCodeAt(i) - 48;
    sum1 += charCodeVal * weights1[i];
  }
  const rest1 = sum1 % 11;
  const dv1 = rest1 < 2 ? 0 : 11 - rest1;

  if (dv1 !== parseInt(normalized[12], 10)) {
    return {
      isValid: false,
      formatType,
      normalized,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: `Primeiro dígito verificador do CNPJ inválido (esperado ${dv1}, recebido ${normalized[12]}).`,
    };
  }

  // Calculate Check Digit 2 (DV2)
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum2 = 0;
  for (let i = 0; i < 12; i++) {
    const charCodeVal = normalized.charCodeAt(i) - 48;
    sum2 += charCodeVal * weights2[i];
  }
  sum2 += dv1 * weights2[12]; // Multiply calculated DV1 by 2 (weights2[12])

  const rest2 = sum2 % 11;
  const dv2 = rest2 < 2 ? 0 : 11 - rest2;

  if (dv2 !== parseInt(normalized[13], 10)) {
    return {
      isValid: false,
      formatType,
      normalized,
      formatted: '',
      classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
      reason: `Segundo dígito verificador do CNPJ inválido (esperado ${dv2}, recebido ${normalized[13]}).`,
    };
  }

  const formatted = `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12)}`;

  return {
    isValid: true,
    formatType,
    normalized,
    formatted,
    classification: 'FORMAT_AND_CHECK_DIGIT_VALIDATION',
  };
}

/**
 * Legacy compatibility wrapper with strict validation
 */
export function sanitizeCpf(raw: string): string {
  const result = validateCpf(raw);
  if (!result.isValid) {
    throw new ProviderDomainError(result.reason || 'CPF inválido.', 'INVALID_CPF', 422);
  }
  return result.formatted;
}

/**
 * Legacy compatibility wrapper with strict numeric + alphanumeric validation
 */
export function sanitizeCnpj(raw: string): string {
  const result = validateCnpj(raw);
  if (!result.isValid) {
    throw new ProviderDomainError(result.reason || 'CNPJ inválido.', 'INVALID_CNPJ', 422);
  }
  return result.formatted;
}

export interface InstructorDraftInput {
  userId: string;
  displayName: string;
  legalName: string;
  cpf: string;
  phone: string;
  bio?: string;
  avatarUrl?: string;
  categories: VehicleCategory[];
  neighborhood: string;
  city: string;
  state: string;
  serviceRadiusKm?: number;
  latitude?: number;
  longitude?: number;
}

export interface DrivingSchoolDraftInput {
  userId: string; // Initial responsible user / School Admin
  tradeName: string;
  legalName: string;
  cnpj: string;
  phone: string;
  publicContact?: string;
  bio?: string;
  avatarUrl?: string;
  categories: VehicleCategory[];
  neighborhood: string;
  city: string;
  state: string;
  serviceRadiusKm?: number;
  latitude?: number;
  longitude?: number;
}

/**
 * Creates an initial Provider in DRAFT status for an Instructor
 */
export function createInstructorDraftModel(input: InstructorDraftInput): Provider {
  if (!input.displayName.trim() || !input.legalName.trim()) {
    throw new ProviderDomainError('Nome civil e nome de exibição são obrigatórios.', 'MISSING_NAME');
  }
  if (!input.categories || input.categories.length === 0) {
    throw new ProviderDomainError('Pelo menos uma categoria pretendida (A ou B) é obrigatória.', 'MISSING_CATEGORY');
  }
  const formattedCpf = sanitizeCpf(input.cpf);

  const now = new Date().toISOString();
  return {
    id: `prov_inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: input.userId,
    name: input.displayName.trim(),
    legalName: input.legalName.trim(),
    documentNumber: formattedCpf,
    phone: input.phone.trim(),
    type: 'INSTRUCTOR',
    status: 'DRAFT',
    ratingAverage: 0,
    ratingCount: 0,
    neighborhood: input.neighborhood.trim(),
    city: input.city.trim() || 'São Paulo',
    state: input.state.trim().toUpperCase() || 'SP',
    serviceRadiusKm: input.serviceRadiusKm || 5,
    latitude: input.latitude || -23.5615,
    longitude: input.longitude || -46.6560,
    categories: input.categories,
    transmissions: ['MANUAL', 'AUTOMATIC'],
    startingPriceInCents: 9000,
    avatarUrl: input.avatarUrl,
    bio: input.bio?.trim(),
    isVerified: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Creates an initial Provider in DRAFT status for a Driving School (CFC)
 */
export function createDrivingSchoolDraftModel(input: DrivingSchoolDraftInput): Provider {
  if (!input.tradeName.trim() || !input.legalName.trim()) {
    throw new ProviderDomainError('Razão Social e Nome Fantasia são obrigatórios.', 'MISSING_NAME');
  }
  if (!input.categories || input.categories.length === 0) {
    throw new ProviderDomainError('Pelo menos uma categoria (A ou B) é obrigatória.', 'MISSING_CATEGORY');
  }
  const formattedCnpj = sanitizeCnpj(input.cnpj);

  const now = new Date().toISOString();
  return {
    id: `prov_cfc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: input.userId,
    name: input.tradeName.trim(),
    legalName: input.legalName.trim(),
    documentNumber: formattedCnpj,
    phone: input.phone.trim(),
    publicContact: input.publicContact?.trim() ? input.publicContact.trim() : undefined,
    type: 'DRIVING_SCHOOL',
    status: 'DRAFT',
    ratingAverage: 0,
    ratingCount: 0,
    neighborhood: input.neighborhood.trim(),
    city: input.city.trim() || 'São Paulo',
    state: input.state.trim().toUpperCase() || 'SP',
    serviceRadiusKm: input.serviceRadiusKm || 8,
    latitude: input.latitude || -23.5505,
    longitude: input.longitude || -46.6333,
    categories: input.categories,
    transmissions: ['MANUAL', 'AUTOMATIC'],
    startingPriceInCents: 8000,
    avatarUrl: input.avatarUrl,
    bio: input.bio?.trim(),
    isVerified: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Strict Data Boundary Projection (Public Provider Profile)
 * Sanitizes and strips all confidential identifiers (CPF, CNPJ, internal phone, residential addresses).
 */
export function toPublicProviderProfile(provider: Provider): PublicProviderProfile {
  return {
    id: provider.id,
    providerType: provider.type,
    displayName: provider.name,
    avatarUrl: provider.avatarUrl,
    bio: provider.bio,
    ratingAverage: provider.ratingAverage,
    ratingCount: provider.ratingCount,
    neighborhood: provider.neighborhood,
    city: provider.city,
    serviceAreaDescription: `${provider.neighborhood}, ${provider.city} (${provider.state || 'SP'}) — Raio aprox. ${provider.serviceRadiusKm || 5}km`,
    categories: provider.categories,
    transmissions: provider.transmissions,
    startingPriceInCents: provider.startingPriceInCents,
    isVerified: provider.isVerified,
  };
}
