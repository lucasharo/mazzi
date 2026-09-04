import { describe, expect, it } from 'vitest';
import { formatDateBR, formatDateTimeBR, formatTimeBR } from '../lib/date-format';
import { formatMeetingPoint, formatPendingPaymentMeetingPoint } from '../lib/meeting-point';
import { mapBookingFromDb } from '../lib/db-service';

describe('Student Experience Phase 1 formatters', () => {
  it('formats date-only values without UTC day shifting', () => {
    expect(formatDateBR('2026-08-25')).toBe('25/08/2026');
    expect(formatDateBR('24/08/2026')).toBe('24/08/2026');
  });

  it('formats timestamptz values in America/Sao_Paulo', () => {
    expect(formatDateTimeBR('2026-08-25T02:30:00.000Z')).toBe('24/08/2026 23:30');
    expect(formatTimeBR('2026-08-25T02:30:00.000Z')).toBe('23:30');
  });

  it.each([
    ['Pinheiros', 'Pinheiros'],
    [{ name: 'Bela Vista' }, 'Bela Vista'],
    [{ label: 'Consolação' }, 'Consolação'],
    [{ address: 'Rua Vergueiro, 100' }, 'Rua Vergueiro, 100'],
  ])('formats meeting point %o', (value, expected) => {
    expect(formatMeetingPoint(value as any)).toBe(expected);
    expect(formatMeetingPoint(value as any)).not.toContain('[object Object]');
  });

  it('masks street and house numbers when payment is pending', () => {
    const fullAddress = 'Rua Ilha Bela 360, Pedreira, São Paulo - Sudeste, 04459-050, Brasil';
    const masked = formatPendingPaymentMeetingPoint(fullAddress);
    expect(masked).not.toContain('Rua Ilha Bela');
    expect(masked).not.toContain('360');
    expect(masked).not.toContain('04459-050');
    expect(masked).toContain('Pedreira');
    expect(masked).toContain('São Paulo');

    const objAddress = { neighborhood: 'Pedreira', city: 'São Paulo' };
    expect(formatPendingPaymentMeetingPoint(objAddress)).toBe('Pedreira, São Paulo');
  });

  it('maps camelCase booking snapshots and real names', () => {
    const booking = mapBookingFromDb({
      id: 'booking-1', student_id: 'student-1', provider_id: 'provider-1', instructor_id: 'instructor-1',
      vehicle_id: 'vehicle-1', offering_id: 'offering-1', status: 'CONFIRMED',
      scheduled_start_at: '2026-08-25T02:30:00.000Z', scheduled_end_at: '2026-08-25T03:30:00.000Z',
      price_in_cents: 12000, platform_fee_in_cents: 0, total_in_cents: 12000,
      snapshot_data: { category: 'B', instructorName: 'Aline Teixeira Costa', providerName: 'CFC Paulista', vehicleName: 'VW Polo', meetingPoint: { name: 'Bela Vista' } },
      meeting_point: { name: 'Bela Vista' }, created_at: '2026-08-01T00:00:00Z',
    });
    expect(booking.instructorName).toBe('Aline Teixeira Costa');
    expect(booking.providerName).toBe('CFC Paulista');
    expect(booking.vehicleName).toBe('VW Polo');
    expect(booking.meetingPoint).toBe('Bela Vista');
    expect(booking.scheduledDate).toBe('24/08/2026');
  });

  it('maps legacy snake_case booking snapshots for compatibility', () => {
    const booking = mapBookingFromDb({
      id: 'booking-2', student_id: 'student-1', provider_id: 'provider-1', instructor_id: 'instructor-1',
      vehicle_id: 'vehicle-1', offering_id: 'offering-1', status: 'COMPLETED',
      scheduled_start_at: '2026-08-25T12:00:00.000Z', scheduled_end_at: '2026-08-25T13:00:00.000Z',
      price_in_cents: 12000, platform_fee_in_cents: 0, total_in_cents: 12000,
      snapshot_data: { category: 'B', instructor_name: 'Carlos Eduardo Souza', provider_name: 'Autoescola Paulista', vehicle_name: 'Onix', meeting_point: { label: 'Centro' } },
      meeting_point: { label: 'Centro' }, created_at: '2026-08-01T00:00:00Z',
    });
    expect(booking.instructorName).toBe('Carlos Eduardo Souza');
    expect(booking.providerName).toBe('Autoescola Paulista');
    expect(booking.vehicleName).toBe('Onix');
    expect(booking.meetingPoint).toBe('Centro');
  });
});
