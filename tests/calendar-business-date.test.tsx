import { describe, expect, it, vi } from 'vitest';
import { getTodayInSaoPaulo } from '../src/lib/date-format';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTimeSlotPicker } from '../src/components/schedule/DateTimeSlotPicker';

describe('canonical MAZZI business date', () => {
  it('uses the Sao Paulo civil date before the UTC rollover', () => {
    expect(getTodayInSaoPaulo(new Date('2026-08-24T00:30:00Z'))).toBe('2026-08-23');
  });

  it('uses the previous Sao Paulo date after the UTC instant crosses 02:30', () => {
    expect(getTodayInSaoPaulo(new Date('2026-08-23T02:30:00Z'))).toBe('2026-08-22');
  });

  it('starts the PRO horizon on the Sao Paulo business date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T00:30:00Z'));
    try {
      const markup = renderToStaticMarkup(
        <DateTimeSlotPicker
          slotsByDate={{
            '2026-08-23': [{ date: '2026-08-23', startTime: '09:00', endTime: '10:00', startAt: '2026-08-23T09:00:00-03:00', endAt: '2026-08-23T10:00:00-03:00' }],
          }}
          selectedDate=""
          onDateChange={() => undefined}
        />,
      );
      expect(markup).toContain('23/08/2026 1 horários disponíveis');
      expect(markup).toContain('24/08/2026 0 horários disponíveis');
    } finally {
      vi.useRealTimers();
    }
  });
});
