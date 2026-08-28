import React from 'react';
import { CheckCircle2, Pencil, QrCode } from 'lucide-react';
import type { PixDestination } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';

interface ProviderAccountTabProps {
  pixDestination?: PixDestination | null;
  onOpenPixSettings: () => void;
  showHeader?: boolean;
}

export const ProviderAccountTab: React.FC<ProviderAccountTabProps> = ({
  pixDestination,
  onOpenPixSettings,
  showHeader = true,
}) => {
  return (
    <div className="space-y-5 text-left">
      {showHeader && (
        <AppPageHeader
          eyebrow="Gestão financeira"
          title="Conta de pagamento Pix"
          subtitle="Configure a chave usada pelo Admin nos repasses manuais."
        />
      )}

      <section className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] text-amber-700">
            <QrCode className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--mazzi-dark)]">Conta de recebimento Pix</h2>
            <p className="mt-0.5 text-xs text-[var(--mazzi-muted)]">Chave usada pelo Admin nos repasses manuais.</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mazzi-text)]">
                <CheckCircle2 className={`h-4 w-4 ${pixDestination?.isActive ? 'text-emerald-600' : 'text-[var(--mazzi-muted)]'}`} aria-hidden="true" />
                <span>{pixDestination?.isActive ? 'Chave Pix cadastrada' : 'Nenhuma chave Pix cadastrada'}</span>
              </div>
              {pixDestination?.isActive && (
                <p className="mt-2 truncate text-xs text-[var(--mazzi-muted)]">
                  {pixDestination.keyType} · {pixDestination.pixKeyMasked || 'Chave cadastrada'}
                </p>
              )}
            </div>
            <Button type="button" variant={pixDestination?.isActive ? 'outline' : 'primary'} size="sm" className="shrink-0" onClick={onOpenPixSettings} leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}>
              {pixDestination?.isActive ? 'Editar chave Pix' : 'Cadastrar chave Pix'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
