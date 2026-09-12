import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const EXIT_CONFIRMATION_WINDOW_MS = 2_500;
let exitConfirmationTimer: ReturnType<typeof setTimeout> | null = null;
let exitConfirmationArmed = false;
let nativeBackButtonRegistration: Promise<void> | null = null;
let nativeBackButtonHandle: { remove: () => Promise<void> } | null = null;
let nativeBackButtonConsumers = 0;

function isMazziRootEntry(): boolean {
  if (window.history.state?.mazziNativeRoot === true) return true;
  if (window.history.state?.mazziModal) return false;
  return /^#\/(student\/home|provider\/dashboard|admin\/dashboard)(?:\?|$)/.test(window.location.hash);
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Uses the Capacitor bridge on Android/iOS and the browser API on the web. */
export async function getCurrentPositionCompat(options: PositionOptions = {}): Promise<GeolocationPosition> {
  if (!isNativeApp()) {
    if (!navigator.geolocation) throw new Error('GEOLOCATION_UNAVAILABLE');
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  const permission = await Geolocation.checkPermissions();
  if (permission.location !== 'granted') {
    const requested = await Geolocation.requestPermissions();
    if (requested.location !== 'granted') throw new Error('GEOLOCATION_PERMISSION_DENIED');
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: options.enableHighAccuracy,
    timeout: options.timeout,
    maximumAge: options.maximumAge,
  });
  return position as unknown as GeolocationPosition;
}

/** Keeps Android back navigation inside the app before minimizing at the root. */
export async function installNativeBackButtonHandler(): Promise<() => void> {
  if (!isNativeApp()) return () => undefined;

  nativeBackButtonConsumers += 1;
  if (!nativeBackButtonRegistration) {
    // Mark the first MAZZI entry so old WebView history cannot keep the native
    // back button navigating past the app's own root screen.
    window.history.replaceState(
      { ...(window.history.state || {}), mazziNativeRoot: true },
      '',
      window.location.href,
    );

    nativeBackButtonRegistration = App.addListener('backButton', () => {
      const nativeBackEvent = new Event('mazzi:native-back', { cancelable: true });
      window.dispatchEvent(nativeBackEvent);
      if (nativeBackEvent.defaultPrevented) {
        exitConfirmationArmed = false;
        if (exitConfirmationTimer) clearTimeout(exitConfirmationTimer);
        exitConfirmationTimer = null;
        return;
      }

      if (!isMazziRootEntry()) {
        window.history.back();
        return;
      }

      if (!exitConfirmationArmed) {
        exitConfirmationArmed = true;
        window.dispatchEvent(new Event('mazzi:back-exit-warning'));
        exitConfirmationTimer = setTimeout(() => {
          exitConfirmationArmed = false;
          exitConfirmationTimer = null;
        }, EXIT_CONFIRMATION_WINDOW_MS);
        return;
      }

      exitConfirmationArmed = false;
      if (exitConfirmationTimer) clearTimeout(exitConfirmationTimer);
      exitConfirmationTimer = null;
      void App.exitApp();
    }).then((handle) => {
      nativeBackButtonHandle = handle;
    });

    await nativeBackButtonRegistration;
  } else {
    await nativeBackButtonRegistration;
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    nativeBackButtonConsumers = Math.max(0, nativeBackButtonConsumers - 1);
    if (nativeBackButtonConsumers > 0) return;
    if (exitConfirmationTimer) clearTimeout(exitConfirmationTimer);
    exitConfirmationTimer = null;
    exitConfirmationArmed = false;
    const handle = nativeBackButtonHandle;
    nativeBackButtonHandle = null;
    nativeBackButtonRegistration = null;
    void handle?.remove();
  };
}

export async function installNativeUrlHandler(onUrl: (url: string) => void): Promise<() => void> {
  if (!isNativeApp()) return () => undefined;

  const handle = await App.addListener('appUrlOpen', ({ url }) => onUrl(url));
  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) onUrl(launchUrl.url);
  return () => handle.remove();
}
