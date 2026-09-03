import { describe, expect, it } from 'vitest';
import {
  appRouteForNotificationTarget,
  parseNotificationNavigationTarget,
  serializeNotificationNavigationTarget,
  targetFromNotification,
  validateNotificationNavigationTarget,
} from '../src/lib/notification-navigation';

const bookingId = '6e4578ed-ef6d-40c6-bb5c-008cdc472b1d';
const payoutId = 'b07013c1-ce07-47d1-b4fd-8c8f4cdaedff';

describe('notification navigation contract', () => {
  it('accepts an allowlisted booking target and round-trips it', () => {
    const target = { version: 1 as const, appContext: 'PRO' as const, entityType: 'booking' as const, entityId: bookingId, action: 'chat' as const };
    const serialized = serializeNotificationNavigationTarget(target);
    expect(parseNotificationNavigationTarget(serialized)).toEqual({ ok: true, target });
    expect(appRouteForNotificationTarget(target)).toBe('bookings');
  });

  it('rejects malformed IDs, unknown keys and arbitrary URLs', () => {
    expect(validateNotificationNavigationTarget({ version: 1, appContext: 'PRO', entityType: 'payout', entityId: 'not-a-uuid', action: 'details' }).ok).toBe(false);
    expect(parseNotificationNavigationTarget('v=1&c=PRO&e=booking&a=details&id=' + bookingId + '&url=https://evil.test').ok).toBe(false);
    expect(parseNotificationNavigationTarget('https://evil.test').ok).toBe(false);
  });

  it('does not allow cross-context financial or compliance targets', () => {
    expect(validateNotificationNavigationTarget({ version: 1, appContext: 'STUDENT', entityType: 'payout', entityId: payoutId, action: 'details' }).ok).toBe(false);
    expect(validateNotificationNavigationTarget({ version: 1, appContext: 'PRO', entityType: 'compliance', entityId: payoutId, action: 'compliance' }).ok).toBe(true);
    expect(validateNotificationNavigationTarget({ version: 1, appContext: 'PRO', entityType: 'earnings', entityId: null, action: 'reviews' }).ok).toBe(true);
  });

  it('maps only known business events and keeps history-only notifications non-actionable', () => {
    expect(targetFromNotification({ type: 'BOOKING_CONFIRMED', appContext: 'STUDENT', entityType: 'booking', entityId: bookingId })).toEqual({
      ok: true,
      target: { version: 1, appContext: 'STUDENT', entityType: 'booking', entityId: bookingId, action: 'details' },
    });
    expect(targetFromNotification({ type: 'NEW_MESSAGE', appContext: 'PRO', entityType: 'booking', entityId: bookingId })).toMatchObject({ ok: true, target: { action: 'chat' } });
    expect(targetFromNotification({ type: 'REVIEW_RECEIVED', appContext: 'PRO', entityType: 'review', entityId: bookingId })).toMatchObject({ ok: true, target: { entityType: 'earnings', entityId: null, action: 'reviews' } });
    expect(targetFromNotification({ type: 'REVIEW_AVAILABLE', appContext: 'STUDENT', entityType: 'review', entityId: bookingId })).toMatchObject({ ok: true, target: { action: 'review' } });
  });
});
