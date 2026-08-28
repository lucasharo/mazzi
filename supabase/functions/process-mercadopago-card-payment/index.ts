// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const decimalToCents = (value: unknown) => {
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(`${whole}${fraction.padEnd(2, '0')}`);
  return Number.isSafeInteger(cents) ? cents : null;
};
const gatewayFeeInCents = (result: any) => {
  const cents = (result?.fee_details || []).filter((item: any) => item?.type === 'mercadopago_fee')
    .reduce((total: number, item: any) => total + (decimalToCents(item.amount) || 0), 0);
  return cents > 0 ? cents : null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });
  if (Deno.env.get("MERCADOPAGO_ENVIRONMENT") !== "test") {
    return reply(503, { message: "O pagamento de teste não está habilitado neste ambiente." });
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
  if (!url || !publicKey || !serviceKey || !accessToken) {
    return reply(503, { message: "O pagamento de teste ainda não foi configurado." });
  }

  const session = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: authData, error: authError } = await session.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });

  let payload: Record<string, any>;
  try { payload = await request.json(); } catch { return reply(400, { message: "Dados de pagamento inválidos." }); }
  if (!isUuid(payload.paymentId) || typeof payload.token !== "string" || !payload.token ||
      typeof payload.paymentMethodId !== "string" || !payload.paymentMethodId || payload.installments !== 1) {
    return reply(400, { message: "Confira os dados do cartão e tente novamente." });
  }

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: payment, error: paymentError } = await service
    .from("payments")
    .select("id, booking_id, amount_in_cents, idempotency_key, status, external_transaction_id")
    .eq("id", payload.paymentId)
    .maybeSingle();
  if (paymentError) {
    console.error("MERCADOPAGO_PAYMENT_LOOKUP_FAILED", {
      code: paymentError.code,
      message: paymentError.message,
      details: paymentError.details,
    });
    return reply(500, { message: "Não foi possível consultar o pagamento. Tente novamente." });
  }
  if (!payment) return reply(404, { message: "Pagamento não encontrado." });
  if (payment.status === "PAID") {
    return reply(200, {
      approved: true,
      paymentId: payment.id,
      externalPaymentId: payment.external_transaction_id || undefined,
      alreadyPaid: true,
    });
  }
  if (payment.status === "FAILED") {
    return reply(409, {
      approved: false,
      paymentStatus: "FAILED",
      retryable: true,
      message: "Esta tentativa foi recusada. Gere uma nova tentativa de pagamento.",
    });
  }
  if (payment.status !== "PENDING" && payment.status !== "FAILED") {
    return reply(409, { message: "Este pagamento não pode ser processado agora." });
  }

  const { data: booking, error: bookingError } = await service
    .from("bookings")
    .select("id, student_id, status")
    .eq("id", payment.booking_id)
    .maybeSingle();
  if (bookingError) {
    console.error("MERCADOPAGO_BOOKING_LOOKUP_FAILED", {
      code: bookingError.code,
      message: bookingError.message,
      details: bookingError.details,
    });
    return reply(500, { message: "Não foi possível validar a reserva. Tente novamente." });
  }
  if (!booking || booking.status !== "PENDING_PAYMENT") {
    return reply(409, { message: "O prazo desta reserva terminou ou ela já foi processada." });
  }
  if (booking.student_id !== authData.user.id) return reply(403, { message: "Você não tem permissão para este pagamento." });

  const cents = Number(payment.amount_in_cents);
  if (!Number.isSafeInteger(cents) || cents <= 0) return reply(409, { message: "O valor deste pagamento é inválido." });
  const payerIdentification = payload.payer?.identification;
  const body = {
    transaction_amount: Number((cents / 100).toFixed(2)),
    token: payload.token,
    description: "Aula prática de direção MAZZI",
    installments: 1,
    payment_method_id: payload.paymentMethodId,
    issuer_id: payload.issuerId || undefined,
    capture: true,
    external_reference: booking.id,
    payer: {
      email: authData.user.email,
      identification: payerIdentification?.number ? {
        type: payerIdentification.type || "CPF",
        number: String(payerIdentification.number).replace(/\D/g, ""),
      } : undefined,
    },
    metadata: { booking_id: booking.id, payment_id: payment.id, environment: "test" },
  };

  let mpResponse: Response;
  try {
    mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": payment.idempotency_key || payment.id,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // A requisição pode ter chegado ao Mercado Pago mesmo com perda da resposta.
    // Mantém o pagamento PENDING e reutiliza esta chave na próxima tentativa.
    return reply(502, {
      approved: false,
      paymentStatus: "PENDING",
      retryable: true,
      message: "Não foi possível confirmar a resposta do Mercado Pago. Tente novamente.",
    });
  }

  const result = await mpResponse.json().catch(() => ({}));
  const isDefinitiveDecline = result.status === "rejected" || result.status === "cancelled";
  if (!isDefinitiveDecline) {
    // Não marca a tentativa como FAILED em HTTP 5xx, limite de requisições,
    // resposta inválida ou status intermediário. Qualquer um deles pode ocultar
    // uma cobrança aceita; por isso a mesma chave deve ser repetida com segurança.
    return reply(503, {
      approved: false,
      paymentStatus: "PENDING",
      retryable: true,
      message: "Não foi possível confirmar o pagamento. Tente novamente.",
    });
  }

  if (!mpResponse.ok || result.status !== "approved") {
    await service.from("payments").update({
      status: "FAILED",
      gateway_provider: "mercadopago_test",
      metadata: { mercado_pago_status: result.status || "rejected", mercado_pago_status_detail: result.status_detail || null },
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    return reply(402, {
      approved: false,
      paymentStatus: "FAILED",
      retryable: true,
      message: "Pagamento de teste recusado. Para simular uma aprovação, informe APRO como nome do titular e CPF 123.456.789-09.",
    });
  }

  const { error: methodUpdateError } = await service.from("payments").update({
    method: "CREDIT_CARD",
    gateway_provider: "mercadopago_test",
    gateway_fee_in_cents: gatewayFeeInCents(result),
    updated_at: new Date().toISOString(),
  }).eq("id", payment.id).eq("status", "PENDING");
  if (methodUpdateError) {
    console.error("MERCADOPAGO_CARD_PAYMENT_PERSIST_FAILED", { code: methodUpdateError.code, message: methodUpdateError.message });
    return reply(500, {
      approved: false,
      paymentStatus: "PENDING",
      retryable: true,
      message: "O pagamento foi processado, mas ainda não conseguimos registrar a forma de pagamento. Tente novamente.",
    });
  }

  const { data: finalized, error: finalizeError } = await service.rpc("finalize_mercadopago_test_payment", {
    p_payment_id: payment.id,
    p_student_id: authData.user.id,
    p_external_payment_id: String(result.id),
    p_card_brand: result.payment_method_id || null,
    p_card_last4: result.card?.last_four_digits || null,
  });
  if (finalizeError) {
    console.error("MERCADOPAGO_PAYMENT_FINALIZATION_FAILED", {
      code: finalizeError.code,
      message: finalizeError.message,
      details: finalizeError.details,
    });
    return reply(500, {
      approved: false,
      paymentStatus: "PENDING",
      retryable: true,
      message: "O pagamento foi processado, mas a reserva ainda está sendo validada. Tente novamente.",
    });
  }
  return reply(200, { approved: true, paymentId: payment.id, externalPaymentId: String(result.id), result: finalized });
});
