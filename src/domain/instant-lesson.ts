import type {
  InstantLessonOffer,
  InstantLessonPriceOption,
  InstantLessonSettings,
  TransmissionType,
  VehicleCategory,
} from '../types';

export const INSTANT_LESSON_MAX_ARRIVAL_MINUTES = 30;
export const INSTANT_LESSON_SAFETY_MARGIN_MINUTES = 15;
export const INSTANT_MATCH_WAVE_SIZE = 3;
export const INSTANT_OFFER_TIMEOUT_SECONDS = 15;
export const INSTANT_LOCATION_FRESHNESS_SECONDS = 30;
export const INSTANT_PROVIDER_LOCATION_INTERVAL_SECONDS = 25;
export const INSTANT_STUDENT_TRACKING_INTERVAL_SECONDS = 8;

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
