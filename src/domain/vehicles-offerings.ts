// ============================================================================
// MAZZI PLATFORM — SPRINT 05: VEHICLES & SERVICE OFFERINGS DOMAIN ENGINE
// File: src/domain/vehicles-offerings.ts
// ============================================================================

import {
  AuditLog,
  Provider,
  PublicServiceOfferingDto,
  PublicVehicleProfile,
  ServiceOffering,
  TransmissionType,
  UserRole,
  Vehicle,
  VehicleCategory,
  VehicleStatus,
  VehicleType,
} from '../types';

/** Duração única de aula disponível no MVP, conforme a hora-aula do CONTRAN. */
export const MVP_LESSON_DURATION_MINUTES = 50;

/** States that require an administrator review before the vehicle can be offered. */
export function isVehicleAwaitingAdminReview(status: VehicleStatus): boolean {
return status === 'PENDING' || status === 'IN_REVIEW';
}

export class VehicleDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'VehicleDomainError';
  }
}

export class OfferingDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'OfferingDomainError';
  }
}

/**
 * Valid state transitions for Vehicle lifecycle
 */
export const ALLOWED_VEHICLE_STATUS_TRANSITIONS: Record<
  VehicleStatus,
  readonly VehicleStatus[]
> = {
DRAFT: ['IN_REVIEW', 'BLOCKED'],
PENDING: ['IN_REVIEW', 'BLOCKED'],
IN_REVIEW: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
  ACTIVE: ['INACTIVE', 'EXPIRED', 'BLOCKED'],
INACTIVE: ['IN_REVIEW', 'ACTIVE', 'BLOCKED'],
EXPIRED: ['IN_REVIEW', 'BLOCKED'],
  BLOCKED: [], // Terminal administrative lockdown
};

/**
 * Parses Brazilian Real input string into integer cents deterministically.
 * Examples:
 * "100" -> 10000
 * "100,00" -> 10000
 * "99,90" -> 9990
 * "1.250,50" -> 125050
 * "R$ 1.250,50" -> 125050
 */
export function parseBrlToCents(rawInput: string): number {
  if (!rawInput || typeof rawInput !== 'string') {
    throw new OfferingDomainError(
      'Valor monetário inválido: entrada vazia.',
      'INVALID_MONEY_FORMAT',
      400
    );
  }

  let clean = rawInput.replace(/R\$\s*/gi, '').trim();

  if (clean === '') {
    throw new OfferingDomainError(
      'Valor monetário inválido: entrada vazia.',
      'INVALID_MONEY_FORMAT',
      400
    );
  }

  if (!/^[0-9.,]+$/.test(clean)) {
    throw new OfferingDomainError(
      `Valor monetário inválido ('${rawInput}'): contém caracteres não permitidos.`,
      'INVALID_MONEY_FORMAT',
      400
    );
  }

  if (clean.includes(',')) {
    const parts = clean.split(',');
    if (parts.length !== 2) {
      throw new OfferingDomainError(
        `Valor monetário inválido ('${rawInput}'): formato de separador decimal incorreto.`,
        'INVALID_MONEY_FORMAT',
        400
      );
    }
    const intPartStr = parts[0].replace(/\./g, '');
    let decPartStr = parts[1];

    if (decPartStr.length === 0) {
      decPartStr = '00';
    } else if (decPartStr.length === 1) {
      decPartStr = decPartStr + '0';
    } else if (decPartStr.length > 2) {
      throw new OfferingDomainError(
        `Valor monetário com mais de duas casas decimais não é permitido ('${rawInput}').`,
        'INVALID_MONEY_FORMAT',
        400
      );
    }

    const intVal = parseInt(intPartStr, 10);
    const decVal = parseInt(decPartStr, 10);

    if (isNaN(intVal) || isNaN(decVal) || intVal < 0) {
      throw new OfferingDomainError(
        `Valor monetário inválido ('${rawInput}').`,
        'INVALID_MONEY_FORMAT',
        400
      );
    }

    const totalCents = intVal * 100 + decVal;
    if (totalCents <= 0) {
      throw new OfferingDomainError(
        'O valor monetário deve ser maior que zero (R$ 0,00).',
        'INVALID_MONEY_FORMAT',
        400
      );
    }
    return totalCents;
  } else {
    const intPartStr = clean.replace(/\./g, '');
    const intVal = parseInt(intPartStr, 10);
    if (isNaN(intVal) || intVal <= 0) {
      throw new OfferingDomainError(
        `Valor monetário inválido ou menor/igual a zero ('${rawInput}').`,
        'INVALID_MONEY_FORMAT',
        400
      );
    }
    return intVal * 100;
  }
}

