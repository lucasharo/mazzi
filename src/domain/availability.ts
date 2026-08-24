// ============================================================================
// MAZZI PLATFORM — AVAILABILITY & SCHEDULING ENGINE
// Domain logic, slot generation algorithm, resource pairing, conflict detection,
// exception precedence, timezone handling, and security guards.
// ============================================================================

import {
  DayOfWeek,
  AvailabilityRule,
  AvailabilityException,
  AvailabilityCandidate,
  AvailabilitySlot,
  SlotGenerationOptions,
  BookingStatus,
  UserRole,
  Provider,
  Vehicle,
  ServiceOffering,
  VehicleCategory,
} from '../types';

export class AvailabilityDomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AvailabilityDomainError';
  }
}

/** Canonical Single Source of Truth for Student Booking Horizon (MVP: 60 moving days) */
export const STUDENT_BOOKING_HORIZON_DAYS = 60;
export const AVAILABILITY_SEARCH_HORIZON_DAYS = STUDENT_BOOKING_HORIZON_DAYS;

/**
 * Autonomous instructors share one weekly agenda across their active vehicles.
 * Driving-school rules retain their existing resource scope when edited.
 */
export function normalizeWeeklyAvailabilityRuleForProvider(
  rule: AvailabilityRule,
  providerType: Provider['type'],
): AvailabilityRule {
  return providerType === 'INSTRUCTOR'
    ? { ...rule, vehicleId: undefined }
    : rule;
}

// Global System Configuration Defaults
// IMPORTANT: These default values are configured for development/testing environments (DEFAULT_DEVELOPMENT_CONFIGURATION).
// They MUST NOT be treated as rigid commercial business decisions and can be overridden dynamically at runtime.
export const DEFAULT_DEVELOPMENT_CONFIGURATION = {
  horizonDays: STUDENT_BOOKING_HORIZON_DAYS,
  noticeMinutes: 120, // 2 hours minimum notice
  defaultTimezone: 'America/Sao_Paulo',
};

export const DEFAULT_TIMEZONE = DEFAULT_DEVELOPMENT_CONFIGURATION.defaultTimezone;
export const MINIMUM_BOOKING_NOTICE_MINUTES = DEFAULT_DEVELOPMENT_CONFIGURATION.noticeMinutes;

// Day of Week Mapping Table (ISO 1=Monday .. 7=Sunday)
export const DAY_OF_WEEK_LABELS_PT: Record<DayOfWeek, string> = {
  MONDAY: 'Segunda-feira',
  TUESDAY: 'Terça-feira',
  WEDNESDAY: 'Quarta-feira',
  THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export const DAY_OF_WEEK_MAP: Record<DayOfWeek, { iso: number; js: number; label: string }> = {
  MONDAY: { iso: 1, js: 1, label: 'Segunda-feira' },
  TUESDAY: { iso: 2, js: 2, label: 'Terça-feira' },
  WEDNESDAY: { iso: 3, js: 3, label: 'Quarta-feira' },
  THURSDAY: { iso: 4, js: 4, label: 'Quinta-feira' },
  FRIDAY: { iso: 5, js: 5, label: 'Sexta-feira' },
  SATURDAY: { iso: 6, js: 6, label: 'Sábado' },
  SUNDAY: { iso: 7, js: 0, label: 'Domingo' },
};

export const JS_DAY_TO_DAY_OF_WEEK: Record<number, DayOfWeek> = {
  0: 'SUNDAY',
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: 'SATURDAY',
};

export interface TimeSlotInterval {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (e.g. "14:00")
  endTime: string; // HH:mm (e.g. "15:00")
  instructorId: string;
  vehicleId: string;
}

/**
 * Converts "HH:mm" to minutes from start of the day (0..1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export const LESSON_START_INTERVAL_MINUTES = 60;

/**
 * Converts minutes from start of day to "HH:mm" format.
 */
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Determines if two daily time intervals on the same date overlap using semi-open intervals [start, end).
 * Rule: [startA, endA) overlaps with [startB, endB) if startA < endB and startB < endA.
 */
export function doIntervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const minStartA = timeStringToMinutes(startA);
  const minEndA = timeStringToMinutes(endA);
  const minStartB = timeStringToMinutes(startB);
  const minEndB = timeStringToMinutes(endB);

  return minStartA < minEndB && minStartB < minEndA;
}

