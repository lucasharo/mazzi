// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPushCapability, requestPushPermission } from '../src/lib/push-device-registry';

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
});
