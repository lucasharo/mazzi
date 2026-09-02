import { useCallback, useEffect, useState } from 'react';
import {
  appRouteForNotificationTarget,
  parseNotificationNavigationTarget,
  serializeNotificationNavigationTarget,
  type NotificationNavigationTarget,
} from './notification-navigation';

function appKeyForContext(appContext: NotificationNavigationTarget['appContext']): string {
  return appContext === 'PRO' ? 'provider' : appContext.toLowerCase();
}

type MobileAppRoute = string;

function getRouteFromHash(appKey: string, fallback: MobileAppRoute): string {
  if (typeof window === 'undefined') return fallback;

  const prefix = `#/${appKey}/`;
  const hash = window.location.hash;
  const route = hash.startsWith(prefix) ? hash.slice(prefix.length).split('?')[0] : '';
  return route || fallback;
}

export function getNotificationNavigationTargetFromHash(appKey: string): NotificationNavigationTarget | null {
  if (typeof window === 'undefined') return null;
  const prefix = `#/${appKey}/`;
  if (!window.location.hash.startsWith(prefix)) return null;
  const query = window.location.hash.split('?')[1];
  if (!query) return null;
  const result = parseNotificationNavigationTarget(query);
  return result.ok && appKeyForContext(result.target.appContext) === appKey ? result.target : null;
}

export function navigateToNotificationTarget(target: NotificationNavigationTarget): boolean {
  if (typeof window === 'undefined') return false;
  const appKey = appKeyForContext(target.appContext);
  const query = serializeNotificationNavigationTarget(target);
  if (!query) return false;
  const path = `#/${appKey}/${appRouteForNotificationTarget(target)}?${query}`;
  if (window.location.hash === path) return true;
  window.history.pushState({ mazziApp: appKey, mazziRoute: appRouteForNotificationTarget(target), mazziTarget: target }, '', `${window.location.pathname}${window.location.search}${path}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  return true;
}

export function clearNotificationNavigationTargetFromHash(appKey: string, route: string): void {
  if (typeof window === 'undefined') return;
  const path = `#/${appKey}/${route}`;
  if (window.location.hash.includes('?')) {
    window.history.replaceState({ mazziApp: appKey, mazziRoute: route }, '', `${window.location.pathname}${window.location.search}${path}`);
    window.dispatchEvent(new Event('hashchange'));
  }
}

/**
 * Small History API router for the mobile PWAs. Hash routes keep Cloudflare/static
 * hosting compatible while allowing the browser back button to restore tabs.
 */
export function useMobileAppRoute<T extends MobileAppRoute>(
  appKey: string,
  defaultRoute: T,
  validRoutes: readonly T[],
): [T, (route: T) => void] {
  const readRoute = useCallback(() => {
    const route = getRouteFromHash(appKey, defaultRoute);
    return validRoutes.includes(route as T) ? (route as T) : defaultRoute;
  }, [appKey, defaultRoute, validRoutes]);

  const [route, setRoute] = useState<T>(readRoute);

  useEffect(() => {
    const path = `#/${appKey}/${route}`;
    if (getRouteFromHash(appKey, '') !== route) {
      window.history.replaceState({ mazziApp: appKey, mazziRoute: route }, '', `${window.location.pathname}${window.location.search}${path}`);
    }

    const handleHistoryChange = () => setRoute(readRoute());
    window.addEventListener('popstate', handleHistoryChange);
    window.addEventListener('hashchange', handleHistoryChange);
    return () => {
      window.removeEventListener('popstate', handleHistoryChange);
      window.removeEventListener('hashchange', handleHistoryChange);
    };
  }, [appKey, readRoute, route]);

  const navigate = useCallback((nextRoute: T) => {
    if (!validRoutes.includes(nextRoute)) return;
    const path = `#/${appKey}/${nextRoute}`;
    if (window.location.hash === path) return;
    window.history.pushState({ mazziApp: appKey, mazziRoute: nextRoute }, '', `${window.location.pathname}${window.location.search}${path}`);
    setRoute(nextRoute);
  }, [appKey, validRoutes]);

  return [route, navigate];
}
