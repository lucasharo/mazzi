import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from 'firebase/messaging';
import type { NotificationAppContext, NotificationType } from '../types';
import {
  validateNotificationNavigationTarget,
  type NotificationNavigationTarget,
} from './notification-navigation';

type ClientEnv = Record<string, string | boolean | undefined>;

export interface FirebaseMessagingConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

export interface FirebasePushMessage {
  notificationId: string | null;
  eventType: NotificationType;
  appContext: NotificationAppContext;
  target: NotificationNavigationTarget;
}

const env = ((import.meta as unknown as { env?: ClientEnv }).env || {});
const PUSH_EVENTS = new Set<NotificationType>([
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'NEW_MESSAGE',
  'STUDENT_CHECKIN',
  'PROVIDER_CHECKIN',
  'LESSON_STARTED',
  'LESSON_COMPLETED',
  'CONTESTATION_UPDATED',
  'COMPLIANCE_PENDING',
  'PAYOUT_PAID',
  'PAYOUT_BLOCKED',
  'PAYOUT_FAILED',
  'REVIEW_AVAILABLE',
  'REVIEW_RECEIVED',
]);

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getStringEnv(name: string): string {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function getFirebaseMessagingConfig(): FirebaseMessagingConfig | null {
  const config = {
    apiKey: getStringEnv('VITE_FIREBASE_API_KEY'),
    authDomain: getStringEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: getStringEnv('VITE_FIREBASE_PROJECT_ID'),
    messagingSenderId: getStringEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: getStringEnv('VITE_FIREBASE_APP_ID'),
    vapidKey: getStringEnv('VITE_FCM_VAPID_KEY'),
  };

  return Object.values(config).every(nonEmptyString) ? config : null;
}

export function isFirebaseMessagingConfigured(): boolean {
  return getFirebaseMessagingConfig() !== null;
}

function getFirebaseApp(config: FirebaseMessagingConfig): FirebaseApp {
  const existingApp = getApps()[0];
  return existingApp || initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
}

async function getSupportedMessaging(): Promise<Messaging | null> {
  const config = getFirebaseMessagingConfig();
  if (!config || typeof window === 'undefined') return null;

  try {
    if (!(await isSupported())) return null;
    return getMessaging(getFirebaseApp(config));
  } catch {
    return null;
  }
}

export async function getFirebaseMessagingToken(
  serviceWorkerRegistration: ServiceWorkerRegistration,
): Promise<string | null> {
  const config = getFirebaseMessagingConfig();
  if (!config || typeof window === 'undefined' || window.Notification?.permission !== 'granted') return null;

  const messaging = await getSupportedMessaging();
  if (!messaging) return null;

  return getToken(messaging, {
    vapidKey: config.vapidKey,
    serviceWorkerRegistration,
  });
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeRawMessage(payload: MessagePayload): Record<string, unknown> | null {
  const outer = recordFromUnknown(payload.data);
  if (!outer) return null;

  const nestedTarget = recordFromUnknown(outer.target);
  const target = nestedTarget || {
    version: outer.version,
    appContext: outer.appContext,
    entityType: outer.entityType,
    entityId: outer.entityId || null,
    action: outer.action,
  };

  return {
    notificationId: outer.notificationId || null,
    eventType: outer.eventType,
    target: {
      version: typeof target.version === 'string' ? Number(target.version) : target.version,
      appContext: target.appContext,
      entityType: target.entityType,
      entityId: target.entityId || null,
      action: target.action,
    },
  };
}

export function normalizeFirebasePushMessage(payload: MessagePayload): FirebasePushMessage | null {
  const raw = normalizeRawMessage(payload);
  if (!raw || !PUSH_EVENTS.has(raw.eventType as NotificationType)) return null;

  const targetResult = validateNotificationNavigationTarget(raw.target);
  if (!targetResult.ok) return null;

  const appContext = targetResult.target.appContext;
  if (!['STUDENT', 'PRO'].includes(appContext)) return null;

  const notificationId = typeof raw.notificationId === 'string' ? raw.notificationId : null;
  if (notificationId !== null && (!nonEmptyString(notificationId) || notificationId.length > 128)) return null;

  return {
    notificationId,
    eventType: raw.eventType as NotificationType,
    appContext,
    target: targetResult.target,
  };
}

export async function subscribeToFirebaseForegroundMessages(
  listener: (message: FirebasePushMessage) => void,
): Promise<() => void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => undefined;

  const seenNotificationIds = new Set<string>();
  const emit = (message: FirebasePushMessage | null) => {
    if (!message) return;
    if (message.notificationId) {
      if (seenNotificationIds.has(message.notificationId)) return;
      seenNotificationIds.add(message.notificationId);
      if (seenNotificationIds.size > 100) {
        const oldest = seenNotificationIds.values().next().value;
        if (oldest) seenNotificationIds.delete(oldest);
      }
    }
    listener(message);
  };

  const serviceWorkerListener = (event: MessageEvent) => {
    const envelope = recordFromUnknown(event.data);
    if (!envelope || envelope.source !== 'mazzi-fcm') return;
    emit(normalizeFirebasePushMessage(envelope.payload as MessagePayload));
  };
  navigator.serviceWorker.addEventListener('message', serviceWorkerListener);

  const messaging = await getSupportedMessaging();
  if (!messaging) {
    return () => navigator.serviceWorker.removeEventListener('message', serviceWorkerListener);
  }

  const unsubscribeOnMessage = onMessage(messaging, (payload) => {
    emit(normalizeFirebasePushMessage(payload));
  });
  return () => {
    navigator.serviceWorker.removeEventListener('message', serviceWorkerListener);
    unsubscribeOnMessage();
  };
}
