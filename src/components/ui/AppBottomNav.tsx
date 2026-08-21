import { ButtonBase } from './Button';
import React from 'react';

export interface AppBottomNavItem<T extends string> {
  id: T;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface AppBottomNavProps<T extends string> {
  ariaLabel: string;
  activeId: T;
  items: AppBottomNavItem<T>[];
  onChange: (id: T) => void;
  placement?: 'viewport' | 'inline';
  className?: string;
}

export function AppBottomNav<T extends string>({ ariaLabel, activeId, items, onChange, placement = 'viewport', className = '' }: AppBottomNavProps<T>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={`mazzi-bottom-nav gap-1 ${className}`}
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        ...(placement === 'inline' ? { position: 'relative', inset: 'auto', bottom: 'auto', left: 'auto', right: 'auto', width: '100%', transform: 'none' } : {}),
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <ButtonBase
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(item.id)}
            className={`relative mx-1 flex min-h-12 items-center justify-center rounded-2xl transition active:scale-95 ${active ? 'bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)] shadow-[0_6px_16px_rgba(246,201,69,.28)]' : 'flex-col text-[var(--mazzi-muted)] hover:text-[var(--mazzi-dark)]'}`}
          >
            <span className="relative grid h-8 w-8 place-items-center rounded-xl" aria-hidden="true">
              {item.icon}
              {!!item.badge && item.badge > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">{item.badge}</span>}
            </span>
            {!active && <span className="mt-0.5 text-[10px] font-semibold leading-none">{item.label}</span>}
          </ButtonBase>
        );
      })}
    </nav>
  );
}
