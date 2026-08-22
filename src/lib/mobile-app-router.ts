import { useCallback, useEffect, useState } from 'react';

type MobileAppRoute = string;

function getRouteFromHash(appKey: string, fallback: MobileAppRoute): string {
  if (typeof window === 'undefined') return fallback;

  const prefix = `#/${appKey}/`;
  const hash = window.location.hash;
  return hash.startsWith(prefix) && hash.slice(prefix.length) ? hash.slice(prefix.length) : fallback;
}

/**
 * Small History API router for the mobile PWAs. Hash routes keep Vercel/static
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
    if (window.location.hash !== path) {
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
