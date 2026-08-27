export type CheckoutGatewayProvider = 'fake' | 'mercadopago';

export function resolveCheckoutGatewayProvider(value?: string): CheckoutGatewayProvider {
  return value?.trim().toLowerCase() === 'mercadopago' ? 'mercadopago' : 'fake';
}

export function getCheckoutGatewayProvider(): CheckoutGatewayProvider {
  return resolveCheckoutGatewayProvider(import.meta.env.VITE_PAYMENT_GATEWAY_PROVIDER);
}

export function getMercadoPagoTestPublicKey(): string {
  return (import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '').trim();
}
