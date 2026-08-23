import { describe, expect, it } from 'vitest';
import { buildFullDayBlockRange } from '../src/lib/date-format';

describe('full-day block range', () => {
  it('uses midnight through the exclusive midnight of the next day', () => {
    expect(buildFullDayBlockRange({ startDate: '2026-08-27', inclusiveEndDate: '2026-08-27' })).toEqual({
      startAt: '2026-08-27T00:00:00.000-03:00',
      endAt: '2026-08-28T00:00:00.000-03:00',
    });
  });

  it('covers every selected day for a multi-day block', () => {
    expect(buildFullDayBlockRange({ startDate: '2026-08-27', inclusiveEndDate: '2026-08-29' }).endAt)
      .toBe('2026-08-30T00:00:00.000-03:00');
  });
});
