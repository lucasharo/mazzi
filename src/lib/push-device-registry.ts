import type { NotificationAppContext } from '../types';
import { dbService } from './db-service';
import { getFirebaseMessagingConfig, getFirebaseMessagingToken } from './firebase-messaging';
import { getServiceWorkerRegistration } from '../registerServiceWorker';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

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

export function hasStoredPushDevice(appContext: NotificationAppContext, userId?: string): boolean {
  if (!userId || typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(storageKey(DEVICE_ID_PREFIX, appContext, userId)));
  } catch {
    return false;
  }
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
  if (Capacitor.isNativePlatform()) {
    return { supported: true, permission: 'prompt', canAsk: true };
  }
  if (typeof window === 'undefined' || !window.Notification || !('serviceWorker' in navigator)) {
    return { supported: false, permission: 'unsupported', canAsk: false };
  }
  const permission = window.Notification.permission === 'default' ? 'prompt' : window.Notification.permission;
  return { supported: true, permission, canAsk: permission === 'prompt' };
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await PushNotifications.checkPermissions();
      const permission = current.receive === 'granted'
        ? 'granted'
        : current.receive === 'denied'
          ? 'denied'
          : (await PushNotifications.requestPermissions()).receive;
      return permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'prompt';
    } catch {
      return 'denied';
    }
  }
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
  if (Capacitor.isNativePlatform()) {
    const permission = await PushNotifications.checkPermissions();
    if (permission.receive !== 'granted') return { registered: false, reason: 'permission-denied' };
  } else if (capability.permission !== 'granted') {
    return { registered: false, reason: 'permission-denied' };
  }
  if (!Capacitor.isNativePlatform() && !getFirebaseMessagingConfig()) return { registered: false, reason: 'not-configured' };

  try {
    if (Capacitor.isNativePlatform()) {
      const token = await new Promise<string>((resolve, reject) => {
        let registrationHandle: { remove: () => Promise<void> } | undefined;
        let errorHandle: { remove: () => Promise<void> } | undefined;
        const finish = async (error?: Error, value?: string) => {
          await registrationHandle?.remove();
          await errorHandle?.remove();
          if (error) reject(error);
          else if (value) resolve(value);
          else reject(new Error('PUSH_TOKEN_EMPTY'));
        };
        void PushNotifications.addListener('registration', ({ value }) => void finish(undefined, value)).then((handle) => { registrationHandle = handle; });
        void PushNotifications.addListener('registrationError', ({ error }) => void finish(new Error(String(error)))).then((handle) => { errorHandle = handle; });
        void PushNotifications.register().catch((error) => void finish(error instanceof Error ? error : new Error('PUSH_REGISTER_FAILED')));
      });
      const deviceId = await dbService.registerMyPushDevice({
        provider: 'FCM',
        appContext: params.appContext,
        deviceFingerprint: getOrCreateDeviceFingerprint(params.appContext),
        endpoint: token,
      });
      if (!deviceId || deviceId === 'null') return { registered: false, reason: 'error' };
      if (params.userId && typeof window !== 'undefined') window.localStorage.setItem(storageKey(DEVICE_ID_PREFIX, params.appContext, params.userId), deviceId);
      return { registered: true, deviceId };
    }

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
