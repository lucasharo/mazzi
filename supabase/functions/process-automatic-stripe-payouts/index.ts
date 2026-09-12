// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });
const valid = (value: unknown, pattern: RegExp) => typeof value === "string" && pattern.test(value);

function encodeForm(values: Record<string, string | number>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, String(value));
  return body;
}

async function stripeJson(key: string, path: string, params?: URLSearchParams, account?: string) {
  try {
    const query = params?.toString();
    const response = await fetch(`https://api.stripe.com/v1/${path}${query ? `?${query}` : ""}`, { headers: { Authorization: `Bearer ${key}`, ...(account ? { "Stripe-Account": account } : {}) } });
    const body = await response.json().catch(() => ({}));
    return response.ok ? body : null;
  } catch (error) {
    console.error("STRIPE_RECONCILIATION_REQUEST_FAILED", { path, account: account || null, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function getSourceTransaction(key: string, paymentIntentId: unknown) {
  if (!valid(paymentIntentId, /^pi_[A-Za-z0-9]+$/)) return null;
  const paymentIntent = await stripeJson(key, `payment_intents/${paymentIntentId}`, new URLSearchParams([["expand[]", "latest_charge"]]));
  const charge = paymentIntent?.latest_charge;
  return valid(charge?.id, /^ch_[A-Za-z0-9]+$/) ? charge.id : null;
}

async function findTransferBalanceTransaction(key: string, account: string, transferId: string) {
  let startingAfter = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({ type: "transfer", limit: "100" });
    if (startingAfter) params.set("starting_after", startingAfter);
    const list = await stripeJson(key, "balance_transactions", params, account);
    const match = (list?.data || []).find((item: any) => item?.source === transferId);
    if (match) return match;
    if (!list?.has_more || !list?.data?.length) return null;
    startingAfter = String(list.data[list.data.length - 1].id || "");
    if (!startingAfter) return null;
  }
  return null;
}

async function persistAvailableOn(service: any, key: string, payout: any) {
  if (!valid(payout.stripe_account_id, /^acct_[A-Za-z0-9]+$/) || !valid(payout.stripe_transfer_id, /^tr_[A-Za-z0-9]+$/)) return { success: false, reason: "STRIPE_RECONCILIATION_IDENTIFIERS_INVALID" };
  const balanceTransaction = await findTransferBalanceTransaction(key, payout.stripe_account_id, payout.stripe_transfer_id);
  if (!balanceTransaction || !Number.isSafeInteger(Number(balanceTransaction.available_on))) {
    console.warn("STRIPE_AVAILABLE_ON_NOT_FOUND", { payoutId: payout.payout_id, bookingId: payout.booking_id, connectedAccount: payout.stripe_account_id, transferId: payout.stripe_transfer_id });
    return { success: false, reason: "STRIPE_AVAILABLE_ON_NOT_FOUND" };
  }
  const availableOn = new Date(Number(balanceTransaction.available_on) * 1000).toISOString();
  const { error } = await service.rpc("record_stripe_transfer_available_on", { p_payout_id: payout.payout_id, p_stripe_account_id: payout.stripe_account_id, p_stripe_transfer_id: payout.stripe_transfer_id, p_balance_transaction_id: balanceTransaction.id, p_available_on: availableOn });
  if (error) return { success: false, reason: error.message };
  console.info("STRIPE_AVAILABLE_ON_RECORDED", { payoutId: payout.payout_id, bookingId: payout.booking_id, connectedAccount: payout.stripe_account_id, transferId: payout.stripe_transfer_id, balanceTransactionId: balanceTransaction.id, availableOn });
  return { success: true, availableOn, balanceTransactionId: balanceTransaction.id };
}

async function processTransfer(service: any, key: string, payout: any) {
  const sourceTransaction = await getSourceTransaction(key, payout.stripe_payment_intent_id);
  if (!sourceTransaction) return { success: false, reason: "STRIPE_SOURCE_TRANSACTION_NOT_FOUND" };
  const response = await fetch("https://api.stripe.com/v1/transfers", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": String(payout.idempotency_key) }, body: encodeForm({ amount: payout.amount_in_cents, currency: "brl", destination: payout.stripe_account_id, source_transaction: sourceTransaction, transfer_group: `mazzi_booking_${payout.booking_id}`, "metadata[mazzi_booking_id]": payout.booking_id, "metadata[mazzi_payout_id]": payout.payout_id }) });
  const stripePayload = await response.json().catch(() => ({}));
  if (!response.ok || !valid(stripePayload.id, /^tr_[A-Za-z0-9]+$/)) return { success: false, reason: String(stripePayload?.error?.message || `Stripe HTTP ${response.status}`) };
  const { error } = await service.rpc("record_stripe_transfer", { p_payout_id: payout.payout_id, p_stripe_transfer_id: stripePayload.id });
  if (error) return { success: false, reason: error.message };
  const available = await persistAvailableOn(service, key, { ...payout, stripe_transfer_id: stripePayload.id });
  return { success: true, transferId: stripePayload.id, available };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) return reply(503, { message: "Processador de repasses não configurado." });
  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: tokenIsValid, error: tokenError } = await service.rpc("verify_payout_cron_token", { p_token: request.headers.get("x-mazzi-cron-token") || "" });
  if (tokenError || tokenIsValid !== true) return reply(401, { message: "Não autorizado." });
  const results: Array<Record<string, unknown>> = [];
  const { data: reconciliation, error: reconciliationError } = await service.rpc("claim_stripe_transfer_reconciliation", { p_limit: 25 });
  if (reconciliationError) return reply(500, { message: "Falha ao reservar reconciliações Stripe.", detail: reconciliationError.message });
  for (const payout of reconciliation || []) {
    const result = await persistAvailableOn(service, stripeSecretKey, { payout_id: payout.payout_id, booking_id: payout.booking_id, stripe_account_id: payout.stripe_account_id, stripe_transfer_id: payout.stripe_transfer_id });
    results.push({ payoutId: payout.payout_id, operation: "available_on_reconciliation", ...result });
  }
  const { data: payouts, error: claimError } = await service.rpc("claim_due_stripe_payouts", { p_limit: 25 });
  if (claimError) return reply(500, { message: "Falha ao reservar repasses elegíveis.", detail: claimError.message });
  for (const payout of payouts || []) {
    try {
      const result = await processTransfer(service, stripeSecretKey, payout);
      if (!result.success) await service.rpc("finalize_stripe_payout", { p_payout_id: payout.payout_id, p_external_transfer_id: null, p_success: false, p_failure_reason: result.reason });
      results.push({ payoutId: payout.payout_id, operation: "transfer", ...result });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await service.rpc("finalize_stripe_payout", { p_payout_id: payout.payout_id, p_external_transfer_id: null, p_success: false, p_failure_reason: reason });
      results.push({ payoutId: payout.payout_id, operation: "transfer", success: false, reason });
    }
  }
  return reply(200, { processed: results.length, succeeded: results.filter((item) => item.success).length, failed: results.filter((item) => item.success === false).length, results });
});
