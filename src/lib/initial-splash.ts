export const INITIAL_NAVIGATION_READY_EVENT = 'mazzi:initial-navigation-ready';

export function signalInitialNavigationReady(): void {
  if (typeof window === 'undefined') return;

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

  const splash = document.getElementById('mazzi-initial-splash');
  if (!splash || splash.dataset.ready === 'true' || splash.dataset.dismissScheduled === 'true') return;

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
