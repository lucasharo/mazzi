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

const isUuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function stripeGet(secretKey: string, path: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
    return reply(503, { message: "Verificação Stripe não configurada no servidor." });
  }

  const accessToken = (request.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!accessToken) return reply(401, { message: "Sessão necessária para consultar o checkout." });

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await service.auth.getUser(accessToken);
  if (authError || !authData?.user) return reply(401, { message: "Sessão expirada. Entre novamente." });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return reply(400, { message: "Dados da verificação inválidos." });
  }

  const paymentId = payload.paymentId;
  const sessionId = payload.sessionId;
  if (!isUuid(paymentId) || typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return reply(400, { message: "Pagamento ou sessão Stripe inválidos." });
  }

  const { data: payment, error: paymentError } = await service
    .from("payments")
    .select("id, booking_id, status, amount_in_cents, gateway_provider, metadata")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError) return reply(500, { message: "Não foi possível consultar o pagamento local." });
  if (!payment) return reply(404, { message: "Pagamento não encontrado." });
  if (payment.gateway_provider && !String(payment.gateway_provider).toLowerCase().includes("stripe")) {
    return reply(409, { message: "Este pagamento pertence a outro gateway." });
  }

  const { data: booking, error: bookingError } = await service
    .from("bookings")
    .select("id, student_id, status")
    .eq("id", payment.booking_id)
    .maybeSingle();
  if (bookingError) return reply(500, { message: "Não foi possível consultar a reserva." });
  if (!booking || booking.student_id !== authData.user.id) return reply(403, { message: "Você não tem permissão para este pagamento." });
  if (payment.status === "PAID" && booking.status === "CONFIRMED") {
    return reply(200, { status: "PAID", bookingStatus: "CONFIRMED", bookingId: booking.id, confirmed: true });
  }

  const { response, data: session } = await stripeGet(
    stripeSecretKey,
    `checkout/sessions/${encodeURIComponent(sessionId)}`,
  );
  if (!response.ok || !session?.id) {
    return reply(502, { message: "Não foi possível consultar a sessão Stripe." });
  }

  const sessionPaymentId = String(session.client_reference_id || session.metadata?.mazzi_payment_id || "");
  if (sessionPaymentId !== payment.id || String(session.metadata?.booking_id || "") !== booking.id) {
    return reply(403, { message: "A sessão Stripe não corresponde a esta reserva." });
  }

  const sessionStatus = String(session.status || "");
  const paymentStatus = String(session.payment_status || "");
  if (sessionStatus === "expired" || sessionStatus === "open" && paymentStatus === "unpaid") {
    return reply(409, { status: paymentStatus || "unpaid", bookingStatus: booking.status, confirmed: false });
  }
  if (paymentStatus !== "paid") {
    return reply(202, { status: paymentStatus || "processing", bookingStatus: booking.status, confirmed: false });
  }

  const amountInCents = Number(session.amount_total);
  if (!Number.isSafeInteger(amountInCents) || amountInCents !== Number(payment.amount_in_cents)) {
    return reply(409, { message: "O valor da sessão Stripe diverge do pagamento local." });
  }

  const { error: confirmationError } = await service.rpc("confirm_booking_payment", {
    p_payment_id: payment.id,
    p_external_payment_id: String(session.payment_intent || ""),
    p_paid_at: session.created ? new Date(Number(session.created) * 1000).toISOString() : new Date().toISOString(),
  });
  if (confirmationError) {
    console.error("STRIPE_CHECKOUT_SESSION_CONFIRM_FAILED", { code: confirmationError.code });
    return reply(500, { message: "O pagamento foi recebido, mas não conseguimos confirmar a reserva." });
  }

  return reply(200, { status: "PAID", bookingStatus: "CONFIRMED", bookingId: booking.id, confirmed: true });
});
