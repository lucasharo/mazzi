// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-signature, x-request-id", "Content-Type": "application/json" };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseSignature(header) {
  return Object.fromEntries(String(header || "").split(",").map((part) => part.split("=", 2)).filter(([key, value]) => key && value));
}

function signaturesMatch(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });
  if (Deno.env.get("MERCADOPAGO_ENVIRONMENT") !== "test") return reply(503, { message: "Webhook desabilitado fora do ambiente de testes." });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
  const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") || "";
  if (!url || !serviceKey || !accessToken || !secret) return reply(503, { message: "Webhook do Mercado Pago ainda não foi configurado." });

  const rawBody = await request.text();
  const body = (() => { try { return JSON.parse(rawBody || "{}"); } catch { return {}; } })();
  const notificationType = String(body?.type || body?.action || "");
  if (notificationType === "order" || notificationType === "order.processed") {
    return reply(200, { received: true, ignored: true, reason: "Integração atual usa notificações de pagamento Pix." });
  }
  const paymentId = String(body?.data?.id || body?.id || "");
  const eventId = String(request.headers.get("x-request-id") || body?.id || `${body?.type || "event"}:${paymentId}`);
  if (!paymentId) return reply(200, { received: true, ignored: true });

  const signature = parseSignature(request.headers.get("x-signature"));
  const requestId = request.headers.get("x-request-id") || "";
  const manifest = `id:${paymentId};request-id:${requestId};ts:${signature.ts || ""};`;
  const expected = await hmacHex(secret, manifest);
  if (!signaturesMatch(expected, signature.v1)) {
    return reply(401, { message: "Assinatura inválida." });
  }

  const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const payloadHash = await hmacHex(secret, rawBody);
  const { data: event, error: eventError } = await service.from("payment_webhook_events").insert({ gateway: "mercadopago_test", external_event_id: eventId, external_payment_id: paymentId, event_type: notificationType || "payment.updated", payload_hash: payloadHash, status: "RECEIVED" }).select("id").maybeSingle();
  if (eventError?.code === "23505") return reply(200, { received: true, duplicate: true });
  if (eventError || !event) return reply(500, { message: "Não foi possível registrar a notificação." });

  let mpResponse;
  try { mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${accessToken}` } }); }
  catch { await service.from("payment_webhook_events").update({ status: "FAILED", error_message: "Gateway indisponível", processed_at: new Date().toISOString() }).eq("id", event.id); return reply(502, { message: "Gateway indisponível." }); }
  const payment = await mpResponse.json().catch(() => ({}));
  if (!mpResponse.ok) { await service.from("payment_webhook_events").update({ status: "FAILED", error_message: "Pagamento não consultado", processed_at: new Date().toISOString() }).eq("id", event.id); return reply(502, { message: "Não foi possível consultar o pagamento." }); }

  const feeCents = (payment.fee_details || []).filter((item) => item?.type === "mercadopago_fee").reduce((total, item) => { const value = String(item.amount || ""); const [whole, fraction = ""] = value.split("."); return total + (Number.isSafeInteger(Number(`${whole}${fraction.padEnd(2, "0")}`)) ? Number(`${whole}${fraction.padEnd(2, "0")}`) : 0); }, 0);
  const { data: localPayment } = await service.from("payments").select("id, amount_in_cents, status").eq("external_transaction_id", paymentId).maybeSingle();
  if (!localPayment) { await service.from("payment_webhook_events").update({ status: "IGNORED", error_message: "Pagamento não vinculado", processed_at: new Date().toISOString() }).eq("id", event.id); return reply(200, { received: true, ignored: true }); }

  if (payment.status === "approved") {
    const { error } = await service.rpc("finalize_mercadopago_pix_payment", { p_external_payment_id: paymentId, p_amount_in_cents: localPayment.amount_in_cents, p_paid_at: payment.date_approved || new Date().toISOString(), p_gateway_fee_in_cents: feeCents || null });
    if (error) { await service.from("payment_webhook_events").update({ status: "FAILED", error_message: error.message, processed_at: new Date().toISOString() }).eq("id", event.id); return reply(500, { message: "Pagamento recebido, mas não foi possível finalizar a reserva." }); }
  } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status)) {
    await service.from("payments").update({ status: payment.status === "refunded" ? "REFUNDED" : "FAILED", metadata: { mercado_pago_status: payment.status, mercado_pago_status_detail: payment.status_detail || null }, updated_at: new Date().toISOString() }).eq("id", localPayment.id).in("status", ["PENDING", "AUTHORIZED"]);
  }
  await service.from("payment_webhook_events").update({ status: "PROCESSED", processed_at: new Date().toISOString() }).eq("id", event.id);
  return reply(200, { received: true, processed: true });
});
