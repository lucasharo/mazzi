import { describe, it, expect } from 'vitest';
import {
  calculateCancellationPolicy,
  MVP_CANCELLATION_POLICY,
  performStudentCancellation,
  performProviderCancellation,
} from '../src/domain/cancellation';
import { Booking } from '../src/types';

describe('DEC-013 Cancellation Policy Domain Unit Tests', () => {
  const baseBooking: Booking = {
    id: 'booking_dec013_test_001',
    studentId: 'student_001',
    providerId: 'provider_001',
    providerName: 'CFC Autoescola Teste',
    instructorId: 'instructor_001',
    instructorName: 'Instrutor Carlos',
    vehicleId: 'vehicle_001',
    vehicleName: 'Gol 1.0',
    offeringId: 'offering_001',
    category: 'B',
    meetingPoint: 'Ponto Central SP',
    scheduledDate: '2026-08-20',
    startTime: '10:00',
    endTime: '10:50',
    scheduledStartAt: '2026-08-20T10:00:00Z',
    scheduledEndAt: '2026-08-20T10:50:00Z',
    lessonDateTime: '2026-08-20T10:00:00Z',
    status: 'CONFIRMED',
    priceInCents: 10000,
    platformFeeInCents: 1000,
    totalInCents: 11000,
    createdAt: '2026-08-18T00:00:00Z',
    updatedAt: '2026-08-18T00:00:00Z',
    snapshot: {
      providerId: 'provider_001',
      providerType: 'DRIVING_SCHOOL',
      instructorId: 'instructor_001',
      vehicleId: 'vehicle_001',
      meetingPoint: 'Ponto Central SP',
      priceInCents: 10000,
      platformFeeInCents: 1000,
      totalInCents: 11000,
      category: 'B',
      transmission: 'MANUAL',
      durationMinutes: 50,
      providerName: 'CFC Autoescola Teste',
      instructorName: 'Instrutor Carlos',
      vehicleName: 'Gol 1.0',
    },
  };

  it('1. Student cancellation >= 24h yields 100% refund', () => {
    const res = calculateCancellationPolicy({
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 24.0,
      totalPaidInCents: 11000,
      lessonPriceInCents: 10000,
      platformFeeInCents: 1000,
    });
    expect(res.refundPercentage).toBe(100);
    expect(res.refundAmountInCents).toBe(11000);
    expect(res.providerCompensationInCents).toBe(0);
  });

  it('2. Student cancellation at 23h 59m (23.99h) yields 50% refund', () => {
    const res = calculateCancellationPolicy({
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 23.99,
      totalPaidInCents: 11000,
      lessonPriceInCents: 10000,
      platformFeeInCents: 1000,
    });
    expect(res.refundPercentage).toBe(50);
    expect(res.refundAmountInCents).toBe(5500);
  });

  it('3. Student cancellation at exactly 6.0h yields 50% refund', () => {
    const res = calculateCancellationPolicy({
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 6.0,
      totalPaidInCents: 11000,
      lessonPriceInCents: 10000,
      platformFeeInCents: 1000,
    });
    expect(res.refundPercentage).toBe(50);
    expect(res.refundAmountInCents).toBe(5500);
  });

  it('4. Student cancellation at 5.99h (< 6h) yields 0% refund', () => {
    const res = calculateCancellationPolicy({
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 5.99,
      totalPaidInCents: 11000,
      lessonPriceInCents: 10000,
      platformFeeInCents: 1000,
    });
    expect(res.refundPercentage).toBe(0);
    expect(res.refundAmountInCents).toBe(0);
    expect(res.providerCompensationInCents).toBe(10000);
  });

  it('5. Provider cancellation yields 100% refund to student', () => {
    const res = calculateCancellationPolicy({
      cancelledBy: 'PROVIDER',
      hoursUntilLesson: 2.0,
      totalPaidInCents: 11000,
      lessonPriceInCents: 10000,
      platformFeeInCents: 1000,
    });
    expect(res.refundPercentage).toBe(100);
    expect(res.refundAmountInCents).toBe(11000);
  });

  it('6. Student no-show yields 0% refund', () => {
    const res = calculateCancellationPolicy({
      cancelledBy: 'NO_SHOW_STUDENT',
      hoursUntilLesson: 0,
      totalPaidInCents: 11000,
      lessonPriceInCents: 10000,
      platformFeeInCents: 1000,
    });
    expect(res.refundPercentage).toBe(0);
    expect(res.refundAmountInCents).toBe(0);
  });

  it('7. Provider no-show yields 100% refund', () => {
    const res = calculateCancellationPolicy({
      cancelledBy: 'NO_SHOW_PROVIDER',
      hoursUntilLesson: 0,
      totalPaidInCents: 11000,
      lessonPriceInCents: 10000,
      platformFeeInCents: 1000,
    });
    expect(res.refundPercentage).toBe(100);
    expect(res.refundAmountInCents).toBe(11000);
  });

  it('8. LEGAL_OVERRIDE forces 100% refund regardless of hours remaining', () => {
    const res = calculateCancellationPolicy({
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 1.0,
      totalPaidInCents: 11000,
      lessonPriceInCents: 10000,
      platformFeeInCents: 1000,
      isLegalOverride: true,
    });
    expect(res.refundPercentage).toBe(100);
    expect(res.refundAmountInCents).toBe(11000);
    expect(res.isLegalOverride).toBe(true);
  });

  it('9. performStudentCancellation updates status and maintains audit log', () => {
    const now = new Date('2026-08-18T10:00:00Z'); // 48 hours before 2026-08-20T10:00:00Z
    const out = performStudentCancellation({
      booking: baseBooking,
      studentId: 'student_001',
      actorUserId: 'student_001',
      actorRole: 'STUDENT',
      reasonText: 'Imprevisto de trabalho',
      now,
    });

    expect(out.booking.status).toBe('CANCELLED_BY_STUDENT');
    expect(out.cancellationResult.refundPercentage).toBe(100);
    expect(out.auditLog.action).toBe('BOOKING_CANCELLED_BY_STUDENT');
  });

  it('10. performProviderCancellation requires reasonCode and updates status', () => {
    const now = new Date('2026-08-18T10:00:00Z');
    
    expect(() =>
      performProviderCancellation({
        booking: baseBooking,
        providerId: 'provider_001',
        actorUserId: 'provider_001',
        actorRole: 'INSTRUCTOR',
        reasonCode: '' as any,
        now,
      })
    ).toThrow(/motivo/i);

    const out = performProviderCancellation({
      booking: baseBooking,
      providerId: 'provider_001',
      actorUserId: 'provider_001',
      actorRole: 'INSTRUCTOR',
      reasonCode: 'VEHICLE_ISSUE',
      reasonText: 'Pneu furado a caminho da aula',
      now,
    });

    expect(out.booking.status).toBe('CANCELLED_BY_PROVIDER');
    expect(out.cancellationResult.refundPercentage).toBe(100);
    expect(out.auditLog.action).toBe('BOOKING_CANCELLED_BY_PROVIDER');
  });
});
