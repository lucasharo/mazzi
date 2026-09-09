// ============================================================================
// MAZZI PLATFORM — PWA SERVICE WORKER REGISTRATION
// ============================================================================

type ClientEnv = Record<string, string | boolean | undefined>;

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function canRegisterServiceWorker(): boolean {
  const env = ((import.meta as unknown as { env?: ClientEnv }).env || {});
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

  const secureOrigin = window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const isProductionBuild = env.PROD === true;
  const isLocalDevOrigin = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const isRemoteDevBuild = env.DEV === true && secureOrigin && !isLocalDevOrigin;
  const hasFirebaseMessagingConfig = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_FCM_VAPID_KEY',
  ].every((key) => typeof env[key] === 'string' && env[key].trim().length > 0);
  // The worker never caches Vite source modules, but localhost only needs it
  // when FCM is configured; this keeps ordinary local development unchanged
  // while allowing DEV push tokens to be registered from localhost.
  const isLocalFcmDev = env.DEV === true && isLocalDevOrigin && hasFirebaseMessagingConfig;

  return secureOrigin && (isProductionBuild || isRemoteDevBuild || isLocalFcmDev);
}

export function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!canRegisterServiceWorker()) return Promise.resolve(null);
  if (registrationPromise) return registrationPromise;

  registrationPromise = new Promise((resolve) => {
    const register = () => {
      const env = ((import.meta as unknown as { env?: ClientEnv }).env || {});
      const base = typeof env.BASE_URL === 'string' && env.BASE_URL ? env.BASE_URL : '/';
      const workerUrl = new URL(`${base}sw.js`, window.location.href).href;
      void navigator.serviceWorker.getRegistration(base)
        .then(async (existing) => {
          const activeScriptUrl = existing?.active?.scriptURL || existing?.waiting?.scriptURL || existing?.installing?.scriptURL;
          if (existing && activeScriptUrl !== workerUrl) {
            await existing.unregister();
            return navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
          }
          return existing || navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
        })
        .then(async (registration) => {
          if (registration) {
            try {
              await registration.update();
            } catch {
              // A cached worker can still serve the app if an update check is unavailable.
            }
          }
          return registration;
        })
        .then(resolve)
        .catch((error: unknown) => {
          if (env.DEV) console.error('[MAZZI_PWA_REGISTRATION_FAILED]', error);
          resolve(null);
        });
    };

    if (document.readyState === 'loading') window.addEventListener('load', register, { once: true });
    else register();
  });

  return registrationPromise;
}

export function registerServiceWorker(): void {
  void getServiceWorkerRegistration();
}
