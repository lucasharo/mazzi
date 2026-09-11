import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

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

  const handle = await App.addListener('backButton', () => {
    const hasInternalHistory = window.history.length > 1;
    if (hasInternalHistory) {
      window.history.back();
      return;
    }
    void App.minimizeApp();
  });
  return () => handle.remove();
}

export async function installNativeUrlHandler(onUrl: (url: string) => void): Promise<() => void> {
  if (!isNativeApp()) return () => undefined;

  const handle = await App.addListener('appUrlOpen', ({ url }) => onUrl(url));
  const launchUrl = await App.getLaunchUrl();
  if (launchUrl?.url) onUrl(launchUrl.url);
  return () => handle.remove();
}
