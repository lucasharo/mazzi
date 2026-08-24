export type CheckInOperationalStatus = 'CONFIRMED' | 'IN_PROGRESS';

export type CheckInAvailabilityReason =
  | 'ALREADY_CHECKED_IN'
  | 'NOT_OPEN_YET'
  | 'AVAILABLE'
  | 'STATUS_NOT_OPERATIONAL';

export interface CheckInAvailabilityInput {
  scheduledStartAt?: string | Date | null;
  status: string;
  alreadyCheckedIn: boolean;
  now?: Date;
}

export interface CheckInAvailability {
  canCheckIn: boolean;
  opensAt: Date | null;
  reason: CheckInAvailabilityReason;
}

/** Canonical check-in window: opens 30 minutes before the absolute start instant. */
export function getCheckInAvailability({
  scheduledStartAt,
  status,
  alreadyCheckedIn,
  now = new Date(),
}: CheckInAvailabilityInput): CheckInAvailability {
  const normalizedStatus = String(status || '').toUpperCase();
  if (alreadyCheckedIn) return { canCheckIn: false, opensAt: null, reason: 'ALREADY_CHECKED_IN' };
  if (!['CONFIRMED', 'IN_PROGRESS'].includes(normalizedStatus)) {
    return { canCheckIn: false, opensAt: null, reason: 'STATUS_NOT_OPERATIONAL' };
  }

  const start = scheduledStartAt ? new Date(scheduledStartAt) : null;
  if (!start || !Number.isFinite(start.getTime())) {
    return { canCheckIn: false, opensAt: null, reason: 'NOT_OPEN_YET' };
  }

  const opensAt = new Date(start.getTime() - 30 * 60 * 1000);
  return now.getTime() >= opensAt.getTime()
    ? { canCheckIn: true, opensAt, reason: 'AVAILABLE' }
    : { canCheckIn: false, opensAt, reason: 'NOT_OPEN_YET' };
}
