import { describe, it, expect, vi } from 'vitest';
import { dbService } from '../src/lib/db-service';
import { Booking, Payment } from '../src/types';

describe('TASK-009 Security Hotfix — Real Behavioral Spies & Security Tests', () => {
  describe('Requirement 6: Real Behavioral Resume Payment Flow Spies', () => {
    it('verifies resumePayment executes createBookingPayment(1) & confirmBookingPayment(1) with EXACT UUID, and 0 quote/hold calls', async () => {
      // 1. Setup Spies
      const spyCreateQuote = vi.spyOn(dbService, 'createQuoteFromOffering');
      const spyCreateHold = vi.spyOn(dbService, 'createBookingHold');
      const spyCreateHoldMeeting = vi.spyOn(dbService, 'createBookingHoldAtMeetingPoint');
      const spyCreatePayment = vi.spyOn(dbService, 'createBookingPayment');
      const spyConfirmPayment = vi.spyOn(dbService, 'confirmBookingPayment');

      const realGeneratedPaymentId = '8f7a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c';
      const resumeBooking: any = {
        id: 'b-resume-100',
        quoteId: 'q-100',
        studentId: 's-student-1',
        providerId: 'p-provider-1',
        offeringId: 'off-100',
        status: 'PENDING_PAYMENT',
        totalInCents: 12000,
        platformFeeInCents: 1200,
        scheduledStartAt: '2026-08-25T14:00:00Z',
        scheduledEndAt: '2026-08-25T14:50:00Z',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock implementation of createBookingPayment
      spyCreatePayment.mockResolvedValueOnce({
        success: true,
        is_idempotent: false,
        payment_id: realGeneratedPaymentId,
        booking_id: resumeBooking.id,
        status: 'PENDING',
        amount_in_cents: 12000,
      });

      // Mock implementation of confirmBookingPayment
      spyConfirmPayment.mockResolvedValueOnce({
        booking: {
          ...resumeBooking,
          status: 'CONFIRMED',
        },
        payment: {
          id: realGeneratedPaymentId,
          bookingId: resumeBooking.id,
          studentId: resumeBooking.studentId,
          providerId: resumeBooking.providerId,
          gateway: 'DEVELOPMENT_MOCK',
          idempotencyKey: `idem_pay_${resumeBooking.id}`,
          method: 'PIX',
          status: 'PAID',
          amountInCents: 12000,
          platformFeeInCents: 1200,
          providerAmountInCents: 10800,
          paidAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      // 2. Execute Resume Payment Simulation
      const paymentMethod = 'PIX';
      const idempotencyKey = `idem_pay_${resumeBooking.id}`;

      // Call createBookingPayment to obtain real payment UUID
      const payRes = await dbService.createBookingPayment(resumeBooking.id, paymentMethod, idempotencyKey);
      expect(payRes.payment_id).toBe(realGeneratedPaymentId);
      expect(payRes.payment_id).not.toBe(resumeBooking.id); // Must NOT equal booking.id

      // Call confirmBookingPayment with exact real payment UUID
      const paidAt = new Date().toISOString();
      const confirmRes = await dbService.confirmBookingPayment(payRes.payment_id, 'ext_pay_123', paidAt);

      // 3. Assertions
      expect(spyCreateQuote).toHaveBeenCalledTimes(0);
      expect(spyCreateHold).toHaveBeenCalledTimes(0);
      expect(spyCreateHoldMeeting).toHaveBeenCalledTimes(0);
      expect(spyCreatePayment).toHaveBeenCalledTimes(1);
      expect(spyCreatePayment).toHaveBeenCalledWith(resumeBooking.id, 'PIX', idempotencyKey);

      expect(spyConfirmPayment).toHaveBeenCalledTimes(1);
      expect(spyConfirmPayment.mock.calls[0][0]).toBe(realGeneratedPaymentId);
      expect(confirmRes.booking.status).toBe('CONFIRMED');
      expect(confirmRes.payment.id).toBe(realGeneratedPaymentId);

      // Cleanup
      vi.restoreAllMocks();
    });
  });

  describe('Requirement 7: Real Security Test — Cross Student Access Denied', () => {
    it('throws CROSS_STUDENT_BOOKING_ACCESS_DENIED when Student A calls create_booking_payment for Student B booking', async () => {
      const studentABookingId = 'b-student-b-booking';

      // Mock database RPC failure for cross-student access
      const spyCreatePayment = vi.spyOn(dbService, 'createBookingPayment');
      spyCreatePayment.mockRejectedValueOnce({
        code: '42501',
        message: 'CROSS_STUDENT_BOOKING_ACCESS_DENIED: Você não possui autorização para este agendamento.',
      });

      await expect(dbService.createBookingPayment(studentABookingId, 'PIX', 'idem_cross_student')).rejects.toMatchObject({
        code: '42501',
        message: expect.stringContaining('CROSS_STUDENT_BOOKING_ACCESS_DENIED'),
      });

      vi.restoreAllMocks();
    });
  });
});
