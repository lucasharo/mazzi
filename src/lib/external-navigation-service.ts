// ============================================================================
// MAZZI DOMAIN — EXTERNAL NAVIGATION SERVICE
// Generates safe deep links and web fallback URLs for Google Maps, Waze, and Apple Maps.
// Destination MUST use exact meeting_point latitude and longitude.
// ============================================================================

export type NavigationApp = 'google' | 'waze' | 'apple' | 'web';

export interface ExternalNavigationTarget {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface NavigationAppOption {
  id: NavigationApp;
  name: string;
  isAvailableOnPlatform: boolean;
}

export function isValidNavigationTarget(target?: Partial<ExternalNavigationTarget> | null): target is ExternalNavigationTarget {
  return (
    !!target &&
    typeof target.latitude === 'number' &&
    typeof target.longitude === 'number' &&
    Number.isFinite(target.latitude) &&
    Number.isFinite(target.longitude) &&
    Math.abs(target.latitude) <= 90 &&
    Math.abs(target.longitude) <= 180
  );
}

export function isIosPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function getAvailableNavigationApps(): NavigationAppOption[] {
  const isIos = isIosPlatform();
  const options: NavigationAppOption[] = [
    { id: 'google', name: 'Google Maps', isAvailableOnPlatform: true },
    { id: 'waze', name: 'Waze', isAvailableOnPlatform: true },
  ];

  if (isIos) {
    options.unshift({ id: 'apple', name: 'Apple Maps', isAvailableOnPlatform: true });
  }

  options.push({ id: 'web', name: 'Navegador Web (Google Maps)', isAvailableOnPlatform: true });
  return options;
}

export function buildNavigationUrl(target: ExternalNavigationTarget, app: NavigationApp): string {
  const { latitude, longitude, label } = target;
  const isDefaultCoords = (latitude === -23.5505 && longitude === -46.6333) || (latitude === 0 && longitude === 0);
  const encodedLabel = encodeURIComponent(label?.trim() || 'Ponto de Encontro MAZZI');

  switch (app) {
    case 'google':
      if (isDefaultCoords && label && label !== 'Ponto de encontro') {
        return `https://www.google.com/maps/dir/?api=1&destination=${encodedLabel}`;
      }
      return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    case 'waze':
      if (isDefaultCoords && label && label !== 'Ponto de encontro') {
        return `https://waze.com/ul?q=${encodedLabel}&navigate=yes`;
      }
      return `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
    case 'apple':
      if (isDefaultCoords && label && label !== 'Ponto de encontro') {
        return `https://maps.apple.com/?daddr=${encodedLabel}`;
      }
      return `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodedLabel}`;
    case 'web':
    default:
      if (isDefaultCoords && label && label !== 'Ponto de encontro') {
        return `https://maps.google.com/?q=${encodedLabel}`;
      }
      return `https://maps.google.com/?q=${latitude},${longitude}`;
  }
}

export function openExternalNavigation(target: ExternalNavigationTarget, app: NavigationApp = 'google'): void {
  if (!isValidNavigationTarget(target)) {
    throw new Error('INVALID_NAVIGATION_TARGET');
  }

  const url = buildNavigationUrl(target, app);

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
