import { describe, expect, it } from 'vitest';
import { addDays, formatDateOnly, timePeriod } from '../apps/student/components/SlotSelectorModal';

describe('Student Experience phases 3 and 4', () => {
  it('keeps date-only calendar arithmetic timezone-safe', () => {
    expect(addDays('2026-08-24', 30)).toBe('2026-09-23');
    expect(formatDateOnly('2026-08-24', { dateStyle: 'short' })).toBe('24/08/2026');
  });

  it('groups slot times into day periods', () => {
    expect(timePeriod('11:59:00')).toBe('Manhã');
    expect(timePeriod('12:00:00')).toBe('Tarde');
    expect(timePeriod('18:00:00')).toBe('Noite');
  });
});
