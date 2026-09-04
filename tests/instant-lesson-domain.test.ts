import { describe, expect, it } from 'vitest';
import {
  INSTANT_MATCH_WAVE_SIZE,
  INSTANT_LESSON_SAFETY_MARGIN_MINUTES,
  buildInstantPriceOptions,
  fitsInstantLessonWindow,
  isInstantCandidateEligible,
  isInstantLocationFresh,
  rankInstantCandidates,
  selectInstantMatchWave,
} from '../src/domain/instant-lesson';

const candidate = (overrides: Partial<Parameters<typeof isInstantCandidateEligible>[0]> = {}) => ({
  providerId: 'provider-1', offeringId: 'offering-1', instructorId: 'instructor-1', vehicleId: 'vehicle-1',
  category: 'B' as const, transmission: 'MANUAL' as const, priceInCents: 10000, durationMinutes: 50,
  distanceMeters: 1000, etaMinutes: 8, locationAgeSeconds: 10, hasScheduleConflict: false,
  ...overrides,
});

describe('Aula Agora domain rules', () => {
  it('uses price only as an eligibility gate and keeps free offers free', () => {
    expect(isInstantCandidateEligible(candidate({ priceInCents: 0 }), null, 'B', 'ALL')).toBe(false);
    expect(isInstantCandidateEligible(candidate({ priceInCents: 10000 }), 9000, 'B', 'ALL')).toBe(false);
    expect(isInstantCandidateEligible(candidate({ priceInCents: 10000 }), 10000, 'B', 'ALL')).toBe(true);
  });

  it('ranks by operational viability before price and excludes stale/conflicting candidates', () => {
    const viableFast = candidate({ providerId: 'fast', etaMinutes: 5, priceInCents: 20000 });
    const viableCheap = candidate({ providerId: 'cheap', etaMinutes: 12, priceInCents: 5000 });
    const stale = candidate({ providerId: 'stale', locationAgeSeconds: 31 });
    const conflicting = candidate({ providerId: 'busy', hasScheduleConflict: true });
    const eligible = [viableFast, viableCheap, stale, conflicting].filter((item) => isInstantCandidateEligible(item, null, 'B', 'ALL'));
    expect(rankInstantCandidates(eligible).map((item) => item.providerId)).toEqual(['fast', 'cheap']);
  });

  it('applies the next-booking safety margin', () => {
    expect(fitsInstantLessonWindow(10, 50, { minutesUntilNextBooking: 79, travelToNextBookingMinutes: 5 })).toBe(false);
    expect(fitsInstantLessonWindow(10, 50, { minutesUntilNextBooking: 80 + INSTANT_LESSON_SAFETY_MARGIN_MINUTES, travelToNextBookingMinutes: 5 })).toBe(true);
  });

  it('limits each match wave and provides derived price buckets plus no limit', () => {
    const candidates = Array.from({ length: 5 }, (_, index) => candidate({ providerId: `p-${index}`, etaMinutes: index + 1 }));
    expect(selectInstantMatchWave(candidates)).toHaveLength(INSTANT_MATCH_WAVE_SIZE);
    expect(buildInstantPriceOptions([5000, 7500, 10000]).map((option) => option.maxPriceInCents)).toEqual([5000, 7500, 10000, null]);
  });

  it('accepts only fresh locations within the configured freshness window', () => {
    expect(isInstantLocationFresh(30)).toBe(true);
    expect(isInstantLocationFresh(31)).toBe(false);
    expect(isInstantLocationFresh(-1)).toBe(false);
  });
});
