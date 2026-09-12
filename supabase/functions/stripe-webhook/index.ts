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

function asNonNegativeCents(value: unknown) {
  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

async function getStripeJson(stripeSecretKey: string, path: string, params?: URLSearchParams, connectedAccount?: string) {
  const query = params?.toString();
  try {
    const response = await fetch(`https://api.stripe.com/v1/${path}${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${stripeSecretKey}`, ...(connectedAccount ? { "Stripe-Account": connectedAccount } : {}) },
    });
    const body = await response.json().catch(() => ({}));
    return response.ok ? asObject(body) : null;
  } catch {
    return null;
  }
}

async function reconcileConnectedPayout(service: any, stripeSecretKey: string, connectedAccount: string, stripePayoutId: string) {
  if (!/^acct_[A-Za-z0-9]+$/.test(connectedAccount) || !/^po_[A-Za-z0-9]+$/.test(stripePayoutId)) return null;
  const { data: knownPayout, error: knownPayoutError } = await service.from("payouts")
    .select("id,booking_id,transfer_reference,destination_key")
    .eq("destination_key", connectedAccount)
    .eq("external_payout_id", stripePayoutId)
    .maybeSingle();
  if (knownPayoutError) throw knownPayoutError;
  if (knownPayout) return { payout: knownPayout, transaction: null };
  const params = new URLSearchParams({ payout: stripePayoutId, limit: "100" });
  const balanceTransactions = await getStripeJson(stripeSecretKey, "balance_transactions", params, connectedAccount);
  const transactions = Array.isArray(balanceTransactions?.data) ? balanceTransactions.data : [];
  if (transactions.length === 0) return null;
  const { data: candidates, error } = await service.from("payouts")
    .select("id,booking_id,transfer_reference,destination_key")
    .eq("destination_key", connectedAccount)
    .not("transfer_reference", "is", null)
    .limit(1000);
  if (error) throw error;
  const matched = (candidates || []).map((payout: any) => {
    const transaction = transactions.find((item: any) => item?.source === payout.transfer_reference);
    return transaction ? { payout, transaction } : null;
  }).find(Boolean);
  if (!matched) {
    console.info("STRIPE_CONNECTED_PAYOUT_UNMATCHED", { connectedAccount, stripePayoutId, balanceTransactionCount: transactions.length });
    return null;
  }
  console.info("STRIPE_CONNECTED_PAYOUT_RECONCILED", { connectedAccount, stripePayoutId, payoutId: matched.payout.id, transferId: matched.payout.transfer_reference, balanceTransactionId: matched.transaction.id });
  return matched;
}

async function getStripeGatewayFeeInCents(
  stripeSecretKey: string,
  eventObject: Record<string, any>,
  paymentIntentId: string,
) {
  const expandedBalanceTransaction = asObject(asObject(eventObject.balance_transaction));
  const expandedFee = asNonNegativeCents(expandedBalanceTransaction.fee);
  if (expandedFee !== null) return expandedFee;

  const balanceTransactionId = typeof eventObject.balance_transaction === "string"
    ? eventObject.balance_transaction
    : "";
  if (/^txn_[A-Za-z0-9]+$/.test(balanceTransactionId)) {
    const balanceTransaction = await getStripeJson(stripeSecretKey, `balance_transactions/${balanceTransactionId}`);
    const fee = asNonNegativeCents(balanceTransaction?.fee);
    if (fee !== null) return fee;
  }

  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) return null;
  const params = new URLSearchParams();
  params.append("expand[]", "latest_charge.balance_transaction");
  // Stripe can expose the successful PaymentIntent before its balance
  // transaction is available. Retry briefly so a successful payment does not
  // become permanently stuck without the real checkout fee.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const paymentIntent = await getStripeJson(stripeSecretKey, `payment_intents/${paymentIntentId}`, params);
    const latestCharge = asObject(paymentIntent?.latest_charge);
    const balanceTransaction = asObject(latestCharge.balance_transaction);
    const fee = asNonNegativeCents(balanceTransaction.fee);
    if (fee !== null) return fee;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

function mergeMetadata(metadata: unknown, values: Record<string, unknown>) {
  return { ...asObject(metadata), ...values };
}

function getPaymentIntentId(eventType: string, object: Record<string, any>) {
  if (eventType.startsWith("payment_intent.")) return String(object.id || "");
  if (typeof object.payment_intent === "string") return object.payment_intent;
  return String(object.payment_intent?.id || "");
}

function getRefundDetails(eventType: string, object: Record<string, any>) {
  return {
    id: String(object.id || ""),
    amount: asCents(object.amount),
  };
}

