import React from 'react';
import { ExternalLink, LockKeyhole } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { formatCentsToBRL } from '../../../domain/money';

interface Props {
  amountInCents: number;
  isProcessing: boolean;
  onCheckout: () => void;
}

export const StripeHostedCheckout: React.FC<Props> = ({ amountInCents, isProcessing, onCheckout }) => (
  <div className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-4">
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-[var(--mazzi-text)]">
      <span className="flex min-w-0 items-center gap-2">
        <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <span className="truncate">Checkout seguro Stripe</span>
      </span>
      <span className="shrink-0 font-extrabold">{formatCentsToBRL(amountInCents)}</span>
    </div>

    <p className="text-center text-xs leading-relaxed text-[var(--mazzi-muted)]">
      Você será redirecionado para a página segura da Stripe para escolher Pix ou cartão de crédito e concluir o pagamento.
    </p>

    <Button
      type="button"
      variant="primary"
      size="md"
      className="w-full font-extrabold"
      isLoading={isProcessing}
      disabled={isProcessing}
      onClick={onCheckout}
      leftIcon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
    >
      Ir para o Checkout Stripe
    </Button>
  </div>
);
