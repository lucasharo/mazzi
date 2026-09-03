import React from 'react';
import { Building2, CheckCircle2, ExternalLink } from 'lucide-react';
import type { ProviderPaymentAccount } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { AppPageHeader } from '../../../components/ui/AppPageHeader';

interface ProviderAccountTabProps {
  paymentAccount?: ProviderPaymentAccount | null;
  onOpenPayoutOnboarding: () => void;
  isOpeningPayoutOnboarding?: boolean;
  showHeader?: boolean;
}

export const ProviderAccountTab: React.FC<ProviderAccountTabProps> = ({
  paymentAccount,
  onOpenPayoutOnboarding,
  isOpeningPayoutOnboarding = false,
  showHeader = true,
}) => {
  const isReady = paymentAccount?.payoutsEnabled === true;
  const hasConnectedAccount = Boolean(paymentAccount?.externalAccountId);
  const maskedAccount = paymentAccount?.maskedPayoutAccount;
  const maskedAccountLabel = maskedAccount?.kind === 'bank_account' ? 'Conta bancária' : 'Conta para recebimento';
  const maskedAccountDetails = [maskedAccount?.bankName, maskedAccount?.last4 ? `final ${maskedAccount.last4}` : undefined]
    .filter(Boolean)
    .join(' · ');

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
            <h2 className="text-sm font-bold text-[var(--mazzi-dark)]">Recebimentos</h2>
            <p className="mt-0.5 text-xs text-[var(--mazzi-muted)]">Configure onde você receberá seus repasses.</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-[var(--mazzi-border)] bg-[var(--mazzi-surface-soft)] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mazzi-text)]">
                <CheckCircle2 className={`h-4 w-4 ${isReady ? 'text-emerald-600' : 'text-[var(--mazzi-muted)]'}`} aria-hidden="true" />
                <span>{isReady ? 'Recebimentos habilitados' : hasConnectedAccount ? 'Cadastro de recebimentos pendente' : 'Cadastro de recebimentos não iniciado'}</span>
              </div>
              <p className="mt-2 max-w-xl text-xs leading-5 text-[var(--mazzi-muted)]">
                Seus dados bancários são informados com segurança no cadastro de recebimentos e não ficam armazenados no MAZZI.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Button type="button" variant="primary" size="sm" onClick={onOpenPayoutOnboarding} isLoading={isOpeningPayoutOnboarding} leftIcon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}>
                {isReady ? 'Atualizar dados' : 'Configurar recebimentos'}
              </Button>
            </div>
          </div>
        </div>
        {hasConnectedAccount && <div className={`mt-3 rounded-2xl border p-3 text-xs font-semibold ${isReady ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {isReady ? 'Cadastro concluído. Os repasses automáticos estão habilitados.' : 'Há informações pendentes. Abra o cadastro de recebimentos para continuar.'}
        </div>}
        {maskedAccount && <div className="mt-3 rounded-2xl border border-[var(--mazzi-border)] bg-white px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--mazzi-muted)]">Conta cadastrada</p>
          <p className="mt-1 text-sm font-semibold text-[var(--mazzi-text)]">{maskedAccountLabel}</p>
          {maskedAccountDetails && <p className="mt-0.5 text-xs text-[var(--mazzi-muted)]">{maskedAccountDetails}</p>}
        </div>}
      </section>
    </div>
  );
};