/**
 * Determines if two ISO timestamp intervals [startA, endA) and [startB, endB) overlap.
 */
export function doTimestampRangesOverlap(
  startAIso: string,
  endAIso: string,
  startBIso: string,
  endBIso: string
): boolean {
  const tStartA = new Date(startAIso).getTime();
  const tEndA = new Date(endAIso).getTime();
  const tStartB = new Date(startBIso).getTime();
  const tEndB = new Date(endBIso).getTime();

  return tStartA < tEndB && tStartB < tEndA;
}

/**
 * Returns DayOfWeek enum string from YYYY-MM-DD date string
 */
export function getDayOfWeekFromDateString(dateStr: string): DayOfWeek {
  const [year, month, day] = dateStr.split('-').map(Number);
  const jsDay = new Date(year, month - 1, day).getDay();
  return JS_DAY_TO_DAY_OF_WEEK[jsDay];
}

/**
 * Statuses that actively block/consume schedule availability.
 * CRITICAL SINGLE SOURCE OF TRUTH: Must stay 100% synchronized with PostgreSQL migration
 * '20260814000001_initial_schema.sql' exclude constraint clause:
 * WHERE status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
 */
export const ACTIVE_CONFLICT_BOOKING_STATUSES: BookingStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
];

export const NON_BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  'CANCELLED_BY_STUDENT',
  'CANCELLED_BY_PROVIDER',
  'EXPIRED',
  'COMPLETED',
];

/**
 * Checks whether a booking status consumes schedule availability (blocks the slot).
 */
export function isBookingActiveConflictStatus(status: BookingStatus): boolean {
  return ACTIVE_CONFLICT_BOOKING_STATUSES.includes(status);
}

/**
 * AVAILABILITY_PRECHECK — Application & Domain Level Pre-Check
 *
 * IMPORTANT ARCHITECTURAL CLASSIFICATION:
 * This function is an in-memory application-level pre-check (AVAILABILITY_PRECHECK) used
 * during slot generation and pre-checkout quote validation to improve UX and prevent showing
 * obviously occupied slots.
 *
 * NOT AN ATOMIC CONCURRENCY LOCK:
 * This function does NOT provide atomic concurrency protection against race conditions.
 * Final transactional concurrency locking will be guaranteed at the database level in Sprint 08
 * via PostgreSQL 'EXCLUDE USING gist' constraints on overlapping tsrange intervals + ACID transactions.
 */
export function hasBookingConflict(
  candidate: TimeSlotInterval,
  existingBookings: {
    scheduledDate?: string;
    date?: string;
    startTime: string;
    endTime: string;
    instructorId: string;
    vehicleId: string;
    status?: BookingStatus;
    holdExpiresAt?: string;
  }[]
): { hasConflict: boolean; reason?: string } {
  const nowMs = Date.now();
  for (const existing of existingBookings) {
    if (existing.status && !isBookingActiveConflictStatus(existing.status)) {
      continue;
    }
    if (existing.status === 'PENDING_PAYMENT' && existing.holdExpiresAt) {
      if (new Date(existing.holdExpiresAt).getTime() <= nowMs) {
        continue;
      }
    }

    const bookingDate = existing.scheduledDate || existing.date;
    if (bookingDate !== candidate.date) {
      continue;
    }

    const overlaps = doIntervalsOverlap(
      candidate.startTime,
      candidate.endTime,
      existing.startTime,
      existing.endTime
    );

    if (overlaps) {
      if (existing.instructorId === candidate.instructorId) {
        return {
          hasConflict: true,
          reason: `O instrutor já possui uma aula agendada entre ${existing.startTime} e ${existing.endTime}.`,
        };
      }
      if (existing.vehicleId === candidate.vehicleId) {
        return {
          hasConflict: true,
          reason: `O veículo selecionado já está alocado para outra aula entre ${existing.startTime} e ${existing.endTime}.`,
        };
      }
    }
  }

  return { hasConflict: false };
}

