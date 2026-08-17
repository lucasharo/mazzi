import React, { useState } from 'react';
import { ChevronDown, LoaderCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import type { AppLoginKind } from '../AppLogin';
import { ADMIN_DEMO_ACCOUNTS, DEV_QUICK_LOGIN_PASSWORD, INSTRUCTOR_DEMO_ACCOUNTS, SCHOOL_DEMO_ACCOUNTS, STUDENT_DEMO_ACCOUNTS, type DevDemoAccount } from './demo-accounts';

export const DevQuickLogin: React.FC<{ kind: AppLoginKind; onError: (message: string) => void }> = ({ kind, onError }) => {
  const { signIn, isLoading } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const accounts = kind === 'student' ? STUDENT_DEMO_ACCOUNTS : kind === 'instructor' ? [...INSTRUCTOR_DEMO_ACCOUNTS, ...SCHOOL_DEMO_ACCOUNTS] : ADMIN_DEMO_ACCOUNTS;
  const visible = kind === 'student' && !expanded ? accounts.slice(0, 5) : accounts;
  const instructors = visible.filter((account) => account.label !== 'Autoescola');
  const schools = visible.filter((account) => account.label === 'Autoescola');
  const login = async (account: DevDemoAccount) => {
    if (selected || isLoading) return;
    setSelected(account.email);
    try { await signIn(account.email, DEV_QUICK_LOGIN_PASSWORD); }
    catch (caught) { onError(caught instanceof Error ? caught.message : 'Falha ao autenticar.'); }
    finally { setSelected(null); }
  };
  const buttons = (items: DevDemoAccount[]) => <div className="grid grid-cols-2 gap-2">{items.map((account) => <button type="button" aria-label={`Entrar com ${account.name}`} key={account.email} disabled={Boolean(selected) || isLoading} onClick={() => login(account)} className="min-h-11 rounded-xl border border-slate-200 bg-white p-2 text-left text-xs font-bold hover:border-amber-400 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">{selected === account.email ? <span className="flex items-center gap-1"><LoaderCircle className="h-3.5 w-3.5 animate-spin"/>Entrando…</span> : account.name}</button>)}</div>;
  return <section aria-label="Contas de teste" className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-wider text-slate-700">Acesso rápido</p><p className="mb-3 text-xs text-slate-500">Desenvolvimento</p>{kind === 'instructor' && <p className="mb-2 text-xs font-bold text-slate-500">Instrutores</p>}{buttons(instructors)}{schools.length > 0 && <><p className="mb-2 mt-4 text-xs font-bold text-slate-500">Autoescolas</p>{buttons(schools)}</>}{kind === 'student' && accounts.length > 5 && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 flex min-h-11 items-center gap-1 text-xs font-bold">{expanded ? 'Ver menos contas' : 'Ver mais contas'}<ChevronDown className={`h-4 w-4 ${expanded ? 'rotate-180' : ''}`}/></button>}</section>;
};
