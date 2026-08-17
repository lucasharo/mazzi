import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export type AppLoginKind = 'student' | 'instructor' | 'admin';

export const AppLogin: React.FC<{ kind: AppLoginKind }> = ({ kind }) => {
  const { signIn, error, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const title = kind === 'student' ? 'Login do Aluno' : kind === 'instructor' ? 'Área do Instrutor' : 'Login Administrativo';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    await signIn(email.trim(), password).catch(() => undefined);
  };

  return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-100 p-5">
    <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-7 shadow-xl">
      <div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">MAZZI</p><h1 className="mt-2 text-2xl font-black text-slate-950">{title}</h1></div>
      <label className="block text-sm font-bold text-slate-700">E-mail<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-amber-400" /></label>
      <label className="block text-sm font-bold text-slate-700">Senha<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-amber-400" /></label>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-slate-950 px-4 py-3 font-black text-amber-400 disabled:opacity-50">{isLoading ? 'Entrando…' : 'Entrar'}</button>
    </form>
  </main>;
};
