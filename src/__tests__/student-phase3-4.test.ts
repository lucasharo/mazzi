import { describe, expect, it } from 'vitest';
import { addDays, formatDateOnly, timePeriod, INITIAL_WINDOW_DAYS, LOAD_MORE_DAYS, MAX_HORIZON_DAYS } from '../apps/student/components/SlotSelectorModal';

describe('Student Experience phases 3 and 4', () => {
  it('keeps date-only calendar arithmetic timezone-safe', () => {
    expect(addDays('2026-08-24', 30)).toBe('2026-09-23');
    expect(formatDateOnly('2026-08-24', { dateStyle: 'short' })).toBe('24/08/2026');
  });

  it('keeps progressive scheduling windows as ISO DATE values', () => {
    expect(addDays('2026-08-16', 29)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(addDays('2026-08-16', 59)).toBe('2026-10-14');
  });

  it('groups slot times into day periods', () => {
    expect(timePeriod('11:59:00')).toBe('Manhã');
    expect(timePeriod('12:00:00')).toBe('Tarde');
    expect(timePeriod('18:00:00')).toBe('Noite');
  });

  it('preserves the progressive 30/60 day horizon', () => {
    expect(INITIAL_WINDOW_DAYS).toBe(30);
    expect(LOAD_MORE_DAYS).toBe(30);
    expect(MAX_HORIZON_DAYS).toBe(60);
    expect(Math.min(MAX_HORIZON_DAYS, INITIAL_WINDOW_DAYS + LOAD_MORE_DAYS)).toBe(60);
  });
});
