import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { AccessDenied } from '../../components/auth/AccessDenied';
import { AdminApp } from '../../apps/admin/AdminApp';

const AdminGate: React.FC = () => { const auth = useAuth(); if (auth.isLoading) return <div className="flex min-h-[100dvh] items-center justify-center">Carregando…</div>; if (!auth.isAuthenticated) return <AppLogin kind="admin" />; return auth.user?.roles.some(role => ['PLATFORM_ADMIN', 'SUPPORT'].includes(role)) ? <AdminApp /> : <AccessDenied />; };
export const AdminRoot: React.FC = () => <AuthProvider><AdminGate /></AuthProvider>;
