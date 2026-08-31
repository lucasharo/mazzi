export function dismissInitialSplash(): void {
  if (typeof document === 'undefined') return;

  const splash = document.getElementById('mazzi-initial-splash');
  if (!splash || splash.dataset.ready === 'true') return;

  splash.dataset.ready = 'true';
  splash.classList.add('is-ready');
  window.setTimeout(() => splash.remove(), 180);
}
