// ============================================================================
// MAZZI DOMAIN — FAKE PAYMENT GATEWAY ADAPTER (MVP / DEVELOPMENT MODE)
// ============================================================================

import {
  PaymentGateway,
  CreatePaymentGatewayRequest,
  PaymentGatewayResult,
  PaymentGatewayDetails,
  PaymentGatewayCancelResult,
  RefundGatewayRequest,
  RefundGatewayResult,
  RefundGatewayDetails,
  ParsedWebhookEvent,
  ConnectedAccountStatusResult,
  LinkAccountResult,
  SettlementStatusResult,
} from './gateway-interface';
import { PaymentGatewayType, Provider, MazziPaymentStatus } from '../../types';

/**
 * FakePaymentGateway for MAZZI MVP Development Environment.
 * Explicitly identified as simulated/development gateway.
 * DOES NOT process real financial transactions, real PIX, or real cards.
 */
export class FakePaymentGateway implements PaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'DEVELOPMENT_MOCK';

  private paymentsStore = new Map<string, PaymentGatewayDetails>();
  private idempotencyStore = new Map<string, PaymentGatewayResult>();
  private refundsStore = new Map<string, RefundGatewayDetails>();

  async createPayment(request: CreatePaymentGatewayRequest): Promise<PaymentGatewayResult> {
    if (process.env.NODE_ENV === 'production' && (request.idempotencyKey?.includes('fake-') || request.gatewayToken?.includes('fake_'))) {
      throw new Error('FAKE_GATEWAY_UNAVAILABLE_IN_PRODUCTION: Ações de simulação de pagamento estão estritamente bloqueadas em ambiente de produção.');
    }

    if (request.amountInCents <= 0) {
      throw new Error('Valor do pagamento deve ser estritamente positivo em centavos.');
    }

    // Idempotency check
    if (request.idempotencyKey && this.idempotencyStore.has(request.idempotencyKey)) {
      return this.idempotencyStore.get(request.idempotencyKey)!;
    }

    // Deterministic Error Triggers for Testing
    if (request.idempotencyKey?.includes('fake-error')) {
      throw new Error('SIMULATED_GATEWAY_ERROR: Erro simulado no gateway de desenvolvimento.');
    }

    const externalPaymentId = `fake_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let status: MazziPaymentStatus = 'PENDING';
    let pixQrCode: string | undefined;
    let pixQrCodeBase64: string | undefined;
    let cardLast4: string | undefined;
    let cardBrand: string | undefined;

    // Determine status from test triggers
    if (request.idempotencyKey?.includes('fake-declined') || request.gatewayToken === 'tok_fake_declined' || request.gatewayToken === 'tok_invalid_card') {
      status = 'FAILED';
    } else if (request.idempotencyKey?.includes('fake-approved') || request.gatewayToken === 'tok_fake_approved') {
      status = 'PAID';
    } else if (request.method === 'PIX') {
      status = 'PENDING';
      // Fake PIX payload clearly identified as simulated/development
      pixQrCode = `FAKE_PIX_SIMULATED_PAYMENT_ENV_DEVELOPMENT_${externalPaymentId}`;
      pixQrCodeBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwMCIvPjwvc3ZnPg==';
    } else if (request.method === 'CREDIT_CARD') {
      status = 'AUTHORIZED';
      cardLast4 = '4242';
      cardBrand = 'mastercard';
    }

    const details: PaymentGatewayDetails = {
      externalPaymentId,
      gateway: this.gatewayType,
      status,
      amountInCents: request.amountInCents,
      paidAt: status === 'PAID' ? new Date().toISOString() : undefined,
    };
    this.paymentsStore.set(externalPaymentId, details);

    const result: PaymentGatewayResult = {
      externalPaymentId,
      gateway: this.gatewayType,
      status,
      amountInCents: request.amountInCents,
      platformFeeInCents: request.platformFeeInCents,
      providerAmountInCents: request.providerAmountInCents,
      method: request.method,
      pixQrCode,
      pixQrCodeBase64,
      pixExpiresAt: request.expirationTimestampUtc || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      cardLast4,
      cardBrand,
      rawGatewayResponse: {
        environment: 'DEVELOPMENT_FAKE_GATEWAY',
        simulated: true,
      },
    };

    if (request.idempotencyKey) {
      this.idempotencyStore.set(request.idempotencyKey, result);
    }

    return result;
  }

  async getPayment(externalPaymentId: string): Promise<PaymentGatewayDetails> {
    const payment = this.paymentsStore.get(externalPaymentId);
    if (!payment) {
      throw new Error(`Pagamento ${externalPaymentId} não encontrado no Fake Payment Gateway.`);
    }
    return payment;
  }

  async cancelPayment(externalPaymentId: string): Promise<PaymentGatewayCancelResult> {
    const payment = this.paymentsStore.get(externalPaymentId);
    if (payment) {
      payment.status = 'CANCELLED';
      this.paymentsStore.set(externalPaymentId, payment);
    }
    return {
      externalPaymentId,
      cancelled: true,
      status: 'CANCELLED',
    };
  }

  async refundPayment(request: RefundGatewayRequest): Promise<RefundGatewayResult> {
    let payment = this.paymentsStore.get(request.externalPaymentId);
    if (!payment) {
      payment = {
        externalPaymentId: request.externalPaymentId,
        gateway: this.gatewayType,
        amountInCents: request.amountInCents,
        status: 'PAID',
      };
      this.paymentsStore.set(request.externalPaymentId, payment);
    }

    if (request.reason?.includes('fake-refund-error')) {
      return {
        externalRefundId: `fake_ref_err_${Date.now()}`,
        externalPaymentId: request.externalPaymentId,
        amountInCents: request.amountInCents,
        status: 'FAILED',
        createdAt: new Date().toISOString(),
      };
    }

    if (request.amountInCents <= 0 || request.amountInCents > payment.amountInCents) {
      throw new Error('Valor de reembolso inválido.');
    }

    const externalRefundId = `fake_ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const refundDetails: RefundGatewayDetails = {
      externalRefundId,
      externalPaymentId: request.externalPaymentId,
      amountInCents: request.amountInCents,
      status: 'PROCESSED',
    };
    this.refundsStore.set(externalRefundId, refundDetails);

    if (request.amountInCents === payment.amountInCents) {
      payment.status = 'REFUNDED';
    } else {
      payment.status = 'PARTIALLY_REFUNDED';
    }

    return {
      externalRefundId,
      externalPaymentId: request.externalPaymentId,
      amountInCents: request.amountInCents,
      status: 'PROCESSED',
      createdAt: new Date().toISOString(),
    };
  }

  async getRefund(externalRefundId: string): Promise<RefundGatewayDetails> {
    const refund = this.refundsStore.get(externalRefundId);
    if (!refund) {
      throw new Error(`Reembolso ${externalRefundId} não encontrado.`);
    }
    return refund;
  }

  verifyWebhookSignature(_rawPayload: string | Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const secret = headers['x-mazzi-test-signature'] || headers['x-signature'];
    if (typeof secret === 'string' && (secret.includes('invalid') || secret.includes('tampered'))) {
      return false;
    }
    return true;
  }

  parseWebhookPayload(rawPayload: string | Buffer, _headers: Record<string, string | string[] | undefined>): ParsedWebhookEvent {
    const parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : JSON.parse(rawPayload.toString('utf-8'));
    return {
      externalEventId: parsed.id || `evt_fake_${Date.now()}`,
      eventType: parsed.type || parsed.action || 'FAKE_GATEWAY_EVENT',
      gateway: this.gatewayType,
      externalPaymentId: parsed.data?.id || parsed.payment_id,
      mappedStatus: parsed.data?.status ? this.mapFakeStatus(parsed.data.status) : undefined,
      amountInCents: parsed.data?.transaction_amount ? Math.round(parsed.data.transaction_amount * 100) : undefined,
      paidAt: parsed.data?.date_approved || parsed.date_created,
      rawPayload: parsed,
    };
  }

  async getConnectedAccountStatus(externalAccountId: string): Promise<ConnectedAccountStatusResult> {
    return {
      externalAccountId,
      status: 'ACTIVE',
      chargesEnabled: true,
      payoutsEnabled: true,
    };
  }

  async createOrLinkProviderAccount(provider: Provider): Promise<LinkAccountResult> {
    const externalAccountId = `fake_acc_${provider.id}`;
    return {
      externalAccountId,
      onboardingUrl: `https://fake.mazzi.com.br/onboarding/dev/${externalAccountId}`,
      status: 'ACTIVE',
    };
  }

  async getSettlementStatus(externalAccountId: string): Promise<SettlementStatusResult> {
    return {
      externalAccountId,
      availableBalanceInCents: 18050,
      pendingBalanceInCents: 9000,
      currency: 'BRL',
    };
  }

  /**
   * Helper method to simulate webhook transitions in development/tests
   */
  simulatePaymentStatusChange(externalPaymentId: string, newStatus: MazziPaymentStatus): PaymentGatewayDetails {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FAKE_GATEWAY_UNAVAILABLE_IN_PRODUCTION: Ações de alteração de estado simulado do Fake Gateway estão bloqueadas em produção.');
    }

    const payment = this.paymentsStore.get(externalPaymentId);
    if (!payment) {
      throw new Error(`Pagamento simulado ${externalPaymentId} não encontrado.`);
    }
    payment.status = newStatus;
    if (newStatus === 'PAID') {
      payment.paidAt = new Date().toISOString();
    }
    this.paymentsStore.set(externalPaymentId, payment);
    return payment;
  }

  private mapFakeStatus(status: string): MazziPaymentStatus {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'paid':
        return 'PAID';
      case 'authorized':
        return 'AUTHORIZED';
      case 'in_process':
      case 'pending':
        return 'PENDING';
      case 'rejected':
      case 'failed':
        return 'FAILED';
      case 'cancelled':
        return 'CANCELLED';
      case 'refunded':
        return 'REFUNDED';
      case 'charged_back':
        return 'CHARGEBACK';
      default:
        return 'PENDING';
    }
  }
}
