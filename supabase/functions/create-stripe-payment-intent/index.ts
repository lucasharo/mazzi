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

async function stripeRequest(secretKey: string, path: string, method: string, body?: URLSearchParams) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
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
    return reply(503, { message: "Pagamento Stripe não configurado no servidor." });
  }

  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return reply(401, { message: "Sessão necessária para iniciar o pagamento." });

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await service.auth.getUser(accessToken);
  if (authError || !authData?.user) return reply(401, { message: "Sessão expirada. Entre novamente." });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return reply(400, { message: "Dados do pagamento inválidos." });
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
  if (payment.status === "PAID") return reply(200, { paymentIntentId: payment.external_transaction_id, status: "succeeded", alreadyPaid: true });
  if (!["PENDING", "AUTHORIZED"].includes(payment.status)) return reply(409, { message: "Este pagamento não pode ser processado agora." });

  const amountInCents = asCents(payment.amount_in_cents);
  if (!amountInCents) return reply(409, { message: "O valor deste pagamento é inválido." });

  const metadata = payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
  const existingIntentId = typeof payment.external_transaction_id === "string" && payment.external_transaction_id.startsWith("pi_")
    ? payment.external_transaction_id
    : "";
  const existingMethod = String(metadata.stripe_payment_method || "");

  if (existingIntentId && existingMethod === method) {
    const { response, data } = await stripeRequest(stripeSecretKey, `payment_intents/${encodeURIComponent(existingIntentId)}`, "GET");
    if (response.ok && data.client_secret) {
      return reply(200, {
        paymentIntentId: data.id,
        clientSecret: data.client_secret,
        status: data.status,
        amountInCents,
      });
    }
  }

  // A user can change Pix/card before paying. Cancel the unused intent and
  // create a new one with a method-specific idempotency key.
  if (existingIntentId && existingMethod !== method) {
    await stripeRequest(stripeSecretKey, `payment_intents/${encodeURIComponent(existingIntentId)}/cancel`, "POST");
  }

  const form = new URLSearchParams();
  form.set("amount", String(amountInCents));
  form.set("currency", "brl");
  // Let Stripe's Dashboard configuration select the eligible methods. Passing
  // payment_method_types[]=pix directly makes the API fail when Pix is not
  // activated for the account, instead of returning a usable configuration.
  form.set("automatic_payment_methods[enabled]", "true");
  form.set("capture_method", "automatic");
  form.set("description", "Aula prática de direção MAZZI");
  form.set("metadata[mazzi_payment_id]", String(payment.id));
  form.set("metadata[booking_id]", String(booking.id));
  form.set("metadata[student_id]", String(authData.user.id));
  form.set("metadata[payment_method]", method);
  const payerEmail = typeof payload.payerEmail === "string" ? payload.payerEmail.trim() : authData.user.email || "";
  if (payerEmail) form.set("receipt_email", payerEmail);

  const stripeIdempotencyKey = `${payment.id}:${method.toLowerCase()}`;
  let created;
  try {
    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": stripeIdempotencyKey,
      },
      body: form,
    });
    created = await response.json().catch(() => ({}));
    if (!response.ok || !created.id || !created.client_secret) {
      const stripeError = created?.error || {};
      const isPixNotEnabled = method === "PIX" && (
        String(stripeError?.message || "").toLowerCase().includes('payment method type "pix" is invalid')
        || String(stripeError?.code || "").toLowerCase() === "payment_method_type_invalid"
      );
      const failureReason = isPixNotEnabled
        ? "STRIPE_PIX_NOT_ENABLED"
        : String(stripeError?.code || stripeError?.type || "STRIPE_PAYMENT_INTENT_CREATE_FAILED");

      // The local payment attempt must not remain PENDING when Stripe rejected
      // creation. Keep the booking open for a new attempt, but close this
      // attempt so switching/retrying cannot leave orphaned pending payments.
      await service
        .from("payments")
        .update({
          status: "FAILED",
          metadata: {
            ...metadata,
            stripe_payment_error_code: stripeError?.code || null,
            stripe_payment_error_type: stripeError?.type || null,
            stripe_payment_error_message: stripeError?.message || null,
            failureReason,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .in("status", ["PENDING", "AUTHORIZED"]);

      console.error("STRIPE_PAYMENT_INTENT_CREATE_FAILED", {
        status: response.status,
        code: stripeError?.code || null,
        type: stripeError?.type || null,
        method,
      });

      if (isPixNotEnabled) {
        return reply(409, {
          code: "STRIPE_PIX_NOT_ENABLED",
          gatewayStatus: response.status,
          message: "Pix ainda não está habilitado na conta Stripe. Ative Pix em Payment methods no Dashboard e tente novamente.",
        });
      }

      return reply(response.status >= 500 ? 502 : 400, {
        code: failureReason,
        message: stripeError?.message || "Não foi possível iniciar o pagamento Stripe.",
      });
    }

    const availablePaymentMethods = Array.isArray(created.payment_method_types)
      ? created.payment_method_types.map((value: unknown) => String(value).toLowerCase())
      : [];
    const requiredPaymentMethod = method === "PIX" ? "pix" : "card";
    if (!availablePaymentMethods.includes(requiredPaymentMethod)) {
      await stripeRequest(stripeSecretKey, `payment_intents/${encodeURIComponent(created.id)}/cancel`, "POST");

      const failureReason = method === "PIX"
        ? "STRIPE_PIX_NOT_ENABLED"
        : "STRIPE_CARD_NOT_ENABLED";
      await service
        .from("payments")
        .update({
          status: "FAILED",
          metadata: {
            ...metadata,
            stripe_payment_intent_id: created.id,
            stripe_payment_error_code: failureReason,
            failureReason,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .in("status", ["PENDING", "AUTHORIZED"]);

      return reply(409, {
        code: failureReason,
        gatewayStatus: 409,
        message: method === "PIX"
          ? "Pix não está disponível para esta conta Stripe. Habilite Pix no Dashboard e conclua a ativação da conta antes de tentar novamente."
          : "Cartão não está disponível para esta conta Stripe. Verifique Payment methods no Dashboard.",
      });
    }
  } catch {
    return reply(502, { message: "Não foi possível conectar ao Stripe. Tente novamente." });
  }

  const nextMetadata = {
    ...metadata,
    stripe_payment_intent_id: created.id,
    stripe_payment_intent_status: created.status || "requires_payment_method",
    stripe_payment_method: method,
  };
  const { error: persistError } = await service
    .from("payments")
    .update({
      method,
      gateway_provider: "stripe",
      external_transaction_id: created.id,
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .in("status", ["PENDING", "AUTHORIZED"]);
  if (persistError) {
    console.error("STRIPE_PAYMENT_INTENT_PERSIST_FAILED", { code: persistError.code, message: persistError.message });
    return reply(502, { message: "O pagamento foi iniciado, mas não conseguimos registrar o acompanhamento. Tente novamente." });
  }

  return reply(200, {
    paymentIntentId: created.id,
    clientSecret: created.client_secret,
    status: created.status,
    amountInCents,
  });
});
