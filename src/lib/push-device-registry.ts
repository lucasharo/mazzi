import type { NotificationAppContext } from '../types';
import { dbService } from './db-service';
import { getFirebaseMessagingConfig, getFirebaseMessagingToken } from './firebase-messaging';
import { getServiceWorkerRegistration } from '../registerServiceWorker';

export type PushPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface PushCapability {
  supported: boolean;
  permission: PushPermissionState;
  canAsk: boolean;
}

export type PushRegistrationReason = 'unsupported' | 'permission-denied' | 'not-configured' | 'error';

const DEVICE_ID_PREFIX = 'mazzi.push.device-id';
const FINGERPRINT_PREFIX = 'mazzi.push.device-fingerprint';

function storageKey(prefix: string, appContext: NotificationAppContext, userId?: string): string {
  return `${prefix}.${appContext}.${userId || 'anonymous'}`;
}

function getOrCreateDeviceFingerprint(appContext: NotificationAppContext): string {
  const key = storageKey(FINGERPRINT_PREFIX, appContext);
  try {
    const stored = window.localStorage.getItem(key);
    if (stored) return stored;
    const fingerprint = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, fingerprint);
    return fingerprint;
  } catch {
    return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `device-${Date.now()}`;
  }
}

export function getPushCapability(): PushCapability {
  if (typeof window === 'undefined' || !window.Notification || !('serviceWorker' in navigator)) {
    return { supported: false, permission: 'unsupported', canAsk: false };
  }
  const permission = window.Notification.permission === 'default' ? 'prompt' : window.Notification.permission;
  return { supported: true, permission, canAsk: permission === 'prompt' };
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  const capability = getPushCapability();
  if (!capability.supported) return 'unsupported';
  if (capability.permission !== 'prompt') return capability.permission;
  try {
    const permission = await window.Notification.requestPermission();
    return permission === 'default' ? 'prompt' : permission;
  } catch {
    return 'denied';
  }
}

export async function registerPushDevice(params: {
  appContext: NotificationAppContext;
  userId?: string;
}): Promise<{ registered: boolean; deviceId?: string; reason?: PushRegistrationReason }> {
  const capability = getPushCapability();
  if (!capability.supported) return { registered: false, reason: 'unsupported' };
  if (capability.permission !== 'granted') return { registered: false, reason: 'permission-denied' };
  if (!getFirebaseMessagingConfig()) return { registered: false, reason: 'not-configured' };

  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) return { registered: false, reason: 'unsupported' };
    const token = await getFirebaseMessagingToken(registration);
    if (!token) return { registered: false, reason: 'error' };
    const deviceId = await dbService.registerMyPushDevice({
      provider: 'FCM',
      appContext: params.appContext,
      deviceFingerprint: getOrCreateDeviceFingerprint(params.appContext),
      endpoint: token,
    });
    if (!deviceId || deviceId === 'null') return { registered: false, reason: 'error' };
    if (params.userId && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey(DEVICE_ID_PREFIX, params.appContext, params.userId), deviceId);
    }
    return { registered: true, deviceId };
  } catch {
    return { registered: false, reason: 'error' };
  }
}

export async function disablePushDevice(deviceId: string): Promise<void> {
  await dbService.disableMyPushDevice(deviceId);
}

export async function disableStoredPushDevice(appContext: NotificationAppContext, userId?: string): Promise<void> {
  if (!userId || typeof window === 'undefined') return;
  const key = storageKey(DEVICE_ID_PREFIX, appContext, userId);
  const deviceId = window.localStorage.getItem(key);
  if (!deviceId) return;
  await disablePushDevice(deviceId);
  window.localStorage.removeItem(key);
}
