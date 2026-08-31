import React, { useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
// Use the pure entrypoint so importing the component never injects Stripe.js
// into DOM-based tests or any page that has not opened the checkout yet.
import { loadStripe } from '@stripe/stripe-js/pure';
import { AlertCircle, CreditCard, LockKeyhole } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { formatCentsToBRL } from '../../../domain/money';
import { getStripePublishableKey } from '../../../lib/payment-gateway-config';

export type StripePaymentResult = {
  status: string;
  paymentIntentId?: string;
  errorMessage?: string;
};

interface StripePaymentFormProps {
  amountInCents: number;
  method: 'PIX' | 'CREDIT_CARD';
  isProcessing: boolean;
  onResult: (result: StripePaymentResult) => void;
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({ amountInCents, method, isProcessing, onResult }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements || isSubmitting || isProcessing) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}`,
      },
      redirect: 'if_required',
    });

    if (error) {
      const message = error.message || 'Não foi possível confirmar o pagamento.';
      setErrorMessage(message);
      onResult({ status: 'error', errorMessage: message });
    } else {
      onResult({
        status: paymentIntent?.status || 'processing',
        paymentIntentId: paymentIntent?.id,
      });
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-[var(--mazzi-text)]">
        <span className="flex min-w-0 items-center gap-2">
          {method === 'PIX' ? <CreditCard className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" /> : <LockKeyhole className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />}
          <span className="truncate">{method === 'PIX' ? 'Pagamento via Pix' : 'Pagamento com cartão de crédito'}</span>
        </span>
        <span className="shrink-0 font-extrabold">{formatCentsToBRL(amountInCents)}</span>
      </div>

      <PaymentElement
        onReady={() => setIsReady(true)}
        options={{ layout: { type: 'accordion', defaultCollapsed: false } }}
      />

      {errorMessage && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        className="w-full font-extrabold"
        isLoading={isSubmitting || isProcessing}
        disabled={!isReady || !stripe || !elements || isSubmitting || isProcessing}
        leftIcon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
      >
        Pagar agora
      </Button>
    </form>
  );
};

interface Props {
  clientSecret: string;
  amountInCents: number;
  method: 'PIX' | 'CREDIT_CARD';
  isProcessing: boolean;
  onResult: (result: StripePaymentResult) => void;
}

export const StripePaymentCheckout: React.FC<Props> = ({ clientSecret, amountInCents, method, isProcessing, onResult }) => {
  const publishableKey = getStripePublishableKey();
  const isTestRuntime = import.meta.env.MODE === 'test'
    || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')
    || (typeof navigator !== 'undefined' && /happy-dom/i.test(navigator.userAgent));
  const stripePromise = useMemo(
    () => {
      if (isTestRuntime || !publishableKey) return null;

      // The test browser was logging an optional Stripe Radar telemetry
      // request to m.stripe.com when DNS/network access was unavailable.
      // Keep the signal collection enabled for live payments, but disable it
      // for pk_test builds where it is not required for the payment flow.
      if (publishableKey.startsWith('pk_test_')) {
        loadStripe.setLoadParameters({ advancedFraudSignals: false });
      }

      return loadStripe(publishableKey);
    },
    [isTestRuntime, publishableKey],
  );

  if (!publishableKey || isTestRuntime || !stripePromise) {
    return (
      <div role="alert" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-[var(--mazzi-text)]">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <p>O pagamento Stripe ainda não foi configurado neste ambiente.</p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: '#f6c945',
            colorText: '#33363f',
            colorDanger: '#e11d48',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '14px',
          },
        },
        paymentMethodOrder: method === 'PIX' ? ['pix', 'card'] : ['card', 'pix'],
        // Do not offer Link or browser wallet autofill in this checkout.
        wallets: { link: 'never', applePay: 'never', googlePay: 'never' },
      }}
    >
      <StripePaymentForm
        amountInCents={amountInCents}
        method={method}
        isProcessing={isProcessing}
        onResult={onResult}
      />
    </Elements>
  );
};
