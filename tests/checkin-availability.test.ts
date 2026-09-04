import { describe, expect, it } from 'vitest';
import { getCheckInAvailability } from '../src/domain/checkin';

const start = '2026-08-27T08:00:00-03:00';

describe('check-in availability window', () => {
  it.each([
    ['07:44:59', false, 'NOT_OPEN_YET'],
    ['07:45:00', true, 'AVAILABLE'],
    ['08:00:00', true, 'AVAILABLE'],
    ['08:50:00', true, 'AVAILABLE'],
    ['12:00:00', true, 'AVAILABLE'],
  ])('at %s returns canCheckIn=%s', (time, canCheckIn, reason) => {
    const result = getCheckInAvailability({ scheduledStartAt: start, status: 'CONFIRMED', alreadyCheckedIn: false, now: new Date(`2026-08-27T${time}-03:00`) });
    expect(result.canCheckIn).toBe(canCheckIn);
    expect(result.reason).toBe(reason);
  });

  it('allows late IN_PROGRESS check-in and rejects terminal states', () => {
    expect(getCheckInAvailability({ scheduledStartAt: start, status: 'IN_PROGRESS', alreadyCheckedIn: false, now: new Date('2026-08-27T12:00:00-03:00') }).canCheckIn).toBe(true);
    expect(getCheckInAvailability({ scheduledStartAt: start, status: 'COMPLETED', alreadyCheckedIn: false, now: new Date('2026-08-27T12:00:00-03:00') }).reason).toBe('STATUS_NOT_OPERATIONAL');
    expect(getCheckInAvailability({ scheduledStartAt: start, status: 'CONFIRMED', alreadyCheckedIn: true, now: new Date('2026-08-27T12:00:00-03:00') }).reason).toBe('ALREADY_CHECKED_IN');
  });

  it('immediately unlocks check-in for PRO and Student when ON_THE_WAY, isOnTheWay, or hasArrived is active', () => {
    // Before 15-min window, normally NOT_OPEN_YET
    const earlyTime = new Date('2026-08-27T06:00:00-03:00');
    expect(getCheckInAvailability({ scheduledStartAt: start, status: 'CONFIRMED', alreadyCheckedIn: false, now: earlyTime }).canCheckIn).toBe(false);

    // Unlocked with ON_THE_WAY status
    expect(getCheckInAvailability({ scheduledStartAt: start, status: 'ON_THE_WAY', alreadyCheckedIn: false, now: earlyTime }).canCheckIn).toBe(true);

    // Unlocked with isOnTheWay flag
    expect(getCheckInAvailability({ scheduledStartAt: start, status: 'CONFIRMED', alreadyCheckedIn: false, isOnTheWay: true, now: earlyTime }).canCheckIn).toBe(true);

    // Unlocked with hasArrived flag
    expect(getCheckInAvailability({ scheduledStartAt: start, status: 'CONFIRMED', alreadyCheckedIn: false, hasArrived: true, now: earlyTime }).canCheckIn).toBe(true);
  });
});
