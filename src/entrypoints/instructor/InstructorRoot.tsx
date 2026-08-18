import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { AccessDenied } from '../../components/auth/AccessDenied';
import { ProviderApp } from '../../apps/provider/ProviderApp';
import { LoadingScreen } from '../../components/ui/LoadingScreen';

const InstructorGate: React.FC = () => {
  const auth = useAuth();
  if (auth.isLoading) return <LoadingScreen />;
  if (!auth.isAuthenticated) return <AppLogin kind="instructor" />;
  return auth.user?.roles.some((role) =>
    ['INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF'].includes(role)
  ) ? (
    <ProviderApp />
  ) : (
    <AccessDenied />
  );
};

export const InstructorRoot: React.FC = () => (
  <AuthProvider>
    <InstructorGate />
  </AuthProvider>
);
