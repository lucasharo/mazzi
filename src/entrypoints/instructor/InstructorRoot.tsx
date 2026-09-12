import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { ProviderApp } from '../../apps/provider/ProviderApp';
import { dismissInitialSplash, INITIAL_NAVIGATION_READY_EVENT, showNativeSplashForNotification } from '../../lib/initial-splash';
import { getNotificationNavigationTargetFromHash, navigateToNotificationTarget } from '../../lib/mobile-app-router';
import { clearPendingNotificationTarget, readPendingNotificationTarget, storePendingNotificationTarget } from '../../lib/pending-navigation';
import { registerServiceWorker } from '../../registerServiceWorker';
import { MazziQueryProvider } from '../../components/query/MazziQueryProvider';
import { installNativeBackButtonHandler, installNativeUrlHandler } from '../../lib/native-platform';
import { subscribeToFirebaseNotificationActions } from '../../lib/firebase-messaging';
import { stopProviderBackgroundLocation } from '../../lib/provider-background-location';
import { Browser } from '@capacitor/browser';

function isStripeOnboardingReturn(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('stripe_onboarding') === 'return';
}

const InstructorGate: React.FC = () => {
  const auth = useAuth();
  const [startupNavigationPending, setStartupNavigationPending] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    registerServiceWorker();
  }, []);
  React.useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      void stopProviderBackgroundLocation();
    }
  }, [auth.isAuthenticated, auth.isLoading]);
  React.useEffect(() => {
    if (auth.isLoading) return;
    const current = getNotificationNavigationTargetFromHash('provider');
    if (!auth.isAuthenticated) {
      if (current?.appContext === 'PRO') storePendingNotificationTarget(current);
      setStartupNavigationPending(false);
      return;
    }
    if (isStripeOnboardingReturn()) {
      setStartupNavigationPending(true);
      return;
    }
    if (current?.appContext === 'PRO') {
      setStartupNavigationPending(true);
      return;
    }
    const pending = readPendingNotificationTarget();
    if (pending?.appContext === 'PRO') {
      if (navigateToNotificationTarget(pending)) {
        setStartupNavigationPending(true);
        clearPendingNotificationTarget();
        return;
      }
    }

    // ProviderApp releases this gate after its initial workspace render.
    if (auth.user?.roles.some((role) => ['INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF'].includes(role))) {
      setStartupNavigationPending(true);
      return;
    }
    setStartupNavigationPending(false);
  }, [auth.isAuthenticated, auth.isLoading]);
  React.useEffect(() => {
    const handleNotificationAction = () => {
      if (auth.isLoading || !auth.isAuthenticated) return;
      const pending = readPendingNotificationTarget();
      if (pending?.appContext === 'PRO' && navigateToNotificationTarget(pending)) {
        setStartupNavigationPending(true);
        clearPendingNotificationTarget();
      }
    };
    window.addEventListener('mazzi:notification-action', handleNotificationAction);
    return () => window.removeEventListener('mazzi:notification-action', handleNotificationAction);
  }, [auth.isAuthenticated, auth.isLoading]);
  React.useEffect(() => {
    const handleInitialNavigationReady = () => setStartupNavigationPending(false);
    window.addEventListener(INITIAL_NAVIGATION_READY_EVENT, handleInitialNavigationReady);
    return () => window.removeEventListener(INITIAL_NAVIGATION_READY_EVENT, handleInitialNavigationReady);
  }, []);
  React.useEffect(() => {
    if (!auth.isLoading && startupNavigationPending === false && !isStripeOnboardingReturn()) dismissInitialSplash();
  }, [auth.isLoading, startupNavigationPending]);

  if (auth.isLoading || startupNavigationPending === null) return null;
  if (auth.recoveryInProgress) return <AppLogin kind="instructor" />;
  if (auth.isInstructorOnboarding) return <AppLogin kind="instructor" />;
  if (!auth.isAuthenticated) return <AppLogin kind="instructor" />;
  return auth.user?.roles.some((role) =>
    ['INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF'].includes(role)
  ) ? (
    <ProviderApp />
  ) : (
    <AppLogin kind="instructor" />
  );
};

export const InstructorRoot: React.FC = () => (
  <InstructorNativeShell />
);

const InstructorNativeShell: React.FC = () => {
  React.useEffect(() => {
    let removeBackButton = () => undefined;
    void installNativeBackButtonHandler().then((cleanup) => { removeBackButton = cleanup; });
    let removeUrlHandler = () => undefined;
    void installNativeUrlHandler((url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'mazzi:' && parsed.hostname === 'instant-offer-action') {
          const offerId = parsed.searchParams.get('offer_id');
          const action = parsed.searchParams.get('action');
          if (offerId && (action === 'ACCEPT' || action === 'DECLINE')) {
            try { window.sessionStorage.setItem('mazzi:instant-offer-action', JSON.stringify({ offerId, action })); } catch { /* storage unavailable */ }
            window.dispatchEvent(new CustomEvent('mazzi:instant-offer-action', { detail: { offerId, action } }));
          }
          return;
        }
        if (parsed.protocol !== 'mazzi:' || parsed.hostname !== 'stripe-return') return;
        void Browser.close();
        const current = new URL(window.location.href);
        current.search = parsed.search;
        current.hash = '#/provider/management';
        window.history.replaceState(window.history.state, '', `${current.pathname}${current.search}${current.hash}`);
        window.dispatchEvent(new CustomEvent('mazzi:stripe-onboarding-return'));
      } catch {
        // Ignore unrelated deep links.
      }
    }).then((cleanup) => { removeUrlHandler = cleanup; });
    let removePushAction = () => undefined;
    void subscribeToFirebaseNotificationActions((target) => {
      if (target.appContext !== 'PRO') return;
      showNativeSplashForNotification();
      storePendingNotificationTarget(target);
      window.dispatchEvent(new Event('mazzi:notification-action'));
    }).then((cleanup) => { removePushAction = cleanup; });
    return () => { removeBackButton(); removeUrlHandler(); removePushAction(); };
  }, []);

  return (
    <MazziQueryProvider>
      <AuthProvider pushAppContext="PRO">
        <InstructorGate />
      </AuthProvider>
    </MazziQueryProvider>
  );
};
