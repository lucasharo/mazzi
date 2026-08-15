// ============================================================================
// MAZZI DOMAIN — PAYMENT GATEWAY FACTORY (SPRINT 09)
// ============================================================================

import { PaymentGateway } from './gateway-interface';
import { FakePaymentGateway } from './fake-adapter';
import { MercadoPagoPaymentGateway, MercadoPagoConfig } from './mercadopago-adapter';

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
    const provider = options?.provider || process.env.PAYMENT_GATEWAY_PROVIDER || 'fake';

    // Safety guard against accidental fake gateway activation in production
    if (process.env.NODE_ENV === 'production' && provider === 'fake') {
      console.warn(
        '[MAZZI SECURITY WARNING]: PRODUCTION_PAYMENT_GATEWAY_PENDING. Running with FakePaymentGateway in production mode! Real PSP integration is DEFERRED.'
      );
    }

    if (provider === 'mercadopago') {
      const config: MercadoPagoConfig = options?.mercadoPagoConfig || {
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
        clientId: process.env.MERCADOPAGO_CLIENT_ID || '',
        clientSecret: process.env.MERCADOPAGO_CLIENT_SECRET || '',
        useLiveHttp: process.env.MERCADOPAGO_LIVE_HTTP === 'true',
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
