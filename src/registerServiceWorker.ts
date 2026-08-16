// ============================================================================
// MAZZI PLATFORM — PWA SERVICE WORKER REGISTRATION
// ============================================================================

export function registerServiceWorker(): void {
  const canRegister =
    (import.meta as any).env?.PROD === true &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    (window.location.protocol === 'https:' || window.location.hostname === 'localhost');

  if (!canRegister) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      if ((import.meta as any).env?.DEV) {
        console.error('[MAZZI_PWA_REGISTRATION_FAILED]', error);
      }
    });
  });
}
