import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const studentApp = readFileSync('src/apps/student/StudentApp.tsx', 'utf8');

describe('student pending-payment navigation', () => {
  it('opens checkout directly when Details is selected for an unpaid booking', () => {
    expect(studentApp).toContain("if (booking.status === 'PENDING_PAYMENT')");
    expect(studentApp).toContain('setResumeBooking(booking);');
    expect(studentApp).toContain('onViewDetails={openStudentBookingDetails}');
    expect(studentApp).toContain('onSelect={openStudentBookingDetails}');
  });

  it('does not render cancelled-before-payment bookings in student lists', () => {
    expect(studentApp).toContain('isCancelledBeforePayment(booking)');
    expect(studentApp).toContain('!isCancelledBeforePayment(b)');
  });
});
