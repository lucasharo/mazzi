import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStudentBookingSection, isBookingEnded } from '../src/domain/booking';

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

  it('uses the Próximas title, includes future lessons from today, and preserves history filtering', () => {
    expect(studentApp).toContain('Próximas');
    expect(studentApp).toContain('Filtros rápidos de aulas');
    expect(studentApp).toContain('Em contestação');
    expect(studentApp).toContain('isBookingEnded(b, nowMs)');
    expect(studentApp).toContain("getStudentBookingSection(b.status, b) === 'HISTORY'");
    expect(studentApp).toContain('Você não possui aulas confirmadas no momento.');
  });
});
