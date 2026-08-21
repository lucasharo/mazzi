import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';
import { SecondaryButton } from '../ui/Button';

export const AccessDenied: React.FC = () => {
  const { logout, user } = useAuth();

  return (
    <main className="min-h-[100dvh] w-full bg-[var(--mazzi-bg)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <section
        role="alert"
        aria-labelledby="access-denied-title"
        className="mazzi-card w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-[var(--mazzi-border)] shadow-sm text-center space-y-5"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] border border-amber-200/60 text-[var(--mazzi-dark)] shadow-xs">
          <ShieldAlert className="h-7 w-7 text-amber-600" aria-hidden="true" />
        </div>

        <div className="space-y-1.5">
          <p className="mazzi-eyebrow">Acesso Restrito</p>
          <h1
            id="access-denied-title"
            className="text-2xl sm:text-3xl font-extrabold text-[var(--mazzi-dark)] tracking-tight"
          >
            Acesso não autorizado
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
            Esta conta {user?.email ? `(${user.email})` : ''} não possui o perfil de permissão necessário para acessar este aplicativo.
          </p>
        </div>

        <div className="pt-2">
          <SecondaryButton
            size="sm"
            className="w-full font-bold shadow-2xs"
            onClick={() => void logout()}
            leftIcon={<LogOut className="w-4 h-4 text-slate-600" aria-hidden="true" />}
          >
            Sair e trocar de conta
          </SecondaryButton>
        </div>
      </section>
    </main>
  );
};
