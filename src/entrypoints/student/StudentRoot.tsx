import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { AccessDenied } from '../../components/auth/AccessDenied';
import { StudentApp } from '../../apps/student/StudentApp';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { Button } from '../../components/ui/Button';

const ProfessionalOnlyScreen: React.FC = () => {
  const { logout } = useAuth();
  return (
    <main className="min-h-screen bg-[var(--mazzi-bg)] px-5 py-8 text-[var(--mazzi-dark)]">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center rounded-3xl border border-[var(--mazzi-border)] bg-white p-6 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">✓</div>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Perfil profissional</p>
        <h1 className="mt-1 text-xl font-extrabold">Acesse o MAZZI PRO</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">Esta conta possui apenas um perfil profissional. Para gerenciar aulas, veículos, ofertas e agenda, acesse o aplicativo MAZZI PRO.</p>
        <Button type="button" variant="outline" className="mt-6 w-full" onClick={() => void logout()}>Sair</Button>
      </div>
    </main>
  );
};

const StudentGate: React.FC = () => {
  const auth = useAuth();
  if (auth.isLoading) return <LoadingScreen />;
  if (auth.recoveryInProgress) return <AppLogin kind="student" />;
  if (!auth.isAuthenticated) return <AppLogin kind="student" />;
  if (auth.user?.roles.includes('STUDENT')) return <StudentApp />;
  if (auth.user?.roles.includes('INSTRUCTOR')) return <ProfessionalOnlyScreen />;
  return <AccessDenied />;
};

export const StudentRoot: React.FC = () => (
  <AuthProvider>
    <StudentGate />
  </AuthProvider>
);
