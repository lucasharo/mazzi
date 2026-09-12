import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const service = readFileSync(
  'android-pro/app/src/main/java/br/com/mazzi/pro/InstantOfferMessagingService.java',
  'utf8',
);
const manifest = readFileSync('android-pro/app/src/main/AndroidManifest.xml', 'utf8');
const mainActivity = readFileSync('android-pro/app/src/main/java/br/com/mazzi/pro/MainActivity.java', 'utf8');
const dispatcher = readFileSync('supabase/functions/dispatch-push-notification/index.ts', 'utf8');
const instructorRoot = readFileSync('src/entrypoints/instructor/InstructorRoot.tsx', 'utf8');
const providerApp = readFileSync('src/apps/provider/ProviderApp.tsx', 'utf8');

describe('native Aula Agora notification actions', () => {
  it('renders high-priority actionable offers outside the PRO web surface', () => {
    expect(service).toContain('FirebaseMessagingService');
    expect(service).toContain('INSTANT_LESSON_OFFER');
    expect(service).toContain('NotificationCompat.PRIORITY_HIGH');
    expect(service).toContain('setSound(Settings.System.DEFAULT_NOTIFICATION_URI');
    expect(service).toContain('setVibrationPattern');
    expect(service).toContain('setTimeoutAfter');
    expect(service).toContain('"Aceitar"');
    expect(service).toContain('"Recusar"');
    expect(service).toContain('actionIntent(offerId, "ACCEPT"');
    expect(service).toContain('actionIntent(offerId, "DECLINE"');
  });

  it('keeps offer messages data-only so Android can render both actions', () => {
    expect(dispatcher).toContain('notification.type === "INSTANT_LESSON_OFFER" ? undefined');
    expect(dispatcher).toContain('eventType: notification.type');
    expect(dispatcher).toContain('expiresInSeconds');
  });

  it('routes native actions through the authenticated PRO session', () => {
    expect(manifest).toContain('android:host="instant-offer-action"');
    expect(instructorRoot).toContain('mazzi:instant-offer-action');
    expect(providerApp).toContain('handleRespondInstantOffer(pending.offerId, pending.action)');
    expect(mainActivity).toContain('dismissDeliveredOffers(this)');
  });
});
