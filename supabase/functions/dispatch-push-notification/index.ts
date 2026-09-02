// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isWebhookSecretValid, sendFcmDataMessage } from "../_shared/fcm-http-v1.ts";

const headers = { "Content-Type": "application/json" };
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

const ALLOWED_EVENTS = new Set([
  "BOOKING_CONFIRMED", "BOOKING_CANCELLED", "NEW_MESSAGE", "STUDENT_CHECKIN",
  "PROVIDER_CHECKIN", "LESSON_STARTED", "LESSON_COMPLETED", "CONTESTATION_UPDATED",
  "COMPLIANCE_PENDING", "PAYOUT_PAID", "PAYOUT_BLOCKED", "PAYOUT_FAILED",
  "REVIEW_AVAILABLE", "REVIEW_RECEIVED",
]);
const ALLOWED_CONTEXTS = new Set(["STUDENT", "PRO"]);
const ALLOWED_ENTITIES = new Set(["booking", "payout", "earnings", "compliance"]);
const ALLOWED_ACTIONS = new Set(["details", "chat", "review", "reviews", "compliance"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidTarget(row: Record<string, unknown>): boolean {
  return typeof row.id === "string" && UUID.test(row.id)
    && typeof row.type === "string" && ALLOWED_EVENTS.has(row.type)
    && typeof row.app_context === "string" && ALLOWED_CONTEXTS.has(row.app_context)
    && typeof row.entity_type === "string" && ALLOWED_ENTITIES.has(row.entity_type)
    && typeof row.navigation_action === "string" && ALLOWED_ACTIONS.has(row.navigation_action)
    && (!row.entity_id || (typeof row.entity_id === "string" && UUID.test(row.entity_id)));
}

function retryDelay(attemptCount: number): number {
  return Math.min(300, Math.max(15, 15 * (2 ** Math.max(attemptCount - 1, 0))));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function loadCanonicalNotification(
  service: ReturnType<typeof createClient>,
  notificationId: string,
): Promise<{ data: Record<string, any> | null; error: unknown }> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await service
      .from("notifications")
      .select("id,user_id,type,app_context,entity_type,entity_id,navigation_action")
      .eq("id", notificationId)
      .maybeSingle();
    if (result.data) return result;
    lastError = result.error;
    if (attempt < 3) await wait(100 * (attempt + 1));
  }
  return { data: null, error: lastError };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });

  const expectedSecret = (Deno.env.get("FCM_WEBHOOK_SECRET") || "").trim();
  if (!expectedSecret || !isWebhookSecretValid(request.headers.get("x-mazzi-dispatch-secret"), expectedSecret)) {
    return reply(401, { message: "Não autorizado." });
  }

  const supabaseUrl = (
    Deno.env.get("MAZZI_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || ""
  ).trim();
  const serviceRoleKey = (
    Deno.env.get("MAZZI_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  ).trim();
  if (!supabaseUrl || !serviceRoleKey) return reply(503, { message: "Dispatcher não configurado." });

  let body: Record<string, any>;
  try { body = await request.json(); } catch { return reply(400, { message: "Payload JSON inválido." }); }
  const notificationId = String(body.record?.id || body.notification_id || "");
  if (!UUID.test(notificationId)) return reply(400, { message: "Notificação inválida." });

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  // pg_net can start the request before the INSERT transaction commits. Retry
  // the canonical lookup briefly so a valid notification is not lost as 404.
  const { data: notification, error: notificationError } = await loadCanonicalNotification(service, notificationId);
  if (notificationError || !notification) return reply(404, { message: "Notificação não encontrada." });
  if (!isValidTarget(notification)) return reply(422, { message: "Destino da notificação inválido." });

  const { data: deliveries, error: deliveriesError } = await service
    .from("push_deliveries")
    .select("id,device_id")
    .eq("notification_id", notificationId)
    .order("created_at", { ascending: true });
  if (deliveriesError) return reply(500, { message: "Não foi possível carregar as entregas." });

  const results = { sent: 0, retried: 0, failed: 0, invalidated: 0, skipped: 0 };
  for (const delivery of deliveries || []) {
    const { data: claim, error: claimError } = await service.rpc("claim_push_delivery", { p_delivery_id: delivery.id });
    if (claimError || !claim) { results.skipped += 1; continue; }

    const { data: device, error: deviceError } = await service
      .from("user_push_devices")
      .select("id,user_id,app_context,provider,endpoint,disabled_at,invalidated_at")
      .eq("id", delivery.device_id)
      .maybeSingle();
    if (deviceError || !device || device.user_id !== notification.user_id || device.app_context !== notification.app_context || device.provider !== "FCM" || device.disabled_at || device.invalidated_at) {
      await service.rpc("finalize_push_delivery", { p_delivery_id: delivery.id, p_status: "FAILED", p_error_message: "DEVICE_NOT_ELIGIBLE" });
      results.failed += 1;
      continue;
    }

    const result = await sendFcmDataMessage({
      token: device.endpoint,
      data: {
        notificationId: notification.id,
        eventType: notification.type,
        appContext: notification.app_context,
        version: "1",
        entityType: notification.entity_type,
        entityId: notification.entity_id || "",
        action: notification.navigation_action,
      },
    }).catch(() => ({ ok: false, kind: "transient", status: 503, error: "FCM_SEND_FAILED" }));

    if (result.ok) {
      await service.rpc("finalize_push_delivery", { p_delivery_id: delivery.id, p_status: "SENT", p_external_message_id: result.messageId });
      results.sent += 1;
    } else if (result.kind === "invalid-token") {
      await service.rpc("invalidate_push_device", { p_device_id: device.id });
      await service.rpc("finalize_push_delivery", { p_delivery_id: delivery.id, p_status: "FAILED", p_error_message: result.error });
      results.invalidated += 1;
    } else if (result.kind === "transient" && Number(claim.attempt_count) < 3) {
      await service.rpc("finalize_push_delivery", { p_delivery_id: delivery.id, p_status: "RETRY", p_error_message: result.error, p_retry_after_seconds: retryDelay(Number(claim.attempt_count)) });
      results.retried += 1;
    } else {
      await service.rpc("finalize_push_delivery", { p_delivery_id: delivery.id, p_status: "FAILED", p_error_message: result.error });
      results.failed += 1;
    }
  }

  console.info("MAZZI_PUSH_DISPATCH", { notificationId, appContext: notification.app_context, eventType: notification.type, ...results });
  return reply(200, { ok: true, notificationId, ...results });
});
