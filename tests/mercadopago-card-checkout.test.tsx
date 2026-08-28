// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mercadoPagoSdk = vi.hoisted(() => ({
  init: vi.fn(),
  cardPaymentProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@mercadopago/sdk-react', () => ({
  initMercadoPago: mercadoPagoSdk.init,
  CardPayment: (props: Record<string, unknown>) => {
    mercadoPagoSdk.cardPaymentProps.push(props);
    return null;
  },
}));

vi.mock('../src/lib/payment-gateway-config', () => ({
  getMercadoPagoTestPublicKey: () => 'TEST-chave-publica',
}));

import { MercadoPagoCardCheckout } from '../src/apps/student/components/MercadoPagoCardCheckout';

afterEach(() => {
  cleanup();
  mercadoPagoSdk.init.mockReset();
  mercadoPagoSdk.cardPaymentProps.length = 0;
});

describe('checkout de cartão do Mercado Pago', () => {
  it('mantém a mesma instância do Brick quando o componente pai renderiza novamente', async () => {
    const firstSubmit = vi.fn();
    const secondSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <MercadoPagoCardCheckout amountInCents={13000} isProcessing={false} onSubmit={firstSubmit} />,
    );

    const initialProps = mercadoPagoSdk.cardPaymentProps.at(-1)!;

    rerender(
      <MercadoPagoCardCheckout amountInCents={13000} isProcessing onSubmit={secondSubmit} />,
    );

    const updatedProps = mercadoPagoSdk.cardPaymentProps.at(-1)!;
    expect(updatedProps.initialization).toBe(initialProps.initialization);
    expect(updatedProps.customization).toBe(initialProps.customization);
    expect(updatedProps.onReady).toBe(initialProps.onReady);
    expect(updatedProps.onError).toBe(initialProps.onError);
    expect(updatedProps.onSubmit).toBe(initialProps.onSubmit);

    expect(updatedProps.customization).toMatchObject({
      visual: {
        hideFormTitle: true,
        texts: {
          emailSectionTitle: 'Dados do titular',
          formSubmit: 'Pagar agora',
        },
        style: {
          theme: 'flat',
          customVariables: {
            baseColor: '#f6c945',
            buttonTextColor: '#202126',
            textPrimaryColor: '#1f2024',
            borderRadiusMedium: '16px',
          },
        },
      },
    });

    const submit = updatedProps.onSubmit as (payload: unknown) => Promise<void>;
    const payload = {
      token: 'token-teste',
      issuer_id: '123',
      payment_method_id: 'master',
      installments: 1,
      payer: { email: 'aluno@teste.com', identification: { type: 'CPF', number: '12345678909' } },
    };

    await act(async () => submit(payload));

    expect(firstSubmit).not.toHaveBeenCalled();
    expect(secondSubmit).toHaveBeenCalledWith({
      token: 'token-teste',
      issuerId: '123',
      paymentMethodId: 'master',
      installments: 1,
      payer: payload.payer,
    });
  });
});
