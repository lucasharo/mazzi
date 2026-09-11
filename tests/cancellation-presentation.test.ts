import { describe, expect, it } from 'vitest';
import { getFriendlyCancellationReason } from '../src/components/booking/BookingDetailsShared';
import { Booking } from '../src/types';

const booking = (reason: string, status: Booking['status'] = 'CANCELLED_BY_PROVIDER') => ({
  status,
  cancellationReason: reason,
} as Booking);

describe('Cancellation reason presentation', () => {
  it('converts provider domain codes into Portuguese descriptions', () => {
    expect(getFriendlyCancellationReason(booking('SCHEDULE_CONFLICT'))).toBe('Conflito de agenda');
    expect(getFriendlyCancellationReason(booking('SCHEDULE_CONFLICT: O horário ficou indisponível'))).toBe('Conflito de agenda: O horário ficou indisponível');
    expect(getFriendlyCancellationReason(booking('Conflito de agenda: SCHEDULE CONFLICT'))).toBe('Conflito de agenda');
    expect(getFriendlyCancellationReason(booking('Problema no veículo: VEHICLE ISSUE'))).toBe('Problema no veículo');
    expect(getFriendlyCancellationReason(booking('Problema no veículo: VEHICLE_ISSUE'))).toBe('Problema no veículo');
  });

  it('keeps student fallback friendly and hides unknown enum tokens', () => {
    expect(getFriendlyCancellationReason(booking('STUDENT_REQUEST', 'CANCELLED_BY_STUDENT'))).toBe('Cancelamento solicitado pelo aluno, sem motivo informado.');
    expect(getFriendlyCancellationReason(booking('UNRECOGNIZED_DOMAIN_CODE'))).toBe('Motivo não informado.');
  });
});
