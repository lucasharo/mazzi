import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { getMercadoPagoTestPublicKey } from '../../../lib/payment-gateway-config';

const LOCAL_TEST_PAYER_IDENTIFICATION = { type: 'CPF', number: '12345678909' } as const;

export interface MercadoPagoCardPayload {
  token: string;
  issuerId: string;
  paymentMethodId: string;
  installments: number;
  cardholderName: string;
  payer: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
}

interface Props {
  amountInCents: number;
  isProcessing: boolean;
  payerEmail?: string;
  onSubmit: (payload: MercadoPagoCardPayload) => Promise<void>;
}

export const MercadoPagoCardCheckout: React.FC<Props> = ({ amountInCents, isProcessing, payerEmail, onSubmit }) => {
  const publicKey = getMercadoPagoTestPublicKey();
  const isProductionEnvironment = Boolean(import.meta.env.PROD && import.meta.env.VITE_APP_ENV !== 'development');
  const [isReady, setIsReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const cardPaymentContainerRef = useRef<HTMLDivElement>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const normalizedPayerEmail = payerEmail?.trim() || undefined;
  const localTestPayerIdentification = import.meta.env.DEV
    ? LOCAL_TEST_PAYER_IDENTIFICATION
    : undefined;

  useEffect(() => {
    if (!publicKey) return;
    initMercadoPago(publicKey, { locale: 'pt-BR' });
  }, [publicKey]);

  const initialization = useMemo(() => ({
    amount: amountInCents / 100,
    ...(normalizedPayerEmail ? {
      payer: {
        email: normalizedPayerEmail,
        ...(localTestPayerIdentification ? { identification: localTestPayerIdentification } : {}),
      },
    } : {}),
  }), [amountInCents, normalizedPayerEmail, localTestPayerIdentification]);
  const customization = useMemo(() => ({
    paymentMethods: { maxInstallments: 1 },
    visual: {
      hideFormTitle: true,
      texts: {
        cardNumber: { label: 'Número do cartão', placeholder: '0000 0000 0000 0000' },
        cardExpirationDate: { label: 'Validade', placeholder: 'MM/AA' },
        cardSecurityCode: { label: 'Código de segurança', placeholder: 'CVV' },
        cardholderName: { label: 'Nome impresso no cartão', placeholder: 'APRO para aprovar o teste' },
        cardholderIdentification: { label: 'Documento do titular' },
        cardholderEmail: { label: 'E-mail' },
        emailSectionTitle: 'Dados do titular',
        formSubmit: 'Pagar agora',
      },
      style: {
        theme: 'flat' as const,
        customVariables: {
          textPrimaryColor: '#1f2024',
          textSecondaryColor: '#77766f',
          inputBackgroundColor: '#ffffff',
          formBackgroundColor: '#ffffff',
          baseColor: '#f6c945',
          baseColorFirstVariant: '#ffe797',
          baseColorSecondVariant: '#fff4c7',
          outlinePrimaryColor: '#e9e6de',
          outlineSecondaryColor: '#f6c945',
          buttonTextColor: '#202126',
          errorColor: '#e11d48',
          successColor: '#059669',
          fontSizeExtraSmall: '12px',
          fontSizeSmall: '13px',
          fontSizeMedium: '14px',
          fontSizeLarge: '16px',
          fontWeightNormal: '400',
          fontWeightSemiBold: '700',
          inputVerticalPadding: '14px',
          inputHorizontalPadding: '16px',
          inputFocusedBoxShadow: '0 0 0 4px rgba(246, 201, 69, 0.35)',
          inputErrorFocusedBoxShadow: '0 0 0 4px rgba(225, 29, 72, 0.16)',
          inputBorderWidth: '1px',
          inputFocusedBorderWidth: '1.5px',
          borderRadiusSmall: '12px',
          borderRadiusMedium: '16px',
          borderRadiusLarge: '20px',
          formPadding: '0px',
        },
      },
    },
  }), []);
  const handleReady = useCallback(() => setIsReady(true), []);
  const handleError = useCallback(() => {
    setSdkError('Não foi possível carregar o formulário de pagamento. Tente novamente.');
  }, []);

  useEffect(() => {
    const container = cardPaymentContainerRef.current;
    if (!container) return;

    const hidePayerEmail = () => {
      const emailInput = container.querySelector<HTMLInputElement>('input[type="email"]');
      if (!emailInput) return;

      const candidates = Array.from(container.querySelectorAll('div')) as HTMLElement[];
      const emailFieldCandidates = candidates
        .filter((element) => element.contains(emailInput) && element.querySelectorAll('input').length === 1)
        .filter((element) => /e-?mail/i.test(element.textContent || ''))
        .sort((first, second) => first.textContent!.length - second.textContent!.length);
      const emailField = emailFieldCandidates[0] || emailInput.parentElement;
      emailField?.setAttribute('hidden', '');
    };

    // O Brick exibe textos técnicos em linha durante a validação de campos.
    // Mantemos a indicação visual/semântica do campo e removemos somente a
    // mensagem textual repetitiva, que quebra o layout compacto do aplicativo.
    const hideValidationMessages = () => {
      const elements = Array.from(container.querySelectorAll('*')) as HTMLElement[];
      elements.forEach((element) => {
        const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
        const normalizedText = text.toLocaleUpperCase('pt-BR');
        const isShortText = text.length > 0 && text.length <= 100;
        const isValidationMessage = isShortText && (
          normalizedText === 'DADO OBRIGATÓRIO'
          || normalizedText.includes('INVÁLID')
          || normalizedText.includes('CARACTERES DE DATA')
          || normalizedText.includes('CAMPO OBRIGATÓRIO')
          || normalizedText.includes('PREENCHA')
        );
        const containsControl = Boolean(element.querySelector('input, select, textarea, button'));
        if (isValidationMessage && !containsControl) {
          element.style.display = 'none';
          element.setAttribute('aria-hidden', 'true');
        }
      });
    };

    hidePayerEmail();
    hideValidationMessages();
    const observer = new MutationObserver(() => {
      hidePayerEmail();
      hideValidationMessages();
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [normalizedPayerEmail]);
  const handleSubmit = useCallback(async (formData: {
    token: string;
    issuer_id: string;
    payment_method_id: string;
    installments: number;
    payer: MercadoPagoCardPayload['payer'];
  }, additionalData?: { cardholderName?: string }) => {
    await onSubmitRef.current({
      token: formData.token,
      issuerId: formData.issuer_id,
      paymentMethodId: formData.payment_method_id,
      installments: formData.installments,
      cardholderName: additionalData?.cardholderName?.trim() || '',
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
      {!isProductionEnvironment && <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-[var(--mazzi-text)]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <span>Ambiente de teste — use um cartão de teste e APRO como nome do titular.</span>
      </div>}
      {!isReady && !sdkError && <p role="status" className="py-4 text-center text-sm text-[var(--mazzi-text)]">Carregando pagamento seguro…</p>}
      {sdkError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{sdkError}</p>}
      <div
        ref={cardPaymentContainerRef}
        data-mazzi-card-payment="true"
        data-email-prefilled={normalizedPayerEmail ? 'true' : 'false'}
        aria-busy={isProcessing}
        className={`min-w-0 touch-manipulation ${isProcessing ? 'opacity-60' : ''}`}
      >
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
