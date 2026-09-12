import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

export const INITIAL_NAVIGATION_READY_EVENT = 'mazzi:initial-navigation-ready';
const INITIAL_SPLASH_FAILSAFE_MS = 3000;
const NOTIFICATION_SPLASH_ID = 'mazzi-notification-splash';

function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

function removeWebSplashOnNative(): void {
  if (!isNativePlatform() || typeof document === 'undefined') return;
  document.getElementById('mazzi-initial-splash')?.remove();
}

function hideNativeSplash(): void {
  if (typeof window === 'undefined') return;
  void SplashScreen.hide().catch(() => undefined);
  document.getElementById(NOTIFICATION_SPLASH_ID)?.remove();
}

/** Shows the same native splash briefly when Android resumes the app from a push tap. */
export function showNativeSplashForNotification(): void {
  if (!isNativePlatform()) return;
  if (typeof document === 'undefined' || document.getElementById(NOTIFICATION_SPLASH_ID)) return;
  const overlay = document.createElement('div');
  overlay.id = NOTIFICATION_SPLASH_ID;
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647', display: 'grid',
    placeItems: 'center', background: '#f6c945', pointerEvents: 'none',
  });
  const icon = document.createElement('img');
  icon.src = '/brand/mazzi-mark-transparent.png';
  icon.alt = '';
  Object.assign(icon.style, { width: '180px', height: '180px', objectFit: 'contain' });
  overlay.appendChild(icon);
  document.body.appendChild(overlay);
}

export function signalInitialNavigationReady(): void {
  if (typeof window === 'undefined') return;
  removeWebSplashOnNative();
  hideNativeSplash();

  const dispatchReadyEvent = () => window.dispatchEvent(new Event(INITIAL_NAVIGATION_READY_EVENT));
  if (typeof window.requestAnimationFrame !== 'function') {
    window.setTimeout(dispatchReadyEvent, 0);
    return;
  }

  // Let the app commit its first data-driven render before the root gate
  // starts dismissing the static splash.
  window.requestAnimationFrame(() => window.requestAnimationFrame(dispatchReadyEvent));
}

export function dismissInitialSplash(): void {
  if (typeof document === 'undefined') return;
  hideNativeSplash();

  const splash = document.getElementById('mazzi-initial-splash');
  if (!splash || splash.dataset.ready === 'true' || splash.dataset.dismissScheduled === 'true') return;

  if (isNativePlatform()) {
    splash.remove();
    return;
  }

  const reveal = () => {
    const currentSplash = document.getElementById('mazzi-initial-splash');
    if (!currentSplash || currentSplash.dataset.ready === 'true') return;

    currentSplash.dataset.ready = 'true';
    currentSplash.classList.add('is-ready');
    window.setTimeout(() => currentSplash.remove(), 180);
  };

  splash.dataset.dismissScheduled = 'true';
  if (typeof window.requestAnimationFrame !== 'function') {
    window.setTimeout(reveal, 0);
    return;
  }

  window.requestAnimationFrame(() => window.requestAnimationFrame(reveal));
}

// Keep a rendering/auth failure from leaving the visual splash over the app
// forever. The native Android splash is handled independently by Capacitor.
if (typeof window !== 'undefined') {
  removeWebSplashOnNative();
  window.setTimeout(() => dismissInitialSplash(), INITIAL_SPLASH_FAILSAFE_MS);
}