/**
 * Checks if a vehicle status transition is permitted
 */
export function canTransitionVehicleStatus(
  currentStatus: VehicleStatus,
  nextStatus: VehicleStatus
): boolean {
  if (currentStatus === nextStatus) return true;
  const allowed = ALLOWED_VEHICLE_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

/**
 * Enforces vehicle status transition rules
 */
export function validateVehicleStatusTransition(
  currentStatus: VehicleStatus,
  nextStatus: VehicleStatus
): void {
  if (!canTransitionVehicleStatus(currentStatus, nextStatus)) {
    throw new VehicleDomainError(
      `Transição de status inválida para o veículo: de '${currentStatus}' para '${nextStatus}'.`,
      'INVALID_VEHICLE_STATUS_TRANSITION',
      422
    );
  }
}

/**
 * Sanitizes and formats license plate for internal display (masking private operational data).
 * Mercosul or traditional BR plate format.
 */
export function maskLicensePlate(rawPlate: string): string {
  if (!rawPlate) return '';
  const clean = rawPlate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length < 7) return '***-****';
  // Keep first 3 characters and last 1 or 2 characters, mask the middle
  return `${clean.substring(0, 3)}-***${clean.substring(clean.length - 1)}`;
}

/**
 * Validates Brazilian license plate format (Mercosul or Traditional).
 */
export function validateLicensePlate(rawPlate: string): {
  isValid: boolean;
  normalized: string;
  reason?: string;
} {
  if (!rawPlate) {
    return { isValid: false, normalized: '', reason: 'Placa não informada.' };
  }
  const clean = rawPlate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length !== 7) {
    return {
      isValid: false,
      normalized: clean,
      reason: 'Placa deve conter exatamente 7 caracteres alfanuméricos.',
    };
  }

  // Traditional: AAA1234
  const traditionalRegex = /^[A-Z]{3}[0-9]{4}$/;
  // Mercosul: AAA1A23
  const mercosulRegex = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

  const isValid = traditionalRegex.test(clean) || mercosulRegex.test(clean);
  return {
    isValid,
    normalized: clean,
    reason: isValid ? undefined : 'Formato de placa inválido (deve ser Padrão Tradicional ou Mercosul).',
  };
}

/**
 * Validates Category compatibility between Instructor credentials/profile and Lesson Category.
 * Strict rule: Category A requires Category A. Category B requires Category B.
 * No assumption that B covers A or vice versa.
 */
export function isCategoryCompatible(
  providerCategories: VehicleCategory[],
  lessonCategory: VehicleCategory
): boolean {
  if (!providerCategories || !Array.isArray(providerCategories)) return false;
  return providerCategories.includes(lessonCategory);
}

/**
 * Validates Vehicle data structure and business invariants.
 */
