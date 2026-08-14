export type PaymentMethod = "PIX" | "CARD";

export type CreateCheckoutInput = {
  bookingId: string;
  amountCents: number;
  method: PaymentMethod;
  idempotencyKey: string;
};

export type Checkout = {
  providerPaymentId: string;
  status: "PENDING" | "APPROVED" | "FAILED";
  expiresAt: Date;
  instructions: string;
};

export type PaymentEvent = {
  providerPaymentId: string;
  status: "APPROVED" | "FAILED" | "REFUNDED";
  occurredAt: Date;
};

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<Checkout>;
  parseWebhook(payload: unknown, signature?: string): Promise<PaymentEvent>;
  refund(providerPaymentId: string, amountCents?: number): Promise<void>;
}
