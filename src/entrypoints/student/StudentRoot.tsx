import React from 'react';
import { AuthProvider, useAuth } from '../../components/auth/AuthContext';
import { AppLogin } from '../../components/auth/AppLogin';
import { AccessDenied } from '../../components/auth/AccessDenied';
import { StudentApp } from '../../apps/student/StudentApp';
import { Button } from '../../components/ui/Button';
import { dismissInitialSplash } from '../../lib/initial-splash';

function isStripeCancellationReturn(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('stripe_checkout') === 'cancelled' && params.has('payment_id');
}

const ProfessionalOnlyScreen: React.FC = () => {
  const { logout } = useAuth();
  return (
    <main className="min-h-screen bg-[var(--mazzi-bg)] px-5 py-8 text-[var(--mazzi-text)]">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center rounded-3xl border border-[var(--mazzi-border)] bg-white p-6 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">✓</div>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Perfil profissional</p>
        <h1 className="mt-1 text-xl font-extrabold">Acesse o MAZZI PRO</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">Esta conta possui apenas um perfil profissional. Para gerenciar aulas, veículos, ofertas e agenda, acesse o aplicativo MAZZI PRO.</p>
        <div className="mt-6 flex justify-center">
          <Button type="button" variant="outline" onClick={() => void logout()}>Sair</Button>
        </div>
      </div>
    </main>
  );
};

const StudentGate: React.FC = () => {
  const auth = useAuth();
  const isCheckoutCancellationReturn = isStripeCancellationReturn();
  React.useEffect(() => {
    if (!auth.isLoading && !isCheckoutCancellationReturn) dismissInitialSplash();
  }, [auth.isLoading, isCheckoutCancellationReturn]);

  if (auth.isLoading) return null;
  if (auth.recoveryInProgress) return <AppLogin kind="student" />;
  if (!auth.isAuthenticated) return <AppLogin kind="student" />;
  if (auth.isInstructorOnboarding) return <AppLogin kind="instructor" />;
  if (auth.user?.roles.includes('STUDENT')) return <StudentApp />;
  if (auth.user?.roles.includes('INSTRUCTOR')) return <ProfessionalOnlyScreen />;
  return <AccessDenied />;
};

export const StudentRoot: React.FC = () => (
  <AuthProvider>
    <StudentGate />
  </AuthProvider>
);
