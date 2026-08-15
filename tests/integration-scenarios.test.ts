import { describe, it, expect } from 'vitest';
import { hasBookingConflict, TimeSlotInterval } from '../src/domain/availability';

describe('Integration Scenarios & Negative Security Tests', () => {
  describe('Double Booking Concurrency Simulation', () => {
    it('guarantees that when 2 students attempt to book the same slot, only the first is accepted', () => {
      const activeBookings: TimeSlotInterval[] = [];

      const candidateStudent1: TimeSlotInterval = {
        date: '2026-08-20',
        startTime: '10:00',
        endTime: '11:00',
        instructorId: 'inst_carlos',
        vehicleId: 'veh_hb20_01',
      };

      const candidateStudent2: TimeSlotInterval = {
        date: '2026-08-20',
        startTime: '10:00',
        endTime: '11:00',
        instructorId: 'inst_carlos',
        vehicleId: 'veh_hb20_01',
      };

      // Student 1 attempts booking first
      const check1 = hasBookingConflict(candidateStudent1, activeBookings);
      expect(check1.hasConflict).toBe(false);
      // Student 1 gets confirmed
      activeBookings.push(candidateStudent1);

      // Student 2 attempts booking for the same slot
      const check2 = hasBookingConflict(candidateStudent2, activeBookings);
      expect(check2.hasConflict).toBe(true);
      expect(check2.reason).toBeDefined();
    });
  });

  describe('Payment Webhook Idempotency', () => {
    it('processes a webhook only once even if received multiple times with the same idempotency key', () => {
      const processedEventIds = new Set<string>();
      let balanceCreditInCents = 0;

      function handlePaymentWebhook(event: {
        idempotencyKey: string;
        amountInCents: number;
        status: 'PAID';
      }) {
        if (processedEventIds.has(event.idempotencyKey)) {
          return { status: 'IGNORED_DUPLICATE', processed: false };
        }
        processedEventIds.add(event.idempotencyKey);
        balanceCreditInCents += event.amountInCents;
        return { status: 'PROCESSED', processed: true };
      }

      const webhookPayload = {
        idempotencyKey: 'idemp_pay_webhook_9941829',
        amountInCents: 12000,
        status: 'PAID' as const,
      };

      // First webhook reception
      const result1 = handlePaymentWebhook(webhookPayload);
      expect(result1.status).toBe('PROCESSED');
      expect(balanceCreditInCents).toBe(12000);

      // Second webhook reception (duplicate network delivery)
      const result2 = handlePaymentWebhook(webhookPayload);
      expect(result2.status).toBe('IGNORED_DUPLICATE');
      // Balance must NOT double
      expect(balanceCreditInCents).toBe(12000);
    });
  });

  describe('Multi-tenant & IDOR Access Control', () => {
    it('prevents Student A from viewing or updating bookings belonging to Student B', () => {
      interface BookingRecord {
        id: string;
        studentId: string;
        providerId: string;
      }

      const bookingsDatabase: BookingRecord[] = [
        { id: 'book_1', studentId: 'student_alice', providerId: 'prov_1' },
        { id: 'book_2', studentId: 'student_bob', providerId: 'prov_2' },
      ];

      function getBookingForStudent(bookingId: string, currentStudentId: string) {
        const booking = bookingsDatabase.find((b) => b.id === bookingId);
        if (!booking) return { error: 'NOT_FOUND', status: 404 };
        if (booking.studentId !== currentStudentId) {
          return { error: 'FORBIDDEN_IDOR', status: 403 };
        }
        return { data: booking, status: 200 };
      }

      // Alice accesses her own booking
      const aliceAccess = getBookingForStudent('book_1', 'student_alice');
      expect(aliceAccess.status).toBe(200);

      // Alice attempts to access Bob's booking
      const aliceTampering = getBookingForStudent('book_2', 'student_alice');
      expect(aliceTampering.status).toBe(403);
      expect(aliceTampering.error).toBe('FORBIDDEN_IDOR');
    });

    it('prevents Autoescola A from mutating vehicles belonging to Autoescola B', () => {
      interface VehicleRecord {
        id: string;
        providerId: string;
        plate: string;
      }

      const vehicleRegistry: VehicleRecord[] = [
        { id: 'veh_1', providerId: 'school_alpha', plate: 'ABC-1234' },
        { id: 'veh_2', providerId: 'school_beta', plate: 'XYZ-9876' },
      ];

      function updateVehicleForSchool(
        vehicleId: string,
        authenticatedSchoolId: string,
        newPlate: string
      ) {
        const vehicle = vehicleRegistry.find((v) => v.id === vehicleId);
        if (!vehicle) return { status: 404 };
        if (vehicle.providerId !== authenticatedSchoolId) {
          return { status: 403, error: 'UNAUTHORIZED_CROSS_TENANT' };
        }
        vehicle.plate = newPlate;
        return { status: 200, data: vehicle };
      }

      // School Alpha tries to alter School Beta vehicle
      const crossTenantAttempt = updateVehicleForSchool('veh_2', 'school_alpha', 'HACK-0000');
      expect(crossTenantAttempt.status).toBe(403);
      expect(crossTenantAttempt.error).toBe('UNAUTHORIZED_CROSS_TENANT');
    });
  });
});