async function refundLatePayment(
  service: any,
  stripeSecretKey: string,
  paymentId: string,
  amountInCents: number,
  paymentIntentId: string,
) {
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
    return "Pagamento tardio sem PaymentIntent válido para estorno.";
  }

  const idempotencyKey = `mazzi-late-payment-refund:${paymentId}`;
  const form = new URLSearchParams();
  form.set("payment_intent", paymentIntentId);
  form.set("amount", String(amountInCents));

  let response: Response;
  let result: Record<string, any>;
  try {
    response = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey,
      },
      body: form,
    });
    result = await response.json().catch(() => ({}));
  } catch {
    return "Não foi possível solicitar o estorno do pagamento tardio.";
  }

  if (!response.ok || !result.id) {
    console.error("STRIPE_LATE_PAYMENT_REFUND_FAILED", {
      status: response.status,
      paymentId,
      code: result?.error?.code || null,
    });
    return result?.error?.message || "O Stripe não autorizou o estorno do pagamento tardio.";
  }
  if (String(result.status || "").toLowerCase() !== "succeeded") {
    return "O estorno do pagamento tardio ainda não foi concluído pelo Stripe.";
  }

  const { error } = await service.rpc("finalize_late_payment_refund", {
    p_payment_id: paymentId,
    p_amount_in_cents: amountInCents,
    p_idempotency_key: idempotencyKey,
    p_external_refund_id: String(result.id),
  });
  return error ? error.message : null;
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

  let { data: webhookEvent, error: eventError } = await service
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
    const { data: existingEvent, error: duplicateLookupError } = await service
      .from("payment_webhook_events")
      .select("id, status")
      .eq("gateway", gatewayProvider)
      .eq("external_event_id", eventId)
      .maybeSingle();

    if (duplicateLookupError || !existingEvent) {
      return reply(500, { message: "Não foi possível consultar o webhook duplicado." });
    }

    if (["PROCESSED", "IGNORED"].includes(existingEvent.status)) {
      return reply(200, { received: true, duplicate: true });
    }

    // Stripe can resend an event that failed after it was recorded. Reuse the
    // original row so retries execute the business transition instead of
    // being incorrectly acknowledged as already processed.
    webhookEvent = existingEvent;
    eventError = null;
    await service
      .from("payment_webhook_events")
      .update({
        status: "RECEIVED",
        error_message: null,
        processed_at: null,
        payload_hash: payloadHash,
      })
      .eq("id", existingEvent.id);
  }
  if (eventError || !webhookEvent) {
    return reply(500, { message: "Não foi possível registrar o webhook." });
  }

  if (eventType.startsWith("payout.")) {
    const connectedAccount = String(event.account || "");
    const stripePayoutId = String(object.id || "");
    const stripePayoutStatus = String(object.status || "pending");
    if (!/^acct_[A-Za-z0-9]+$/.test(connectedAccount) || !/^po_[A-Za-z0-9]+$/.test(stripePayoutId)) {
      await service.from("payment_webhook_events").update({
        status: "IGNORED",
        error_message: "Payout Stripe sem vínculo local.",
        processed_at: new Date().toISOString(),
      }).eq("id", webhookEvent.id);
      return reply(200, { received: true, ignored: true });
    }
    let match: any = null;
    try { match = await reconcileConnectedPayout(service, stripeSecretKey, connectedAccount, stripePayoutId); } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await service.from("payment_webhook_events").update({ status: "FAILED", error_message: message, processed_at: new Date().toISOString() }).eq("id", webhookEvent.id);
      return reply(500, { message: "Não foi possível reconciliar o payout Stripe." });
    }
    if (!match) {
      await service.from("payment_webhook_events").update({ status: "IGNORED", error_message: "Payout Stripe sem Balance Transaction vinculada a uma Transfer MAZZI.", processed_at: new Date().toISOString() }).eq("id", webhookEvent.id);
      return reply(200, { received: true, payout: true, ignored: true });
    }
    const { error: payoutError } = await service.rpc("record_stripe_payout_status", {
      p_payout_id: match.payout.id,
      p_stripe_payout_id: stripePayoutId,
      p_stripe_transfer_id: match.payout.transfer_reference,
      p_stripe_status: stripePayoutStatus,
      p_failure_code: object.failure_code || null,
      p_failure_message: object.failure_message || null,
      p_arrival_date: Number.isFinite(Number(object.arrival_date)) ? new Date(Number(object.arrival_date) * 1000).toISOString() : null,
      p_stripe_account_id: connectedAccount,
      p_balance_transaction_id: match.transaction?.id || null,
      p_stripe_available_on: Number.isFinite(Number(match.transaction?.available_on)) ? new Date(Number(match.transaction.available_on) * 1000).toISOString() : null,
      p_payout_created_at: Number.isFinite(Number(object.created)) ? new Date(Number(object.created) * 1000).toISOString() : null,
      p_stripe_paid_at: eventType === "payout.paid" ? new Date(Number(event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString() : null,
    });
    await service.from("payment_webhook_events").update({
      status: payoutError ? "FAILED" : "PROCESSED",
      error_message: payoutError?.message || null,
      processed_at: new Date().toISOString(),
    }).eq("id", webhookEvent.id);
    if (payoutError) return reply(500, { message: "Não foi possível atualizar o status do repasse." });
    return reply(200, { received: true, payout: true, status: stripePayoutStatus });
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
        .select("id, amount_in_cents, status, booking_id, gateway_provider, gateway_fee_in_cents, metadata")
        .eq("id", paymentIdFromMetadata)
        .maybeSingle()
    : externalPaymentId
      ? service
          .from("payments")
          .select("id, amount_in_cents, status, booking_id, gateway_provider, gateway_fee_in_cents, metadata")
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
    ...(eventType.startsWith("checkout.session.")
      ? { stripe_checkout_session_id: object.id || null, stripe_checkout_payment_status: object.payment_status || null }
      : {}),
  });

  const checkoutSessionSucceeded =
    (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") &&
    (object.payment_status === "paid" || eventType === "checkout.session.async_payment_succeeded");
  const paymentSucceededEvent = checkoutSessionSucceeded ||
    eventType === "payment_intent.succeeded" ||
    eventType === "charge.succeeded";

  if (paymentSucceededEvent) {
    const amount = asCents(
      eventType.startsWith("checkout.session.")
        ? object.amount_total
        : object.amount_received || object.amount,
    );
    if (amount !== localPayment.amount_in_cents) {
      processingError = "Valor do PaymentIntent divergente do pagamento local.";
    } else {
      const paymentIntentId = String(externalPaymentId || object.payment_intent || object.id || "");
      const gatewayFeeInCents = await getStripeGatewayFeeInCents(stripeSecretKey, object, paymentIntentId);
      const paymentMetadata = mergeMetadata(eventMetadata, {
        stripe_gateway_fee_in_cents: gatewayFeeInCents,
      });
      const paymentUpdate: Record<string, unknown> = {
        metadata: paymentMetadata,
        updated_at: new Date().toISOString(),
      };
      if (gatewayFeeInCents !== null) paymentUpdate.gateway_fee_in_cents = gatewayFeeInCents;
      const { error: feePersistenceError } = await service
        .from("payments")
        .update(paymentUpdate)
        .eq("id", localPayment.id);
      if (feePersistenceError) processingError = feePersistenceError.message;

      const alreadyMarkedLate = Boolean(localPayment.metadata?.late_payment);
      let latePayment = alreadyMarkedLate;

      if (!processingError && !alreadyMarkedLate) {
        const { data: confirmation, error } = await service.rpc("confirm_booking_payment", {
          p_payment_id: localPayment.id,
          p_external_payment_id: paymentIntentId,
          p_paid_at: object.created
            ? new Date(Number(object.created) * 1000).toISOString()
            : new Date().toISOString(),
        });
        if (error) {
          const lateError = [
            "BOOKING_HOLD_EXPIRED",
            "BOOKING_NOT_PENDING_PAYMENT",
            "PAYMENT_PROCESSING_WINDOW_EXPIRED",
          ].some((code) => error.message.includes(code));
          if (!lateError) {
            processingError = error.message;
          } else {
            const { data: lateRecord, error: lateRecordError } = await service.rpc("record_late_payment", {
              p_payment_id: localPayment.id,
              p_external_payment_id: paymentIntentId,
              p_paid_at: object.created
                ? new Date(Number(object.created) * 1000).toISOString()
                : new Date().toISOString(),
            });
            if (lateRecordError) processingError = lateRecordError.message;
            else latePayment = Boolean(lateRecord?.late_payment);
          }
        } else {
          latePayment = Boolean(confirmation?.late_payment);
        }
      }

      if (!processingError && latePayment) {
        const refundError = await refundLatePayment(
          service,
          stripeSecretKey,
          localPayment.id,
          localPayment.amount_in_cents,
          paymentIntentId,
        );
        if (refundError) processingError = refundError;
      }
    }
  } else if (eventType === "checkout.session.async_payment_failed") {
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
  } else if (eventType === "checkout.session.expired") {
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
  } else if (
    eventType === "refund.created" ||
    eventType === "refund.updated" ||
    eventType === "charge.refund.updated"
  ) {
    const refund = getRefundDetails(eventType, object);
    const refundStatus = String(object.status || "");
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
  } else if (eventType === "charge.refunded") {
    // This is a cumulative charge summary and does not reliably include the
    // individual refund object. Stripe recommends refund.created for the
    // authoritative refund id and amount, which are required for idempotency.
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
