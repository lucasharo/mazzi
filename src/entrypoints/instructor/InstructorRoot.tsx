import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { ProviderApp } from '../../apps/provider/ProviderApp';
import { dismissInitialSplash } from '../../lib/initial-splash';

const InstructorGate: React.FC = () => {
  const auth = useAuth();
  React.useEffect(() => {
    if (!auth.isLoading) dismissInitialSplash();
  }, [auth.isLoading]);

  if (auth.isLoading) return null;
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
