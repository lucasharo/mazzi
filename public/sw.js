/* MAZZI PWA — conservative public-asset cache only.
 * Do not cache Supabase/Auth/REST/RPC/private API responses.
 */

const basePath = self.location.pathname.substring(0, self.location.pathname.lastIndexOf('/') + 1);
const CACHE_NAME = 'mazzi-public-assets-v5';
const APP_SHELL = [
  basePath,
  basePath + 'manifest.webmanifest',
  basePath + 'brand/mazzi-road-motion.gif',
  basePath + 'brand/pwa/icon-192x192.png',
  basePath + 'brand/pwa/notification-badge.svg',
  basePath + 'brand/favicon/favicon-64x64.png'
];
const PUSH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-(?:4[0-9a-f]{3}|7[0-9a-f]{3})-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUSH_EVENTS = new Set(['BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'NEW_MESSAGE', 'PAYOUT_PAID', 'PAYOUT_BLOCKED', 'PAYOUT_FAILED', 'REVIEW_RECEIVED', 'COMPLIANCE_PENDING']);
const PUSH_CONTEXTS = new Set(['STUDENT', 'PRO']);
const PUSH_ENTITIES = new Set(['booking', 'payout', 'earnings', 'compliance']);
const PUSH_ACTIONS = new Set(['details', 'chat', 'review', 'reviews', 'compliance']);

function isPrivateOrDynamicRequest(request) {
  const url = new URL(request.url);

  if (request.method !== 'GET') return true;
  if (url.origin !== self.location.origin) return true;

  // Never cache Vite/HMR or source modules. A PWA worker controlling a DEV
  // page must not serve an old React module after a local code change.
  if (
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) return true;

  return (
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/rpc/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/storage/') ||
    url.pathname.includes('supabase')
  );
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeFcmData(payload) {
  if (!isRecord(payload)) return null;
  const data = isRecord(payload.data) ? payload.data : payload;
  const nestedTarget = isRecord(data.target) ? data.target : null;
  const target = nestedTarget || {
    version: data.version,
    appContext: data.appContext,
    entityType: data.entityType,
    entityId: data.entityId || null,
    action: data.action,
  };
  return {
    notificationId: data.notificationId || null,
    eventType: data.eventType,
    appContext: data.appContext || target.appContext,
    target: {
      version: Number(target.version),
      entityType: target.entityType,
      entityId: target.entityId || null,
      action: target.action,
    },
  };
}

function validatePushData(data) {
  const normalized = normalizeFcmData(data) || data;
  if (!normalized || typeof normalized !== 'object' || !PUSH_EVENTS.has(normalized.eventType) || !PUSH_CONTEXTS.has(normalized.appContext)) return null;
  const target = normalized.target;
  if (!target || target.version !== 1 || !PUSH_ENTITIES.has(target.entityType) || !PUSH_ACTIONS.has(target.action)) return null;
  if (target.entityId && !PUSH_UUID.test(target.entityId)) return null;
  if (target.entityType === 'booking' && !['STUDENT', 'PRO'].includes(normalized.appContext)) return null;
  if (target.entityType === 'booking' && target.action === 'review' && normalized.appContext !== 'STUDENT') return null;
  if (target.entityType === 'booking' && !['details', 'chat', 'review'].includes(target.action)) return null;
  if ((target.entityType === 'payout' || target.entityType === 'compliance' || target.entityType === 'booking') && !target.entityId) return null;
  if (target.entityType === 'earnings' && (target.entityId || target.action !== 'reviews' || normalized.appContext !== 'PRO')) return null;
  if (target.entityType === 'payout' && normalized.appContext !== 'PRO') return null;
  if (target.entityType === 'compliance' && (normalized.appContext !== 'PRO' || target.action !== 'compliance')) return null;
  if (typeof normalized.notificationId !== 'undefined' && normalized.notificationId !== null && typeof normalized.notificationId !== 'string') return null;
  return { eventType: normalized.eventType, appContext: normalized.appContext, target: { version: 1, entityType: target.entityType, entityId: target.entityId || null, action: target.action }, notificationId: normalized.notificationId || null };
}

function targetUrl(data) {
  const appKey = data.appContext === 'PRO' ? 'provider' : data.appContext.toLowerCase();
  const route = data.target.entityType === 'booking' ? 'bookings' : data.target.entityType === 'compliance' ? 'management' : 'earnings';
  const url = new URL(basePath, self.location.origin);
  url.hash = `/${appKey}/${route}?v=1&c=${encodeURIComponent(data.appContext)}&e=${encodeURIComponent(data.target.entityType)}&a=${encodeURIComponent(data.target.action)}${data.target.entityId ? `&id=${encodeURIComponent(data.target.entityId)}` : ''}`;
  return url.href;
}

function clientMatchesAppContext(client, appContext) {
  const expectedAppKey = appContext === 'PRO' ? 'provider' : 'student';
  const hashMatch = client.url.match(/#\/(student|provider)(?:\/|$)/);
  // A client without an explicit app route is not safe to reuse: it may be
  // the other role before its router has initialized. Open the notification
  // target instead so app_context remains authoritative in multi-role PWAs.
  return Boolean(hashMatch && hashMatch[1] === expectedAppKey);
}

function pushCopy(eventType) {
  if (eventType === 'NEW_MESSAGE') return { title: 'Nova mensagem', body: 'Você recebeu uma atualização em uma aula.' };
  if (eventType === 'PAYOUT_PAID') return { title: 'Repasse atualizado', body: 'Há uma atualização disponível em Ganhos.' };
  if (eventType === 'PAYOUT_BLOCKED' || eventType === 'PAYOUT_FAILED') return { title: 'Repasse requer atenção', body: 'Confira a situação em Ganhos.' };
  if (eventType === 'REVIEW_RECEIVED') return { title: 'Nova avaliação', body: 'Confira seu desempenho no MAZZI.' };
  if (eventType === 'COMPLIANCE_PENDING') return { title: 'Pendência de cadastro', body: 'Há uma pendência para revisar em Gestão.' };
  return { title: 'Atualização da aula', body: 'Confira os detalhes da sua aula no MAZZI.' };
}

function foregroundMessagePayload(data) {
  return {
    data: {
      notificationId: data.notificationId || null,
      eventType: data.eventType,
      appContext: data.appContext,
      version: '1',
      entityType: data.target.entityType,
      entityId: data.target.entityId || '',
      action: data.target.action,
    },
  };
}

async function handlePushMessage(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const hasVisibleClient = clients.some((client) => client.visibilityState === 'visible');

  for (const client of clients) {
    client.postMessage({ source: 'mazzi-fcm', payload: foregroundMessagePayload(data) });
  }

  if (hasVisibleClient) return;

  const copy = pushCopy(data.eventType);
  await self.registration.showNotification(copy.title, {
    body: copy.body,
    tag: data.notificationId ? `mazzi-notification-${data.notificationId}` : `mazzi-${data.eventType}`,
    data,
    icon: `${basePath}brand/favicon/favicon-64x64.png`,
    badge: `${basePath}brand/pwa/notification-badge.svg`,
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (isPrivateOrDynamicRequest(request)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(basePath))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        return response;
      });
    })
  );
});

self.addEventListener('push', (event) => {
  let data = null;
  try { data = validatePushData(event.data ? event.data.json() : null); } catch { data = null; }
  if (!data) return;
  event.waitUntil(handlePushMessage(data));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = validatePushData(event.notification.data);
  if (!data) return;
  const url = targetUrl(data);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin) && clientMatchesAppContext(client, data.appContext));
      if (existing) return existing.navigate(url).then((client) => client && client.focus());
      return self.clients.openWindow(url);
    })
  );
});
