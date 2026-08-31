import { describe, expect, it } from 'vitest';
import { getStripeEnvironment, resolveCheckoutGatewayProvider } from '../src/lib/payment-gateway-config';

describe('configuração do checkout', () => {
  it('mantém o gateway fake como padrão seguro', () => {
    expect(resolveCheckoutGatewayProvider()).toBe('fake');
    expect(resolveCheckoutGatewayProvider('')).toBe('fake');
    expect(resolveCheckoutGatewayProvider('invalido')).toBe('fake');
  });

  it('habilita Stripe somente pelo valor explícito', () => {
    expect(resolveCheckoutGatewayProvider('stripe')).toBe('stripe');
    expect(resolveCheckoutGatewayProvider(' Stripe ')).toBe('stripe');
  });

  it('identifica produção pela chave pública mesmo no localhost', () => {
    expect(getStripeEnvironment('pk_live_chave-publica')).toBe('production');
    expect(getStripeEnvironment('pk_test_chave-publica')).toBe('test');
  });
});
