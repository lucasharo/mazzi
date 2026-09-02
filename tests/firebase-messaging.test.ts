import { describe, expect, it } from 'vitest';
import { getFirebaseMessagingConfig, normalizeFirebasePushMessage } from '../src/lib/firebase-messaging';
import type { MessagePayload } from 'firebase/messaging';

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';

describe('Firebase Messaging client contract', () => {
  it('accepts only a complete public configuration when one is provided', () => {
    const config = getFirebaseMessagingConfig();
    expect(config === null || Object.values(config).every((value) => typeof value === 'string' && value.length > 0)).toBe(true);
  });

  it('normalizes the flat data-only FCM payload to the shared navigation target', () => {
    const message = normalizeFirebasePushMessage({
      data: {
        notificationId: '22222222-2222-4222-8222-222222222222',
        eventType: 'BOOKING_CONFIRMED',
        version: '1',
        appContext: 'STUDENT',
        entityType: 'booking',
        entityId: BOOKING_ID,
        action: 'details',
      },
    } as unknown as MessagePayload);

    expect(message).toEqual({
      notificationId: '22222222-2222-4222-8222-222222222222',
      eventType: 'BOOKING_CONFIRMED',
      appContext: 'STUDENT',
      target: {
        version: 1,
        appContext: 'STUDENT',
        entityType: 'booking',
        entityId: BOOKING_ID,
        action: 'details',
      },
    });
  });

  it('rejects malformed or cross-context destinations', () => {
    const message = normalizeFirebasePushMessage({
      data: {
        eventType: 'BOOKING_CONFIRMED',
        version: '1',
        appContext: 'STUDENT',
        entityType: 'payout',
        entityId: BOOKING_ID,
        action: 'details',
      },
    } as unknown as MessagePayload);

    expect(message).toBeNull();
  });
});
