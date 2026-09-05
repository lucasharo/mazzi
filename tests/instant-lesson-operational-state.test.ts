import { describe, expect, it } from 'vitest';
import { getInstantLessonAvailabilityNotice, getInstantOperationalState } from '../src/domain/instant-lesson';

describe('Aula Agora operational state', () => {
  it('derives travel from metadata without changing the commercial booking status', () => {
    expect(getInstantOperationalState({
      bookingStatus: 'CONFIRMED',
      providerOnTheWayAt: '2026-09-04T16:01:00Z',
    })).toBe('ON_THE_WAY');
  });

  it('gives check-in precedence to ARRIVED and lesson lifecycle precedence to IN_PROGRESS', () => {
    expect(getInstantOperationalState({
      bookingStatus: 'CONFIRMED',
      providerOnTheWayAt: '2026-09-04T16:01:00Z',
      instructorCheckedIn: true,
    })).toBe('ARRIVED');
    expect(getInstantOperationalState({
      bookingStatus: 'IN_PROGRESS',
      providerOnTheWayAt: '2026-09-04T16:01:00Z',
      instructorCheckedIn: true,
    })).toBe('IN_PROGRESS');
  });

  it('never exposes operational travel for a pending-payment or terminal booking', () => {
    expect(getInstantOperationalState({
      bookingStatus: 'PENDING_PAYMENT',
      providerOnTheWayAt: '2026-09-04T16:01:00Z',
    })).toBe('WAITING_PAYMENT');
    expect(getInstantOperationalState({
      bookingStatus: 'COMPLETED',
      providerOnTheWayAt: '2026-09-04T16:01:00Z',
    })).toBe('TERMINAL');
  });

  it('blocks Aula Agora with an explicit reason during an active lesson or conflict window', () => {
    const nowMs = new Date('2026-09-05T12:00:00-03:00').getTime();
    expect(getInstantLessonAvailabilityNotice([{
      status: 'IN_PROGRESS',
      scheduledStartAt: '2026-09-05T11:30:00-03:00',
      scheduledEndAt: '2026-09-05T12:20:00-03:00',
    } as any], nowMs)?.reason).toBe('IN_PROGRESS');
    expect(getInstantLessonAvailabilityNotice([{
      status: 'CONFIRMED',
      scheduledStartAt: '2026-09-05T13:00:00-03:00',
      scheduledEndAt: '2026-09-05T13:50:00-03:00',
    } as any], nowMs)?.reason).toBe('CONFLICT');
    expect(getInstantLessonAvailabilityNotice([{
      status: 'CONFIRMED',
      scheduledStartAt: '2026-09-05T14:00:00-03:00',
      scheduledEndAt: '2026-09-05T14:50:00-03:00',
    } as any], nowMs)).toBeNull();
  });

  it('keeps Aula Agora blocked while the backend still marks the lesson IN_PROGRESS', () => {
    const nowMs = new Date('2026-09-05T13:00:00-03:00').getTime();
    expect(getInstantLessonAvailabilityNotice([{
      status: 'IN_PROGRESS',
      scheduledStartAt: '2026-09-05T11:30:00-03:00',
      scheduledEndAt: '2026-09-05T12:20:00-03:00',
    } as any], nowMs)?.reason).toBe('IN_PROGRESS');
  });
});
