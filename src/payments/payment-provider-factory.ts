import { FakePaymentProvider } from "./fake-payment-provider";
import type { PaymentProvider } from "./payment-provider";

export const getPaymentProvider = (): PaymentProvider => {
  const provider = process.env.PAYMENT_PROVIDER ?? "fake";

  if (provider === "fake") return new FakePaymentProvider();

  if (provider === "mercado-pago") {
    throw new Error("MercadoPagoPaymentProvider ainda não foi configurado.");
  }

  throw new Error(`Provedor de pagamento não suportado: ${provider}`);
};
