import { afterEach, describe, expect, it } from "vitest";
import { FakePaymentProvider } from "./fake-payment-provider";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

describe("FakePaymentProvider", () => {
  it("cria checkout simulado em desenvolvimento", async () => {
    process.env.NODE_ENV = "development";
    const provider = new FakePaymentProvider();

    const checkout = await provider.createCheckout({
      bookingId: "booking-1",
      amountCents: 10000,
      method: "PIX",
      idempotencyKey: "idempotency-1",
    });

    expect(checkout.providerPaymentId).toBe("fake_idempotency-1");
    expect(checkout.status).toBe("PENDING");
  });

  it("bloqueia uso em produção", async () => {
    process.env.NODE_ENV = "production";
    const provider = new FakePaymentProvider();

    await expect(
      provider.createCheckout({
        bookingId: "booking-1",
        amountCents: 10000,
        method: "CARD",
        idempotencyKey: "idempotency-2",
      }),
    ).rejects.toThrow("não pode ser usado em produção");
  });
});
