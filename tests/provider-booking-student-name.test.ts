import { describe, expect, it } from 'vitest';
import { mapBookingFromDb } from '../src/lib/db-service';

const bookingRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  student_id: 'student-1',
  provider_id: 'provider-1',
  instructor_id: 'instructor-1',
  vehicle_id: 'vehicle-1',
  offering_id: 'offering-1',
  status: 'CONFIRMED',
  scheduled_start_at: '2026-08-24T10:00:00-03:00',
  scheduled_end_at: '2026-08-24T10:50:00-03:00',
  price_in_cents: 10500,
  snapshot_data: { category: 'B' },
  meeting_point: 'Consolação, São Paulo',
  ...overrides,
});

describe('provider booking student name mapping', () => {
  it('keeps the student name returned by the unified instructor RPC', () => {
    const booking = mapBookingFromDb(bookingRow({ student_name: 'Bruno Henrique Lima' }));

    expect(booking.studentName).toBe('Bruno Henrique Lima');
  });

  it('accepts the camelCase name returned by normalized client data', () => {
    const booking = mapBookingFromDb(bookingRow({ studentName: 'Ana Maria' }));

    expect(booking.studentName).toBe('Ana Maria');
  });
});
