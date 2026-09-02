import { parseNotificationNavigationTarget, serializeNotificationNavigationTarget, type NotificationNavigationTarget } from './notification-navigation';

const STORAGE_KEY = 'mazzi.pending-notification-navigation.v1';
const TTL_MS = 10 * 60 * 1000;

export function storePendingNotificationTarget(target: NotificationNavigationTarget): void {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ target: serializeNotificationNavigationTarget(target), expiresAt: Date.now() + TTL_MS })); } catch { /* session storage is optional */ }
}

export function readPendingNotificationTarget(): NotificationNavigationTarget | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { target?: string; expiresAt?: number };
    if (!parsed.target || !parsed.expiresAt || parsed.expiresAt < Date.now()) { window.sessionStorage.removeItem(STORAGE_KEY); return null; }
    const result = parseNotificationNavigationTarget(parsed.target);
    return result.ok ? result.target : null;
  } catch { return null; }
}

export function clearPendingNotificationTarget(): void {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* optional */ }
}
