import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStudentBookingSection } from '../src/domain/booking';

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

  it('routes only CONFIRMED to Confirmadas', () => {
    expect(getStudentBookingSection('CONFIRMED')).toBe('CONFIRMED');
    expect(getStudentBookingSection('IN_PROGRESS')).not.toBe('CONFIRMED');
  });

  it('routes a legacy confirmed payload with cancellation metadata to history', () => {
    expect(getStudentBookingSection('CONFIRMED', { cancelledAt: '2026-08-24T12:00:00Z' })).toBe('HISTORY');
    expect(getStudentBookingSection('CONFIRMED', { cancellationReason: 'Mudança de horário' })).toBe('HISTORY');
  });

  it('keeps temporal placement explicit: ended bookings leave Confirmadas and enter Histórico', () => {
    expect(studentApp).toContain("!isBookingEnded(b, nowMs)");
    expect(studentApp).toContain("isBookingEnded(b, nowMs)");
  });

  it('uses the Confirmadas title, exact status filter, history complement, and coherent empty state', () => {
    expect(studentApp).toContain('Confirmadas');
    expect(studentApp).not.toContain('Todas');
    expect(studentApp).toContain("getStudentBookingSection(b.status, b) === 'CONFIRMED'");
    expect(studentApp).toContain("getStudentBookingSection(b.status, b) === 'HISTORY'");
    expect(studentApp).toContain('Você não possui aulas confirmadas no momento.');
  });
});
