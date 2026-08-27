import { describe, expect, it } from 'vitest';
import { resolveCheckoutGatewayProvider } from '../src/lib/payment-gateway-config';

describe('configuração do checkout', () => {
  it('mantém o gateway fake como padrão seguro', () => {
    expect(resolveCheckoutGatewayProvider()).toBe('fake');
    expect(resolveCheckoutGatewayProvider('')).toBe('fake');
    expect(resolveCheckoutGatewayProvider('invalido')).toBe('fake');
  });

  it('habilita Mercado Pago somente pelo valor explícito', () => {
    expect(resolveCheckoutGatewayProvider('mercadopago')).toBe('mercadopago');
    expect(resolveCheckoutGatewayProvider(' MercadoPago ')).toBe('mercadopago');
  });
});
