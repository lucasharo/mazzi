import { ButtonBase } from './Button';
import React from 'react';
import { Bell, RefreshCw } from 'lucide-react';

interface AppHomeHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  eyebrowIcon?: React.ReactNode;
  onOpenNotifications: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
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
}) => (
  <header data-component="app-home-header" className="flex items-start justify-between gap-4">
    <div className="min-w-0 space-y-1">
      <p className="mazzi-eyebrow inline-flex items-center gap-1">
        {eyebrowIcon}
        {eyebrow}
      </p>
      <h1 className="text-2xl font-extrabold leading-tight tracking-[-0.03em] text-[var(--mazzi-dark)] sm:text-[32px]">
        {title}
      </h1>
      <p className="max-w-[38ch] text-xs font-semibold leading-relaxed text-[var(--mazzi-muted)] sm:text-sm">
        {subtitle}
      </p>
    </div>

    <div className="flex shrink-0 items-center gap-2">
      <ButtonBase
        type="button"
        onClick={onOpenNotifications}
        className="mazzi-icon-button cursor-pointer"
        title="Notificações"
        aria-label="Abrir notificações"
        data-notification="true"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
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
  </header>
);
