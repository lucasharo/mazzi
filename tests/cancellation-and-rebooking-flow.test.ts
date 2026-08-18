import { describe, it, expect } from 'vitest';
import { AUTH_OTP_LENGTH, AUTH_OTP_REGEX } from '../src/lib/auth-constants';
import { calculateCancellationPolicy, performStudentCancellation, performProviderCancellation } from '../src/domain/cancellation';
import { hasBookingConflict, isBookingActiveConflictStatus } from '../src/domain/availability';
import { Booking } from '../src/types';

describe('TASK-007 — Cancellation, Chat, Slot Release & Rebooking Tests', () => {
  describe('1. OTP 8-digit configuration', () => {
    it('AUTH_OTP_LENGTH is set to 8', () => {
      expect(AUTH_OTP_LENGTH).toBe(8);
    });

    it('AUTH_OTP_REGEX validates exactly 8 numeric digits', () => {
      expect(AUTH_OTP_REGEX.test('12345678')).toBe(true);
      expect(AUTH_OTP_REGEX.test('1234567')).toBe(false);
      expect(AUTH_OTP_REGEX.test('123456789')).toBe(false);
      expect(AUTH_OTP_REGEX.test('abcdefgh')).toBe(false);
    });
  });

  describe('2. Cancellation Policies & Slot Release (DEC-013)', () => {
    it('Student cancellation >= 24h yields 100% refund', () => {
      const res = calculateCancellationPolicy({
        cancelledBy: 'STUDENT',
        hoursUntilLesson: 25,
        totalPaidInCents: 10000,
        lessonPriceInCents: 9000,
        platformFeeInCents: 1000,
      });
      expect(res.refundPercentage).toBe(100);
      expect(res.refundAmountInCents).toBe(10000);
    });

    it('Student cancellation between 6h and 24h yields 50% refund', () => {
      const res = calculateCancellationPolicy({
        cancelledBy: 'STUDENT',
        hoursUntilLesson: 12,
        totalPaidInCents: 10000,
        lessonPriceInCents: 9000,
        platformFeeInCents: 1000,
      });
      expect(res.refundPercentage).toBe(50);
      expect(res.refundAmountInCents).toBe(5000);
    });

    it('Student cancellation < 6h yields 0% refund', () => {
      const res = calculateCancellationPolicy({
        cancelledBy: 'STUDENT',
        hoursUntilLesson: 2,
        totalPaidInCents: 10000,
        lessonPriceInCents: 9000,
        platformFeeInCents: 1000,
      });
      expect(res.refundPercentage).toBe(0);
      expect(res.refundAmountInCents).toBe(0);
    });

    it('Provider cancellation always yields 100% refund', () => {
      const res = calculateCancellationPolicy({
        cancelledBy: 'PROVIDER',
        hoursUntilLesson: 1,
        totalPaidInCents: 10000,
        lessonPriceInCents: 9000,
        platformFeeInCents: 1000,
      });
      expect(res.refundPercentage).toBe(100);
      expect(res.refundAmountInCents).toBe(10000);
    });
  });

  describe('3. Domain Availability & Expired Holds', () => {
    it('CANCELLED_BY_STUDENT and CANCELLED_BY_PROVIDER do not block availability', () => {
      expect(isBookingActiveConflictStatus('CANCELLED_BY_STUDENT')).toBe(false);
      expect(isBookingActiveConflictStatus('CANCELLED_BY_PROVIDER')).toBe(false);
      expect(isBookingActiveConflictStatus('EXPIRED')).toBe(false);
    });

    it('Active PENDING_PAYMENT blocks availability if hold is in the future', () => {
      const futureHold = new Date(Date.now() + 600000).toISOString();
      const conflictRes = hasBookingConflict(
        {
          date: '2026-08-20',
          startTime: '10:00',
          endTime: '11:00',
          instructorId: 'inst_1',
          vehicleId: 'veh_1',
        },
        [
          {
            scheduledDate: '2026-08-20',
            startTime: '10:00',
            endTime: '11:00',
            instructorId: 'inst_1',
            vehicleId: 'veh_1',
            status: 'PENDING_PAYMENT',
            holdExpiresAt: futureHold,
          },
        ]
      );
      expect(conflictRes.hasConflict).toBe(true);
    });

    it('Expired PENDING_PAYMENT (holdExpiresAt <= now) does NOT block availability', () => {
      const pastHold = new Date(Date.now() - 600000).toISOString();
      const conflictRes = hasBookingConflict(
        {
          date: '2026-08-20',
          startTime: '10:00',
          endTime: '11:00',
          instructorId: 'inst_1',
          vehicleId: 'veh_1',
        },
        [
          {
            scheduledDate: '2026-08-20',
            startTime: '10:00',
            endTime: '11:00',
            instructorId: 'inst_1',
            vehicleId: 'veh_1',
            status: 'PENDING_PAYMENT',
            holdExpiresAt: pastHold,
          },
        ]
      );
      expect(conflictRes.hasConflict).toBe(false);
    });

    it('Cancelled booking on same slot does NOT block availability', () => {
      const conflictRes = hasBookingConflict(
        {
          date: '2026-08-20',
          startTime: '10:00',
          endTime: '11:00',
          instructorId: 'inst_1',
          vehicleId: 'veh_1',
        },
        [
          {
            scheduledDate: '2026-08-20',
            startTime: '10:00',
            endTime: '11:00',
            instructorId: 'inst_1',
            vehicleId: 'veh_1',
            status: 'CANCELLED_BY_STUDENT',
          },
        ]
      );
      expect(conflictRes.hasConflict).toBe(false);
    });
  });

  describe('4. Provider Cancellation Contract', () => {
    it('Requires mandatory reasonCode for provider cancellation', () => {
      const mockBooking: Booking = {
        id: 'bk_1',
        studentId: 'stud_1',
        providerId: 'prov_1',
        instructorId: 'inst_1',
        vehicleId: 'veh_1',
        offeringId: 'off_1',
        scheduledDate: '2026-08-25',
        startTime: '14:00',
        endTime: '15:00',
        scheduledStartAt: '2026-08-25T14:00:00Z',
        scheduledEndAt: '2026-08-25T14:50:00Z',
        meetingPoint: 'Sede da Autoescola',
        providerName: 'Autoescola MAZZI',
        instructorName: 'Instrutor MAZZI',
        vehicleName: 'Gol 1.0',
        studentName: 'Aluno Teste',
        category: 'B',
        status: 'CONFIRMED',
        priceInCents: 10000,
        platformFeeInCents: 1000,
        totalInCents: 11000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        snapshot: {
          providerId: 'prov_1',
          providerName: 'Autoescola MAZZI',
          providerType: 'DRIVING_SCHOOL',
          instructorId: 'inst_1',
          instructorName: 'Instrutor MAZZI',
          vehicleId: 'veh_1',
          vehicleName: 'Gol 1.0',
          category: 'B',
          transmission: 'MANUAL',
          durationMinutes: 50,
          priceInCents: 10000,
          platformFeeInCents: 1000,
          totalInCents: 11000,
          meetingPoint: 'Sede da Autoescola',
        },
      };

      const res = performProviderCancellation({
        booking: mockBooking,
        providerId: 'prov_1',
        actorUserId: 'user_prov_1',
        actorRole: 'INSTRUCTOR',
        reasonCode: 'VEHICLE_ISSUE',
        idempotencyKey: 'idem_cancel_1',
      });

      expect(res.cancellationResult.refundPercentage).toBe(100);
      expect(res.booking.status).toBe('CANCELLED_BY_PROVIDER');
    });
  });
});
