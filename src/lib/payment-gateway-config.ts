export type CheckoutGatewayProvider = 'fake' | 'stripe';

export function resolveCheckoutGatewayProvider(value?: string): CheckoutGatewayProvider {
  return value?.trim().toLowerCase() === 'stripe' ? 'stripe' : 'fake';
}

export function getCheckoutGatewayProvider(): CheckoutGatewayProvider {
  if (import.meta.env.MODE === 'test' || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
    return 'fake';
  }
  return resolveCheckoutGatewayProvider(import.meta.env.VITE_PAYMENT_GATEWAY_PROVIDER);
}

export function getStripePublishableKey(): string {
  return (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim();
}

export type StripeEnvironment = 'test' | 'production';

/**
 * The frontend cannot read the server-side Access Token, so use the public
 * key format only to select test-only UX/data. Payment authorization remains
 * enforced by the Supabase Edge Function using its server-side secret.
 */
export function getStripeEnvironment(publicKey = getStripePublishableKey()): StripeEnvironment {
  return publicKey.startsWith('pk_live_') ? 'production' : 'test';
}
