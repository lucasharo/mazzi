export const INITIAL_NAVIGATION_READY_EVENT = 'mazzi:initial-navigation-ready';

export function signalInitialNavigationReady(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(INITIAL_NAVIGATION_READY_EVENT));
}

export function dismissInitialSplash(): void {
  if (typeof document === 'undefined') return;

  const splash = document.getElementById('mazzi-initial-splash');
  if (!splash || splash.dataset.ready === 'true') return;

  splash.dataset.ready = 'true';
  splash.classList.add('is-ready');
  window.setTimeout(() => splash.remove(), 180);
}
