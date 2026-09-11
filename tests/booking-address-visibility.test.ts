import { describe, expect, it } from 'vitest';
import type { Booking } from '../src/types';
import { getBookingAddressVisibility } from '../src/domain/booking-address-visibility';
import { getProviderBookingMeetingPointText, getStudentBookingMeetingPointText } from '../src/lib/booking-meeting-point-display';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    studentId: 'student-1',
    providerId: 'provider-1',
    providerName: 'Instrutor',
    instructorId: 'instructor-1',
    instructorName: 'Instrutor',
    vehicleId: 'vehicle-1',
    vehicleName: 'Carro',
    offeringId: 'offering-1',
    category: 'B',
    scheduledDate: '2026-09-08',
    startTime: '16:00',
    endTime: '16:50',
    scheduledStartAt: '2026-09-08T19:00:00.000Z',
    scheduledEndAt: '2026-09-08T19:50:00.000Z',
    status: 'CONFIRMED',
    snapshot: {
      providerId: 'provider-1',
      providerName: 'Instrutor',
      providerType: 'INSTRUCTOR',
      instructorId: 'instructor-1',
      instructorName: 'Instrutor',
      vehicleId: 'vehicle-1',
      vehicleName: 'Carro',
      category: 'B',
      durationMinutes: 50,
      priceInCents: 10000,
      platformFeeInCents: 1000,
      totalInCents: 11000,
      meetingPoint: { type: 'PROVIDER_ADDRESS', address: 'Rua do Instrutor, 100', neighborhood: 'Lapa', city: 'São Paulo' },
    },
    meetingPoint: 'Rua do Instrutor, 100',
    fullMeetingPoint: 'Rua do Instrutor, 100',
    priceInCents: 10000,
    platformFeeInCents: 1000,
    totalInCents: 11000,
    createdAt: '2026-09-08T12:00:00.000Z',
    ...overrides,
  };
}

describe('student booking address visibility', () => {
  it('hides provider address before the one-hour release window', () => {
    const booking = makeBooking();
    const visibility = getBookingAddressVisibility(booking, Date.parse('2026-09-08T17:30:00.000Z'));

    expect(visibility.shouldHideProviderAddress).toBe(true);
    expect(getStudentBookingMeetingPointText(booking, undefined, Date.parse('2026-09-08T17:30:00.000Z')))
      .toBe('Lapa, São Paulo');
    expect(getStudentBookingMeetingPointText(booking, undefined, Date.parse('2026-09-08T17:30:00.000Z')))
      .not.toContain('Rua do Instrutor');
  });

  it('keeps the student address visible before the release window', () => {
    const booking = makeBooking({
      meetingPoint: 'Rua do Aluno, 200',
      fullMeetingPoint: 'Rua do Aluno, 200',
      snapshot: {
        ...makeBooking().snapshot,
        meetingPoint: { type: 'STUDENT_ADDRESS', address: 'Rua do Aluno, 200', neighborhood: 'Lapa', city: 'São Paulo' },
      },
    });

    expect(getBookingAddressVisibility(booking, Date.parse('2026-09-08T17:30:00.000Z')).shouldHideProviderAddress)
      .toBe(false);
    expect(getStudentBookingMeetingPointText(booking, undefined, Date.parse('2026-09-08T17:30:00.000Z')))
      .toBe('Rua do Aluno, 200');
  });

  it('hides a student address from the PRO card until displacement starts', () => {
    const booking = makeBooking({
      meetingPoint: 'Rua do Aluno, 200',
      fullMeetingPoint: 'Rua do Aluno, 200',
      snapshot: {
        ...makeBooking().snapshot,
        meetingPoint: { type: 'STUDENT_ADDRESS', address: 'Rua do Aluno, 200', neighborhood: 'Lapa', city: 'São Paulo' },
      },
    });

    expect(getProviderBookingMeetingPointText(booking)).toBe('Lapa, São Paulo');
    expect(getProviderBookingMeetingPointText(booking)).not.toContain('Rua do Aluno');
    expect(getProviderBookingMeetingPointText({ ...booking, providerOnTheWayAt: '2026-09-08T18:00:00.000Z' })).toBe('Rua do Aluno, 200');
  });

  it('hides the other user address after cancellation while preserving the own address', () => {
    const providerAddressBooking = makeBooking({ status: 'CANCELLED_BY_STUDENT' });
    expect(getStudentBookingMeetingPointText(providerAddressBooking)).toBe('Lapa, São Paulo');

    const studentAddressBooking = makeBooking({
      status: 'CANCELLED_BY_PROVIDER',
      meetingPoint: 'Rua do Aluno, 200',
      fullMeetingPoint: 'Rua do Aluno, 200',
      snapshot: {
        ...makeBooking().snapshot,
        meetingPoint: { type: 'STUDENT_ADDRESS', address: 'Rua do Aluno, 200', neighborhood: 'Lapa', city: 'São Paulo' },
      },
    });
    expect(getProviderBookingMeetingPointText(studentAddressBooking)).toBe('Lapa, São Paulo');

    expect(getProviderBookingMeetingPointText(providerAddressBooking)).toBe('Rua do Instrutor, 100');
    expect(getStudentBookingMeetingPointText(studentAddressBooking)).toBe('Rua do Aluno, 200');
  });

  it('hides the provider address from the student while a dispute is active', () => {
    const disputedBooking = makeBooking({ status: 'DISPUTED' });

    expect(getStudentBookingMeetingPointText(disputedBooking)).toBe('Lapa, São Paulo');
    expect(getStudentBookingMeetingPointText(disputedBooking)).not.toContain('Rua do Instrutor');
  });

  it('hides the student address from the PRO while a dispute is active', () => {
    const disputedBooking = makeBooking({
      status: 'DISPUTED',
      meetingPoint: 'Rua do Aluno, 200',
      fullMeetingPoint: 'Rua do Aluno, 200',
      snapshot: {
        ...makeBooking().snapshot,
        meetingPoint: { type: 'STUDENT_ADDRESS', address: 'Rua do Aluno, 200', neighborhood: 'Lapa', city: 'São Paulo' },
      },
    });

    expect(getProviderBookingMeetingPointText(disputedBooking)).toBe('Lapa, São Paulo');
    expect(getProviderBookingMeetingPointText(disputedBooking)).not.toContain('Rua do Aluno');
  });
});
