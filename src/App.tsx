/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './components/auth/AuthContext';
import { AuthScreens } from './components/auth/AuthScreens';
import { StudentApp } from './apps/student/StudentApp';
import { ProviderApp } from './apps/provider/ProviderApp';
import { AdminApp } from './apps/admin/AdminApp';
import { DesignSystemShowcase } from './apps/design-system/DesignSystemShowcase';
import { Smartphone, Briefcase, ShieldAlert, Palette, KeyRound, LogOut, UserCircle } from 'lucide-react';
import { UserRole } from './types';

type AppView = 'student' | 'provider' | 'admin' | 'design-system' | 'auth';

function AppContent() {
  const [currentView, setCurrentView] = useState<AppView>('student');
  const { user, isAuthenticated, isLoading, logout, switchRole } = useAuth();
  const authenticatedRole = user?.roles?.[0];
  const isStudentAccount = isAuthenticated && authenticatedRole === 'STUDENT';
  const isProviderAccount = isAuthenticated && (authenticatedRole === 'INSTRUCTOR' || authenticatedRole === 'SCHOOL_ADMIN');
  const isAdminAccount = isAuthenticated && (authenticatedRole === 'PLATFORM_ADMIN' || authenticatedRole === 'SUPPORT');

  useEffect(() => {
    if (!isAuthenticated || !authenticatedRole) return;
    if (isStudentAccount) setCurrentView('student');
    else if (isProviderAccount) setCurrentView('provider');
    else if (isAdminAccount) setCurrentView('admin');
  }, [authenticatedRole, isAdminAccount, isAuthenticated, isProviderAccount, isStudentAccount]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setCurrentView('auth');
    }
  }, [isAuthenticated, isLoading]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans antialiased text-slate-900">
      {/* Top Global Demo Switcher Bar */}
      {!isAuthenticated && <div className="bg-slate-950 border-b border-slate-800 text-white px-4 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-xs">
            M
          </div>
          <span className="font-extrabold text-sm tracking-tight text-white hidden sm:inline">
            MAZZI • Marketplace de Aulas
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded-full">
            Sprint 03: Auth + RBAC
          </span>
        </div>

        {/* View & Auth Switcher (hidden for authenticated student accounts) */}
        {!isStudentAccount && <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          {(!isAuthenticated || isStudentAccount) && <button
            type="button"
            onClick={() => {
              switchRole('STUDENT');
              setCurrentView('student');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              currentView === 'student'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Aluno</span>
          </button>}

          {(!isAuthenticated || isProviderAccount) && <button
            type="button"
            onClick={() => {
              switchRole('INSTRUCTOR');
              setCurrentView('provider');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              currentView === 'provider'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Pro (Instrutor)</span>
          </button>}

          {(!isAuthenticated || isAdminAccount) && <button
            type="button"
            onClick={() => {
              switchRole('PLATFORM_ADMIN');
              setCurrentView('admin');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              currentView === 'admin'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>}

          {!isAuthenticated && <button
            type="button"
            onClick={() => setCurrentView('auth')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              currentView === 'auth'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-amber-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Login/Auth</span>
          </button>}

          {!isAuthenticated && <button
            type="button"
            onClick={() => setCurrentView('design-system')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              currentView === 'design-system'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Design System</span>
          </button>}
        </div>}

        {/* Active Session Badge */}
        {user && (
          <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
            <UserCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold">{user.email}</span>
            <span className="text-[10px] font-bold uppercase bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded">
              {user.roles[0]}
            </span>
            <button type="button" onClick={() => { void logout(); setCurrentView('auth'); }} className="ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-rose-300 hover:bg-rose-950/60" aria-label="Sair"><LogOut className="w-3.5 h-3.5" /> Sair</button>
          </div>
        )}
      </div>}

      {/* Active App Shell */}
      <div className="flex-1 bg-slate-100 flex flex-col justify-center">
        {currentView === 'student' && <StudentApp />}
        {currentView === 'provider' && <ProviderApp />}
        {currentView === 'admin' && <AdminApp />}
        {currentView === 'design-system' && <DesignSystemShowcase />}
        {currentView === 'auth' && (
          <div className="py-12 px-4 flex items-center justify-center">
            <AuthScreens onSuccess={() => setCurrentView('student')} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
