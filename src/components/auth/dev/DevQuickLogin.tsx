import React, { useState } from 'react';
import { ChevronDown, LoaderCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../AuthContext';
import type { AppLoginKind } from '../AppLogin';
import {
  ADMIN_DEMO_ACCOUNTS,
  INSTRUCTOR_DEMO_ACCOUNTS,
  SCHOOL_DEMO_ACCOUNTS,
  STUDENT_DEMO_ACCOUNTS,
  type DevDemoAccount,
} from './demo-accounts';

import { getRuntimeEnvValue } from '../../../lib/runtime-env';

export function getDemoPasswordForAccount(account: DevDemoAccount): string | undefined {
  const roleOrLabel = (account.role || account.label || '').toUpperCase();
  let pass: string | undefined;

  if (roleOrLabel === 'ADMIN' || roleOrLabel === 'PLATFORM_ADMIN') {
    pass = getRuntimeEnvValue('VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD');
  } else if (
    roleOrLabel === 'AUTOESCOLA' ||
    roleOrLabel === 'SCHOOL' ||
    roleOrLabel === 'SCHOOL_ADMIN' ||
    roleOrLabel === 'DRIVING_SCHOOL'
  ) {
    pass = getRuntimeEnvValue('VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD');
  } else if (roleOrLabel === 'INSTRUTOR' || roleOrLabel === 'INSTRUCTOR') {
    pass = getRuntimeEnvValue('VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD');
  } else {
    pass = getRuntimeEnvValue('VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD');
  }

  if (!pass) return undefined;
  const clean = pass.replace(/^"|"$/g, '').trim();
  return clean || undefined;
}

export const DevQuickLogin: React.FC<{
  kind: AppLoginKind;
  onError: (message: string) => void;
}> = ({ kind, onError }) => {
  const { signIn, isLoading } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const accounts =
    kind === 'student'
      ? STUDENT_DEMO_ACCOUNTS
      : kind === 'instructor'
      ? [...INSTRUCTOR_DEMO_ACCOUNTS, ...SCHOOL_DEMO_ACCOUNTS]
      : ADMIN_DEMO_ACCOUNTS;

  const visible = kind === 'student' && !expanded ? accounts.slice(0, 5) : accounts;
  const instructors = visible.filter((account) => account.label !== 'Autoescola');
  const schools = visible.filter((account) => account.label === 'Autoescola');

  const login = async (account: DevDemoAccount) => {
    if (selected || isLoading) return;
    const password = getDemoPasswordForAccount(account);
    if (!password || !password.trim()) {
      onError('Credencial local de desenvolvimento não configurada.');
      return;
    }

    setSelected(account.email);
    try {
      await signIn(account.email, password);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Falha ao autenticar.');
    } finally {
      setSelected(null);
    }
  };

  const buttons = (items: DevDemoAccount[]) => (
    <div className="grid grid-cols-2 gap-2">
      {items.map((account) => (
        <button
          type="button"
          aria-label={`Entrar com ${account.name}`}
          key={account.email}
          disabled={Boolean(selected) || isLoading}
          onClick={() => login(account)}
          className="min-h-11 rounded-xl border border-[var(--mazzi-border)] bg-white px-2.5 py-2 text-left text-xs font-bold text-[var(--mazzi-dark)] hover:border-amber-400 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mazzi-dark)] shadow-2xs"
        >
          {selected === account.email ? (
            <span className="flex items-center gap-1.5 text-amber-600">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>Entrando…</span>
            </span>
          ) : (
            <span className="truncate block">{account.name}</span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <section
      aria-label="Contas de teste"
      className="rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-3.5 text-left"
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" aria-hidden="true" />
          <span>Acesso rápido (Dev)</span>
        </p>
        <span className="text-[10px] font-semibold text-slate-400">Ambiente de Testes</span>
      </div>

      {kind === 'instructor' && (
        <p className="mb-1.5 text-[11px] font-bold text-slate-600">Instrutores Autônomos</p>
      )}
      {buttons(instructors)}

      {schools.length > 0 && (
        <>
          <p className="mb-1.5 mt-3 text-[11px] font-bold text-slate-600">Autoescolas / CFC</p>
          {buttons(schools)}
        </>
      )}

      {kind === 'student' && accounts.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2.5 flex min-h-11 items-center gap-1 text-xs font-bold text-slate-600 hover:text-[var(--mazzi-dark)] transition cursor-pointer rounded-lg px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mazzi-dark)]"
        >
          <span>{expanded ? 'Ver menos contas' : 'Ver mais contas de teste'}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    </section>
  );
};

export default DevQuickLogin;
