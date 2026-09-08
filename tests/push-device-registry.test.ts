// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPushCapability, hasStoredPushDevice, requestPushPermission } from '../src/lib/push-device-registry';

describe('push capability', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports unsupported browsers without throwing', () => {
    const original = window.Notification;
    Object.defineProperty(window, 'Notification', { configurable: true, value: undefined });
    expect(getPushCapability()).toEqual({ supported: false, permission: 'unsupported', canAsk: false });
    Object.defineProperty(window, 'Notification', { configurable: true, value: original });
  });

  it('normalizes browser default permission to prompt', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} });
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default', requestPermission: vi.fn().mockResolvedValue('denied') } });
    expect(getPushCapability().permission).toBe('prompt');
    await expect(requestPushPermission()).resolves.toBe('denied');
  });

  it('recognizes a device already registered for the current app context and user', () => {
    window.localStorage.setItem('mazzi.push.device-id.PRO.user-1', 'device-1');

    expect(hasStoredPushDevice('PRO', 'user-1')).toBe(true);
    expect(hasStoredPushDevice('PRO', 'user-2')).toBe(false);
    expect(hasStoredPushDevice('STUDENT', 'user-1')).toBe(false);
  });
});
