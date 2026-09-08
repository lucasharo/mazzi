import type { Booking } from '../types';
import { getBookingAddressVisibility } from '../domain/booking-address-visibility';
import { formatTimeBR } from './date-format';
import { formatMeetingPoint, formatPendingPaymentMeetingPoint } from './meeting-point';
import { needsMeetingPointAddress } from '../domain/maps/meeting-point-address';

export function getStudentBookingMeetingPointText(
  booking: Booking,
  fallback = 'Ponto de encontro a combinar',
  nowMs = Date.now(),
): string {
  const visibility = getBookingAddressVisibility(booking, nowMs);
  if (visibility.shouldHideProviderAddress) {
    return visibility.releaseAtMs !== undefined
      ? `Endereço estará disponível a partir de ${formatTimeBR(new Date(visibility.releaseAtMs).toISOString())}.`
      : 'Endereço estará disponível quando o instrutor estiver a caminho.';
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
  fallback = 'Ponto de encontro indicado no mapa',
): string {
  const meetingPoints = [booking.meetingPoint, booking.snapshot?.meetingPoint];
  const isProviderAddress = meetingPoints.some((value) => (
    typeof value === 'object'
      && value !== null
      && (value as { type?: string }).type === 'PROVIDER_ADDRESS'
  ));
  const providerOnTheWayAt = booking.providerOnTheWayAt
    || booking.snapshot?.provider_on_the_way_at
    || (booking.snapshot as { providerOnTheWayAt?: string } | undefined)?.providerOnTheWayAt;
  const canShowAddress = isProviderAddress || Boolean(providerOnTheWayAt) || booking.status === 'COMPLETED';

  if (!canShowAddress) return 'Endereço estará disponível quando você clicar em “Estou a caminho”.';
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
