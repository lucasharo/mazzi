// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, stripe-signature",
  "Content-Type": "application/json",
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEquals(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function parseStripeSignature(header: string | null) {
  const values: Record<string, string[]> = {};
  for (const part of String(header || "").split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name && value) values[name] = [...(values[name] || []), value];
  }
  return values;
}

async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
) {
  const signature = parseStripeSignature(signatureHeader);
  const timestamp = Number(signature.t?.[0]);
  if (!Number.isInteger(timestamp)) return false;

  const toleranceSeconds = 300;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) {
    return false;
  }

  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return (signature.v1 || []).some((candidate) =>
    constantTimeEquals(expected, candidate)
  );
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object"
    ? value as Record<string, any>
    : {};
}

function asCents(value: unknown) {
  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function mergeMetadata(metadata: unknown, values: Record<string, unknown>) {
  return { ...asObject(metadata), ...values };
}

function getPaymentIntentId(eventType: string, object: Record<string, any>) {
  if (eventType.startsWith("payment_intent.")) return String(object.id || "");
  return String(object.payment_intent || "");
}

function getRefundDetails(eventType: string, object: Record<string, any>) {
  if (eventType === "charge.refunded") {
    const refunds = Array.isArray(object.refunds?.data) ? object.refunds.data : [];
    const latest = refunds
      .filter((refund: Record<string, any>) => refund.status === "succeeded")
      .sort((left: Record<string, any>, right: Record<string, any>) =>
        Number(right.created || 0) - Number(left.created || 0)
      )[0];
    return {
      id: String(latest?.id || object.id || ""),
      amount: asCents(latest?.amount || object.amount_refunded),
    };
  }

  return {
    id: String(object.id || ""),
    amount: asCents(object.amount),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") {
    return reply(405, { message: "Método não permitido." });
  }

  const webhookSecret = (Deno.env.get("STRIPE_WEBHOOK_SECRET") || "").trim();
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
    return reply(503, { message: "Webhook Stripe não configurado." });
  }

  const rawBody = await request.text();
  const isValid = await verifyStripeSignature(
    rawBody,
    request.headers.get("stripe-signature"),
    webhookSecret,
  );
  if (!isValid) return reply(400, { message: "Assinatura Stripe inválida." });

  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return reply(400, { message: "Payload JSON inválido." });
  }

  const eventId = String(event.id || "");
  const eventType = String(event.type || "");
  const object = asObject(event.data?.object);
  if (!eventId || !eventType) {
    return reply(400, { message: "Evento Stripe incompleto." });
  }

  const gatewayProvider = event.livemode ? "stripe_production" : "stripe_test";
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const payloadHash = await hmacHex(webhookSecret, rawBody);
  const externalPaymentId = getPaymentIntentId(eventType, object) || null;

  const { data: webhookEvent, error: eventError } = await service
    .from("payment_webhook_events")
    .insert({
      gateway: gatewayProvider,
      external_event_id: eventId,
      external_payment_id: externalPaymentId,
      event_type: eventType,
      payload_hash: payloadHash,
      status: "RECEIVED",
    })
    .select("id")
    .maybeSingle();

  if (eventError?.code === "23505") {
    return reply(200, { received: true, duplicate: true });
  }
  if (eventError || !webhookEvent) {
    return reply(500, { message: "Não foi possível registrar o webhook." });
  }

  const paymentIdFromMetadata = String(
    object.metadata?.mazzi_payment_id ||
      object.metadata?.payment_id ||
      object.metadata?.local_payment_id ||
      "",
  );
  const paymentQuery = paymentIdFromMetadata
    ? service
        .from("payments")
        .select("id, amount_in_cents, status, booking_id, gateway_provider, metadata")
        .eq("id", paymentIdFromMetadata)
        .maybeSingle()
    : externalPaymentId
      ? service
          .from("payments")
          .select("id, amount_in_cents, status, booking_id, gateway_provider, metadata")
          .eq("external_transaction_id", externalPaymentId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });
  const { data: localPayment, error: paymentLookupError } = await paymentQuery;

  if (paymentLookupError) {
    await service
      .from("payment_webhook_events")
      .update({
        status: "FAILED",
        error_message: paymentLookupError.message,
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEvent.id);
    return reply(500, { message: "Não foi possível localizar o pagamento." });
  }

  if (!localPayment) {
    await service
      .from("payment_webhook_events")
      .update({
        status: "IGNORED",
        error_message: "Pagamento não vinculado ao MAZZI.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEvent.id);
    return reply(200, { received: true, ignored: true });
  }

  if (
    localPayment.gateway_provider &&
    !String(localPayment.gateway_provider).toLowerCase().includes("stripe")
  ) {
    await service
      .from("payment_webhook_events")
      .update({
        status: "IGNORED",
        error_message: "Pagamento pertence a outro gateway.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEvent.id);
    return reply(200, { received: true, ignored: true });
  }

  let processingError: string | null = null;
  const eventMetadata = mergeMetadata(localPayment.metadata, {
    stripe_event_id: eventId,
    stripe_event_type: eventType,
    stripe_status: object.status || null,
    stripe_payment_intent_id: externalPaymentId,
  });

  if (eventType === "payment_intent.succeeded") {
    const amount = asCents(object.amount_received || object.amount);
    if (amount !== localPayment.amount_in_cents) {
      processingError = "Valor do PaymentIntent divergente do pagamento local.";
    } else {
      const { error } = await service.rpc("confirm_booking_payment", {
        p_payment_id: localPayment.id,
        p_external_payment_id: String(object.id || externalPaymentId || ""),
        p_paid_at: object.created
          ? new Date(Number(object.created) * 1000).toISOString()
          : new Date().toISOString(),
      });
      if (error) processingError = error.message;
    }
  } else if (eventType === "payment_intent.processing") {
    const { error } = await service
      .from("payments")
      .update({ metadata: eventMetadata, updated_at: new Date().toISOString() })
      .eq("id", localPayment.id)
      .in("status", ["PENDING", "AUTHORIZED"]);
    if (error) processingError = error.message;
  } else if (eventType === "payment_intent.payment_failed") {
    const { error } = await service
      .from("payments")
      .update({
        status: "FAILED",
        failed_at: new Date().toISOString(),
        metadata: eventMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", localPayment.id)
      .in("status", ["PENDING", "AUTHORIZED"]);
    if (error) processingError = error.message;
  } else if (eventType === "payment_intent.requires_action") {
    const { error } = await service
      .from("payments")
      .update({ metadata: eventMetadata, updated_at: new Date().toISOString() })
      .eq("id", localPayment.id)
      .in("status", ["PENDING", "AUTHORIZED"]);
    if (error) processingError = error.message;
  } else if (eventType === "payment_intent.canceled") {
    const { error } = await service
      .from("payments")
      .update({
        status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
        metadata: eventMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", localPayment.id)
      .in("status", ["PENDING", "AUTHORIZED"]);
    if (error) processingError = error.message;
  } else if (eventType === "charge.refunded" || eventType === "charge.refund.updated") {
    const refund = getRefundDetails(eventType, object);
    const refundStatus = eventType === "charge.refund.updated"
      ? String(object.status || "")
      : "succeeded";
    if (refundStatus === "succeeded" && refund.id && refund.amount) {
      const { error } = await service.rpc("process_booking_refund", {
        p_payment_id: localPayment.id,
        p_amount_in_cents: refund.amount,
        p_reason: "STRIPE_REFUND_WEBHOOK",
        p_idempotency_key: `stripe-refund:${localPayment.id}:${refund.id}`,
        p_external_refund_id: refund.id,
      });
      if (error) processingError = error.message;
    }
  } else if (eventType === "charge.dispute.created") {
    const { error } = await service
      .from("payments")
      .update({
        status: "CHARGEBACK",
        metadata: mergeMetadata(eventMetadata, {
          stripe_dispute_id: object.id || null,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", localPayment.id)
      .in("status", ["PAID", "PARTIALLY_REFUNDED"]);
    if (error) processingError = error.message;
  }

  if (processingError) {
    await service
      .from("payment_webhook_events")
      .update({
        status: "FAILED",
        error_message: processingError,
        processed_at: new Date().toISOString(),
      })
      .eq("id", webhookEvent.id);
    return reply(500, { message: "Webhook recebido, mas não foi processado." });
  }

  await service
    .from("payment_webhook_events")
    .update({ status: "PROCESSED", processed_at: new Date().toISOString() })
    .eq("id", webhookEvent.id);

  return reply(200, { received: true, processed: true });
});