export function validateVehicleData(data: Partial<Vehicle>): void {
  if (!data.providerId || data.providerId.trim() === '') {
    throw new VehicleDomainError(
      'Veículo deve obrigatoriamente possuir um proprietário (providerId).',
      'MISSING_VEHICLE_OWNER',
      400
    );
  }

  if (!data.brand || data.brand.trim() === '') {
    throw new VehicleDomainError('Marca do veículo é obrigatória.', 'INVALID_VEHICLE_BRAND', 400);
  }

  if (!data.model || data.model.trim() === '') {
    throw new VehicleDomainError('Modelo do veículo é obrigatório.', 'INVALID_VEHICLE_MODEL', 400);
  }

  const currentYear = new Date().getFullYear();
  if (
    typeof data.year !== 'number' ||
    isNaN(data.year) ||
    data.year < 1990 ||
    data.year > currentYear + 1
  ) {
    throw new VehicleDomainError(
      `Ano do veículo inválido (${data.year}). Deve estar entre 1990 e ${currentYear + 1}.`,
      'INVALID_VEHICLE_YEAR',
      400
    );
  }

  if (data.licensePlate) {
    const plateCheck = validateLicensePlate(data.licensePlate);
    if (!plateCheck.isValid) {
      throw new VehicleDomainError(
        plateCheck.reason || 'Placa do veículo inválida.',
        'INVALID_LICENSE_PLATE',
        400
      );
    }
  }

  if (!data.category || !['A', 'B'].includes(data.category)) {
    throw new VehicleDomainError(
      'Categoria do veículo deve ser A (Motocicleta) ou B (Automóvel) no MVP.',
      'INVALID_VEHICLE_CATEGORY',
      400
    );
  }

  if (!data.vehicleType || !['MOTORCYCLE', 'CAR'].includes(data.vehicleType)) {
    throw new VehicleDomainError(
      'Tipo de veículo deve ser MOTORCYCLE ou CAR.',
      'INVALID_VEHICLE_TYPE',
      400
    );
  }

  // Category & VehicleType consistency check
  if (data.category === 'A' && data.vehicleType !== 'MOTORCYCLE') {
    throw new VehicleDomainError(
      'Veículos de Categoria A devem ser do tipo MOTORCYCLE.',
      'CATEGORY_VEHICLE_TYPE_MISMATCH',
      400
    );
  }
  if (data.category === 'B' && data.vehicleType !== 'CAR') {
    throw new VehicleDomainError(
      'Veículos de Categoria B devem ser do tipo CAR.',
      'CATEGORY_VEHICLE_TYPE_MISMATCH',
      400
    );
  }

  // Transmission rules
  if (data.vehicleType === 'CAR' || data.category === 'B') {
    if (!data.transmission || !['MANUAL', 'AUTOMATIC'].includes(data.transmission)) {
      throw new VehicleDomainError(
        'Veículos da Categoria B / CAR devem possuir transmissão MANUAL ou AUTOMATIC.',
        'INVALID_TRANSMISSION',
        400
      );
    }
  } else if (data.vehicleType === 'MOTORCYCLE') {
    if (
      !data.transmission ||
      !['MANUAL', 'AUTOMATIC', 'NOT_APPLICABLE'].includes(data.transmission)
    ) {
      throw new VehicleDomainError(
        'Transmissão para motocicleta inválida.',
        'INVALID_TRANSMISSION',
        400
      );
    }
  }
}

/**
* Creates a new Vehicle record in PENDING or IN_REVIEW status.
 */
