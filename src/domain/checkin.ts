export type CheckInOperationalStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'ON_THE_WAY';

export type CheckInAvailabilityReason =
  | 'ALREADY_CHECKED_IN'
  | 'NOT_OPEN_YET'
  | 'AVAILABLE'
  | 'STATUS_NOT_OPERATIONAL';

export interface CheckInAvailabilityInput {
  scheduledStartAt?: string | Date | null;
  scheduledDate?: string | null;
  startTime?: string | null;
  status: string;
  alreadyCheckedIn: boolean;
  isOnTheWay?: boolean;
  hasArrived?: boolean;
  now?: Date;
}

export interface CheckInAvailability {
  canCheckIn: boolean;
  opensAt: Date | null;
  reason: CheckInAvailabilityReason;
}

/** Canonical check-in window: opens 15 minutes before the absolute start instant, or immediately when provider is on the way / arrived. */
export function getCheckInAvailability({
  scheduledStartAt,
  scheduledDate,
  startTime,
  status,
  alreadyCheckedIn,
  isOnTheWay = false,
  hasArrived = false,
  now = new Date(),
}: CheckInAvailabilityInput): CheckInAvailability {
  const normalizedStatus = String(status || '').toUpperCase();
  if (alreadyCheckedIn) return { canCheckIn: false, opensAt: null, reason: 'ALREADY_CHECKED_IN' };
  if (!['CONFIRMED', 'IN_PROGRESS', 'ON_THE_WAY'].includes(normalizedStatus)) {
    return { canCheckIn: false, opensAt: null, reason: 'STATUS_NOT_OPERATIONAL' };
  }

  // When provider is on the way or arrived at the location, check-in is immediately unlocked!
  if (normalizedStatus === 'ON_THE_WAY' || isOnTheWay || hasArrived) {
    return { canCheckIn: true, opensAt: now, reason: 'AVAILABLE' };
  }

  const startTimestamp = getCanonicalTimestamp(scheduledStartAt, scheduledDate, startTime);
  if (startTimestamp === null) {
    return { canCheckIn: false, opensAt: null, reason: 'NOT_OPEN_YET' };
  }

  const opensAt = new Date(startTimestamp - 15 * 60 * 1000);
  return now.getTime() >= opensAt.getTime()
    ? { canCheckIn: true, opensAt, reason: 'AVAILABLE' }
    : { canCheckIn: false, opensAt, reason: 'NOT_OPEN_YET' };
}

function getCanonicalTimestamp(
  isoTimestamp?: string | Date | null,
  dateOnly?: string | null,
  timeOnly?: string | null,
): number | null {
  if (isoTimestamp) {
    const parsed = new Date(isoTimestamp).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  if (!dateOnly || !timeOnly) return null;
  const normalizedDate = /^\d{2}\/\d{2}\/\d{4}$/.test(dateOnly)
    ? `${dateOnly.slice(6)}-${dateOnly.slice(3, 5)}-${dateOnly.slice(0, 2)}`
    : dateOnly;
  const normalizedTime = timeOnly.length === 5 ? `${timeOnly}:00` : timeOnly;
  const parsed = new Date(`${normalizedDate}T${normalizedTime}-03:00`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
