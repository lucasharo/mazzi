import { describe, expect, it } from 'vitest';
import { addDays, formatDateOnly, timePeriod } from '../apps/student/components/SlotSelectorModal';

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
});
