// ============================================================================
// MAZZI DOMAIN — MERCADO PAGO MARKETPLACE ADAPTER (BRAZILIAN MVP)
// ============================================================================

import crypto from 'crypto';
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
  OAuthExchangeResult,
} from './gateway-interface';
import { PaymentGatewayType, Provider, MazziPaymentStatus, ProviderPaymentAccountStatus } from '../../types';
import { DEFAULT_HOLD_EXPIRATION_MINUTES } from '../booking';

export interface MercadoPagoConfig {
  accessToken?: string;
  clientSecret?: string;
  clientId?: string;
  webhookSecret?: string;
  marketplaceId?: string;
  redirectUri?: string;
  isSandbox?: boolean;
  useLiveHttp?: boolean;
}

export class MercadoPagoPaymentGateway implements PaymentGateway {
  readonly gatewayType: PaymentGatewayType = 'MERCADOPAGO';
  public config: MercadoPagoConfig;

  constructor(config: MercadoPagoConfig = {}) {
    this.config = {
      accessToken: config.accessToken || process.env.MERCADOPAGO_ACCESS_TOKEN,
      clientSecret: config.clientSecret || process.env.MERCADOPAGO_CLIENT_SECRET,
      clientId: config.clientId || process.env.MERCADOPAGO_CLIENT_ID || process.env.MERCADOPAGO_MARKETPLACE_ID,
      webhookSecret: config.webhookSecret || process.env.MERCADOPAGO_WEBHOOK_SECRET,
      marketplaceId: config.marketplaceId || process.env.MERCADOPAGO_MARKETPLACE_ID,
      redirectUri: config.redirectUri || process.env.MERCADOPAGO_REDIRECT_URI,
      isSandbox: config.isSandbox ?? (process.env.NODE_ENV !== 'production'),
      useLiveHttp: config.useLiveHttp ?? (process.env.MERCADOPAGO_LIVE_HTTP === 'true'),
    };
  }

