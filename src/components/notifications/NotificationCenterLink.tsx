import React from 'react';
import { ChevronRight, Settings2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface NotificationCenterLinkProps {
  onOpen: () => void;
}

export const NotificationCenterLink: React.FC<NotificationCenterLinkProps> = ({ onOpen }) => (
  <div className="mazzi-compact-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4 shadow-xs">
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700" aria-hidden="true">
        <Settings2 className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-bold text-[var(--mazzi-dark)]">Configurações</h4>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--mazzi-muted)]">Gerencie notificações e outras preferências do app.</p>
      </div>
    </div>
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="ml-auto shrink-0"
      onClick={onOpen}
      rightIcon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
    >
      Abrir configurações
    </Button>
  </div>
);
