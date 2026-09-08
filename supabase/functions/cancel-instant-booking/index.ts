// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

const isUuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const errorStatus = (code: string) => {
  if (code === "42501") return 403;
  if (code === "28000") return 401;
  if (code.startsWith("42")) return 422;
  return 409;
};

const errorMessage = (code: string, fallback: string) => ({
  INSTANT_CANCELLATION_STARTED: "A aula já começou e não pode mais ser cancelada.",
  INSTANT_CANCELLATION_STATUS_INVALID: "Esta Aula Agora não está disponível para cancelamento.",
  PAYMENT_NOT_CONFIRMED: "O pagamento da aula ainda não foi confirmado.",
  STRIPE_PAYMENT_INTENT_REQUIRED: "O pagamento ainda não possui uma confirmação válida do Stripe.",
  REFUND_AMOUNT_MISMATCH: "O valor do estorno mudou. Atualize a aula e tente novamente.",
  GATEWAY_REFUND_CONFIRMATION_REQUIRED: "O Stripe ainda não confirmou o estorno. Tente novamente em instantes.",
}[code] || fallback);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeSecretKey) {
    return reply(503, { message: "O cancelamento com estorno ainda não foi configurado." });
  }

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });

  const session = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await session.auth.getUser(token);
  if (authError || !authData?.user) return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return reply(400, { message: "Dados de cancelamento inválidos." }); }
  if (!isUuid(payload.bookingId)) return reply(400, { message: "Reserva inválida para cancelamento." });

  const reason = typeof payload.reason === "string" ? payload.reason : null;
  const reasonCode = typeof payload.reasonCode === "string" ? payload.reasonCode : null;
  const idempotencyKey = typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : null;
  const { data: prepared, error: prepareError } = await session.rpc("prepare_instant_booking_cancellation", {
    p_booking_id: payload.bookingId,
    p_reason: reason,
    p_reason_code: reasonCode,
    p_idempotency_key: idempotencyKey,
  });
  if (prepareError || !prepared) {
    const code = prepareError?.code || "CANCELLATION_PREPARE_FAILED";
    return reply(errorStatus(code), { message: errorMessage(code, prepareError?.message || "Não foi possível preparar o cancelamento.") });
  }

  const refundAmountInCents = Number(prepared.refund_amount_in_cents || 0);
  const key = String(prepared.idempotency_key || idempotencyKey || "");
  let externalRefundId: string | null = null;

  if (refundAmountInCents > 0 && prepared.existing_refund_status !== "PROCESSED") {
    const paymentIntentId = String(prepared.external_payment_id || "");
    if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
      return reply(422, { message: "O pagamento ainda não possui um PaymentIntent válido para estorno." });
    }
    const form = new URLSearchParams();
    form.set("payment_intent", paymentIntentId);
    form.set("amount", String(refundAmountInCents));
    let stripeResponse: Response;
    let stripeResult: Record<string, any>;
    try {
      stripeResponse = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": `mazzi-instant-cancel:${key}`,
        },
        body: form,
      });
      stripeResult = await stripeResponse.json().catch(() => ({}));
    } catch {
      return reply(502, { message: "Não foi possível confirmar o estorno com o Stripe. Tente novamente." });
    }
    if (!stripeResponse.ok || !stripeResult.id) {
      console.error("INSTANT_STRIPE_REFUND_FAILED", { status: stripeResponse.status, code: stripeResult?.error?.code || null });
      return reply(stripeResponse.status >= 500 ? 503 : 422, {
        message: stripeResult?.error?.message || "O Stripe não autorizou o estorno.",
      });
    }
    const refundStatus = String(stripeResult.status || "").toLowerCase();
    if (refundStatus !== "succeeded") {
      return reply(202, { success: true, refundStatus: "PENDING", message: "O estorno foi solicitado e está sendo processado pelo Stripe." });
    }
    externalRefundId = String(stripeResult.id);
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: finalized, error: finalizeError } = await service.rpc("finalize_instant_booking_cancellation", {
    p_booking_id: payload.bookingId,
    p_reason: reason,
    p_reason_code: reasonCode,
    p_idempotency_key: key,
    p_refund_amount_in_cents: refundAmountInCents,
    p_external_refund_id: externalRefundId,
    p_actor_id: authData.user.id,
  });
  if (finalizeError || !finalized) {
    console.error("INSTANT_CANCELLATION_LOCAL_FINALIZATION_FAILED", {
      code: finalizeError?.code,
      message: finalizeError?.message,
      bookingId: payload.bookingId,
    });
    return reply(500, { message: "O Stripe confirmou o estorno, mas o MAZZI ainda está sincronizando o cancelamento." });
  }
  return reply(200, finalized);
});
