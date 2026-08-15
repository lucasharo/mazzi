// ============================================================================
// MAZZI DOMAIN — PAYMENT GATEWAY INTERFACE & CONTRACTS (SPRINT 09)
// ============================================================================

import {
  PaymentMethodType,
  MazziPaymentStatus,
  ProviderPaymentAccountStatus,
  PaymentGatewayType,
  Provider,
} from '../../types';

export interface CreatePaymentGatewayRequest {
  idempotencyKey: string;
  bookingId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentDocument?: string; // CPF
  providerId: string;
  providerExternalAccountId?: string;
  sellerAccessToken?: string; // OAuth Access Token of the connected seller for Split 1:1
  amountInCents: number; // Total amount paid by student
  platformFeeInCents: number; // MAZZI Marketplace commission (application_fee)
  providerAmountInCents: number; // Net amount routed to instructor/CFC
  method: PaymentMethodType;
  description: string;
  gatewayToken?: string; // Card token or card payment method ID (NEVER PAN/CVV)
  cardHolderName?: string;
  cardInstallments?: number;
  expirationTimestampUtc?: string; // For PIX expiration, bound to booking.holdExpiresAt
  metadata?: Record<string, any>;
}

export interface PaymentGatewayResult {
  externalPaymentId: string;
  gateway: PaymentGatewayType;
  status: MazziPaymentStatus;
  amountInCents: number;
  platformFeeInCents: number;
  providerAmountInCents: number;
  mercadoPagoFeeInCents?: number;
  sellerNetAmountInCents?: number;
  method: PaymentMethodType;
  pixQrCode?: string; // Copia e Cola
  pixQrCodeBase64?: string; // Base64 image
  pixExpiresAt?: string;
  cardLast4?: string;
  cardBrand?: string;
  rawGatewayResponse?: Record<string, any>;
}

export interface PaymentGatewayDetails {
  externalPaymentId: string;
  gateway: PaymentGatewayType;
  status: MazziPaymentStatus;
  amountInCents: number;
  grossAmountInCents?: number;
  marketplaceFeeInCents?: number;
  mercadoPagoFeeInCents?: number;
  sellerNetAmountInCents?: number;
  paidAt?: string;
  failedAt?: string;
  failureReason?: string;
  rawGatewayResponse?: Record<string, any>;
}

export interface PaymentGatewayCancelResult {
  externalPaymentId: string;
  cancelled: boolean;
  status: MazziPaymentStatus;
}

export interface RefundGatewayRequest {
  externalPaymentId: string;
  amountInCents: number; // Can be total or partial
  reason: string;
  idempotencyKey: string;
  sellerAccessToken?: string; // OAuth Access Token of seller for Split 1:1 refund
}

export interface RefundGatewayResult {
  externalRefundId: string;
  externalPaymentId: string;
  amountInCents: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  createdAt: string;
  rawGatewayResponse?: Record<string, any>;
}

export interface RefundGatewayDetails {
  externalRefundId: string;
  externalPaymentId: string;
  amountInCents: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
}

export interface ParsedWebhookEvent {
  externalEventId: string;
  eventType: string; // e.g. "payment.updated", "payment.created", "charge.refunded"
  gateway: PaymentGatewayType;
  externalPaymentId?: string;
  mappedStatus?: MazziPaymentStatus;
  amountInCents?: number;
  paidAt?: string;
  failureReason?: string;
  rawPayload: Record<string, any>;
}

export interface ConnectedAccountStatusResult {
  externalAccountId: string;
  status: ProviderPaymentAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingUrl?: string;
  requirements?: string[];
  rawGatewayResponse?: Record<string, any>;
}

export interface LinkAccountResult {
  externalAccountId: string;
  onboardingUrl?: string;
  status: ProviderPaymentAccountStatus;
}

export interface OAuthExchangeResult {
  externalAccountId: string;
  accessToken: string;
  refreshToken?: string;
  publicKey?: string;
  liveMode: boolean;
  expiresIn?: number;
  scope?: string;
  rawGatewayResponse?: Record<string, any>;
}

export interface SettlementStatusResult {
  externalAccountId: string;
  availableBalanceInCents: number;
  pendingBalanceInCents: number;
  currency: string;
}

export interface PaymentGateway {
  readonly gatewayType: PaymentGatewayType;

  /**
   * Creates a payment order/charge in the payment gateway.
   */
  createPayment(request: CreatePaymentGatewayRequest): Promise<PaymentGatewayResult>;

  /**
   * Retrieves payment status from gateway by external payment ID.
   */
  getPayment(externalPaymentId: string, options?: { sellerAccessToken?: string }): Promise<PaymentGatewayDetails>;

  /**
   * Cancels a pending charge/PIX before payment.
   */
  cancelPayment(externalPaymentId: string): Promise<PaymentGatewayCancelResult>;

  /**
   * Requests a total or partial refund for a captured payment.
   */
  refundPayment(request: RefundGatewayRequest): Promise<RefundGatewayResult>;

  /**
   * Gets details of a specific refund.
   */
  getRefund(externalRefundId: string): Promise<RefundGatewayDetails>;

  /**
   * Cryptographically verifies the authenticity and integrity of an incoming webhook.
   */
  verifyWebhookSignature(rawPayload: string | Buffer, headers: Record<string, string | string[] | undefined>): boolean;

  /**
   * Parses the raw webhook payload into standard Mazzi event structure.
   */
  parseWebhookPayload(rawPayload: string | Buffer, headers: Record<string, string | string[] | undefined>): ParsedWebhookEvent;

  /**
   * Gets status of a connected provider seller account.
   */
  getConnectedAccountStatus(externalAccountId: string): Promise<ConnectedAccountStatusResult>;

  /**
   * Initiates onboarding or retrieves link for provider payout account.
   */
  createOrLinkProviderAccount(provider: Provider): Promise<LinkAccountResult>;

  /**
   * Queries balance and settlement status for an account.
   */
  getSettlementStatus(externalAccountId: string): Promise<SettlementStatusResult>;
}
