// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

function encodeForm(values: Record<string, string | number>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) body.set(key, String(value));
  return body;
}

async function getSourceTransaction(stripeSecretKey: string, paymentIntentId: unknown) {
  const id = typeof paymentIntentId === "string" ? paymentIntentId : "";
  if (!/^pi_[A-Za-z0-9]+$/.test(id)) return null;

  const params = new URLSearchParams();
  params.set("expand[]", "latest_charge");
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(id)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
    );
    if (!response.ok) return null;
    const paymentIntent = await response.json().catch(() => ({}));
    const charge = paymentIntent?.latest_charge;
    return typeof charge?.id === "string" && /^ch_[A-Za-z0-9]+$/.test(charge.id)
      ? charge.id
      : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const stripeSecretKey = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  const cronToken = request.headers.get("x-mazzi-cron-token") || "";

  if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
    return reply(503, { message: "Processador de repasses não configurado." });
  }
  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: tokenIsValid, error: tokenError } = await service.rpc("verify_payout_cron_token", { p_token: cronToken });
  if (tokenError || tokenIsValid !== true) {
    return reply(401, { message: "Não autorizado." });
  }
  const { data: payouts, error: claimError } = await service.rpc("claim_due_stripe_payouts", { p_limit: 25 });
  if (claimError) return reply(500, { message: "Falha ao reservar repasses elegíveis.", detail: claimError.message });

  const results: Array<Record<string, unknown>> = [];
  for (const payout of payouts || []) {
    try {
      const sourceTransaction = await getSourceTransaction(
        stripeSecretKey,
        payout.stripe_payment_intent_id,
      );
      if (!sourceTransaction) {
        const reason = "STRIPE_SOURCE_TRANSACTION_NOT_FOUND";
        await service.rpc("finalize_stripe_payout", {
          p_payout_id: payout.payout_id,
          p_external_transfer_id: null,
          p_success: false,
          p_failure_reason: reason,
        });
        results.push({ payoutId: payout.payout_id, success: false, reason });
        continue;
      }

      const stripeResponse = await fetch("https://api.stripe.com/v1/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": String(payout.idempotency_key),
        },
        body: encodeForm({
          amount: payout.amount_in_cents,
          currency: "brl",
          destination: payout.stripe_account_id,
          source_transaction: sourceTransaction,
          transfer_group: `mazzi_booking_${payout.booking_id}`,
          "metadata[mazzi_booking_id]": payout.booking_id,
          "metadata[mazzi_payout_id]": payout.payout_id,
        }),
      });
      const stripePayload = await stripeResponse.json().catch(() => ({}));
      if (!stripeResponse.ok || !stripePayload.id) {
        const reason = String(stripePayload?.error?.message || `Stripe HTTP ${stripeResponse.status}`);
        await service.rpc("finalize_stripe_payout", {
          p_payout_id: payout.payout_id,
          p_external_transfer_id: null,
          p_success: false,
          p_failure_reason: reason,
        });
        results.push({ payoutId: payout.payout_id, success: false, reason });
        continue;
      }

      const { error: finalizeError } = await service.rpc("finalize_stripe_payout", {
        p_payout_id: payout.payout_id,
        p_external_transfer_id: stripePayload.id,
        p_success: true,
        p_failure_reason: null,
      });
      if (finalizeError) throw finalizeError;
      results.push({ payoutId: payout.payout_id, success: true, transferId: stripePayload.id });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await service.rpc("finalize_stripe_payout", {
        p_payout_id: payout.payout_id,
        p_external_transfer_id: null,
        p_success: false,
        p_failure_reason: reason,
      });
      results.push({ payoutId: payout.payout_id, success: false, reason });
    }
  }

  return reply(200, {
    processed: results.length,
    succeeded: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  });
});
