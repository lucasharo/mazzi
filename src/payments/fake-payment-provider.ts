import type { Checkout, CreateCheckoutInput, PaymentEvent, PaymentProvider } from "./payment-provider";

const assertDevelopment = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FakePaymentProvider não pode ser usado em produção.");
  }
};

export class FakePaymentProvider implements PaymentProvider {
  async createCheckout(input: CreateCheckoutInput): Promise<Checkout> {
    assertDevelopment();

    return {
      providerPaymentId: `fake_${input.idempotencyKey}`,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      instructions: `Pagamento ${input.method} simulado para a reserva ${input.bookingId}.`,
    };
  }

  async parseWebhook(payload: unknown): Promise<PaymentEvent> {
    assertDevelopment();
    const event = payload as Partial<PaymentEvent>;

    if (!event.providerPaymentId || !event.status) {
      throw new Error("Evento fake inválido.");
    }

    return {
      providerPaymentId: event.providerPaymentId,
      status: event.status,
      occurredAt: event.occurredAt ? new Date(event.occurredAt) : new Date(),
    };
  }

  async refund(): Promise<void> {
    assertDevelopment();
  }
}
