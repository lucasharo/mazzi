import React from 'react';

interface AppPageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const AppPageHeader: React.FC<AppPageHeaderProps> = ({ eyebrow, title, subtitle, action }) => (
  <header className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--mazzi-muted)]">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-[-0.03em] text-[var(--mazzi-dark)] sm:text-[32px]">{title}</h1>
      {subtitle && <p className="mt-1 max-w-[42ch] text-xs font-medium leading-relaxed text-slate-500 sm:text-sm">{subtitle}</p>}
    </div>
    {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
  </header>
);
