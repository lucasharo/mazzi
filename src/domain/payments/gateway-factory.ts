// ============================================================================
// MAZZI DOMAIN — PAYMENT GATEWAY FACTORY (SPRINT 09)
// ============================================================================

import { PaymentGateway } from './gateway-interface';
import { FakePaymentGateway } from './fake-adapter';
import { MercadoPagoPaymentGateway, MercadoPagoConfig } from './mercadopago-adapter';
import { getRuntimeEnvValue, isMockValidationPaymentAllowed } from '../../lib/runtime-env';

export type PaymentGatewayProvider = 'fake' | 'mercadopago';

export interface PaymentGatewayFactoryOptions {
  provider?: PaymentGatewayProvider;
  mercadoPagoConfig?: MercadoPagoConfig;
}

export class PaymentGatewayFactory {
  /**
   * Resolves the PaymentGateway instance based on environment configuration.
   * Default for MVP development & validation mode is 'fake' (FakePaymentGateway).
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

    if (provider === 'fake') {
      if (!isMockValidationPaymentAllowed()) {
        throw new Error('FAKE_GATEWAY_UNAVAILABLE_IN_PRODUCTION: O gateway de pagamento simulado está bloqueado em produção a menos que VITE_PAYMENT_MODE=MOCK_VALIDATION esteja explicitamente configurado.');
      }
      return new FakePaymentGateway();
    }

    if (provider === 'mercadopago') {
      throw new Error('REAL_PAYMENT_GATEWAY_NOT_ENABLED: O gateway de pagamento real Mercado Pago está desabilitado na fase de validação do MVP.');
    }

    return new FakePaymentGateway();
  }
}

/**
 * Global singleton PaymentGateway resolver for the MAZZI platform
 */
export const defaultPaymentGateway: PaymentGateway = PaymentGatewayFactory.createGateway();
