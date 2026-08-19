import { describe, it, expect } from 'vitest';
import { mapBookingFromDb } from '../src/lib/db-service';

describe('TASK-052 — Provider Booking Lifecycle Hydration & Reload Resilience Tests', () => {
  const baseDbRow = {
    id: 'booking_hyd_001',
    student_id: 'student_001',
    provider_id: 'provider_001',
    instructor_id: 'instructor_001',
    vehicle_id: 'vehicle_001',
    offering_id: 'offering_001',
    category: 'B',
    status: 'CONFIRMED',
    scheduled_start_at: '2026-08-20T10:00:00Z',
    scheduled_end_at: '2026-08-20T10:50:00Z',
    price_in_cents: 10000,
    platform_fee_in_cents: 1000,
    total_in_cents: 11000,
    created_at: '2026-08-18T12:00:00Z',
    snapshot_data: {
      providerName: 'CFC Autoescola Teste',
      instructorName: 'Instrutor Carlos',
      vehicleName: 'Gol 1.0',
      meetingPoint: 'Ponto Central SP',
    },
  };

  it('A. CONFIRMED without check-in maps instructorCheckedIn = false and checkinInstructorAt = undefined', () => {
    const row = {
      ...baseDbRow,
      status: 'CONFIRMED',
      checkin_instructor_at: null,
    };
    const b = mapBookingFromDb(row);
    expect(b.status).toBe('CONFIRMED');
    expect(b.instructorCheckedIn).toBe(false);
    expect(b.checkinInstructorAt).toBeUndefined();
  });

  it('B. CONFIRMED with persisted check-in maps instructorCheckedIn = true and preserves exact checkinInstructorAt timestamp', () => {
    const row = {
      ...baseDbRow,
      status: 'CONFIRMED',
      checkin_instructor_at: '2026-08-20T09:45:00Z',
    };
    const b = mapBookingFromDb(row);
    expect(b.status).toBe('CONFIRMED');
    expect(b.instructorCheckedIn).toBe(true);
    expect(b.checkinInstructorAt).toBe('2026-08-20T09:45:00Z');
  });

  it('C. student check-in is correctly mapped from checkin_student_at', () => {
    const rowWithCheckin = {
      ...baseDbRow,
      checkin_student_at: '2026-08-20T09:46:00Z',
    };
    const bWith = mapBookingFromDb(rowWithCheckin);
    expect(bWith.studentCheckedIn).toBe(true);

    const rowWithoutCheckin = {
      ...baseDbRow,
      checkin_student_at: null,
    };
    const bWithout = mapBookingFromDb(rowWithoutCheckin);
    expect(bWithout.studentCheckedIn).toBe(false);
  });

  it('D. IN_PROGRESS booking preserves status and exact lessonStartedAt timestamp', () => {
    const row = {
      ...baseDbRow,
      status: 'IN_PROGRESS',
      checkin_instructor_at: '2026-08-20T09:45:00Z',
      lesson_started_at: '2026-08-20T10:01:00Z',
    };
    const b = mapBookingFromDb(row);
    expect(b.status).toBe('IN_PROGRESS');
    expect(b.instructorCheckedIn).toBe(true);
    expect(b.lessonStartedAt).toBe('2026-08-20T10:01:00Z');
  });

  it('E. COMPLETED booking preserves status, completedAt, and lessonFinishedAt timestamps', () => {
    const row = {
      ...baseDbRow,
      status: 'COMPLETED',
      checkin_instructor_at: '2026-08-20T09:45:00Z',
      lesson_started_at: '2026-08-20T10:01:00Z',
      completed_at: '2026-08-20T10:51:00Z',
      lesson_finished_at: '2026-08-20T10:51:00Z',
    };
    const b = mapBookingFromDb(row);
    expect(b.status).toBe('COMPLETED');
    expect(b.completedAt).toBe('2026-08-20T10:51:00Z');
    expect(b.lessonFinishedAt).toBe('2026-08-20T10:51:00Z');
  });

  it('F. NULL timestamps in DB are NOT substituted by fallback clock values', () => {
    const row = {
      ...baseDbRow,
      checkin_instructor_at: null,
      lesson_started_at: null,
      lesson_finished_at: null,
      completed_at: null,
      confirmed_at: null,
      updated_at: null,
      hold_expires_at: null,
    };
    const b = mapBookingFromDb(row);
    expect(b.checkinInstructorAt).toBeUndefined();
    expect(b.lessonStartedAt).toBeUndefined();
    expect(b.lessonFinishedAt).toBeUndefined();
    expect(b.completedAt).toBeUndefined();
    expect(b.confirmedAt).toBeUndefined();
    expect(b.updatedAt).toBeUndefined();
    expect(b.holdExpiresAt).toBeUndefined();
  });

  it('G. metadata fields (updatedAt, confirmedAt, holdExpiresAt, quoteId, idempotencyKey) are preserved', () => {
    const row = {
      ...baseDbRow,
      quote_id: 'quote_123',
      idempotency_key: 'idem_key_456',
      confirmed_at: '2026-08-18T12:05:00Z',
      updated_at: '2026-08-18T12:10:00Z',
      hold_expires_at: '2026-08-18T12:20:00Z',
    };
    const b = mapBookingFromDb(row);
    expect(b.quoteId).toBe('quote_123');
    expect(b.idempotencyKey).toBe('idem_key_456');
    expect(b.confirmedAt).toBe('2026-08-18T12:05:00Z');
    expect(b.updatedAt).toBe('2026-08-18T12:10:00Z');
    expect(b.holdExpiresAt).toBe('2026-08-18T12:20:00Z');
  });

  it('H. cancellation metadata fields are preserved when present in DB row', () => {
    const row = {
      ...baseDbRow,
      status: 'CANCELLED_BY_STUDENT',
      cancelled_at: '2026-08-19T14:00:00Z',
      cancelled_by: 'STUDENT',
      cancellation_reason: 'Imprevisto de saúde',
      refund_amount_in_cents: 11000,
      expired_at: null,
    };
    const b = mapBookingFromDb(row);
    expect(b.status).toBe('CANCELLED_BY_STUDENT');
    expect(b.cancelledAt).toBe('2026-08-19T14:00:00Z');
    expect(b.cancelledBy).toBe('STUDENT');
    expect(b.cancellationReason).toBe('Imprevisto de saúde');
    expect(b.refundAmountInCents).toBe(11000);
  });

  it('I. reload state contract: CONFIRMED booking with checkin_instructor_at maps to instructorCheckedIn === true after page refresh/workspace reload', () => {
    const rowAfterReload = {
      ...baseDbRow,
      status: 'CONFIRMED',
      checkin_instructor_at: '2026-08-20T09:50:00Z',
    };
    const b = mapBookingFromDb(rowAfterReload);

    // This is the core reload resilience requirement: UI will see instructorCheckedIn=true and render "Iniciar Aula" instead of "Check-in"
    expect(b.status).toBe('CONFIRMED');
    expect(b.instructorCheckedIn).toBe(true);
    expect(b.checkinInstructorAt).toBe('2026-08-20T09:50:00Z');
  });

  it('J. lifecycle state independence: instructorCheckedIn is strictly derived from checkin_instructor_at, NOT inferred from status', () => {
    const rowLegacyInProgressNoCheckin = {
      ...baseDbRow,
      status: 'IN_PROGRESS',
      checkin_instructor_at: null,
    };
    const b = mapBookingFromDb(rowLegacyInProgressNoCheckin);
    expect(b.status).toBe('IN_PROGRESS');
    expect(b.instructorCheckedIn).toBe(false);
  });
});
