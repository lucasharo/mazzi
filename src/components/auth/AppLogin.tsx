import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { requestPasswordReset } from '../../lib/auth-service';

export type AppLoginKind = 'student' | 'instructor' | 'admin';
type Screen = 'login' | 'signup' | 'forgot' | 'email_confirmation';
type Feedback = { tone: 'error' | 'success'; message: string };
const devQuickLoginPath = '/src/components/auth/dev/DevQuickLogin.tsx';
const fieldClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20';
const linkClass = 'rounded-md font-bold text-slate-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500';

export const AppLogin: React.FC<{ kind: AppLoginKind }> = ({ kind }) => {
  const { signIn, signUpStudent, error, isLoading } = useAuth();
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [DevQuickLogin, setDevQuickLogin] = useState<React.ComponentType<{ kind: AppLoginKind; onError: (message: string) => void }> | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import(/* @vite-ignore */ devQuickLoginPath).then((module) => setDevQuickLogin(() => module.DevQuickLogin));
  }, []);

  const goTo = (next: Screen) => { setFeedback(null); setScreen(next); };
  const submitLogin = async (event: React.FormEvent) => { event.preventDefault(); setFeedback(null); try { await signIn(email.trim(), password); } catch { /* AuthContext exposes the error. */ } };
  const submitSignup = async (event: React.FormEvent) => {
    event.preventDefault(); setFeedback(null);
    if (!name.trim()) return setFeedback({ tone: 'error', message: 'Informe seu nome completo.' });
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFeedback({ tone: 'error', message: 'Informe um e-mail válido.' });
    if (phone.replace(/\D/g, '').length < 10) return setFeedback({ tone: 'error', message: 'Informe um celular válido.' });
    if (password.length < 8) return setFeedback({ tone: 'error', message: 'A senha deve ter pelo menos 8 caracteres.' });
    if (password !== confirmPassword) return setFeedback({ tone: 'error', message: 'As senhas precisam ser iguais.' });
    if (kind === 'instructor') return setFeedback({ tone: 'error', message: 'O envio seguro do cadastro de instrutor está em desenvolvimento. Nenhuma conta foi criada.' });
    try { const { session } = await signUpStudent({ email: email.trim(), password, name: name.trim(), phone: phone.trim() }); if (!session) goTo('email_confirmation'); else setFeedback({ tone: 'success', message: 'Conta criada com sucesso.' }); }
    catch (caught) { setFeedback({ tone: 'error', message: caught instanceof Error ? caught.message : 'Não foi possível criar sua conta.' }); }
  };
  const submitForgot = async (event: React.FormEvent) => {
    event.preventDefault(); setFeedback(null);
    try { await requestPasswordReset(email.trim()); setFeedback({ tone: 'success', message: `Enviamos as instruções para ${email.trim()}.` }); }
    catch (caught) { setFeedback({ tone: 'error', message: caught instanceof Error ? caught.message : 'Não foi possível enviar o link.' }); }
  };

  const shell = (content: React.ReactNode) => <main className="flex min-h-[100dvh] items-center justify-center bg-slate-100 p-5"><div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl ring-1 ring-slate-200/60">{content}</div></main>;
  const notice = feedback && <p role="alert" className={`rounded-xl p-3 text-sm ${feedback.tone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>{feedback.message}</p>;
  const field = (label: string, value: string, setter: (value: string) => void, type: string, autoComplete: string) => <label className="block text-sm font-bold">{label}<input required type={type} autoComplete={autoComplete} value={value} onChange={(event) => setter(event.target.value)} className={fieldClass}/></label>;

  if (screen === 'email_confirmation') return shell(<div className="space-y-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">MAZZI</p><h1 className="text-2xl font-black">Conta criada</h1><p className="text-sm leading-6 text-slate-600">Enviamos uma confirmação para:<br/><strong className="text-slate-950">{email.trim()}</strong></p><p className="text-sm text-slate-600">Confirme seu e-mail para entrar.</p><button type="button" onClick={() => goTo('login')} className="w-full rounded-xl bg-slate-950 p-3 font-black text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">Voltar para login</button></div>);
  if (screen === 'signup') return shell(<form onSubmit={submitSignup} className="space-y-4" noValidate><button type="button" onClick={() => goTo('login')} className={linkClass}>← Voltar</button><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">MAZZI</p><h1 className="text-2xl font-black">{kind === 'student' ? 'Criar sua conta' : 'Seja um instrutor MAZZI'}</h1><p className="text-sm text-slate-500">{kind === 'student' ? 'Comece a encontrar aulas práticas perto de você.' : 'Ensine alunos e organize suas aulas em um único lugar.'}</p>{field('Nome completo', name, setName, 'text', 'name')}{field('E-mail', email, setEmail, 'email', 'email')}{field('Celular', phone, setPhone, 'tel', 'tel')}{field('Senha', password, setPassword, 'password', 'new-password')}{field('Confirmar senha', confirmPassword, setConfirmPassword, 'password', 'new-password')}{notice}<button type="submit" disabled={isLoading} className="w-full rounded-xl bg-slate-950 p-3 font-black text-amber-400 disabled:opacity-50">{kind === 'student' ? 'Criar conta' : 'Continuar'}</button><p className="text-center text-sm text-slate-500">Já possui uma conta? <button type="button" onClick={() => goTo('login')} className={linkClass}>Entrar</button></p></form>);
  if (screen === 'forgot') return shell(<form onSubmit={submitForgot} className="space-y-4"><button type="button" onClick={() => goTo('login')} className={linkClass}>← Voltar</button><h1 className="text-2xl font-black">Recuperar senha</h1>{field('E-mail', email, setEmail, 'email', 'email')}{notice}<button type="submit" disabled={isLoading} className="w-full rounded-xl bg-slate-950 p-3 font-black text-amber-400 disabled:opacity-50">Enviar link</button></form>);

  const title = kind === 'student' ? 'Login do Aluno' : kind === 'instructor' ? 'Área do Instrutor' : 'Login Administrativo';
  return shell(<form onSubmit={submitLogin} className="space-y-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">MAZZI</p><h1 className="text-2xl font-black">{title}</h1>{field('E-mail', email, setEmail, 'email', 'email')}{field('Senha', password, setPassword, 'password', 'current-password')}{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice}<button type="submit" disabled={isLoading} className="w-full rounded-xl bg-slate-950 p-3 font-black text-amber-400 disabled:opacity-50">{isLoading ? 'Entrando…' : 'Entrar'}</button><button type="button" onClick={() => goTo('forgot')} className={linkClass}>Esqueceu sua senha?</button>{kind === 'student' && <p className="text-center text-sm text-slate-500">Ainda não tem conta? <button type="button" onClick={() => goTo('signup')} className={linkClass}>Criar minha conta</button></p>}{kind === 'instructor' && <p className="text-center text-sm text-slate-500">Quer dar aulas pela MAZZI? <button type="button" onClick={() => goTo('signup')} className={linkClass}>Cadastre-se como instrutor</button></p>}{DevQuickLogin && <DevQuickLogin kind={kind} onError={(message) => setFeedback({ tone: 'error', message })}/>}</form>);
};
