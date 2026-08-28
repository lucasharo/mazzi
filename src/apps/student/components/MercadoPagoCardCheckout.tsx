import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { getMercadoPagoTestPublicKey } from '../../../lib/payment-gateway-config';

export interface MercadoPagoCardPayload {
  token: string;
  issuerId: string;
  paymentMethodId: string;
  installments: number;
  payer: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
}

interface Props {
  amountInCents: number;
  isProcessing: boolean;
  onSubmit: (payload: MercadoPagoCardPayload) => Promise<void>;
}

export const MercadoPagoCardCheckout: React.FC<Props> = ({ amountInCents, isProcessing, onSubmit }) => {
  const publicKey = getMercadoPagoTestPublicKey();
  const [isReady, setIsReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useEffect(() => {
    if (!publicKey) return;
    initMercadoPago(publicKey, { locale: 'pt-BR' });
  }, [publicKey]);

  const initialization = useMemo(() => ({ amount: amountInCents / 100 }), [amountInCents]);
  const customization = useMemo(() => ({
    paymentMethods: { maxInstallments: 1 },
    visual: { style: { theme: 'default' as const } },
  }), []);
  const handleReady = useCallback(() => setIsReady(true), []);
  const handleError = useCallback(() => {
    setSdkError('Não foi possível carregar o formulário de pagamento. Tente novamente.');
  }, []);
  const handleSubmit = useCallback(async (formData: {
    token: string;
    issuer_id: string;
    payment_method_id: string;
    installments: number;
    payer: MercadoPagoCardPayload['payer'];
  }) => {
    await onSubmitRef.current({
      token: formData.token,
      issuerId: formData.issuer_id,
      paymentMethodId: formData.payment_method_id,
      installments: formData.installments,
      payer: formData.payer,
    });
  }, []);

  if (!publicKey) {
    return (
      <div role="alert" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-[var(--mazzi-text)]">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <p>O pagamento de teste do Mercado Pago ainda não foi configurado neste ambiente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--mazzi-border)] bg-white p-3 sm:p-4">
      <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-[var(--mazzi-text)]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <span>Ambiente de teste — use somente cartões de teste do Mercado Pago.</span>
      </div>
      {!isReady && !sdkError && <p role="status" className="py-4 text-center text-sm text-[var(--mazzi-text)]">Carregando pagamento seguro…</p>}
      {sdkError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{sdkError}</p>}
      <div aria-busy={isProcessing} className={isProcessing ? 'pointer-events-none opacity-60' : ''}>
        <CardPayment
          initialization={initialization}
          locale="pt-BR"
          customization={customization}
          onReady={handleReady}
          onError={handleError}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};
