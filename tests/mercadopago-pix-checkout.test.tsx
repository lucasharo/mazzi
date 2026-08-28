// @vitest-environment happy-dom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoPagoPixCheckout } from '../src/apps/student/components/MercadoPagoPixCheckout';

afterEach(cleanup);

const baseProps = {
  amountInCents: 9500,
  isProcessing: false,
  copied: false,
  onCreate: vi.fn(async () => undefined),
  onRefresh: vi.fn(async () => undefined),
  onCopy: vi.fn(),
};

describe('checkout Pix do Mercado Pago', () => {
  it('não mostra o QR falso na primeira abertura', () => {
    const { container } = render(
      <MercadoPagoPixCheckout
        {...baseProps}
        pixQrCode="FAKE_PIX_SIMULATED_PAYMENT_ENV_DEVELOPMENT_fake_pay_123"
        pixQrCodeBase64="data:image/png;base64,imagem-falsa"
      />,
    );

    expect(screen.getByText('Gerar código Pix')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Gerar Pix' })).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('mostra o QR somente após receber um código real', () => {
    const { container } = render(
      <MercadoPagoPixCheckout
        {...baseProps}
        pixQrCode="00020126580014BR.GOV.BCB.PIX"
        pixQrCodeBase64="data:image/png;base64,imagem-real"
      />,
    );

    expect(screen.getByText('Aguardando pagamento')).toBeTruthy();
    expect(container.querySelector('img')).not.toBeNull();
  });
});
