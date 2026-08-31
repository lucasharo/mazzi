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

const asCents = (value: unknown) => {
  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
};

function stripeFormValue(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

function resolveReturnOrigin(request: Request, requestedOrigin: unknown) {
  const configuredOrigin = (Deno.env.get("STRIPE_CHECKOUT_APP_URL") || "").trim();
  const candidates = [
    typeof requestedOrigin === "string" ? requestedOrigin.trim() : "",
    request.headers.get("Origin") || "",
    configuredOrigin,
    "https://mazzi-aluno-dev.pages.dev",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      const isMazziPage = url.hostname === "mazzi-aluno-dev.pages.dev";
      const isQuickTunnel = url.protocol === "https:"
        && (url.hostname === "trycloudflare.com" || url.hostname.endsWith(".trycloudflare.com"));
      if ((url.protocol === "http:" && isLocal) || (url.protocol === "https:" && (isMazziPage || isQuickTunnel))) {
        return url.origin;
      }
    } catch {
      // Try the next safe candidate.
    }
  }

  return "https://mazzi-aluno-dev.pages.dev";
}

async function stripeRequest(secretKey: string, path: string, method: string, body?: URLSearchParams, idempotencyKey?: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body,
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
    return reply(503, { message: "Checkout Stripe não configurado no servidor." });
  }

  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return reply(401, { message: "Sessão necessária para iniciar o checkout." });

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await service.auth.getUser(accessToken);
  if (authError || !authData?.user) return reply(401, { message: "Sessão expirada. Entre novamente." });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return reply(400, { message: "Dados do checkout inválidos." });
  }

  const paymentId = payload.paymentId;
  const method = payload.method;
  if (!isUuid(paymentId) || (method !== "PIX" && method !== "CREDIT_CARD")) {
    return reply(400, { message: "Pagamento ou forma de pagamento inválidos." });
  }

  const { data: payment, error: paymentError } = await service
    .from("payments")
    .select("id, booking_id, method, status, amount_in_cents, idempotency_key, gateway_provider, external_transaction_id, metadata")
    .eq("id", paymentId)
    .maybeSingle();
  if (paymentError) return reply(500, { message: "Não foi possível consultar o pagamento." });
  if (!payment) return reply(404, { message: "Pagamento não encontrado." });

  const { data: booking, error: bookingError } = await service
    .from("bookings")
    .select("id, student_id, status")
    .eq("id", payment.booking_id)
    .maybeSingle();
  if (bookingError) return reply(500, { message: "Não foi possível validar a reserva." });
  if (!booking || booking.student_id !== authData.user.id) return reply(403, { message: "Você não tem permissão para este pagamento." });
  if (booking.status !== "PENDING_PAYMENT") return reply(409, { message: "Esta reserva não está mais aguardando pagamento." });
  if (payment.status === "PAID") return reply(200, { alreadyPaid: true });
  if (!["PENDING", "AUTHORIZED"].includes(payment.status)) return reply(409, { message: "Este pagamento não pode ser processado agora." });

  const amountInCents = asCents(payment.amount_in_cents);
  if (!amountInCents) return reply(409, { message: "O valor deste pagamento é inválido." });

  const metadata = payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
  const existingSessionId = typeof metadata.stripe_checkout_session_id === "string"
    ? metadata.stripe_checkout_session_id
    : "";
  const returnOrigin = resolveReturnOrigin(request, payload.returnOrigin);
  if (existingSessionId && String(metadata.stripe_payment_method || "") === method) {
    const { response, data } = await stripeRequest(
      stripeSecretKey,
      `checkout/sessions/${encodeURIComponent(existingSessionId)}`,
      "GET",
    );
    let existingReturnOrigin = "";
    try {
      existingReturnOrigin = new URL(String(data.success_url || "")).origin;
    } catch {
      // Recreate the session when Stripe did not return a valid success URL.
    }
    if (response.ok && data.url && data.status !== "expired" && existingReturnOrigin === returnOrigin) {
      return reply(200, {
        checkoutSessionId: data.id,
        checkoutUrl: data.url,
        status: data.status,
        amountInCents,
      });
    }
  }

  const successUrl = `${returnOrigin}/?stripe_checkout=success&payment_id=${encodeURIComponent(payment.id)}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${returnOrigin}/?stripe_checkout=cancelled&payment_id=${encodeURIComponent(payment.id)}`;
  const form = new URLSearchParams();
  form.set("mode", "payment");
  // Let Stripe's Dashboard-driven dynamic payment methods render the choice
  // inside hosted Checkout. Pix appears automatically once the account is
  // enabled and eligible; card remains available in the meantime.
  form.set("payment_method_options[pix][expires_after_seconds]", String(10 * 60));
  form.set("line_items[0][price_data][currency]", "brl");
  form.set("line_items[0][price_data][product_data][name]", "Aula prática de direção MAZZI");
  form.set("line_items[0][price_data][product_data][description]", "Reserva de aula prática de direção");
  form.set("line_items[0][price_data][unit_amount]", String(amountInCents));
  form.set("line_items[0][quantity]", "1");
  form.set("client_reference_id", String(payment.id));
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("metadata[mazzi_payment_id]", String(payment.id));
  form.set("metadata[booking_id]", String(booking.id));
  form.set("metadata[student_id]", String(authData.user.id));
  form.set("metadata[payment_method]", method);
  form.set("payment_intent_data[metadata][mazzi_payment_id]", String(payment.id));
  form.set("payment_intent_data[metadata][booking_id]", String(booking.id));
  form.set("payment_intent_data[metadata][student_id]", String(authData.user.id));
  form.set("payment_intent_data[metadata][payment_method]", method);

  const payerEmail = typeof payload.payerEmail === "string"
    ? payload.payerEmail.trim()
    : authData.user.email || "";
  if (payerEmail) form.set("customer_email", payerEmail);

  const idempotencyKey = `mazzi-stripe-checkout:${payment.id}:${method.toLowerCase()}:${encodeURIComponent(returnOrigin)}`;
  let result: Record<string, any>;
  let stripeResponse: Response;
  try {
    ({ response: stripeResponse, data: result } = await stripeRequest(
      stripeSecretKey,
      "checkout/sessions",
      "POST",
      form,
      idempotencyKey,
    ));
  } catch {
    return reply(502, { message: "Não foi possível conectar ao Stripe. Tente novamente." });
  }

  if (!stripeResponse.ok || !result.id || !result.url) {
    console.error("STRIPE_CHECKOUT_SESSION_CREATE_FAILED", {
      status: stripeResponse.status,
      code: result?.error?.code || null,
      type: result?.error?.type || null,
      method,
    });
    const isPixNotEnabled = method === "PIX" && String(result?.error?.message || "").toLowerCase().includes("pix");
    return reply(stripeResponse.status >= 500 ? 502 : 422, {
      code: isPixNotEnabled ? "STRIPE_PIX_NOT_ENABLED" : String(result?.error?.code || "STRIPE_CHECKOUT_SESSION_CREATE_FAILED"),
      message: isPixNotEnabled
        ? "Pix ainda não está habilitado na conta Stripe. Ative Pix em Payment methods no Dashboard e tente novamente."
        : result?.error?.message || "Não foi possível iniciar o Checkout Stripe.",
    });
  }

  const nextMetadata = {
    ...metadata,
    stripe_checkout_session_id: result.id,
    stripe_checkout_status: result.status || "open",
    stripe_payment_method: method,
  };
  const { error: persistError } = await service
    .from("payments")
    .update({
      method,
      gateway_provider: "stripe",
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .in("status", ["PENDING", "AUTHORIZED"]);
  if (persistError) {
    console.error("STRIPE_CHECKOUT_SESSION_PERSIST_FAILED", { code: persistError.code, message: persistError.message });
    return reply(502, { message: "O checkout foi iniciado, mas não conseguimos registrar o acompanhamento. Tente novamente." });
  }

  return reply(200, {
    checkoutSessionId: result.id,
    checkoutUrl: result.url,
    status: result.status || "open",
    amountInCents,
  });
});
