// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
const isUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function decimalToCents(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(`${whole}${fraction.padEnd(2, "0")}`);
  return Number.isSafeInteger(cents) ? cents : null;
}

function gatewayFeeInCents(result) {
  const fee = (result?.fee_details || [])
    .filter((item) => item?.type === "mercadopago_fee")
    .reduce((total, item) => total + (decimalToCents(item.amount) || 0), 0);
  return fee > 0 ? fee : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });
  const environment = (Deno.env.get("MERCADOPAGO_ENVIRONMENT") || "").trim().toLowerCase();
  if (!["test", "production"].includes(environment)) {
    return reply(503, { message: "O ambiente do Mercado Pago não está configurado corretamente." });
  }
  const gatewayProvider = environment === "production" ? "mercadopago_production" : "mercadopago_test";

  const bearer = request.headers.get("Authorization") || "";
  const accessTokenHeader = bearer.replace(/^Bearer\s+/i, "");
  if (!accessTokenHeader) return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
  if (!url || !anonKey || !serviceKey || !mercadoPagoToken) return reply(503, { message: "O pagamento Pix de teste ainda não foi configurado." });

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessTokenHeader}` } } });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessTokenHeader);
  if (authError || !authData.user) return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });

  const payerEmail = (authData.user.email || "").trim();
  if (!payerEmail) return reply(503, { message: "O e-mail do pagador não está configurado." });

  let payload;
  try { payload = await request.json(); } catch { return reply(400, { message: "Dados do pagamento Pix inválidos." }); }
  if (!isUuid(payload?.paymentId)) return reply(400, { message: "Pagamento inválido." });

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: payment, error: paymentError } = await service
    .from("payments")
    .select("id, booking_id, method, amount_in_cents, status, external_transaction_id, idempotency_key, metadata")
    .eq("id", payload.paymentId)
    .maybeSingle();
  if (paymentError || !payment) return reply(paymentError ? 500 : 404, { message: "Não foi possível consultar o pagamento Pix." });

  const { data: booking, error: bookingError } = await service
    .from("bookings")
    .select("id, student_id, status, hold_expires_at, total_in_cents")
    .eq("id", payment.booking_id)
    .maybeSingle();
  if (bookingError || !booking) return reply(500, { message: "Não foi possível validar a reserva." });
  if (booking.student_id !== authData.user.id) return reply(403, { message: "Você não tem permissão para este pagamento." });
  if (payment.method !== "PIX") return reply(409, { message: "Este pagamento não está configurado para Pix." });
  if (payment.status === "PAID") return reply(200, { approved: true, status: "PAID", paymentId: payment.id, externalPaymentId: payment.external_transaction_id, alreadyPaid: true });
  if (payment.status !== "PENDING" && payment.status !== "AUTHORIZED") return reply(409, { message: "Este pagamento não pode ser processado agora." });
  if (booking.status !== "PENDING_PAYMENT") return reply(409, { message: "O prazo desta reserva terminou ou ela já foi processada." });

  if (payment.external_transaction_id && payment.metadata?.pix_qr_code) {
    let currentGatewayResponse;
    try {
      currentGatewayResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(payment.external_transaction_id)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      });
    } catch {
      return reply(502, { message: "Não foi possível consultar o Mercado Pago agora. Tente novamente." });
    }

    const currentGatewayPayment = await currentGatewayResponse.json().catch(() => ({}));
    if (!currentGatewayResponse.ok || !currentGatewayPayment.id) {
      console.error("MERCADOPAGO_PIX_STATUS_FAILED", { status: currentGatewayResponse.status, paymentId: payment.external_transaction_id });
      return reply(502, { message: "Não foi possível atualizar o status do Pix agora. Tente novamente." });
    }

    const currentStatus = currentGatewayPayment.status || "pending";
    const currentFeeCents = gatewayFeeInCents(currentGatewayPayment);
    if (currentStatus === "approved") {
      const { data: finalized, error: finalizeError } = await service.rpc("finalize_mercadopago_pix_payment", {
        p_external_payment_id: String(currentGatewayPayment.id),
        p_amount_in_cents: Number(payment.amount_in_cents),
        p_paid_at: currentGatewayPayment.date_approved || new Date().toISOString(),
        p_gateway_fee_in_cents: currentFeeCents,
      });
      if (finalizeError) return reply(500, { message: "O Pix foi aprovado, mas a reserva ainda está sendo validada. Contate o suporte." });
      return reply(200, { approved: true, status: "PAID", paymentId: payment.id, externalPaymentId: String(currentGatewayPayment.id), result: finalized });
    }

    const failedStatuses = new Set(["rejected", "cancelled", "refunded", "charged_back"]);
    if (failedStatuses.has(currentStatus)) {
      await service.from("payments").update({
        status: "FAILED",
        gateway_fee_in_cents: currentFeeCents,
        metadata: { ...(payment.metadata || {}), mercado_pago_status: currentStatus, mercado_pago_status_detail: currentGatewayPayment.status_detail || null },
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id).neq("status", "PAID");
      return reply(200, { approved: false, status: "FAILED", paymentId: payment.id, externalPaymentId: String(currentGatewayPayment.id), pixQrCode: payment.metadata.pix_qr_code, pixQrCodeBase64: payment.metadata.pix_qr_code_base64, pixExpiresAt: payment.metadata.pix_expires_at });
    }

    return reply(200, {
      approved: false,
      status: payment.status,
      paymentId: payment.id,
      externalPaymentId: payment.external_transaction_id,
      pixQrCode: payment.metadata.pix_qr_code,
      pixQrCodeBase64: payment.metadata.pix_qr_code_base64,
      pixExpiresAt: payment.metadata.pix_expires_at,
      gatewayStatus: currentStatus,
    });
  }

  const cents = Number(payment.amount_in_cents);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents !== Number(booking.total_in_cents)) return reply(409, { message: "O valor deste pagamento é inválido." });
  if (booking.hold_expires_at && new Date(booking.hold_expires_at).getTime() <= Date.now()) return reply(409, { message: "O código Pix não pode mais ser criado porque o prazo da reserva terminou." });

  const reservationExpiration = booking.hold_expires_at || new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const expirationDate = new Date(new Date(reservationExpiration).getTime() - 20 * 1000);
  if (expirationDate.getTime() <= Date.now()) return reply(409, { message: "O código Pix não pode mais ser criado porque o prazo da reserva terminou." });
  const expiration = expirationDate.toISOString();
  const body = {
    transaction_amount: Number((cents / 100).toFixed(2)),
    description: "Aula prática de direção MAZZI",
    payment_method_id: "pix",
    date_of_expiration: expiration,
    external_reference: booking.id,
    payer: { email: payerEmail },
    metadata: { booking_id: booking.id, payment_id: payment.id, environment },
  };

  let mpResponse;
  try {
    mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mercadoPagoToken}`, "X-Idempotency-Key": payment.idempotency_key || payment.id },
      body: JSON.stringify(body),
    });
  } catch {
    return reply(502, { message: "Não foi possível falar com o Mercado Pago agora. Tente novamente." });
  }

  const result = await mpResponse.json().catch(() => ({}));
  if (!mpResponse.ok || !result.id) {
    console.error("MERCADOPAGO_PIX_CREATE_FAILED", { status: mpResponse.status, detail: result.status_detail });
    return reply(mpResponse.status >= 400 && mpResponse.status < 500 ? 402 : 502, {
      gatewayStatus: result?.status || null,
      gatewayStatusDetail: result?.status_detail || null,
      message: mpResponse.status >= 500
        ? "O Mercado Pago está temporariamente indisponível. Tente novamente em instantes."
        : "Não foi possível gerar o código Pix. Confira os dados e tente novamente.",
    });
  }

  const transactionData = result.point_of_interaction?.transaction_data || {};
  const pixQrCode = transactionData.qr_code || null;
  const pixQrCodeBase64 = transactionData.qr_code_base64 || null;
  if (!pixQrCode) return reply(502, { message: "O Mercado Pago não retornou um código Pix válido." });
  const feeCents = gatewayFeeInCents(result);
  const metadata = {
    ...(payment.metadata || {}),
    environment,
    mercado_pago_payment_id: String(result.id),
    mercado_pago_status: result.status || "pending",
    mercado_pago_status_detail: result.status_detail || null,
    pix_qr_code: pixQrCode,
    pix_qr_code_base64: pixQrCodeBase64,
    pix_expires_at: result.date_of_expiration || expiration,
    gateway_fee_in_cents: feeCents,
  };
  const { error: persistError } = await service.from("payments").update({
    gateway_provider: gatewayProvider,
    external_transaction_id: String(result.id),
    pix_qr_code: pixQrCode,
    pix_qr_code_base64: pixQrCodeBase64,
    pix_expires_at: result.date_of_expiration || expiration,
    gateway_fee_in_cents: feeCents,
    metadata,
    updated_at: new Date().toISOString(),
  }).eq("id", payment.id).eq("status", "PENDING");
  if (persistError) return reply(500, { message: "O código Pix foi criado, mas não conseguimos salvar a tentativa. Contate o suporte." });

  if (result.status === "approved") {
    const { data: finalized, error: finalizeError } = await service.rpc("finalize_mercadopago_pix_payment", {
      p_external_payment_id: String(result.id), p_amount_in_cents: cents, p_paid_at: result.date_approved || new Date().toISOString(), p_gateway_fee_in_cents: feeCents,
    });
    if (finalizeError) return reply(500, { message: "O Pix foi aprovado, mas a reserva ainda está sendo validada. Contate o suporte." });
    return reply(200, { approved: true, status: "PAID", paymentId: payment.id, externalPaymentId: String(result.id), result: finalized });
  }
  return reply(200, { approved: false, status: result.status || "pending", paymentId: payment.id, externalPaymentId: String(result.id), pixQrCode, pixQrCodeBase64, pixExpiresAt: result.date_of_expiration || expiration });
});
