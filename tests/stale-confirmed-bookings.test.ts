import { describe, expect, it } from 'vitest';
import { getStaleConfirmedBookings } from '../src/domain/booking';

const makeBooking = (id: string, status: string, scheduledEndAt: string) => ({
  id,
  status,
  scheduledStartAt: '2026-09-10T13:00:00.000Z',
  scheduledEndAt,
} as any);

describe('stale confirmed booking reminders', () => {
  it('returns only confirmed bookings whose scheduled window has ended', () => {
    const nowMs = new Date('2026-09-10T15:00:00.000Z').getTime();
    const bookings = [
      makeBooking('ended-confirmed', 'CONFIRMED', '2026-09-10T14:00:00.000Z'),
      makeBooking('active-confirmed', 'CONFIRMED', '2026-09-10T16:00:00.000Z'),
      makeBooking('ended-completed', 'COMPLETED', '2026-09-10T14:00:00.000Z'),
    ];

    expect(getStaleConfirmedBookings(bookings, nowMs).map((booking) => booking.id))
      .toEqual(['ended-confirmed']);
  });
});
