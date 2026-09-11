import type { Booking } from '../types';
import { CANCELLED_BOOKING_STATUSES } from '../domain/booking';
import { getBookingAddressVisibility } from '../domain/booking-address-visibility';
import { formatApproximateMeetingPoint, formatMeetingPoint, formatPendingPaymentMeetingPoint } from './meeting-point';
import { needsMeetingPointAddress } from '../domain/maps/meeting-point-address';

export function getStudentBookingMeetingPointText(
  booking: Booking,
  fallback = 'Região da aula',
  nowMs = Date.now(),
): string {
  const visibility = getBookingAddressVisibility(booking, nowMs);
  if ((CANCELLED_BOOKING_STATUSES.includes(booking.status) || booking.status === 'DISPUTED') && visibility.isProviderAddress) {
    return formatApproximateMeetingPoint(booking.snapshot?.meetingPoint || booking.meetingPoint || booking.fullMeetingPoint, fallback);
  }

  if (visibility.shouldHideProviderAddress) {
    return formatApproximateMeetingPoint(
      booking.snapshot?.meetingPoint || booking.meetingPoint || booking.fullMeetingPoint,
      fallback,
    );
  }

  if (booking.status === 'PENDING_PAYMENT') {
    return formatPendingPaymentMeetingPoint(
      booking.meetingPoint || booking.snapshot?.meetingPoint || booking.fullMeetingPoint,
    );
  }

  return formatMeetingPoint(booking.meetingPoint)
    || (booking.fullMeetingPoint && !needsMeetingPointAddress(booking.fullMeetingPoint)
      ? booking.fullMeetingPoint
      : '')
    || fallback;
}

export function getProviderBookingMeetingPointText(
  booking: Booking,
  fallback = 'Região da aula',
): string {
  const meetingPoints = [booking.meetingPoint, booking.snapshot?.meetingPoint];
  const isProviderAddress = meetingPoints.some((value) => (
    typeof value === 'object'
      && value !== null
      && (value as { type?: string }).type === 'PROVIDER_ADDRESS'
  ));
  if (CANCELLED_BOOKING_STATUSES.includes(booking.status) && !isProviderAddress) {
    return formatApproximateMeetingPoint(booking.snapshot?.meetingPoint || booking.meetingPoint || booking.fullMeetingPoint, fallback);
  }

  const providerOnTheWayAt = booking.providerOnTheWayAt;
  const canShowAddress = isProviderAddress || Boolean(providerOnTheWayAt) || booking.status === 'COMPLETED';

  if (!canShowAddress) {
    return formatApproximateMeetingPoint(
      booking.snapshot?.meetingPoint || booking.meetingPoint || booking.fullMeetingPoint,
      fallback,
    );
  }
  if (booking.status === 'PENDING_PAYMENT') {
    return formatPendingPaymentMeetingPoint(booking.meetingPoint || booking.snapshot?.meetingPoint || booking.fullMeetingPoint);
  }

  return formatMeetingPoint(booking.meetingPoint)
    || formatMeetingPoint(booking.snapshot?.meetingPoint)
    || (booking.fullMeetingPoint && !needsMeetingPointAddress(booking.fullMeetingPoint)
      ? booking.fullMeetingPoint
      : '')
    || fallback;
}
