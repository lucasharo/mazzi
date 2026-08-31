import React from 'react';
import { Building2, CheckCircle2, Pencil } from 'lucide-react';
import type { BankAccount } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';

interface ProviderAccountTabProps {
  bankAccount?: BankAccount | null;
  onOpenBankAccountSettings: () => void;
  showHeader?: boolean;
}

export const ProviderAccountTab: React.FC<ProviderAccountTabProps> = ({
  bankAccount,
  onOpenBankAccountSettings,
  showHeader = true,
}) => {
  return (
    <div className="space-y-5 text-left">
      {showHeader && (
        <AppPageHeader
          eyebrow="Gestão financeira"
          title="Conta bancária"
          subtitle="Configure a conta usada nos repasses."
        />
      )}

      <section className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--mazzi-yellow-soft)] text-amber-700">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--mazzi-dark)]">Conta bancária para recebimentos</h2>
            <p className="mt-0.5 text-xs text-[var(--mazzi-muted)]">Conta usada pelo Admin nos repasses manuais.</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mazzi-text)]">
                <CheckCircle2 className={`h-4 w-4 ${bankAccount?.isActive ? 'text-emerald-600' : 'text-[var(--mazzi-muted)]'}`} aria-hidden="true" />
                <span>{bankAccount?.isActive ? 'Conta bancária cadastrada' : 'Nenhuma conta bancária cadastrada'}</span>
              </div>
              {bankAccount?.isActive && (
                <p className="mt-2 truncate text-xs text-[var(--mazzi-muted)]">
                  Banco {bankAccount.bankCode} · Ag. {bankAccount.branchNumber} · Conta {bankAccount.accountNumberMasked || 'cadastrada'}
                </p>
              )}
            </div>
            <Button type="button" variant={bankAccount?.isActive ? 'outline' : 'primary'} size="sm" className="shrink-0" onClick={onOpenBankAccountSettings} leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}>
              {bankAccount?.isActive ? 'Editar conta bancária' : 'Cadastrar conta bancária'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
