import { describe, it, expect, vi } from 'vitest';
import {
  calculateCancellationPolicy,
  MVP_CANCELLATION_POLICY,
  performStudentCancellation,
  performProviderCancellation,
} from '../src/domain/cancellation';
import { Booking } from '../src/types';
import { dbService } from '../src/lib/db-service';
import { supabase } from '../src/lib/supabase';

// Mock Supabase client for RPC verification
vi.mock('../src/lib/supabase', () => {
  const rpcMock = vi.fn();
  const fromMock = vi.fn();
  return {
    supabase: {
      rpc: rpcMock,
      from: fromMock,
    },
  };
});

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

  it('5. Legal override (CDC) gives 100% refund regardless of time', () => {
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

  it('6. performStudentCancellation updates status and maintains audit log', () => {
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

  it('7. performProviderCancellation requires reasonCode and updates status', () => {
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

  it('8. mocks supabase.rpc for cancel_booking_v2 and verifies real payload arguments', async () => {
    (supabase.rpc as any).mockResolvedValue({
      data: {
        success: true,
        is_idempotent: false,
        booking_id: 'booking_123',
        status: 'CANCELLED_BY_STUDENT',
        refund_percentage: 100,
        refund_amount_in_cents: 11000,
        policy_description: 'Cancelamento com 24h ou mais de antecedência: Reembolso integral (100%).',
        cancellation_reason: 'Imprevisto pessoal',
        cancelled_at: '2026-08-19T18:00:00Z',
      },
      error: null,
    });

    const result = await dbService.cancelBooking({
      bookingId: 'booking_123',
      reason: 'Imprevisto pessoal',
      reasonCode: undefined,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('cancel_booking_v2', {
      p_booking_id: 'booking_123',
      p_reason: 'Imprevisto pessoal',
      p_reason_code: null,
    });

    const rpcPayload = (supabase.rpc as any).mock.calls[0][1];
    expect(rpcPayload).toHaveProperty('p_booking_id', 'booking_123');
    expect(rpcPayload).toHaveProperty('p_reason', 'Imprevisto pessoal');
    expect(rpcPayload).toHaveProperty('p_reason_code', null);
    expect(rpcPayload).not.toHaveProperty('idempotency_key');
    expect(rpcPayload).not.toHaveProperty('p_idempotency_key');

    expect(result.status).toBe('CANCELLED_BY_STUDENT');
    expect(result.refund_amount_in_cents).toBe(11000);
  });

  it('9. verifies review CTA eligibility: completed without review vs completed with review', async () => {
    const selectMock = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [{ booking_id: 'booking_reviewed_1' }],
        error: null,
      }),
    });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const reviewedSet = await dbService.getReviewedBookingIds(['booking_reviewed_1', 'booking_unreviewed_2']);

    expect(reviewedSet.has('booking_reviewed_1')).toBe(true);
    expect(reviewedSet.has('booking_unreviewed_2')).toBe(false);

    // CTA Eligibility Rule
    const isEligibleForReview = (status: string, bookingId: string) =>
      status === 'COMPLETED' && !reviewedSet.has(bookingId);

    expect(isEligibleForReview('COMPLETED', 'booking_unreviewed_2')).toBe(true);
    expect(isEligibleForReview('COMPLETED', 'booking_reviewed_1')).toBe(false);
    expect(isEligibleForReview('CONFIRMED', 'booking_unreviewed_2')).toBe(false);
  });
});
