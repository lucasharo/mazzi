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
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const isSafePositiveInteger = (value: unknown) =>
  Number.isSafeInteger(value) && Number(value) > 0;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });
  const environment = (Deno.env.get("MERCADOPAGO_ENVIRONMENT") || "").trim().toLowerCase();
  if (!["test", "production"].includes(environment)) {
    return reply(503, { message: "O ambiente do Mercado Pago não está configurado corretamente." });
  }
  const gatewayProvider = environment === "production" ? "mercadopago_production" : "mercadopago_test";

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
  if (!url || !publicKey || !serviceKey || !accessToken) {
    return reply(503, { message: "O estorno de teste ainda não foi configurado." });
  }

  const session = createClient(url, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await session.auth.getUser(token);
  if (authError || !authData.user) {
    return reply(401, { message: "Sua sessão expirou. Entre novamente para continuar." });
  }

  const { data: isAdmin, error: adminError } = await session.rpc("is_platform_admin");
  if (adminError || isAdmin !== true) {
    return reply(403, { message: "Você não tem permissão para solicitar estornos." });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return reply(400, { message: "Dados de estorno inválidos." });
  }
  if (!isUuid(payload.bookingId)) {
    return reply(400, { message: "Reserva inválida para estorno." });
  }

  const service = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: payment, error: paymentError } = await service
    .from("payments")
    .select("id, booking_id, amount_in_cents, status, gateway_provider, external_transaction_id, metadata")
    .eq("booking_id", payload.bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    console.error("MERCADOPAGO_REFUND_PAYMENT_LOOKUP_FAILED", {
      code: paymentError.code,
      message: paymentError.message,
    });
    return reply(500, { message: "Não foi possível localizar o pagamento da reserva." });
  }
  if (!payment) return reply(404, { message: "Pagamento não encontrado." });
  if (payment.gateway_provider !== gatewayProvider) {
    return reply(409, { message: "O pagamento pertence a outro ambiente do Mercado Pago." });
  }
  // REFUNDED is also accepted here so a retry can reach the idempotent SQL
  // finalizer instead of being rejected before the existing refund is found.
  if (!["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status)) {
    return reply(409, { message: "Este pagamento não está disponível para estorno." });
  }
  if (!isSafePositiveInteger(Number(payment.amount_in_cents))) {
    return reply(409, { message: "O valor do pagamento é inválido para estorno." });
  }

  const externalPaymentId = String(
    payment.external_transaction_id || payment.metadata?.mercado_pago_payment_id || "",
  );
  if (!/^\d+$/.test(externalPaymentId)) {
    return reply(409, { message: "O pagamento ainda não possui um identificador do Mercado Pago." });
  }

  // The SQL function owns the refund balance/idempotency check. This Edge
  // Function intentionally does not read refunds directly because the DEV
  // service role has no table SELECT grant; the SECURITY DEFINER RPC does.
  const amountToRefundInCents = Number(payment.amount_in_cents);
  const idempotencyKey = `mazzi-refund:${payment.id}:${amountToRefundInCents}`;

  let mpResponse: Response;
  try {
    // Mercado Pago requires the amount in the gateway's currency unit. The
    // local accounting remains integer cents; this conversion exists only at
    // the external API boundary and is never persisted as a float.
    const gatewayAmount = Number((amountToRefundInCents / 100).toFixed(2));
    mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(externalPaymentId)}/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": idempotencyKey,
        "X-Render-In-Process-Refunds": "true",
      },
      body: JSON.stringify({ amount: gatewayAmount }),
    });
  } catch {
    return reply(502, {
      success: false,
      refundStatus: "PENDING",
      retryable: true,
      message: "Não foi possível confirmar o estorno com o Mercado Pago. Tente novamente.",
    });
  }

  const result = await mpResponse.json().catch(() => ({}));
  const refundStatus = String(result.status || "").toLowerCase();
  const isProcessed = mpResponse.ok && ["approved", "processed", "refunded"].includes(refundStatus);
  const isPending = mpResponse.ok && ["in_process", "pending", "processing"].includes(refundStatus);

  if (!isProcessed && !isPending) {
    console.error("MERCADOPAGO_REFUND_FAILED", {
      httpStatus: mpResponse.status,
      status: result.status,
      statusDetail: result.status_detail,
      message: result.message,
    });
    return reply(mpResponse.status >= 400 && mpResponse.status < 500 ? 422 : 503, {
      success: false,
      refundStatus: "FAILED",
      retryable: mpResponse.status >= 500,
      message: "O Mercado Pago não autorizou o estorno. Verifique o pagamento e tente novamente.",
    });
  }

  if (isPending) {
    return reply(202, {
      success: true,
      refundStatus: "PENDING",
      retryable: true,
      externalRefundId: result.id ? String(result.id) : undefined,
      message: "O estorno foi solicitado e está sendo processado pelo Mercado Pago.",
    });
  }

  const { data: finalized, error: finalizeError } = await service.rpc("finalize_mercadopago_refund", {
    p_payment_id: payment.id,
    p_amount_in_cents: amountToRefundInCents,
    p_reason: String(payload.reason || "ADMIN_MERCADOPAGO_REFUND"),
    p_idempotency_key: idempotencyKey,
    p_external_refund_id: result.id ? String(result.id) : null,
    p_actor_id: authData.user.id,
  });
  if (finalizeError) {
    console.error("MERCADOPAGO_REFUND_LOCAL_FINALIZATION_FAILED", {
      code: finalizeError.code,
      message: finalizeError.message,
    });
    return reply(500, {
      success: false,
      refundStatus: "PENDING",
      retryable: true,
      message: "O Mercado Pago processou o estorno, mas o MAZZI ainda está sincronizando a reserva.",
    });
  }

  return reply(200, {
    success: true,
    refundStatus: "PROCESSED",
    externalRefundId: result.id ? String(result.id) : undefined,
    result: finalized,
  });
});
