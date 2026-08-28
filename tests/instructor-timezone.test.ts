import { describe, it, expect } from 'vitest';
import {
  getTodayInSaoPaulo,
  getBusinessDateFromTimestamp,
  isBookingTodayInSaoPaulo,
  isLessonEnded,
  getCanonicalTimestamp,
} from '../src/lib/date-format';

describe('INSTRUCTOR TIMEZONE & TEMPORAL CLASSIFICATION (America/Sao_Paulo)', () => {
  it('getTodayInSaoPaulo returns YYYY-MM-DD in America/Sao_Paulo timezone', () => {
    const today = getTodayInSaoPaulo();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('getBusinessDateFromTimestamp correctly converts UTC 01:00Z to previous day in São Paulo (-03:00)', () => {
    // 2026-08-20 01:00:00 UTC -> 2026-08-19 22:00:00 in SP
    const utcTimestamp = '2026-08-20T01:00:00.000Z';
    const dateInSp = getBusinessDateFromTimestamp(utcTimestamp);
    expect(dateInSp).toBe('2026-08-19');
  });

  it('getBusinessDateFromTimestamp correctly converts UTC 15:00Z to same day in São Paulo (-03:00)', () => {
    // 2026-08-19 15:00:00 UTC -> 2026-08-19 12:00:00 in SP
    const utcTimestamp = '2026-08-19T15:00:00.000Z';
    const dateInSp = getBusinessDateFromTimestamp(utcTimestamp);
    expect(dateInSp).toBe('2026-08-19');
  });

  it('isBookingTodayInSaoPaulo correctly identifies bookings belonging to today in São Paulo', () => {
    // Mock now as 2026-08-19 12:00:00 SP (15:00 UTC)
    const mockNow = new Date('2026-08-19T15:00:00.000Z');

    // Booking at 2026-08-20 01:00 UTC (2026-08-19 22:00 SP) IS TODAY in SP
    const bookingSpToday = { scheduledStartAt: '2026-08-20T01:00:00.000Z' };
    expect(isBookingTodayInSaoPaulo(bookingSpToday, mockNow)).toBe(true);

    // Booking at 2026-08-20 15:00 UTC (2026-08-20 12:00 SP) IS TOMORROW in SP
    const bookingSpTomorrow = { scheduledStartAt: '2026-08-20T15:00:00.000Z' };
    expect(isBookingTodayInSaoPaulo(bookingSpTomorrow, mockNow)).toBe(false);
  });

  it('isLessonEnded correctly identifies past vs future lessons using epoch comparison', () => {
    const mockNow = new Date('2026-08-19T15:00:00.000Z');
    const pastBooking = { scheduledEndAt: '2026-08-19T14:59:00.000Z' };
    const futureBooking = { scheduledEndAt: '2026-08-19T15:01:00.000Z' };

    expect(isLessonEnded(pastBooking, mockNow)).toBe(true);
    expect(isLessonEnded(futureBooking, mockNow)).toBe(false);
  });

  it('keeps an in-progress lesson out of history until its end time', () => {
    const booking = {
      scheduledStartAt: '2026-08-28T11:00:00-03:00',
      scheduledEndAt: '2026-08-28T11:50:00-03:00',
    };
    expect(isLessonEnded(booking, new Date('2026-08-28T11:30:00-03:00'))).toBe(false);
    expect(isLessonEnded(booking, new Date('2026-08-28T11:50:00-03:00'))).toBe(true);
  });
});
