import React from 'react';
import {
  Bell,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Building2,
  UserCheck,
} from 'lucide-react';
import { Provider, UserRole } from '../../../types';
import { StatusBadge } from '../../../components/ui/StatusBadge';

interface ProviderHeaderProps {
  currentProvider?: Provider;
  currentRole: UserRole;
  userEmail?: string;
  userName?: string;
  profileAvatar?: string;
  onOpenNotifications: () => void;
  onRefreshWorkspace: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
}

export const ProviderHeader: React.FC<ProviderHeaderProps> = ({
  currentProvider,
  currentRole,
  userName,
  profileAvatar,
  onOpenNotifications,
  onRefreshWorkspace,
  onLogout,
  onOpenProfile,
}) => {
  const providerName = currentProvider?.name || userName || 'Instrutor';
  const isSchool = currentProvider?.type === 'DRIVING_SCHOOL' || currentRole === 'SCHOOL_STAFF';

  const avatarInitials = providerName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-[#202126] text-white shadow-md border-b border-slate-800">
      <div className="mx-auto flex w-full max-w-[680px] items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Profile Info */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenProfile}
            className="group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-[#ffe797] to-[#f6c945] text-[#202126] font-black text-sm shadow-sm transition transform active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-[#f6c945]"
            title="Ver Perfil"
            aria-label="Abrir Perfil do Instrutor"
          >
            {profileAvatar ? (
              <img src={profileAvatar} alt={providerName} className="h-full w-full object-cover" />
            ) : (
              <span>{avatarInitials}</span>
            )}
          </button>

          <div className="text-left space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#f6c945] flex items-center gap-1">
                {isSchool ? <Building2 className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                {isSchool ? 'Autoescola / CFC' : 'Instrutor MAZZI'}
              </span>
              {currentProvider?.isVerified && (
                <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded-full border border-emerald-800/60">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Verificado
                </span>
              )}
            </div>
            <h1 className="text-sm sm:text-base font-extrabold text-white truncate max-w-[180px] sm:max-w-[260px]">
              {providerName}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Status Tag */}
          {currentProvider?.status && (
            <div className="hidden sm:block">
              <StatusBadge status={currentProvider.status} />
            </div>
          )}

          {/* Notifications Button */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition focus:outline-hidden focus:ring-2 focus:ring-[#f6c945]"
            title="Notificações"
            aria-label="Ver Notificações"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-[#f6c945] ring-2 ring-[#202126]" />
          </button>

          {/* Refresh Workspace Button */}
          <button
            type="button"
            onClick={onRefreshWorkspace}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition focus:outline-hidden focus:ring-2 focus:ring-[#f6c945]"
            title="Atualizar dados"
            aria-label="Atualizar Espaço"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-rose-950/80 hover:text-rose-400 transition focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            title="Sair da Conta"
            aria-label="Sair da Conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
