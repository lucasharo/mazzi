// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });

  const url = (Deno.env.get("SUPABASE_URL") || "").trim();
  const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!url || !anonKey || !serviceKey || !stripeSecretKey) return reply(503, { message: "O estorno Stripe ainda não foi configurado." });

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });
  const session = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await session.auth.getUser(token);
  if (authError || !authData?.user) return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });
  const { data: isAdmin, error: adminError } = await session.rpc("is_platform_admin");
  if (adminError || isAdmin !== true) return reply(403, { message: "Você não tem permissão para solicitar estornos." });

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return reply(400, { message: "Dados de estorno inválidos." }); }
  if (!isUuid(payload.bookingId)) return reply(400, { message: "Reserva inválida para estorno." });

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: payment, error: paymentError } = await service
    .from("payments")
    .select("id, booking_id, amount_in_cents, status, gateway_provider, external_transaction_id, metadata")
    .eq("booking_id", payload.bookingId)
    .eq("gateway_provider", "stripe")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (paymentError) return reply(500, { message: "Não foi possível localizar o pagamento da reserva." });
  if (!payment) return reply(404, { message: "Pagamento Stripe não encontrado." });
  if (!["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status)) return reply(409, { message: "Este pagamento não está disponível para estorno." });

  const amountInCents = Number(payment.amount_in_cents);
  const paymentIntentId = String(payment.external_transaction_id || payment.metadata?.stripe_payment_intent_id || "");
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId) || !Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    return reply(409, { message: "O pagamento ainda não possui dados válidos para estorno." });
  }

  const idempotencyKey = `mazzi-stripe-refund:${payment.id}:${amountInCents}`;
  const form = new URLSearchParams();
  form.set("payment_intent", paymentIntentId);
  form.set("amount", String(amountInCents));
  let stripeResponse: Response;
  let result: Record<string, any>;
  try {
    stripeResponse = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey,
      },
      body: form,
    });
    result = await stripeResponse.json().catch(() => ({}));
  } catch {
    return reply(502, { success: false, refundStatus: "PENDING", retryable: true, message: "Não foi possível conectar ao Stripe para solicitar o estorno." });
  }

  if (!stripeResponse.ok || !result.id) {
    console.error("STRIPE_REFUND_FAILED", { status: stripeResponse.status, type: result?.error?.type || null });
    return reply(stripeResponse.status >= 500 ? 503 : 422, { success: false, refundStatus: "FAILED", retryable: stripeResponse.status >= 500, message: result?.error?.message || "O Stripe não autorizou o estorno." });
  }

  const refundStatus = String(result.status || "").toLowerCase();
  if (refundStatus === "pending") {
    return reply(202, { success: true, refundStatus: "PENDING", retryable: true, externalRefundId: result.id, message: "O estorno foi solicitado e está sendo processado pelo Stripe." });
  }
  if (refundStatus !== "succeeded") return reply(422, { success: false, refundStatus: "FAILED", retryable: false, message: "O Stripe não concluiu o estorno." });

  const { data: finalized, error: finalizeError } = await service.rpc("process_booking_refund", {
    p_payment_id: payment.id,
    p_amount_in_cents: amountInCents,
    p_reason: String(payload.reason || "ADMIN_STRIPE_REFUND"),
    p_idempotency_key: idempotencyKey,
    p_external_refund_id: String(result.id),
  });
  if (finalizeError) {
    console.error("STRIPE_REFUND_LOCAL_FINALIZATION_FAILED", { code: finalizeError.code, message: finalizeError.message });
    return reply(500, { success: false, refundStatus: "PENDING", retryable: true, message: "O Stripe processou o estorno, mas o MAZZI ainda está sincronizando a reserva." });
  }
  return reply(200, { success: true, refundStatus: "PROCESSED", externalRefundId: result.id, result: finalized });
});
