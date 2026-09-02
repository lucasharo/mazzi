// ============================================================================
// MAZZI DOMAIN — DEVELOPMENT PAYMENT GATEWAY ADAPTER (MOCK / TESTS ONLY)
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
import { DEFAULT_HOLD_EXPIRATION_MINUTES } from '../booking';
import { PaymentGatewayType, Provider, MazziPaymentStatus } from '../../types';

export class DevelopmentPaymentGateway implements PaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'DEVELOPMENT_MOCK';

  private paymentsStore = new Map<string, PaymentGatewayDetails>();
  private refundsStore = new Map<string, RefundGatewayDetails>();

  async createPayment(request: CreatePaymentGatewayRequest): Promise<PaymentGatewayResult> {
    if (request.amountInCents <= 0) {
      throw new Error('Valor do pagamento deve ser estritamente positivo em centavos.');
    }

    const externalPaymentId = `dev_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let status: MazziPaymentStatus = 'PENDING';
    let pixQrCode: string | undefined;
    let pixQrCodeBase64: string | undefined;
    let cardLast4: string | undefined;
    let cardBrand: string | undefined;

    if (request.method === 'PIX') {
      status = 'PENDING';
      // Standard static PIX payload string structure simulation for testing
      pixQrCode = `00020126580014BR.GOV.BCB.PIX0136${externalPaymentId}520400005303986540${(request.amountInCents / 100).toFixed(2)}5802BR5913MAZZI BRASIL6009SAO PAULO62070503***6304ABCD`;
      pixQrCodeBase64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwMCIvPjwvc3ZnPg==';
    } else if (request.method === 'CREDIT_CARD') {
      // In development mock, card starts authorized / paid if valid token, or fails if invalid token
      if (request.gatewayToken === 'tok_invalid_card') {
        status = 'FAILED';
      } else {
        status = 'AUTHORIZED';
      }
      cardLast4 = '4242';
      cardBrand = 'mastercard';
    }

    const details: PaymentGatewayDetails = {
      externalPaymentId,
      gateway: this.gatewayType,
      status,
      amountInCents: request.amountInCents,
      paidAt: (status as string) === 'PAID' ? new Date().toISOString() : undefined,
    };
    this.paymentsStore.set(externalPaymentId, details);

    return {
      externalPaymentId,
      gateway: this.gatewayType,
      status,
      amountInCents: request.amountInCents,
      platformFeeInCents: request.platformFeeInCents,
      providerAmountInCents: request.providerAmountInCents,
      method: request.method,
      pixQrCode,
      pixQrCodeBase64,
      pixExpiresAt: request.expirationTimestampUtc || new Date(Date.now() + DEFAULT_HOLD_EXPIRATION_MINUTES * 60 * 1000).toISOString(),
      cardLast4,
      cardBrand,
    };
  }

  async getPayment(externalPaymentId: string): Promise<PaymentGatewayDetails> {
    const payment = this.paymentsStore.get(externalPaymentId);
    if (!payment) {
      throw new Error(`Pagamento ${externalPaymentId} não encontrado no gateway de desenvolvimento.`);
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

    if (request.amountInCents <= 0 || request.amountInCents > payment.amountInCents) {
      throw new Error('Valor de reembolso inválido.');
    }

    const externalRefundId = `dev_ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
    // In development mode, check for simulated test header or return true
    const secret = headers['x-mazzi-test-signature'] || headers['x-signature'];
    if (typeof secret === 'string' && (secret.includes('invalid') || secret.includes('tampered'))) {
      return false;
    }
    return true;
  }

  parseWebhookPayload(rawPayload: string | Buffer, _headers: Record<string, string | string[] | undefined>): ParsedWebhookEvent {
    const parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : JSON.parse(rawPayload.toString('utf-8'));
    return {
      externalEventId: parsed.id || `evt_dev_${Date.now()}`,
      eventType: parsed.type || parsed.action || 'payment.updated',
      gateway: this.gatewayType,
      externalPaymentId: parsed.data?.id || parsed.payment_id,
      mappedStatus: parsed.data?.status ? this.mapDevStatus(parsed.data.status) : undefined,
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
    const externalAccountId = `dev_acc_${provider.id}`;
    return {
      externalAccountId,
      onboardingUrl: `https://sandbox.mazzi.com.br/onboarding/dev/${externalAccountId}`,
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

  private mapDevStatus(status: string): MazziPaymentStatus {
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
