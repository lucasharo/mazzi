// @vitest-environment happy-dom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mercadoPagoSdk = vi.hoisted(() => ({
  init: vi.fn(),
  cardPaymentProps: [] as Array<Record<string, unknown>>,
  renderEmailInput: false,
  renderValidationMessage: false,
}));

vi.mock('@mercadopago/sdk-react', () => ({
  initMercadoPago: mercadoPagoSdk.init,
  CardPayment: (props: Record<string, unknown>) => {
    mercadoPagoSdk.cardPaymentProps.push(props);
    return mercadoPagoSdk.renderEmailInput ? (
      <div>
        <label>E-mail</label>
        <input type="email" defaultValue="aluno@teste.com" />
      </div>
    ) : mercadoPagoSdk.renderValidationMessage ? (
      <div>
        <input aria-invalid="true" />
        <span>CARACTERES DE DATA INVÁLIDOS</span>
      </div>
    ) : null;
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
  mercadoPagoSdk.renderEmailInput = false;
  mercadoPagoSdk.renderValidationMessage = false;
});

describe('checkout de cartão do Mercado Pago', () => {
  it('mantém a mesma instância do Brick quando o componente pai renderiza novamente', async () => {
    const firstSubmit = vi.fn();
    const secondSubmit = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(
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
          cardholderName: { placeholder: 'APRO para aprovar o teste' },
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

    const processingContainer = container.querySelector('[aria-busy="true"]');
    expect(processingContainer).not.toBeNull();
    expect(processingContainer?.classList.contains('touch-manipulation')).toBe(true);
    expect(processingContainer?.classList.contains('opacity-60')).toBe(true);
    expect(processingContainer?.classList.contains('pointer-events-none')).toBe(false);

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
      cardholderName: '',
      payer: payload.payer,
    });
  });

  it('preenche o e-mail cadastrado e marca o campo para ocultação visual', () => {
    render(
      <MercadoPagoCardCheckout
        amountInCents={13000}
        isProcessing={false}
        payerEmail=" aluno@teste.com "
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const props = mercadoPagoSdk.cardPaymentProps.at(-1)!;
    expect(props.initialization).toEqual({
      amount: 130,
      payer: {
        email: 'aluno@teste.com',
        identification: { type: 'CPF', number: '12345678909' },
      },
    });
    expect(document.querySelector('[data-email-prefilled="true"]')).not.toBeNull();
  });

  it('oculta o campo de e-mail do Brick quando o cadastro já foi informado', async () => {
    mercadoPagoSdk.renderEmailInput = true;
    render(
      <MercadoPagoCardCheckout
        amountInCents={13000}
        isProcessing={false}
        payerEmail="aluno@teste.com"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await act(async () => {});

    expect(document.querySelector('input[type="email"]')?.parentElement?.hasAttribute('hidden')).toBe(true);
  });

  it('oculta mensagens textuais de validação e preserva a indicação de campo inválido', async () => {
    mercadoPagoSdk.renderValidationMessage = true;
    render(
      <MercadoPagoCardCheckout
        amountInCents={13000}
        isProcessing={false}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await act(async () => {});

    const message = screen.getByText('CARACTERES DE DATA INVÁLIDOS', { exact: true });
    expect(message.style.display).toBe('none');
    expect(message.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('input[aria-invalid="true"]')).not.toBeNull();
  });

  it('encaminha o nome do titular recebido como dado adicional do Brick', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MercadoPagoCardCheckout amountInCents={13000} isProcessing={false} onSubmit={onSubmit} />,
    );

    const submit = mercadoPagoSdk.cardPaymentProps.at(-1)!.onSubmit as (
      payload: unknown,
      additionalData?: { cardholderName?: string },
    ) => Promise<void>;

    await act(async () => submit({
      token: 'token-teste',
      issuer_id: '123',
      payment_method_id: 'master',
      installments: 1,
      payer: { identification: { type: 'CPF', number: '12345678909' } },
    }, { cardholderName: ' APRO ' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ cardholderName: 'APRO' }));
  });
});
