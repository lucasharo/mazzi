import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { AccessDenied } from '../../components/auth/AccessDenied';
import { AdminApp } from '../../apps/admin/AdminApp';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

const AdminGate: React.FC = () => {
  const auth = useAuth();
  if (auth.isLoading) return <LoadingScreen />;
  if (auth.recoveryInProgress) return <AppLogin kind="admin" />;
  if (!auth.isAuthenticated) return <AppLogin kind="admin" />;
  return auth.user?.roles.includes('PLATFORM_ADMIN') ? (
    <AdminApp />
  ) : (
    <AccessDenied />
  );
};

export const AdminRoot: React.FC = () => (
  <AuthProvider>
    <AdminGate />
  </AuthProvider>
);
