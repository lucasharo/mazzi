import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStudentBookingSection, isBookingEnded, isBookingInProgress, sortBookingsForNext } from '../src/domain/booking';

const studentApp = fs.readFileSync(path.join(process.cwd(), 'src/apps/student/StudentApp.tsx'), 'utf8');

describe('Student booking sections', () => {
  it.each([
    'COMPLETED',
    'IN_PROGRESS',
    'PENDING_PAYMENT',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_PROVIDER',
    'EXPIRED',
    'PAYMENT_FAILED',
    'REFUNDED',
    'NO_SHOW_STUDENT',
    'NO_SHOW_PROVIDER',
  ])('%s goes to history', (status) => {
    expect(getStudentBookingSection(status)).toBe('HISTORY');
  });

  it('keeps the domain section conservative while the UI places in-progress lessons in Hoje', () => {
    expect(getStudentBookingSection('CONFIRMED')).toBe('CONFIRMED');
    expect(getStudentBookingSection('IN_PROGRESS')).not.toBe('CONFIRMED');
    expect(studentApp).toContain("b.status === 'IN_PROGRESS'");
    expect(studentApp).toContain("bookingTab === 'today'");
  });

  it('routes a legacy confirmed payload with cancellation metadata to history', () => {
    expect(getStudentBookingSection('CONFIRMED', { cancelledAt: '2026-08-24T12:00:00Z' })).toBe('HISTORY');
    expect(getStudentBookingSection('CONFIRMED', { cancellationReason: 'Mudança de horário' })).toBe('HISTORY');
  });

  it('keeps temporal placement explicit: only ended bookings leave Próximas and enter Histórico', () => {
    expect(studentApp).toContain("!isBookingEnded(b, nowMs)");
    expect(studentApp).toContain("isBookingEnded(b, nowMs)");
  });

  it('considers a lesson historical only after its scheduled end time', () => {
    const booking = {
      scheduledStartAt: '2026-08-28T11:00:00-03:00',
      scheduledEndAt: '2026-08-28T11:50:00-03:00',
    } as any;
    expect(isBookingEnded(booking, new Date('2026-08-28T11:30:00-03:00').getTime())).toBe(false);
    expect(isBookingEnded(booking, new Date('2026-08-28T11:50:00-03:00').getTime())).toBe(true);
  });

  it('prioritizes an active lesson over a future lesson for the dashboard card', () => {
    const nowMs = new Date('2026-08-28T11:30:00-03:00').getTime();
    const futureBooking = {
      id: 'future',
      status: 'CONFIRMED',
      scheduledStartAt: '2026-08-28T12:00:00-03:00',
      scheduledEndAt: '2026-08-28T12:50:00-03:00',
    } as any;
    const activeBooking = {
      id: 'active',
      status: 'IN_PROGRESS',
      scheduledStartAt: '2026-08-28T11:00:00-03:00',
      scheduledEndAt: '2026-08-28T11:50:00-03:00',
    } as any;

    expect(sortBookingsForNext([futureBooking, activeBooking], nowMs)[0].id).toBe('active');
  });

  it('recognizes a confirmed lesson inside its scheduled window as in progress', () => {
    const nowMs = new Date('2026-08-28T11:30:00-03:00').getTime();
    const booking = {
      status: 'CONFIRMED',
      scheduledStartAt: '2026-08-28T11:00:00-03:00',
      scheduledEndAt: '2026-08-28T11:50:00-03:00',
    } as any;

    expect(isBookingInProgress(booking, nowMs)).toBe(true);
    expect(isBookingInProgress(booking, new Date('2026-08-28T10:59:59-03:00').getTime())).toBe(false);
    expect(isBookingInProgress(booking, new Date('2026-08-28T11:50:00-03:00').getTime())).toBe(false);
  });

  it('keeps an IN_PROGRESS lesson visible until the backend finishes it', () => {
    const booking = {
      status: 'IN_PROGRESS',
      scheduledStartAt: '2026-08-28T11:00:00-03:00',
      scheduledEndAt: '2026-08-28T11:50:00-03:00',
    } as any;

    expect(isBookingInProgress(booking, new Date('2026-08-28T12:15:00-03:00').getTime())).toBe(true);
    expect(isBookingEnded(booking, new Date('2026-08-28T12:15:00-03:00').getTime())).toBe(false);
  });

  it('uses the Próximas title, includes future lessons from today, and preserves history filtering', () => {
    expect(studentApp).toContain('Próximas');
    expect(studentApp).toContain('Filtros rápidos de aulas');
    expect(studentApp).toContain('Em contestação');
    expect(studentApp).toContain('isBookingEnded(b, nowMs)');
    expect(studentApp).toContain("getStudentBookingSection(b.status, b) === 'HISTORY'");
    expect(studentApp).toContain('Você não possui aulas confirmadas no momento.');
  });

  it('includes cancelled lessons scheduled for today in the Hoje tab', () => {
    expect(studentApp).toContain('isStudentTodayVisibleBooking');
    expect(studentApp).toContain('CANCELLED_BOOKING_STATUSES.includes(booking.status)');
    expect(studentApp).toContain("bookingTab === 'today'");
    expect(studentApp).toContain("{ value: 'cancelled' as const, label: 'Canceladas' }");
  });

  it('references the stale confirmed booking reminder for overdue reservations', () => {
    expect(studentApp).toContain('getStaleConfirmedBookings');
    expect(studentApp).toContain('dismissedStaleConfirmedSignatureRef');
  });
});