// ============================================================================
// SECURITY & RBAC AUTHORIZATION GUARDS
// ============================================================================

/**
 * Security Guard: Enforces write authorization on Availability Rules and Exceptions.
 */
export function enforceAvailabilityOwnership(params: {
  targetProviderId: string;
  actorProviderId: string;
  actorRole: UserRole;
  providerStatus?: string;
  targetVehicleId?: string;
  targetInstructorId?: string;
  providerVehicles?: Vehicle[];
  providerInstructors?: string[];
}): void {
  const {
    targetProviderId,
    actorProviderId,
    actorRole,
    providerStatus,
    targetVehicleId,
    targetInstructorId,
    providerVehicles,
    providerInstructors,
  } = params;

  if (actorRole === 'STUDENT') {
    throw new AvailabilityDomainError(
      'Acesso negado: Alunos não possuem permissão para gerenciar a agenda de disponibilidade.',
      'STUDENT_AVAILABILITY_WRITE_DENIED',
      403
    );
  }

  if (actorRole === 'SUPPORT') {
    throw new AvailabilityDomainError(
      'Acesso negado: O papel SUPPORT não possui permissão para criar, alterar ou remover horários da agenda.',
      'SUPPORT_AVAILABILITY_WRITE_DENIED',
      403
    );
  }

  if (providerStatus && providerStatus !== 'ACTIVE' && providerStatus !== 'DRAFT' && providerStatus !== 'PENDING_REVIEW') {
    throw new AvailabilityDomainError(
      `Prestador suspenso ou bloqueado (Status: '${providerStatus}') não pode alterar sua agenda.`,
      'INACTIVE_PROVIDER_AVAILABILITY_WRITE_DENIED',
      403
    );
  }

  if (actorRole !== 'PLATFORM_ADMIN') {
    if (targetProviderId !== actorProviderId) {
      throw new AvailabilityDomainError(
        'Acesso negado: Não é permitido gerenciar a agenda de outro prestador/CFC.',
        'PROVIDER_CROSS_ACCESS_DENIED',
        403
      );
    }
  }

  if (targetVehicleId && providerVehicles) {
    const belongs = providerVehicles.some((v) => v.id === targetVehicleId);
    if (!belongs) {
      throw new AvailabilityDomainError(
        'Acesso negado: O veículo informado não pertence a este prestador.',
        'ALIEN_RESOURCE_AVAILABILITY_DENIED',
        403
      );
    }
  }

  if (targetInstructorId && providerInstructors) {
    const belongs = providerInstructors.some((iId) => iId === targetInstructorId);
    if (!belongs) {
      throw new AvailabilityDomainError(
        'Acesso negado: O instrutor informado não pertence a este prestador/CFC.',
        'ALIEN_RESOURCE_AVAILABILITY_DENIED',
        403
      );
    }
  }
}

/**
 * Validates a recurring AvailabilityRule for logical consistency.
 */
export function validateAvailabilityRule(
  rule: Partial<AvailabilityRule>,
  existingRules: AvailabilityRule[] = []
): void {
  if (!rule.startTime || !rule.endTime || !rule.dayOfWeek) {
    throw new AvailabilityDomainError(
      'Regra de disponibilidade exige dia da semana, horário inicial e horário final.',
      'INVALID_RULE_STRUCTURE',
      400
    );
  }

  const startMin = timeStringToMinutes(rule.startTime);
  const endMin = timeStringToMinutes(rule.endTime);

  const startSeconds = Number(rule.startTime.split(':')[2] || 0);
  const endSeconds = Number(rule.endTime.split(':')[2] || 0);
  if (startMin % 60 !== 0 || endMin % 60 !== 0 || startSeconds !== 0 || endSeconds !== 0) {
    throw new AvailabilityDomainError(
      'Escolha horários em hora cheia, como 08:00 ou 09:00.',
      'AVAILABILITY_FULL_HOUR_REQUIRED',
      400,
    );
  }

  if (startMin >= endMin) {
    throw new AvailabilityDomainError(
      `Horário inicial (${rule.startTime}) deve ser menor que o horário final (${rule.endTime}). Não são permitidas janelas noturnas atravessando meia-noite no MVP.`,
      'INVALID_TIME_WINDOW',
      400
    );
  }

  // Check overlap with existing active rules for the same day and target resources
  for (const existing of existingRules) {
    if (!existing.isActive || existing.id === rule.id) continue;

    if (existing.dayOfWeek === rule.dayOfWeek) {
      const sameInstructor = !rule.instructorId || !existing.instructorId || rule.instructorId === existing.instructorId;
      const sameVehicle = !rule.vehicleId || !existing.vehicleId || rule.vehicleId === existing.vehicleId;

      if (sameInstructor && sameVehicle) {
        if (doIntervalsOverlap(rule.startTime, rule.endTime, existing.startTime, existing.endTime)) {
          throw new AvailabilityDomainError(
            `A janela ${rule.startTime}–${rule.endTime} sobrepõe a regra existente (${existing.startTime}–${existing.endTime}) para este dia da semana.`,
            'OVERLAPPING_RECURRING_RULE',
            409
          );
        }
      }
    }
  }
}

