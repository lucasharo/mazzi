import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { AccessDenied } from '../../components/auth/AccessDenied';
import { StudentApp } from '../../apps/student/StudentApp';

const StudentGate: React.FC = () => { const auth = useAuth(); if (auth.isLoading) return <div className="flex min-h-[100dvh] items-center justify-center">Carregando…</div>; if (!auth.isAuthenticated) return <AppLogin kind="student" />; return auth.user?.roles.includes('STUDENT') ? <StudentApp /> : <AccessDenied />; };
export const StudentRoot: React.FC = () => <AuthProvider><StudentGate /></AuthProvider>;
