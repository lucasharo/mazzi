// ============================================================================
// MAZZI PLATFORM — SPRINT 03: AUTHENTICATION FLOW UI SCREENS (LOGIN, SIGNUP, FORGOT)
// File: src/components/auth/AuthScreens.tsx
// ============================================================================

import React, { useState } from 'react';
import { DEMO_LOGIN_USERS, useAuth, type DemoLoginUser } from './AuthContext';
import type { UserRole } from '../../types';
import { Shield, Lock, Mail, Phone, User, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, UsersRound } from 'lucide-react';

type AuthView = 'login' | 'signup' | 'forgot_password' | 'blocked_notice';

export const AuthScreens: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const { user, loginAsDemoUser, logout } = useAuth();
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDemoRole, setSelectedDemoRole] = useState<UserRole>('STUDENT');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const showDevLoginUsers = (import.meta as any).env?.DEV !== false;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      await loginAsDemoUser(selectedDemoRole, email || undefined);
      setIsLoading(false);
      setMessage({ type: 'success', text: `Login autenticado com sucesso como ${selectedDemoRole}!` });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setIsLoading(false);
      setMessage({ type: 'error', text: err.message || 'Falha ao autenticar.' });
    }
  };

  const handleDevUserLogin = async (demoUser: DemoLoginUser) => {
    setIsLoading(true);
    setMessage(null);
    setEmail(demoUser.email);
    setSelectedDemoRole(demoUser.role);

    try {
      await loginAsDemoUser(demoUser.role, demoUser.email);
      setMessage({ type: 'success', text: `Login autenticado como ${demoUser.name}.` });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha ao autenticar usuario de teste.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    setTimeout(() => {
      // Standard public signup strictly enforces STUDENT role
      loginAsDemoUser('STUDENT', email);
      setIsLoading(false);
      setMessage({ type: 'success', text: 'Conta de aluno criada com sucesso! Perfil STUDENT atribuído.' });
      if (onSuccess) onSuccess();
    }, 500);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setMessage({
        type: 'success',
        text: `Link de recuperação de senha enviado para ${email || 'seu e-mail'}.`,
      });
    }, 400);
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header with 99 Branding */}
      <div className="bg-slate-950 p-6 text-white text-center relative">
        <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center mx-auto mb-3 shadow-md">
          M
        </div>
        <h2 className="text-xl font-extrabold tracking-tight">MAZZI Autenticação & RBAC</h2>
        <p className="text-xs text-slate-400 mt-1">
          Acesso seguro e isolamento multi-tenant (PostgreSQL + Supabase)
        </p>
      </div>

      <div className="p-6 space-y-5">
        {/* Feedback Alerts */}
        {message && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* VIEW: LOGIN */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aluno.demo@mazzi.com.br"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setView('forgot_password')}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition"
                />
              </div>
            </div>

            {showDevLoginUsers && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2">
                  <UsersRound className="w-4 h-4 text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Usuarios de teste
                  </span>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {DEMO_LOGIN_USERS.map((demoUser) => (
                    <button
                      key={demoUser.id}
                      type="button"
                      onClick={() => handleDevUserLogin(demoUser)}
                      disabled={isLoading}
                      className="w-full text-left rounded-lg border border-slate-200 bg-white p-3 transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-slate-900">{demoUser.name}</p>
                          <p className="truncate text-xs font-medium text-slate-500">{demoUser.email}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                          {demoUser.role}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-600">{demoUser.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!showDevLoginUsers && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Simular Papel de Acesso (RBAC)
              </label>
              <select
                value={selectedDemoRole}
                onChange={(e) => setSelectedDemoRole(e.target.value as UserRole)}
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:border-amber-400 outline-none cursor-pointer"
              >
                <option value="STUDENT">Aluno (STUDENT)</option>
                <option value="INSTRUCTOR">Instrutor Autônomo (INSTRUCTOR)</option>
                <option value="SCHOOL_ADMIN">Gestor de Autoescola (SCHOOL_ADMIN)</option>
                <option value="SCHOOL_STAFF">Atendente de Autoescola (SCHOOL_STAFF)</option>
                <option value="PLATFORM_ADMIN">Administrador da Plataforma (PLATFORM_ADMIN)</option>
              </select>
            </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Entrar no Sistema</span>
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-500">
                Não possui conta?{' '}
                <button
                  type="button"
                  onClick={() => setView('signup')}
                  className="font-bold text-slate-900 hover:underline cursor-pointer"
                >
                  Criar conta de aluno
                </button>
              </p>
            </div>
          </form>
        )}

        {/* VIEW: SIGNUP */}
        {view === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Nome Completo
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do Aluno"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Telefone Celular
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 outline-none transition"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
              Nota: O cadastro público inicial cria exclusivamente o papel <strong>STUDENT</strong>. Cadastro de instrutor e autoescola requer validação regulatória (Sprint 04).
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-slate-950 hover:bg-slate-800 text-white font-extrabold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4 text-amber-400" />}
              <span>Cadastrar como Aluno</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setView('login')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                ← Voltar para o Login
              </button>
            </div>
          </form>
        )}

        {/* VIEW: FORGOT PASSWORD */}
        {view === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Informe seu e-mail cadastrado para receber as instruções de redefinição de senha segura via Supabase Auth.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aluno@mazzi.com.br"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-amber-400 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              <span>Enviar Link de Recuperação</span>
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setView('login')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                ← Voltar para o Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
