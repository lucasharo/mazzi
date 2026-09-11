import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { AccessDenied } from '../../components/auth/AccessDenied';
import { AdminApp } from '../../apps/admin/AdminApp';
import { dismissInitialSplash } from '../../lib/initial-splash';
import { installNativeBackButtonHandler } from '../../lib/native-platform';

const AdminGate: React.FC = () => {
  const auth = useAuth();
  React.useEffect(() => {
    if (!auth.isLoading) dismissInitialSplash();
  }, [auth.isLoading]);

  if (auth.isLoading) return null;
  if (auth.recoveryInProgress) return <AppLogin kind="admin" />;
  if (!auth.isAuthenticated) return <AppLogin kind="admin" />;
  return auth.user?.roles.includes('PLATFORM_ADMIN') ? (
    <AdminApp />
  ) : (
    <AccessDenied />
  );
};

export const AdminRoot: React.FC = () => (
  <AdminNativeShell />
);

const AdminNativeShell: React.FC = () => {
  React.useEffect(() => {
    let removeBackButton = () => undefined;
    void installNativeBackButtonHandler().then((cleanup) => { removeBackButton = cleanup; });
    return () => removeBackButton();
  }, []);

  return (
    <AuthProvider>
      <AdminGate />
    </AuthProvider>
  );
};