/**
 * Validates an AvailabilityException for logical consistency.
 */
export function validateAvailabilityException(exception: Partial<AvailabilityException>): void {
  if (!exception.startAt || !exception.endAt || !exception.type || !exception.reasonCategory) {
    throw new AvailabilityDomainError(
      'Exceção exige tipo, categoria de motivo, data/hora inicial e data/hora final.',
      'INVALID_EXCEPTION_STRUCTURE',
      400
    );
  }

  const startMs = new Date(exception.startAt).getTime();
  const endMs = new Date(exception.endAt).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    throw new AvailabilityDomainError(
      'Formatos de data/hora da exceção são inválidos.',
      'INVALID_DATE_FORMAT',
      400
    );
  }

  if (startMs >= endMs) {
    throw new AvailabilityDomainError(
      'A data/hora inicial da exceção deve ser estritamente anterior à data/hora final.',
      'INVALID_EXCEPTION_WINDOW',
      400
    );
  }
}

// ============================================================================
// SLOT GENERATION ENGINE
// ============================================================================

/**
 * Helper to build an ISO 8601 UTC string from YYYY-MM-DD date and HH:mm time in a timezone.
 */
export function createIsoTimestamp(dateStr: string, timeStr: string, timezone: string = DEFAULT_TIMEZONE): string {
  // Simple deterministic ISO construction assuming BRT offset -03:00 for America/Sao_Paulo
  // In production with Luxon, timezone DST is resolved dynamically.
  const tzOffset = '-03:00';
  return `${dateStr}T${timeStr}:00.000${tzOffset}`;
}

/**
 * Core Algorithm: Generates all eligible available slots for a given offering, date range, and resource state.
 *
 * Evaluation Pipeline for each potential slot:
 * 1. Provider ACTIVE?
 * 2. Vehicle ACTIVE?
 * 3. Offering ACTIVE?
 * 4. Category compatible?
 * 5. Allowed by Base Recurring Availability OR covered by AVAILABLE_OVERRIDE?
 * 6. Excluded by ANY overlapping BLOCK exception for provider/instructor/vehicle? (BLOCK precedence)
 * 7. Occupied by existing active Bookings (PENDING_PAYMENT, CONFIRMED, IN_PROGRESS)?
 * 8. Slot fits entirely in window?
 * 9. Slot is in the future (minimum notice >= 120m)?
 * 10. Max advance days respected (<= 30 days)?
 */