export function createVehicleDraft(params: {
  providerId: string;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  category: VehicleCategory;
  vehicleType: VehicleType;
  transmission: TransmissionType;
  color?: string;
  description?: string;
  photos?: string[];
  autoSubmitForReview?: boolean;
}): Vehicle {
  const plateResult = validateLicensePlate(params.licensePlate);
  if (!plateResult.isValid) {
    throw new VehicleDomainError(
      plateResult.reason || 'Placa do veículo inválida.',
      'INVALID_LICENSE_PLATE',
      400
    );
  }

const initialStatus: VehicleStatus = params.autoSubmitForReview ? 'IN_REVIEW' : 'PENDING';

  const vehicle: Vehicle = {
    id: `veh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    providerId: params.providerId,
    brand: params.brand.trim(),
    model: params.model.trim(),
    year: params.year,
    licensePlate: plateResult.normalized,
    licensePlateMasked: maskLicensePlate(plateResult.normalized),
    category: params.category,
    vehicleType: params.vehicleType,
    transmission: params.transmission,
    status: initialStatus,
    color: params.color?.trim(),
    description: params.description?.trim(),
    photos: params.photos || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  validateVehicleData(vehicle);
  return vehicle;
}

/**
 * Sanitizes a Vehicle object for public consumption.
 * CRITICAL PRIVACY BOUNDARY: License plate is NEVER exposed in public profiles or search views.
 */
export function sanitizeVehicleForPublic(vehicle: Vehicle): PublicVehicleProfile {
  const transLabel =
    vehicle.transmission === 'MANUAL'
      ? 'Manual'
      : vehicle.transmission === 'AUTOMATIC'
      ? 'Automático'
      : 'N/A';

  return {
    id: vehicle.id,
    providerId: vehicle.providerId,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    vehicleType: vehicle.vehicleType,
    category: vehicle.category,
    transmission: vehicle.transmission,
    color: vehicle.color,
    photos: vehicle.photos || [],
    displayTitle: `${vehicle.brand} ${vehicle.model} (${vehicle.year}) - ${transLabel}`,
  };
}

/**
 * Validates Service Offering data invariants.
 */
export function validateOfferingData(data: Partial<ServiceOffering>): void {
  if (!data.providerId || data.providerId.trim() === '') {
    throw new OfferingDomainError(
      'Serviço/Oferta deve obrigatoriamente possuir um proprietário (providerId).',
      'MISSING_OFFERING_PROVIDER',
      400
    );
  }

  if (!data.vehicleId || data.vehicleId.trim() === '') {
    throw new OfferingDomainError(
      'Serviço/Oferta deve obrigatoriamente ser vinculado a um veículo (vehicleId).',
      'MISSING_OFFERING_VEHICLE',
      400
    );
  }

  if (data.durationMinutes !== MVP_LESSON_DURATION_MINUTES) {
    throw new OfferingDomainError(
      'No MVP, a duração da aula deve ser de 50 minutos.',
      'INVALID_OFFERING_DURATION',
      400
    );
  }

  if (
    typeof data.priceInCents !== 'number' ||
    !Number.isInteger(data.priceInCents) ||
    data.priceInCents <= 0
  ) {
    throw new OfferingDomainError(
      'Preço da aula deve ser um valor inteiro em centavos maior que zero (priceInCents > 0).',
      'INVALID_OFFERING_PRICE',
      400
    );
  }

  if (!data.category || !['A', 'B'].includes(data.category)) {
    throw new OfferingDomainError(
      'Categoria da oferta deve ser A ou B.',
      'INVALID_OFFERING_CATEGORY',
      400
    );
  }

  if (!data.transmission || !['MANUAL', 'AUTOMATIC', 'NOT_APPLICABLE'].includes(data.transmission)) {
    throw new OfferingDomainError(
      'Transmissão da oferta deve ser herdada do veículo selecionado.',
      'OFFERING_TRANSMISSION_REQUIRED',
      400,
    );
  }
}

/**
 * Creates a Service Offering.
 */
export function createServiceOffering(params: {
  providerId: string;
  instructorId: string;
  vehicle: Vehicle;
  category: VehicleCategory;
  durationMinutes: number;
  priceInCents: number;
  initialStatus?: 'ACTIVE' | 'INACTIVE';
  existingOfferings?: ServiceOffering[];
}): ServiceOffering {
  if (!params.instructorId || typeof params.instructorId !== 'string') {
    throw new OfferingDomainError(
      'Instrutor da oferta é obrigatório.',
      'MISSING_OFFERING_INSTRUCTOR',
      400
    );
  }

  // Validate Vehicle Ownership
  if (params.vehicle.providerId !== params.providerId) {
    throw new OfferingDomainError(
      'Não é permitido criar oferta utilizando veículo pertencente a outro prestador (Vehicle Hijacking blocked).',
      'CROSS_PROVIDER_VEHICLE_MISMATCH',
      403
    );
  }

  // Validate Category Compatibility between Vehicle and Offering
  if (params.vehicle.category !== params.category) {
    throw new OfferingDomainError(
      `Incompatibilidade de categoria: Veículo de Categoria ${params.vehicle.category} não pode ser utilizado em oferta de Categoria ${params.category}.`,
      'CATEGORY_COMPATIBILITY_ERROR',
      422
    );
  }

  // Prevent Exact Duplicate Offerings
  if (params.existingOfferings && Array.isArray(params.existingOfferings)) {
    const isDuplicate = params.existingOfferings.some(
      (off) =>
        off.providerId === params.providerId &&
        off.instructorId === params.instructorId &&
        off.vehicleId === params.vehicle.id &&
        off.category === params.vehicle.category &&
        off.transmission === params.vehicle.transmission &&
        off.durationMinutes === params.durationMinutes &&
        off.status === 'ACTIVE'
    );
    if (isDuplicate) {
      throw new OfferingDomainError(
        'Já existe uma oferta ativa idêntica para este instrutor, veículo, categoria e duração.',
        'DUPLICATE_OFFERING_EXISTS',
        409
      );
    }
  }

  const offering: ServiceOffering = {
    id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    providerId: params.providerId,
    instructorId: params.instructorId,
    vehicleId: params.vehicle.id,
    category: params.vehicle.category,
    transmission: params.vehicle.transmission,
    durationMinutes: params.durationMinutes,
    priceInCents: params.priceInCents,
    status: params.initialStatus ?? 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  validateOfferingData(offering);
  return offering;
}

/**
 * Evaluates full real-time eligibility of a Service Offering for public booking.
 * An offering is reservable if and only if:
 * 1. Provider status is ACTIVE
 * 2. Vehicle status is ACTIVE
 * 3. Offering status is ACTIVE
 * 4. Vehicle & Offering belong to the same Provider
 * 5. Vehicle category matches Offering category
 * 6. Provider is authorized for the category (Instructor profile / School registration)
 */
export function evaluateOfferingEligibility(
  provider: Provider,
  vehicle: Vehicle,
  offering: ServiceOffering
): {
  isEligible: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (provider.status !== 'ACTIVE') {
    reasons.push(`Prestador não está ativo (Status atual: '${provider.status}').`);
  }

  if (vehicle.status !== 'ACTIVE') {
    reasons.push(`Veículo associado não está ativo (Status atual: '${vehicle.status}').`);
  }

  if (offering.status !== 'ACTIVE') {
    reasons.push('Oferta de serviço está desativada.');
  }

  if (vehicle.providerId !== provider.id) {
    reasons.push('Veículo não pertence ao prestador da oferta.');
  }

  if (offering.providerId !== provider.id) {
    reasons.push('Oferta não pertence ao prestador informado.');
  }

  if (offering.vehicleId !== vehicle.id) {
    reasons.push('Vínculo incorreto entre oferta e veículo.');
  }

  if (vehicle.category !== offering.category) {
    reasons.push(
      `Incompatibilidade entre a categoria do veículo (${vehicle.category}) e a categoria da oferta (${offering.category}).`
    );
  }

  if (!isCategoryCompatible(provider.categories || [], offering.category)) {
    reasons.push(
      `Prestador não possui habilitação/autorização cadastrada para a Categoria ${offering.category}.`
    );
  }

  return {
    isEligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Sanitizes Service Offering for public catalog view.
 */
export function sanitizeOfferingForPublic(
  offering: ServiceOffering,
  vehicle: Vehicle,
  provider: Provider
): PublicServiceOfferingDto {
  const eligibility = evaluateOfferingEligibility(provider, vehicle, offering);
  return {
    id: offering.id,
    providerId: offering.providerId,
    vehicle: sanitizeVehicleForPublic(vehicle),
    category: offering.category,
    durationMinutes: offering.durationMinutes,
    priceInCents: offering.priceInCents,
    status: offering.status,
    isEligible: eligibility.isEligible,
  };
}

/**
 * Multi-tenant Authorization & Anti-Attack Safeguards
 */
export function enforceVehicleOwnership(
  vehicle: Vehicle,
  actorProviderId: string,
  actorRole: UserRole
): void {
  if (actorRole === 'SUPPORT') {
    throw new VehicleDomainError(
      'Acesso negado: O papel SUPPORT não possui permissão para criar, alterar ou gerenciar veículos.',
      'SUPPORT_VEHICLE_WRITE_DENIED',
      403
    );
  }

  if (actorRole === 'STUDENT') {
    throw new VehicleDomainError(
      'Alunos não possuem permissão para cadastrar ou gerenciar veículos.',
      'STUDENT_VEHICLE_ACCESS_DENIED',
      403
    );
  }

  if (actorRole === 'PLATFORM_ADMIN') {
    return; // System Admins have platform management scope
  }

  if (vehicle.providerId !== actorProviderId) {
    throw new VehicleDomainError(
      'Acesso negado: Prestador não é proprietário deste veículo.',
      'CROSS_PROVIDER_VEHICLE_ACCESS_DENIED',
      403
    );
  }
}

export function enforceOfferingOwnership(
  offering: ServiceOffering,
  actorProviderId: string,
  actorRole: UserRole
): void {
  if (actorRole === 'SUPPORT') {
    throw new OfferingDomainError(
      'Acesso negado: O papel SUPPORT não possui permissão para criar, alterar ou gerenciar ofertas ou preços.',
      'SUPPORT_OFFERING_WRITE_DENIED',
      403
    );
  }

  if (actorRole === 'STUDENT') {
    throw new OfferingDomainError(
      'Alunos não possuem permissão para gerenciar ofertas de serviço.',
      'STUDENT_OFFERING_ACCESS_DENIED',
      403
    );
  }

  if (actorRole === 'PLATFORM_ADMIN') {
    return;
  }

  if (offering.providerId !== actorProviderId) {
    throw new OfferingDomainError(
      'Acesso negado: Prestador não é proprietário desta oferta de serviço.',
      'CROSS_PROVIDER_OFFERING_ACCESS_DENIED',
      403
    );
  }
}

/**
 * Enforces permissions and rules for activating a vehicle.
* Providers CANNOT activate a vehicle in DRAFT, PENDING, or IN_REVIEW status directly.
* Status transition DRAFT/IN_REVIEW -> ACTIVE requires platform review/approval.
 */
export function validateVehicleActivationPermission(
  currentVehicle: Vehicle,
  actorRole: UserRole
): void {
  if (actorRole === 'SUPPORT') {
    throw new VehicleDomainError(
      'O papel SUPPORT não possui permissão para alterar o status do veículo.',
      'SUPPORT_VEHICLE_ACTIVATION_DENIED',
      403
    );
  }

if (currentVehicle.status === 'DRAFT' || currentVehicle.status === 'PENDING' || currentVehicle.status === 'IN_REVIEW') {
    if (actorRole !== 'PLATFORM_ADMIN') {
      throw new VehicleDomainError(
        `Prestadores não podem ativar diretamente um veículo em estado '${currentVehicle.status}'. O veículo deve passar pelo fluxo de homologação/review.`,
        'PROVIDER_DIRECT_VEHICLE_ACTIVATION_DENIED',
        403
      );
    }
  }

  if (currentVehicle.status === 'BLOCKED') {
    throw new VehicleDomainError(
      'Veículo bloqueado administrativamente não pode ser ativado.',
      'BLOCKED_VEHICLE_ACTIVATION_DENIED',
      422
    );
  }

  validateVehicleStatusTransition(currentVehicle.status, 'ACTIVE');
}

/**
 * Enforces permissions and rules for activating a service offering.
 * Provider can activate an offering ONLY if:
 * - Provider status is ACTIVE
 * - Vehicle status is ACTIVE
 * - Offering and Vehicle belong to the same Provider
 * - Category is compatible
 */
export function validateOfferingActivationPermission(
  provider: Provider,
  vehicle: Vehicle,
  offering: ServiceOffering,
  actorRole: UserRole
): void {
  if (actorRole === 'SUPPORT') {
    throw new OfferingDomainError(
      'O papel SUPPORT não possui permissão para ativar ou alterar ofertas de serviço.',
      'SUPPORT_OFFERING_ACTIVATION_DENIED',
      403
    );
  }

  if (provider.status !== 'ACTIVE') {
    throw new OfferingDomainError(
      `Não é possível ativar oferta de serviço para um prestador não ativo (Status: '${provider.status}').`,
      'INACTIVE_PROVIDER_OFFERING_ACTIVATION_DENIED',
      422
    );
  }

  if (vehicle.status !== 'ACTIVE') {
    throw new OfferingDomainError(
      `Não é possível ativar oferta de serviço para um veículo não ativo (Status: '${vehicle.status}').`,
      'INACTIVE_VEHICLE_OFFERING_ACTIVATION_DENIED',
      422
    );
  }

  if (vehicle.providerId !== provider.id || offering.providerId !== provider.id || offering.vehicleId !== vehicle.id) {
    throw new OfferingDomainError(
      'A oferta, o veículo e o prestador devem ser estritamente correspondentes.',
      'OFFERING_VEHICLE_PROVIDER_MISMATCH',
      403
    );
  }
}

/**
 * Constructs structured AuditLog entry for vehicle and offering actions
 */
export function createVehicleAuditLog(params: {
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action:
    | 'VEHICLE_CREATED'
    | 'VEHICLE_UPDATED'
    | 'VEHICLE_SUBMITTED'
    | 'VEHICLE_APPROVED'
    | 'VEHICLE_REJECTED'
    | 'VEHICLE_ACTIVATED'
    | 'VEHICLE_DEACTIVATED'
    | 'OFFERING_CREATED'
    | 'OFFERING_UPDATED'
    | 'OFFERING_ACTIVATED'
    | 'OFFERING_DEACTIVATED';
  entityType: 'VEHICLE' | 'SERVICE_OFFERING';
  entityId: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
}): AuditLog {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    previousValue: params.previousValue,
    newValue: params.newValue,
    timestamp: new Date().toISOString(),
    ipAddress: params.ipAddress || '127.0.0.1',
  };
}

/**
 * Administrative vehicle approval by PLATFORM_ADMIN
 */
export function approveVehicle(
  vehicle: Vehicle,
  reviewer: { userId: string; email: string; roles: UserRole[]; status: string },
  provider: Provider
): { vehicle: Vehicle; auditLog: AuditLog } {
  if (reviewer.status === 'BLOCKED') {
    throw new VehicleDomainError('Usuário bloqueado.', 'USER_BLOCKED', 403);
  }
  if (!reviewer.roles.includes('PLATFORM_ADMIN')) {
    throw new VehicleDomainError(
      'Apenas administradores da plataforma (PLATFORM_ADMIN) podem aprovar veículos.',
      'FORBIDDEN_VEHICLE_APPROVAL',
      403
    );
  }
  if (vehicle.providerId === reviewer.userId) {
    throw new VehicleDomainError(
      'Violação de Segurança: O usuário não pode aprovar o seu próprio veículo.',
      'SELF_APPROVAL_PROHIBITED',
      403
    );
  }

  validateVehicleStatusTransition(vehicle.status, 'ACTIVE');

  // Verify provider is active
  if (provider.status !== 'ACTIVE') {
    throw new VehicleDomainError(
      'Não é possível aprovar veículo para um prestador que não está ativo.',
      'INACTIVE_PROVIDER_VEHICLE_APPROVAL_DENIED',
      422
    );
  }

  const updated: Vehicle = {
    ...vehicle,
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
  };

  const auditLog = createVehicleAuditLog({
    actorId: reviewer.userId,
    actorName: reviewer.email || 'Admin',
    actorRole: 'PLATFORM_ADMIN',
    action: 'VEHICLE_APPROVED',
    entityType: 'VEHICLE',
    entityId: vehicle.id,
    previousValue: vehicle.status,
    newValue: 'ACTIVE',
  });

  return { vehicle: updated, auditLog };
}

/**
 * Administrative vehicle rejection or block by PLATFORM_ADMIN
 */
export function rejectVehicle(
  vehicle: Vehicle,
  reviewer: { userId: string; email: string; roles: UserRole[]; status: string },
  reason: string
): { vehicle: Vehicle; auditLog: AuditLog } {
  if (reviewer.status === 'BLOCKED') {
    throw new VehicleDomainError('Usuário bloqueado.', 'USER_BLOCKED', 403);
  }
  if (!reviewer.roles.includes('PLATFORM_ADMIN')) {
    throw new VehicleDomainError(
      'Apenas administradores da plataforma (PLATFORM_ADMIN) podem rejeitar veículos.',
      'FORBIDDEN_VEHICLE_REJECTION',
      403
    );
  }
  if (!reason || !reason.trim()) {
    throw new VehicleDomainError('Motivo é obrigatório para rejeitar o veículo.', 'MISSING_REASON', 400);
  }

  const updated: Vehicle = {
    ...vehicle,
    status: 'INACTIVE',
    description: `Rejeitado: ${reason.trim()}. ${vehicle.description || ''}`,
    updatedAt: new Date().toISOString(),
  };

  const auditLog = createVehicleAuditLog({
    actorId: reviewer.userId,
    actorName: reviewer.email || 'Admin',
    actorRole: 'PLATFORM_ADMIN',
    action: 'VEHICLE_REJECTED',
    entityType: 'VEHICLE',
    entityId: vehicle.id,
    previousValue: vehicle.status,
    newValue: 'INACTIVE',
  });

  return { vehicle: updated, auditLog };
}

/**
 * Administrative vehicle block by PLATFORM_ADMIN
 */
export function blockVehicle(
  vehicle: Vehicle,
  reviewer: { userId: string; email: string; roles: UserRole[]; status: string },
  reason: string
): { vehicle: Vehicle; auditLog: AuditLog } {
  if (reviewer.status === 'BLOCKED') {
    throw new VehicleDomainError('Usuário bloqueado.', 'USER_BLOCKED', 403);
  }
  if (!reviewer.roles.includes('PLATFORM_ADMIN')) {
    throw new VehicleDomainError(
      'Apenas administradores da plataforma (PLATFORM_ADMIN) podem bloquear veículos.',
      'FORBIDDEN_VEHICLE_BLOCK',
      403
    );
  }
  if (!reason || !reason.trim()) {
    throw new VehicleDomainError('Motivo é obrigatório para bloquear o veículo.', 'MISSING_REASON', 400);
  }

  validateVehicleStatusTransition(vehicle.status, 'BLOCKED');

  const updated: Vehicle = {
    ...vehicle,
    status: 'BLOCKED',
    description: `Bloqueado administrativamente: ${reason.trim()}. ${vehicle.description || ''}`,
    updatedAt: new Date().toISOString(),
  };

  const auditLog = createVehicleAuditLog({
    actorId: reviewer.userId,
    actorName: reviewer.email || 'Admin',
    actorRole: 'PLATFORM_ADMIN',
    action: 'VEHICLE_UPDATED',
    entityType: 'VEHICLE',
    entityId: vehicle.id,
    previousValue: vehicle.status,
    newValue: 'BLOCKED',
  });

  return { vehicle: updated, auditLog };
}
