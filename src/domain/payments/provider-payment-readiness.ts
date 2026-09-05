import type { ProviderPaymentAccount } from '../../types';

/** A provider is ready for marketplace visibility only after Connect is fully enabled. */
export function isProviderPaymentAccountReady(account?: ProviderPaymentAccount | null): boolean {
  return Boolean(
    account?.status === 'ACTIVE' &&
    account.externalAccountId.trim() &&
    account.chargesEnabled === true &&
    account.payoutsEnabled === true,
  );
}
