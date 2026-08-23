import { describe, expect, it } from 'vitest';
import { getDayBlockDisplayRange } from '../src/lib/date-format';

describe('day-block display range', () => {
  it('renders a canonical same-day block without technical times', () => {
    expect(getDayBlockDisplayRange('2026-08-27T00:00:00-03:00', '2026-08-28T00:00:00-03:00')).toEqual({
      startDate: '27/08/2026', endDate: '27/08/2026', label: 'Dia inteiro',
    });
  });

  it('renders the inclusive end date for a multi-day block', () => {
    const display = getDayBlockDisplayRange('2026-08-27T00:00:00-03:00', '2026-08-30T00:00:00-03:00');
    expect(display).toEqual({ startDate: '27/08/2026', endDate: '29/08/2026', label: 'Dias inteiros' });
  });
});
