import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('service worker notification contract', () => {
  it('keeps a single conservative worker with safe push click handling', () => {
    const worker = fs.readFileSync('public/sw.js', 'utf8');
    expect(worker).toContain("self.addEventListener('push'");
    expect(worker).toContain("self.addEventListener('notificationclick'");
    expect(worker).toContain('validatePushData');
    expect(worker).toContain('clients.matchAll');
    expect(worker).toContain("source: 'mazzi-fcm'");
    expect(worker).toContain("client.visibilityState === 'visible'");
    expect(worker).toContain('openWindow');
    expect(worker).toContain('clientMatchesAppContext');
    expect(worker).toContain('client.url.startsWith(self.location.origin) && clientMatchesAppContext(client, data.appContext)');
    expect(worker).toContain('return Boolean(hashMatch && hashMatch[1] === expectedAppKey);');
    expect(worker).not.toContain('return !hashMatch || hashMatch[1] === expectedAppKey;');
    expect(worker).toContain("notification-badge.svg");
    expect(worker).toContain("icon: `${basePath}brand/favicon/favicon-64x64.png`");
    expect(worker).not.toContain("badge: `${basePath}brand/pwa/icon-192x192.png`");
    expect(worker).toContain("url.origin !== self.location.origin");
    expect(worker).toContain("request.method !== 'GET'");
    expect(worker).not.toContain('data.url');
    expect(worker).toContain("const PUSH_CONTEXTS = new Set(['STUDENT', 'PRO']);");
    expect(worker).not.toContain("new Set(['STUDENT', 'PRO', 'ADMIN'])");
  });
});
