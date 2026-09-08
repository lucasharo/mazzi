import type { Booking } from '../types';
import { getBookingStartTimestamp } from './booking';

export const BOOKING_ADDRESS_RELEASE_WINDOW_MS = 60 * 60 * 1_000;

export interface BookingAddressVisibility {
  isProviderAddress: boolean;
  shouldHideProviderAddress: boolean;
  releaseAtMs?: number;
}

/**
 * Applies the student-facing privacy rule for provider meeting points.
 * A student's own address is never hidden by this rule. Provider addresses
 * are released one hour before the lesson, or when the provider is already
 * on the way, matching the booking details flow.
 */
export function getBookingAddressVisibility(
  booking: Booking,
  nowMs = Date.now(),
): BookingAddressVisibility {
  const meetingPoints = [booking.meetingPoint, booking.snapshot?.meetingPoint];
  const isProviderAddress = meetingPoints.some((value) => (
    typeof value === 'object'
      && value !== null
      && (value as { type?: string }).type === 'PROVIDER_ADDRESS'
  ));

  const providerOnTheWayAt = booking.providerOnTheWayAt
    || booking.snapshot?.provider_on_the_way_at
    || (booking.snapshot as { providerOnTheWayAt?: string } | undefined)?.providerOnTheWayAt;
  const isLessonStarted = booking.status === 'IN_PROGRESS' || Boolean(booking.lessonStartedAt);
  const scheduledStartMs = getBookingStartTimestamp(booking);
  const releaseAtMs = scheduledStartMs > 0
    ? scheduledStartMs - BOOKING_ADDRESS_RELEASE_WINDOW_MS
    : undefined;
  const isAddressReleaseWindowOpen = releaseAtMs !== undefined && nowMs >= releaseAtMs;

  const shouldHideProviderAddress = !isLessonStarted
    && ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)
    && !providerOnTheWayAt
    && isProviderAddress
    && !isAddressReleaseWindowOpen;

  return {
    isProviderAddress,
    shouldHideProviderAddress,
    releaseAtMs,
  };
}
