import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { ProviderApp } from '../../apps/provider/ProviderApp';
import { dismissInitialSplash, INITIAL_NAVIGATION_READY_EVENT } from '../../lib/initial-splash';
import { getNotificationNavigationTargetFromHash, navigateToNotificationTarget } from '../../lib/mobile-app-router';
import { clearPendingNotificationTarget, readPendingNotificationTarget, storePendingNotificationTarget } from '../../lib/pending-navigation';
import { registerServiceWorker } from '../../registerServiceWorker';

const InstructorGate: React.FC = () => {
  const auth = useAuth();
  const [startupNavigationPending, setStartupNavigationPending] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    registerServiceWorker();
  }, []);
  React.useEffect(() => {
    if (auth.isLoading) return;
    const current = getNotificationNavigationTargetFromHash('provider');
    if (!auth.isAuthenticated) {
      if (current?.appContext === 'PRO') storePendingNotificationTarget(current);
      setStartupNavigationPending(false);
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
    setStartupNavigationPending(false);
  }, [auth.isAuthenticated, auth.isLoading]);
  React.useEffect(() => {
    const handleInitialNavigationReady = () => setStartupNavigationPending(false);
    window.addEventListener(INITIAL_NAVIGATION_READY_EVENT, handleInitialNavigationReady);
    return () => window.removeEventListener(INITIAL_NAVIGATION_READY_EVENT, handleInitialNavigationReady);
  }, []);
  React.useEffect(() => {
    if (!auth.isLoading && startupNavigationPending === false) dismissInitialSplash();
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
  <AuthProvider>
    <InstructorGate />
  </AuthProvider>
);
