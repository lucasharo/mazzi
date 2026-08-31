import { ButtonBase } from './Button';
import React from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import { NotificationIndicator } from './NotificationIndicator';
import { EnvironmentBadge } from './EnvironmentBadge';
import type { Notification } from '../../types';

interface AppHomeHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  eyebrowIcon?: React.ReactNode;
  onOpenNotifications: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  appContext?: NonNullable<Notification['appContext']>;
}

/** Canonical home header shared by the MAZZI mobile apps. */
export const AppHomeHeader: React.FC<AppHomeHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  eyebrowIcon,
  onOpenNotifications,
  onRefresh,
  isRefreshing = false,
  appContext = 'PRO',
}) => {
  const appLabel = appContext === 'STUDENT' ? 'Aluno' : 'Profissional';

  return (
    <header data-component="app-home-header" className="space-y-7">
      <div className="flex items-center justify-between gap-4">
        <div className="mazzi-brand-lockup min-w-0">
          <img src="/brand/mazzi-logo.png" alt="" width="42" height="42" aria-hidden="true" />
          <span className="min-w-0">
            <strong>MAZZI</strong>
            <small>{appLabel}</small>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <EnvironmentBadge />
          <ButtonBase
            type="button"
            onClick={onOpenNotifications}
            className="mazzi-icon-button cursor-pointer"
            title="Notificações"
            aria-label="Abrir notificações"
          >
            <NotificationIndicator appContext={appContext} className="h-full w-full items-center justify-center">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </NotificationIndicator>
          </ButtonBase>
          <ButtonBase
            type="button"
            onClick={onRefresh}
            className="mazzi-icon-button cursor-pointer disabled:cursor-wait disabled:opacity-60"
            disabled={isRefreshing}
            title="Atualizar dados desta tela"
            aria-label="Atualizar dados desta tela"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </ButtonBase>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="mazzi-eyebrow">{eyebrow}</p>
          <h1 className="text-[28px] font-black leading-[1.04] tracking-[-0.045em] text-[var(--mazzi-dark)] sm:text-[34px]">
            {title}
          </h1>
          <p className="max-w-[42ch] text-xs font-medium leading-relaxed text-[var(--mazzi-muted)] sm:text-sm">
            {subtitle}
          </p>
        </div>
        {eyebrowIcon && <span className="mazzi-heading-icon" aria-hidden="true">{eyebrowIcon}</span>}
      </div>
    </header>
  );
};
