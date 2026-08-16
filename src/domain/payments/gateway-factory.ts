// ============================================================================
// MAZZI DOMAIN — PAYMENT GATEWAY FACTORY (SPRINT 09)
// ============================================================================

import { PaymentGateway } from './gateway-interface';
import { FakePaymentGateway } from './fake-adapter';
import { MercadoPagoPaymentGateway, MercadoPagoConfig } from './mercadopago-adapter';
import { getRuntimeEnvValue, isProductionRuntime } from '../../lib/runtime-env';

export type PaymentGatewayProvider = 'fake' | 'mercadopago';

export interface PaymentGatewayFactoryOptions {
  provider?: PaymentGatewayProvider;
  mercadoPagoConfig?: MercadoPagoConfig;
}

export class PaymentGatewayFactory {
  /**
   * Resolves the PaymentGateway instance based on environment configuration.
   * Default for MVP development is 'fake' (FakePaymentGateway).
   */
  static createGateway(options?: PaymentGatewayFactoryOptions): PaymentGateway {
    const configuredProvider =
      options?.provider ||
      getRuntimeEnvValue('PAYMENT_GATEWAY_PROVIDER') ||
      getRuntimeEnvValue('VITE_PAYMENT_GATEWAY_PROVIDER') ||
      'fake';
    const provider = configuredProvider === 'development' ? 'fake' : configuredProvider;

    if (provider !== 'fake' && provider !== 'mercadopago') {
      throw new Error(`PAYMENT_GATEWAY_PROVIDER_UNSUPPORTED: ${provider}`);
    }

    // Safety guard against accidental fake gateway activation in production.
    if (isProductionRuntime() && provider === 'fake') {
      throw new Error('FAKE_GATEWAY_UNAVAILABLE_IN_PRODUCTION: configure PAYMENT_GATEWAY_PROVIDER=mercadopago before production payment flows.');
    }

    if (provider === 'mercadopago') {
      const config: MercadoPagoConfig = options?.mercadoPagoConfig || {
        accessToken: getRuntimeEnvValue('MERCADOPAGO_ACCESS_TOKEN') || '',
        clientId: getRuntimeEnvValue('MERCADOPAGO_CLIENT_ID') || '',
        clientSecret: getRuntimeEnvValue('MERCADOPAGO_CLIENT_SECRET') || '',
        useLiveHttp: getRuntimeEnvValue('MERCADOPAGO_LIVE_HTTP') === 'true',
      };
      return new MercadoPagoPaymentGateway(config);
    }

    // Default to FakePaymentGateway for development
    return new FakePaymentGateway();
  }
}

/**
 * Global singleton PaymentGateway resolver for the MAZZI platform
 */
export const defaultPaymentGateway: PaymentGateway = PaymentGatewayFactory.createGateway();