export function generateAvailableSlots(options: SlotGenerationOptions): AvailabilityCandidate[] {
  const {
    offering,
    provider,
    vehicles,
    instructors = [],
    startDate,
    endDate,
    timezone = DEFAULT_TIMEZONE,
    stepMinutes = LESSON_START_INTERVAL_MINUTES,
    bufferMinutes = 0,
    minimumNoticeMinutes = MINIMUM_BOOKING_NOTICE_MINUTES,
    maxAdvanceDays = AVAILABILITY_SEARCH_HORIZON_DAYS,
    now: injectedNow,
    availabilityRules,
    exceptions,
    existingBookings,
    instructorGlobalBlocks = [],
  } = options;

  // 1. Check Provider status
  if (provider.status !== 'ACTIVE') {
    return [];
  }

  // 2. Check Offering status
  if (offering.status !== 'ACTIVE') {
    return [];
  }

  // 3. Filter eligible vehicles
  const eligibleVehicles = vehicles.filter(
    (v) =>
      v.id === offering.vehicleId &&
      v.providerId === provider.id &&
      v.status === 'ACTIVE' &&
      v.category === offering.category
  );

  if (eligibleVehicles.length === 0) {
    return [];
  }

  // 4. Determine eligible instructors
  let eligibleInstructors: { id: string; name: string }[] = [];
  if (provider.type === 'INSTRUCTOR') {
    eligibleInstructors = [
      {
        id: provider.id,
        name: provider.name,
      },
    ];
  } else {
    // DRIVING_SCHOOL
    if (instructors && instructors.length > 0) {
      eligibleInstructors = instructors.filter((inst) => {
        const isCatMatch =
          !inst.categories ||
          inst.categories.length === 0 ||
          inst.categories.includes(offering.category);
        return inst.isAvailable !== false && isCatMatch;
      });
    }

    // Fallback if explicit instructor list is empty: derive from availability rules or provider itself
    if (eligibleInstructors.length === 0) {
      const ruleInstructorIds = new Set(
        availabilityRules.map((r) => r.instructorId).filter(Boolean)
      );
      if (ruleInstructorIds.size > 0) {
        eligibleInstructors = Array.from(ruleInstructorIds).map((id) => ({
          id,
          name: `${provider.name} (Instrutor)`,
        }));
      } else {
        eligibleInstructors = [{ id: provider.id, name: provider.name }];
      }
    }
  }

  if (eligibleInstructors.length === 0) {
    return [];
  }

  const candidateSlots: AvailabilityCandidate[] = [];
  const referenceNow = injectedNow || new Date();
  const minNoticeMs = minimumNoticeMinutes * 60 * 1000;
  const earliestAllowedMs = referenceNow.getTime() + minNoticeMs;

  const horizonMaxMs = referenceNow.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000;

  // Generate date list between startDate and endDate
  const dateList: string[] = [];
  const curr = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (curr <= end) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    dateList.push(`${yyyy}-${mm}-${dd}`);
    curr.setDate(curr.getDate() + 1);
  }

  for (const dateStr of dateList) {
    const dayOfWeek = getDayOfWeekFromDateString(dateStr);

    // Filter active availability rules for this day, enforcing effectiveFrom and effectiveTo dates
    const dayRules = availabilityRules.filter((r) => {
      if (!r.isActive || r.dayOfWeek !== dayOfWeek || r.providerId !== provider.id) return false;
      if (r.effectiveFrom && dateStr < r.effectiveFrom) return false;
      if (r.effectiveTo && dateStr > r.effectiveTo) return false;
      return true;
    });

    // Filter AVAILABLE_OVERRIDE exceptions for this date
    const dayOverrides = exceptions.filter((ex) => {
      if (ex.isActive === false || ex.type !== 'AVAILABLE_OVERRIDE') return false;
      const exStart = ex.startAt.slice(0, 10);
      const exEnd = ex.endAt.slice(0, 10);
      return dateStr >= exStart && dateStr <= exEnd;
    });

    if (dayRules.length === 0 && dayOverrides.length === 0) {
      continue;
    }

    // Filter BLOCK exceptions affecting this date range
    const activeBlockExceptions = exceptions.filter((ex) => ex.isActive !== false && ex.type === 'BLOCK');

    for (const vehicle of eligibleVehicles) {
      for (const instructor of eligibleInstructors) {
        // Collect daily windows from rules
        const windows: { startTime: string; endTime: string }[] = [];

        for (const rule of dayRules) {
          if (!rule.instructorId || rule.instructorId === instructor.id) {
            if (!rule.vehicleId || rule.vehicleId === vehicle.id) {
              windows.push({ startTime: rule.startTime, endTime: rule.endTime });
            }
          }
        }

        for (const override of dayOverrides) {
          if (!override.instructorId || override.instructorId === instructor.id) {
            if (!override.vehicleId || override.vehicleId === vehicle.id) {
              const startT = override.startAt.includes('T') ? override.startAt.split('T')[1].slice(0, 5) : '08:00';
              const endT = override.endAt.includes('T') ? override.endAt.split('T')[1].slice(0, 5) : '18:00';
              windows.push({ startTime: startT, endTime: endT });
            }
          }
        }

        for (const window of windows) {
          const windowStartMin = timeStringToMinutes(window.startTime);
          const windowEndMin = timeStringToMinutes(window.endTime);
          const duration = offering.durationMinutes;

          let slotStartMin = windowStartMin;

          while (slotStartMin + duration <= windowEndMin) {
            const slotEndMin = slotStartMin + duration;
            const slotStartStr = minutesToTimeString(slotStartMin);
            const slotEndStr = minutesToTimeString(slotEndMin);

            const startIso = createIsoTimestamp(dateStr, slotStartStr, timezone);
            const endIso = createIsoTimestamp(dateStr, slotEndStr, timezone);
            const startMs = new Date(startIso).getTime();

            // Check 1: Future and Minimum Notice
            if (startMs < earliestAllowedMs || startMs > horizonMaxMs) {
              slotStartMin += stepMinutes + bufferMinutes;
              continue;
            }

            // Check 2: BLOCK Exception precedence (BLOCK > AVAILABLE_OVERRIDE / Base Rules)
            // A block applies if it matches provider AND vehicle (if specified) AND instructor (if specified)
            let isBlocked = false;
            for (const block of activeBlockExceptions) {
              const appliesToProvider = block.providerId === provider.id;
              const appliesToVehicle = !block.vehicleId || block.vehicleId === vehicle.id;
              const appliesToInstructor = !block.instructorId || block.instructorId === instructor.id;

              if (appliesToProvider && appliesToVehicle && appliesToInstructor) {
                if (doTimestampRangesOverlap(startIso, endIso, block.startAt, block.endAt)) {
                  isBlocked = true;
                  break;
                }
              }
            }

            if (isBlocked) {
              slotStartMin += stepMinutes + bufferMinutes;
              continue;
            }

            // Check 3: Existing Booking Conflict for Instructor OR Vehicle
            const conflictCheck = hasBookingConflict(
              {
                date: dateStr,
                startTime: slotStartStr,
                endTime: slotEndStr,
                instructorId: instructor.id,
                vehicleId: vehicle.id,
              },
              existingBookings
            );

            if (conflictCheck.hasConflict) {
              slotStartMin += stepMinutes + bufferMinutes;
              continue;
            }

            if (instructorGlobalBlocks.some((block) => doTimestampRangesOverlap(startIso, endIso, block.start_at, block.end_at))) {
              slotStartMin += stepMinutes + bufferMinutes;
              continue;
            }

            // All checks passed! Accept slot candidate
            candidateSlots.push({
              startAt: startIso,
              endAt: endIso,
              date: dateStr,
              startTime: slotStartStr,
              endTime: slotEndStr,
              providerId: provider.id,
              offeringId: offering.id,
              instructorId: instructor.id,
              instructorName: instructor.name,
              vehicleId: vehicle.id,
              vehicleName: `${vehicle.brand} ${vehicle.model}`,
              durationMinutes: offering.durationMinutes,
              priceInCents: offering.priceInCents,
              category: offering.category,
            });

            slotStartMin += stepMinutes + bufferMinutes;
          }
        }
      }
    }
  }

  return candidateSlots;
}

/**
 * Sanitizes candidate slot for public presentation, stripping internal notes/reasons.
 */
export function sanitizeSlotForPublic(candidate: AvailabilityCandidate): AvailabilitySlot {
  return {
    id: `slot_${candidate.providerId}_${candidate.date}_${candidate.startTime.replace(':', '')}`,
    providerId: candidate.providerId,
    instructorId: candidate.instructorId,
    instructorName: candidate.instructorName,
    vehicleId: candidate.vehicleId,
    vehicleName: candidate.vehicleName || 'Veículo do Prestador',
    date: candidate.date,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    isBooked: false,
    startAt: candidate.startAt,
    endAt: candidate.endAt,
  };
}
