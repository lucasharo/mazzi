import type {
  Booking,
  InstantLessonOffer,
  InstantLessonPriceOption,
  InstantLessonSettings,
  TransmissionType,
  VehicleCategory,
} from '../types';
import { getBookingEndTimestamp, getBookingStartTimestamp } from './booking';

export type InstantOperationalState =
  | 'WAITING_PAYMENT'
  | 'CONFIRMED'
  | 'ON_THE_WAY'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'TERMINAL';

export function getInstantOperationalState(input: {
  bookingStatus: string;
  providerOnTheWayAt?: string | null;
  instructorCheckedIn?: boolean;
}): InstantOperationalState {
  const status = String(input.bookingStatus || '').toUpperCase();
  if (status === 'PENDING_PAYMENT') return 'WAITING_PAYMENT';
  if (status === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (status === 'CONFIRMED') {
    if (input.instructorCheckedIn) return 'ARRIVED';
    if (input.providerOnTheWayAt) return 'ON_THE_WAY';
    return 'CONFIRMED';
  }
  return 'TERMINAL';
}

export const INSTANT_LESSON_MAX_ARRIVAL_MINUTES = 30;
export const INSTANT_LESSON_SAFETY_MARGIN_MINUTES = 15;
export const INSTANT_LESSON_UI_CONFLICT_WINDOW_MINUTES = 50 + INSTANT_LESSON_SAFETY_MARGIN_MINUTES;
export const INSTANT_MATCH_WAVE_SIZE = 3;
export const INSTANT_OFFER_TIMEOUT_SECONDS = 15;
export const INSTANT_LOCATION_FRESHNESS_SECONDS = 30;
export const INSTANT_PROVIDER_LOCATION_INTERVAL_SECONDS = 10;
export const INSTANT_STUDENT_TRACKING_INTERVAL_SECONDS = 8;
export const INSTANT_INSTRUCTOR_AVAILABILITY_WINDOW_MINUTES = 60;

export function isInstantInstructorAvailabilityActive(
  status: { instantOnline: boolean; onlineExpiresAt?: string | null },
  nowMs = Date.now(),
): boolean {
  if (!status.instantOnline || !status.onlineExpiresAt) return false;
  const expiresAtMs = new Date(status.onlineExpiresAt).getTime();
  return Number.isFinite(expiresAtMs) && nowMs < expiresAtMs;
}

/**
 * Calculates the display countdown using the backend clock when available.
 * The backend remains authoritative when the professional accepts or declines.
 */
export function getInstantOfferSecondsLeft(
  expiresAt: string,
  nowMs = Date.now(),
  serverClockOffsetMs = 0,
): number {
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return 0;
  return Math.max(0, Math.ceil((expiresAtMs - (nowMs + serverClockOffsetMs)) / 1000));
}

export function formatInstantInstructorAvailability(
  status: { instantOnline: boolean; onlineExpiresAt?: string | null },
  nowMs = Date.now(),
): string | null {
  if (!status.instantOnline || !status.onlineExpiresAt) return null;
  const remainingMinutes = Math.ceil((new Date(status.onlineExpiresAt).getTime() - nowMs) / 60_000);
  return remainingMinutes > 0 ? `Disponível por mais ${remainingMinutes} min.` : null;
}

export interface InstantLessonAvailabilityNotice {
  reason: 'IN_PROGRESS' | 'CONFLICT';
  title: string;
  description: string;
}

/**
 * Gives home screens a conservative explanation before opening Aula Agora.
 * The backend remains authoritative for the complete travel-time calculation.
 */
export function getInstantLessonAvailabilityNotice(
  bookings: Booking[],
  nowMs = Date.now(),
): InstantLessonAvailabilityNotice | null {
  const activeBookings = bookings.filter((booking) => {
    if (booking.status === 'PENDING_PAYMENT') {
      return !booking.holdExpiresAt || new Date(booking.holdExpiresAt).getTime() > nowMs;
    }
    return booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS';
  });

  const currentBooking = activeBookings.find((booking) => {
    const startMs = getBookingStartTimestamp(booking);
    const endMs = getBookingEndTimestamp(booking);
    // IN_PROGRESS is authoritative until the backend finishes the lesson,
    // including a session that runs beyond its originally scheduled end.
    return booking.status === 'IN_PROGRESS' || (endMs > nowMs && startMs > 0 && startMs <= nowMs);
  });

  if (currentBooking) {
    return {
      reason: 'IN_PROGRESS',
      title: 'Aula Agora indisponível neste momento',
      description: 'Você está em uma aula em andamento. Assim que ela terminar, a opção ficará disponível novamente.',
    };
  }

  const hasUpcomingConflict = activeBookings.some((booking) => {
    const startMs = getBookingStartTimestamp(booking);
    return startMs > nowMs && startMs - nowMs <= INSTANT_LESSON_UI_CONFLICT_WINDOW_MINUTES * 60 * 1000;
  });

  return hasUpcomingConflict ? {
    reason: 'CONFLICT',
    title: 'Aula Agora indisponível por enquanto',
    description: 'Você tem uma aula próxima e a janela de segurança precisa ser preservada. Tente novamente após esse período.',
  } : null;
}

export interface InstantLessonCandidate {
  providerId: string;
  offeringId: string;
  instructorId: string;
  vehicleId: string;
  category: VehicleCategory;
  transmission: TransmissionType;
  priceInCents: number;
  durationMinutes: number;
  distanceMeters: number;
  etaMinutes: number;
  locationAgeSeconds: number;
  hasScheduleConflict: boolean;
  fairnessScore?: number;
}

export interface NextBookingWindow {
  minutesUntilNextBooking: number;
  travelToNextBookingMinutes: number;
}

export function isInstantPriceEligible(priceInCents: number, maxPriceInCents: number | null): boolean {
  return Number.isInteger(priceInCents) && priceInCents > 0
    && (maxPriceInCents == null || (Number.isInteger(maxPriceInCents) && priceInCents <= maxPriceInCents));
}

export function isInstantLocationFresh(locationAgeSeconds: number, maxAgeSeconds = INSTANT_LOCATION_FRESHNESS_SECONDS): boolean {
  return Number.isFinite(locationAgeSeconds) && locationAgeSeconds >= 0 && locationAgeSeconds <= maxAgeSeconds;
}

export function fitsInstantLessonWindow(
  etaToStudentMinutes: number,
  durationMinutes: number,
  nextBooking?: NextBookingWindow,
  safetyMarginMinutes = INSTANT_LESSON_SAFETY_MARGIN_MINUTES,
): boolean {
  if (![etaToStudentMinutes, durationMinutes, safetyMarginMinutes].every(Number.isFinite)) return false;
  if (etaToStudentMinutes < 0 || durationMinutes <= 0 || safetyMarginMinutes < 0) return false;
  if (!nextBooking) return true;
  return etaToStudentMinutes + durationMinutes + nextBooking.travelToNextBookingMinutes + safetyMarginMinutes
    <= nextBooking.minutesUntilNextBooking;
}

export function isInstantCandidateEligible(
  candidate: InstantLessonCandidate,
  maxPriceInCents: number | null,
  expectedCategory: VehicleCategory,
  expectedTransmission: TransmissionType | 'ALL',
): boolean {
  return candidate.category === expectedCategory
    && (expectedTransmission === 'ALL' || candidate.transmission === expectedTransmission)
    && candidate.etaMinutes <= INSTANT_LESSON_MAX_ARRIVAL_MINUTES
    && isInstantLocationFresh(candidate.locationAgeSeconds)
    && !candidate.hasScheduleConflict
    && isInstantPriceEligible(candidate.priceInCents, maxPriceInCents);
}

/**
 * Price is only an eligibility gate. ETA and operational viability lead the
 * ordering so the marketplace does not silently turn Aula Agora into an
 * auction for the lowest price.
 */
export function rankInstantCandidates(candidates: InstantLessonCandidate[]): InstantLessonCandidate[] {
  return [...candidates].sort((a, b) => (
    a.etaMinutes - b.etaMinutes
    || a.distanceMeters - b.distanceMeters
    || (b.fairnessScore ?? 0) - (a.fairnessScore ?? 0)
    || a.providerId.localeCompare(b.providerId)
  ));
}

export function selectInstantMatchWave(candidates: InstantLessonCandidate[], waveSize = INSTANT_MATCH_WAVE_SIZE): InstantLessonCandidate[] {
  return rankInstantCandidates(candidates).slice(0, Math.max(1, Math.floor(waveSize)));
}

export function buildInstantPriceOptions(
  pricesInCents: number[],
  maxOptions = 5,
): InstantLessonPriceOption[] {
  const sorted = [...new Set(pricesInCents.filter((price) => Number.isInteger(price) && price > 0))].sort((a, b) => a - b);
  if (sorted.length === 0) return [{ maxPriceInCents: null, eligibleProviderCount: 0 }];

  const selected = sorted.length <= maxOptions
    ? sorted
    : Array.from({ length: maxOptions }, (_, index) => sorted[Math.round(index * (sorted.length - 1) / (maxOptions - 1))]);

  return [
    ...[...new Set(selected)].map((maxPriceInCents) => ({
      maxPriceInCents,
      eligibleProviderCount: pricesInCents.filter((price) => price <= maxPriceInCents).length,
    })),
    { maxPriceInCents: null, eligibleProviderCount: sorted.length },
  ];
}

export function validateInstantSettings(settings: Pick<InstantLessonSettings, 'instantPriceInCents' | 'maxDistanceKm'>): string | null {
  if (!Number.isInteger(settings.instantPriceInCents) || settings.instantPriceInCents <= 0) {
    return 'Informe um preço válido para a Aula Agora.';
  }
  if (!Number.isInteger(settings.maxDistanceKm) || settings.maxDistanceKm < 1 || settings.maxDistanceKm > 100) {
    return 'Escolha uma distância entre 1 e 100 km.';
  }
  return null;
}

export function formatInstantStatus(status: string): string {
  const labels: Record<string, string> = {
    SEARCHING: 'Procurando um profissional',
    MATCHED: 'Profissional encontrado',
    CANCELLED: 'Busca cancelada',
    EXPIRED: 'Busca encerrada',
    FAILED: 'Não foi possível encontrar um profissional',
    PENDING: 'Nova solicitação',
    ACCEPTED: 'Solicitação aceita',
    DECLINED: 'Solicitação recusada',
    LOST_RACE: 'Solicitação já atendida',
  };
  return labels[status] || 'Atualizando solicitação';
}