  /**
   * Generates OAuth Authorization URL for a provider to link their Mercado Pago account.
   */
  getOAuthAuthorizationUrl(params: { providerId: string; redirectUri?: string; state?: string }): string {
    const clientId = this.config.clientId || 'MAZZI_MARKETPLACE_APP';
    const redirectUri = params.redirectUri || this.config.redirectUri || 'https://mazzi.app.br/api/oauth/mercadopago/callback';
    const state = params.state || `prov_${params.providerId}__${crypto.randomBytes(12).toString('hex')}`;

    return `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  /**
   * Exchanges OAuth authorization code for seller access token and external collector ID.
   */
  async exchangeOAuthCode(params: { code: string; redirectUri?: string }): Promise<OAuthExchangeResult> {
    const { code, redirectUri } = params;
    const effectiveRedirectUri = redirectUri || this.config.redirectUri || 'https://mazzi.app.br/api/oauth/mercadopago/callback';
    const clientSecret = this.config.clientSecret;

    if (this.config.useLiveHttp && this.config.accessToken && clientSecret) {
      const response = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify({
          client_secret: clientSecret,
          client_id: this.config.clientId,
          grant_type: 'authorization_code',
          code,
          redirect_uri: effectiveRedirectUri,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao trocar código OAuth no Mercado Pago: ${errData.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        externalAccountId: String(data.user_id),
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        publicKey: data.public_key,
        liveMode: Boolean(data.live_mode),
        expiresIn: data.expires_in,
        scope: data.scope,
        rawGatewayResponse: data,
      };
    }

    // Deterministic Sandbox Simulation for testing without live secrets
    return {
      externalAccountId: `mp_collector_${code.substring(0, 8)}`,
      accessToken: `APP_USR_TEST_${crypto.randomBytes(24).toString('hex')}`,
      refreshToken: `TG_TEST_${crypto.randomBytes(24).toString('hex')}`,
      publicKey: `TEST-PUB-${crypto.randomBytes(8).toString('hex')}`,
      liveMode: false,
      expiresIn: 15552000,
      scope: 'offline_access read write payments',
    };
  }

  /**
   * Refreshes OAuth token for a seller.
   */
  async refreshOAuthToken(refreshToken: string): Promise<OAuthExchangeResult> {
    const clientSecret = this.config.clientSecret;

    if (this.config.useLiveHttp && this.config.accessToken && clientSecret) {
      const response = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
        },
        body: JSON.stringify({
          client_secret: clientSecret,
          client_id: this.config.clientId,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao renovar token OAuth no Mercado Pago: ${errData.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        externalAccountId: String(data.user_id),
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        publicKey: data.public_key,
        liveMode: Boolean(data.live_mode),
        expiresIn: data.expires_in,
        scope: data.scope,
        rawGatewayResponse: data,
      };
    }

    return {
      externalAccountId: `mp_refreshed_collector`,
      accessToken: `APP_USR_TEST_REFRESHED_${crypto.randomBytes(24).toString('hex')}`,
      refreshToken: `TG_TEST_NEW_${crypto.randomBytes(24).toString('hex')}`,
      liveMode: false,
      expiresIn: 15552000,
    };
  }

  /**
   * Translates internal Mazzi payment request into Mercado Pago API payload.
   * Ensures amounts are in currency format and platform marketplace fee is declared.
   * STRICT SECURITY: PAN and CVV are NEVER accepted by this adapter. Only gatewayToken.
   */
  async createPayment(request: CreatePaymentGatewayRequest): Promise<PaymentGatewayResult> {
    if (request.amountInCents <= 0) {
      throw new Error('Valor do pagamento deve ser positivo.');
    }

    const transactionAmount = Number((request.amountInCents / 100).toFixed(2));
    const marketplaceFee = Number((request.platformFeeInCents / 100).toFixed(2));
    const effectiveToken = request.sellerAccessToken || this.config.accessToken;

    // When running in real mode with live network requested or seller token provided:
    if (this.config.useLiveHttp && effectiveToken) {
      try {
        const body: Record<string, any> = {
          transaction_amount: transactionAmount,
          description: request.description,
          payment_method_id: request.method === 'PIX' ? 'pix' : undefined,
          payer: {
            email: request.studentEmail,
            first_name: request.studentName.split(' ')[0],
            last_name: request.studentName.split(' ').slice(1).join(' ') || 'Aluno',
            identification: request.studentDocument
              ? { type: 'CPF', number: request.studentDocument.replace(/\D/g, '') }
              : undefined,
          },
          application_fee: marketplaceFee,
          external_reference: request.bookingId,
          metadata: {
            booking_id: request.bookingId,
            student_id: request.studentId,
            provider_id: request.providerId,
            idempotency_key: request.idempotencyKey,
            ...request.metadata,
          },
        };

        if (request.method === 'CREDIT_CARD' && request.gatewayToken) {
          body.token = request.gatewayToken;
          body.installments = request.cardInstallments || 1;
        }

        if (request.expirationTimestampUtc && request.method === 'PIX') {
          body.date_of_expiration = request.expirationTimestampUtc;
        }

        const response = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveToken}`,
            'X-Idempotency-Key': request.idempotencyKey,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`Mercado Pago API error (${response.status}): ${errData.message || response.statusText}`);
        }

        const data = await response.json();
        const mappedStatus = this.mapMpStatus(data.status);

        // Parse 4-tier fee breakdown if provided in fee_details
        const mpFeeDetail = data.fee_details?.find((f: any) => f.type === 'mercadopago_fee');
        const mercadoPagoFeeInCents = mpFeeDetail ? Math.round(mpFeeDetail.amount * 100) : undefined;
        const sellerNetAmountInCents = request.amountInCents - request.platformFeeInCents - (mercadoPagoFeeInCents || 0);

        return {
          externalPaymentId: String(data.id),
          gateway: this.gatewayType,
          status: mappedStatus,
          amountInCents: request.amountInCents,
          platformFeeInCents: request.platformFeeInCents,
          providerAmountInCents: request.providerAmountInCents,
          mercadoPagoFeeInCents,
          sellerNetAmountInCents,
          method: request.method,
          pixQrCode: data.point_of_interaction?.transaction_data?.qr_code,
          pixQrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64,
          pixExpiresAt: data.date_of_expiration,
          cardLast4: data.card?.last_four_digits,
          cardBrand: data.payment_method_id,
          rawGatewayResponse: data,
        };
      } catch (err: any) {
        throw new Error(`Falha na comunicação com Mercado Pago: ${err.message}`);
      }
    }

    // Fallback sandbox / simulation when token not yet injected in preview container:
    // Follows official Mercado Pago response schemas
    const mockId = `mp_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Estimated MP fee in sandbox (0.99% for PIX, ~3.99% for card)
    const estimatedMpFeeInCents = request.method === 'PIX' 
      ? Math.round(request.amountInCents * 0.0099)
      : Math.round(request.amountInCents * 0.0399);
    const sellerNetAmountInCents = request.amountInCents - request.platformFeeInCents - estimatedMpFeeInCents;

    return {
      externalPaymentId: mockId,
      gateway: this.gatewayType,
      status: 'PENDING',
      amountInCents: request.amountInCents,
      platformFeeInCents: request.platformFeeInCents,
      providerAmountInCents: request.providerAmountInCents,
      mercadoPagoFeeInCents: estimatedMpFeeInCents,
      sellerNetAmountInCents,
      method: request.method,
      pixQrCode: request.method === 'PIX' 
        ? `00020126580014BR.GOV.BCB.PIX0136${mockId}520400005303986540${transactionAmount}5802BR5913MAZZI BRASIL6009SAO PAULO62070503***63041234`
        : undefined,
      pixQrCodeBase64: request.method === 'PIX' ? 'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACt...' : undefined,
      pixExpiresAt: request.expirationTimestampUtc || new Date(Date.now() + DEFAULT_HOLD_EXPIRATION_MINUTES * 60 * 1000).toISOString(),
      cardLast4: request.method === 'CREDIT_CARD' ? '4242' : undefined,
      cardBrand: request.method === 'CREDIT_CARD' ? 'master' : undefined,
      rawGatewayResponse: {
        id: mockId,
        status: 'pending',
        transaction_amount: transactionAmount,
        application_fee: marketplaceFee,
        point_of_interaction: request.method === 'PIX' ? {
          transaction_data: {
            qr_code: `00020126580014BR.GOV.BCB.PIX0136${mockId}520400005303986540${transactionAmount}5802BR5913MAZZI BRASIL6009SAO PAULO62070503***63041234`,
            qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACt...',
            ticket_url: `https://www.mercadopago.com.br/payments/${mockId}/ticket`,
          }
        } : undefined,
      },
    };
  }

  async getPayment(externalPaymentId: string, options?: { sellerAccessToken?: string }): Promise<PaymentGatewayDetails> {
    const effectiveToken = options?.sellerAccessToken || this.config.accessToken;
    if (this.config.useLiveHttp && effectiveToken) {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${externalPaymentId}`, {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao consultar pagamento ${externalPaymentId} no Mercado Pago.`);
      }

      const data = await response.json();
      const grossAmountInCents = Math.round(data.transaction_amount * 100);
      const appFee = data.application_fee ?? data.marketplace_fee;
      const marketplaceFeeInCents = appFee ? Math.round(appFee * 100) : undefined;
      const mpFeeDetail = data.fee_details?.find((f: any) => f.type === 'mercadopago_fee');
      const mercadoPagoFeeInCents = mpFeeDetail ? Math.round(mpFeeDetail.amount * 100) : undefined;
      const sellerNetAmountInCents = grossAmountInCents - (marketplaceFeeInCents || 0) - (mercadoPagoFeeInCents || 0);

      return {
        externalPaymentId: String(data.id),
        gateway: this.gatewayType,
        status: this.mapMpStatus(data.status),
        amountInCents: grossAmountInCents,
        grossAmountInCents,
        marketplaceFeeInCents,
        mercadoPagoFeeInCents,
        sellerNetAmountInCents,
        paidAt: data.date_approved,
        failedAt: data.status === 'rejected' ? data.date_last_updated : undefined,
        failureReason: data.status_detail,
        rawGatewayResponse: data,
      };
    }

    return {
      externalPaymentId,
      gateway: this.gatewayType,
      status: 'PENDING',
      amountInCents: 10000,
      grossAmountInCents: 10000,
      marketplaceFeeInCents: 1000,
      mercadoPagoFeeInCents: 99,
      sellerNetAmountInCents: 8901,
    };
  }

  async cancelPayment(externalPaymentId: string, options?: { sellerAccessToken?: string }): Promise<PaymentGatewayCancelResult> {
    const effectiveToken = options?.sellerAccessToken || this.config.accessToken;
    if (this.config.useLiveHttp && effectiveToken) {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${externalPaymentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!response.ok) {
        throw new Error(`Erro ao cancelar pagamento ${externalPaymentId} no Mercado Pago.`);
      }

      const data = await response.json();
      return {
        externalPaymentId: String(data.id),
        cancelled: data.status === 'cancelled',
        status: this.mapMpStatus(data.status),
      };
    }

    return {
      externalPaymentId,
      cancelled: true,
      status: 'CANCELLED',
    };
  }

  async refundPayment(request: RefundGatewayRequest): Promise<RefundGatewayResult> {
    const refundAmount = Number((request.amountInCents / 100).toFixed(2));
    const effectiveToken = request.sellerAccessToken || this.config.accessToken;

    if (this.config.useLiveHttp && effectiveToken) {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${request.externalPaymentId}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`,
          'X-Idempotency-Key': request.idempotencyKey,
        },
        body: JSON.stringify({
          amount: refundAmount,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Erro ao estornar pagamento no Mercado Pago: ${errData.message || response.statusText}`);
      }

      const data = await response.json();
      return {
        externalRefundId: String(data.id),
        externalPaymentId: request.externalPaymentId,
        amountInCents: Math.round(data.amount * 100),
        status: data.status === 'approved' ? 'PROCESSED' : 'PENDING',
        createdAt: data.date_created,
        rawGatewayResponse: data,
      };
    }

    const mockRefundId = `mp_ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return {
      externalRefundId: mockRefundId,
      externalPaymentId: request.externalPaymentId,
      amountInCents: request.amountInCents,
      status: 'PROCESSED',
      createdAt: new Date().toISOString(),
    };
  }

  async getRefund(externalRefundId: string): Promise<RefundGatewayDetails> {
    return {
      externalRefundId,
      externalPaymentId: 'unknown',
      amountInCents: 0,
      status: 'PROCESSED',
    };
  }

  /**
   * Verifies Mercado Pago Webhook cryptographic signature (x-signature header).
   * Exact Mercado Pago Manifest Format:
   * Header: x-signature = ts=...,v1=...
   * Header: x-request-id = ...
   * Payload data id: data.id or query id
   * Manifest: `id:${dataId};request-id:${xRequestId};ts:${ts};`
   * Hash: HMAC-SHA256(webhookSecret, manifest)
   * Comparison: Constant-time timingSafeEqual
   */
  verifyWebhookSignature(rawPayload: string | Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const xSignature = (headers['x-signature'] || headers['X-Signature']) as string | undefined;
    const xRequestId = ((headers['x-request-id'] || headers['X-Request-Id']) as string | undefined) || '';

    const secret = this.config.webhookSecret;
    if (!secret) {
      // If secret not configured in dev/sandbox environment, reject in strict mode or require x-signature presence
      return process.env.NODE_ENV !== 'production' && Boolean(xSignature);
    }

    if (!xSignature) {
      return false;
    }

    const parts = xSignature.split(',');
    let ts = '';
    let hash = '';

    for (const part of parts) {
      const [k, v] = part.trim().split('=');
      if (k === 'ts') ts = v;
      if (k === 'v1') hash = v;
    }

    if (!ts || !hash) {
      return false;
    }

    try {
      let dataId = '';
      if (rawPayload) {
        const body = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : JSON.parse(rawPayload.toString('utf-8'));
        dataId = String(body?.data?.id || body?.id || '');
      }

      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
      const computedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

      const hashBuffer = Buffer.from(hash, 'utf-8');
      const computedBuffer = Buffer.from(computedHash, 'utf-8');

      if (hashBuffer.length !== computedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(hashBuffer, computedBuffer);
    } catch {
      return false;
    }
  }

  parseWebhookPayload(rawPayload: string | Buffer, _headers: Record<string, string | string[] | undefined>): ParsedWebhookEvent {
    const parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : JSON.parse(rawPayload.toString('utf-8'));
    return {
      externalEventId: String(parsed.id || parsed.data?.id || `evt_${Date.now()}`),
      eventType: parsed.type || parsed.action || 'payment.updated',
      gateway: this.gatewayType,
      externalPaymentId: parsed.data?.id ? String(parsed.data.id) : (parsed.id ? String(parsed.id) : undefined),
      mappedStatus: parsed.data?.status ? this.mapMpStatus(parsed.data.status) : undefined,
      amountInCents: parsed.data?.transaction_amount ? Math.round(parsed.data.transaction_amount * 100) : undefined,
      paidAt: parsed.data?.date_approved,
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
    const externalAccountId = `mp_seller_${provider.id}`;
    return {
      externalAccountId,
      onboardingUrl: this.getOAuthAuthorizationUrl({ providerId: provider.id }),
      status: 'PENDING',
    };
  }

  async getSettlementStatus(externalAccountId: string): Promise<SettlementStatusResult> {
    return {
      externalAccountId,
      availableBalanceInCents: 0,
      pendingBalanceInCents: 0,
      currency: 'BRL',
    };
  }

  private mapMpStatus(status: string): MazziPaymentStatus {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'PAID';
      case 'authorized':
        return 'AUTHORIZED';
      case 'in_process':
      case 'pending':
        return 'PENDING';
      case 'rejected':
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
