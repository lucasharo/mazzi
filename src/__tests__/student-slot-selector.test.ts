import { describe, expect, it } from 'vitest';
import { addDays, filterSlotsForExistingBookings, formatDateOnly, timePeriod, INITIAL_WINDOW_DAYS, LOAD_MORE_DAYS, MAX_HORIZON_DAYS } from '../apps/student/components/SlotSelectorModal';
import type { Booking } from '../types';

const bookingFixture = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'booking-1',
  studentId: 'student-1',
  providerId: 'provider-1',
  providerName: 'Instrutor',
  instructorId: 'instructor-1',
  instructorName: 'Instrutor',
  vehicleId: 'vehicle-1',
  vehicleName: 'Veículo',
  offeringId: 'offering-1',
  category: 'B',
  scheduledDate: '2026-08-28',
  startTime: '10:00',
  endTime: '10:50',
  scheduledStartAt: '2026-08-28T13:00:00.000Z',
  scheduledEndAt: '2026-08-28T13:50:00.000Z',
  status: 'CONFIRMED',
  snapshot: {
    providerId: 'provider-1',
    providerName: 'Instrutor',
    providerType: 'INSTRUCTOR',
    instructorId: 'instructor-1',
    instructorName: 'Instrutor',
    vehicleId: 'vehicle-1',
    vehicleName: 'Veículo',
    category: 'B',
    durationMinutes: 50,
    priceInCents: 10000,
    platformFeeInCents: 1000,
    totalInCents: 10000,
    meetingPoint: 'São Paulo',
  },
  meetingPoint: 'São Paulo',
  priceInCents: 10000,
  platformFeeInCents: 1000,
  totalInCents: 10000,
  createdAt: '2026-08-27T12:00:00.000Z',
  updatedAt: '2026-08-27T12:00:00.000Z',
  ...overrides,
});

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

  it('removes slots that overlap a student booking', () => {
    const slots = [
      {
        local_date: '2026-08-28',
        local_start_time: '10:00:00',
        local_end_time: '10:50:00',
        slot_start_at: '2026-08-28T13:00:00.000Z',
        slot_end_at: '2026-08-28T13:50:00.000Z',
      },
      {
        local_date: '2026-08-28',
        local_start_time: '11:00:00',
        local_end_time: '11:50:00',
        slot_start_at: '2026-08-28T14:00:00.000Z',
        slot_end_at: '2026-08-28T14:50:00.000Z',
      },
    ];

    expect(filterSlotsForExistingBookings(slots, 50, [bookingFixture()])).toHaveLength(1);
    expect(filterSlotsForExistingBookings(slots, 50, [bookingFixture()])[0].local_start_time).toBe('11:00:00');
  });

  it('allows expired pending holds to stop blocking the calendar', () => {
    const slot = {
      local_date: '2026-08-28',
      local_start_time: '10:00:00',
      local_end_time: '10:50:00',
      slot_start_at: '2026-08-28T13:00:00.000Z',
      slot_end_at: '2026-08-28T13:50:00.000Z',
    };
    const pending = bookingFixture({ status: 'PENDING_PAYMENT', holdExpiresAt: '2026-08-28T12:00:00.000Z' });

    expect(filterSlotsForExistingBookings([slot], 50, [pending], Date.parse('2026-08-28T13:00:00.000Z'))).toHaveLength(1);
  });
});
