import React from 'react';
import { Bell, Settings2 } from 'lucide-react';
import type { Notification } from '../../types';
import { NotificationPreferences } from '../notifications/NotificationPreferences';
import { PushNotificationOptIn } from '../notifications/PushNotificationOptIn';

interface SettingsPanelProps {
  appContext: Extract<NonNullable<Notification['appContext']>, 'STUDENT' | 'PRO'>;
  userId?: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ appContext, userId }) => (
  <div className="mx-auto w-full max-w-2xl space-y-5" data-component="settings-panel">
    <header className="flex items-start gap-3 px-1 pt-1">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700" aria-hidden="true">
        <Settings2 className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Preferências do app</p>
        <h2 className="mt-0.5 text-xl font-black tracking-tight text-[var(--mazzi-dark)]">Configurações</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--mazzi-muted)]">Gerencie notificações e preferências da sua experiência no MAZZI.</p>
      </div>
    </header>

    <section aria-labelledby="settings-notifications-title" className="overflow-hidden rounded-3xl border border-[var(--mazzi-border)] bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-100 p-4 sm:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700" aria-hidden="true">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 id="settings-notifications-title" className="text-base font-black text-[var(--mazzi-dark)]">Notificações</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--mazzi-muted)]">Escolha quais avisos deseja receber e como deseja ser notificado.</p>
        </div>
      </div>

      <div className="px-4 sm:px-5">
        <div className="border-b border-slate-100 py-3">
          <PushNotificationOptIn appContext={appContext} userId={userId} />
        </div>
        <NotificationPreferences appContext={appContext} showHeading={false} />
      </div>
    </section>
  </div>
);
