import React from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import { ButtonBase } from '../ui/Button';

interface NotificationCenterLinkProps {
  onOpen: () => void;
}

export const NotificationCenterLink: React.FC<NotificationCenterLinkProps> = ({ onOpen }) => (
  <ButtonBase
    type="button"
    onClick={onOpen}
    aria-label="Abrir configurações"
    className="mazzi-card flex min-h-[68px] w-full items-center justify-between gap-3.5 rounded-2xl p-3.5 text-left shadow-xs transition-all duration-200 ease-out hover:shadow-md active:scale-[0.99]"
  >
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-yellow)] text-[var(--mazzi-dark)]" aria-hidden="true">
        <Settings className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <span className="mazzi-eyebrow block text-[9px] text-[#8b6800]">Configurações</span>
        <span className="mt-1 block truncate text-xs font-medium text-[var(--mazzi-muted)]">Ajuste sua experiência no MAZZI.</span>
      </div>
    </div>
    <span className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--mazzi-surface-soft)] text-[var(--mazzi-dark)]" aria-hidden="true">
      <ChevronRight className="h-5 w-5" aria-hidden="true" />
    </span>
  </ButtonBase>
);
