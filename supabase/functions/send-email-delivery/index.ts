// @ts-nocheck -- Deno types are supplied by the Supabase Edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createResendEmailProviderFromEnv } from "../_shared/email/email-provider.ts";
import {
  buildProBookingConfirmedEmailData,
  buildProPayoutCompletedEmailData,
  buildStudentCancellationRefundEmailData,
  buildStudentPaymentConfirmedEmailData,
  buildStudentRefundCompletedEmailData,
} from "../_shared/email/email-assemblers.ts";
import { readEmailRuntimeConfig } from "../_shared/email/email-config.ts";
import { EMAIL_SUBJECTS } from "../_shared/email/email-subjects.ts";
import { renderEmailTemplate } from "../_shared/email/render-template.ts";

const headers = { "Content-Type": "application/json" };
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function single(service: any, table: string, id: string, columns: string) {
  const { data, error } = await service.from(table).select(columns).eq("id", id).maybeSingle();
  if (error) throw new Error(`EMAIL_DATA_LOOKUP_FAILED:${table}`);
  if (!data) throw new Error(`EMAIL_DATA_NOT_FOUND:${table}`);
  return data;
}

async function user(service: any, id: string) {
  return single(service, "users", id, "id, name, email");
}

async function bookingContext(service: any, bookingId: string) {
  const booking = await single(
    service,
    "bookings",
    bookingId,
    "id, public_reference, student_id, provider_id, instructor_id, vehicle_id, offering_id, scheduled_start_at, scheduled_end_at, price_in_cents, platform_fee_in_cents, total_in_cents, refund_amount_in_cents, snapshot_data",
  );
  const [student, instructor, provider, vehicle, offering] = await Promise.all([
    user(service, booking.student_id),
    user(service, booking.instructor_id),
    single(service, "providers", booking.provider_id, "id, user_id, trade_name, legal_name"),
    single(service, "vehicles", booking.vehicle_id, "id, brand, model, year, transmission, category"),
    single(service, "service_offerings", booking.offering_id, "id, category, transmission"),
  ]);
  const snapshot = booking.snapshot_data && typeof booking.snapshot_data === "object" ? booking.snapshot_data : {};
  const snapshotVehicle = snapshot.vehicle && typeof snapshot.vehicle === "object" ? snapshot.vehicle : {};
  const providerName = String(provider.trade_name || provider.legal_name || "Instrutor MAZZI");
  return {
    booking,
    student,
    instructor,
    provider,
    canonical: {
      id: booking.id,
      publicReference: booking.public_reference,
      scheduledStartAt: booking.scheduled_start_at,
      scheduledEndAt: booking.scheduled_end_at,
      priceInCents: booking.price_in_cents,
      platformFeeInCents: booking.platform_fee_in_cents,
      totalInCents: booking.total_in_cents,
      licenseCategory: String(offering.category || snapshot.category || vehicle.category),
      studentName: student.name,
      providerName,
      providerFirstName: String(instructor.name || providerName).split(/\s+/)[0],
      vehicle: {
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        transmission: vehicle.transmission || offering.transmission,
        color: String(vehicle.color || snapshotVehicle.color || snapshot.vehicleColor || "Não informado"),
      },
    },
  };
}

async function latestPayment(service: any, bookingId: string, paymentId?: string) {
  if (paymentId) {
    return single(service, "payments", paymentId, "id, booking_id, public_reference, amount_in_cents, platform_fee_in_cents, provider_amount_in_cents");
  }
  const { data, error } = await service
    .from("payments")
    .select("id, booking_id, public_reference, amount_in_cents, platform_fee_in_cents, provider_amount_in_cents")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("EMAIL_DATA_NOT_FOUND:payments");
  return data;
}

async function latestRefund(service: any, bookingId: string, refundId?: string) {
  if (refundId) return single(service, "refunds", refundId, "id, booking_id, payment_id, amount_in_cents");
  const { data, error } = await service
    .from("refunds")
    .select("id, booking_id, payment_id, amount_in_cents")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("EMAIL_DATA_NOT_FOUND:refunds");
  return data;
}

function digits(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

async function payoutData(service: any, payoutId: string, context: any) {
  const payout = await single(
    service,
    "payouts",
    payoutId,
    "id, provider_id, booking_id, public_reference, amount_in_cents, gross_amount_in_cents, platform_fee_in_cents, transfer_method, released_at, processed_at, created_at",
  );
  const { data: bank, error: bankError } = await service
    .from("provider_bank_accounts")
    .select("bank_code, branch_number, account_number, is_active")
    .eq("provider_id", payout.provider_id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bankError || !bank) throw new Error("EMAIL_BANK_ACCOUNT_NOT_FOUND");
  const branch = digits(bank.branch_number);
  const account = digits(bank.account_number);
  if (branch.length < 2 || account.length < 4) throw new Error("EMAIL_BANK_ACCOUNT_FRAGMENT_INVALID");
  return buildProPayoutCompletedEmailData({
    config: context.config,
    payout: {
      publicReference: payout.public_reference,
      amountInCents: payout.amount_in_cents,
      grossAmountInCents: payout.gross_amount_in_cents ?? context.booking.totalInCents,
      platformFeeInCents: payout.platform_fee_in_cents ?? context.booking.platformFeeInCents,
      releasedAt: payout.released_at || payout.processed_at || payout.created_at,
      method: payout.transfer_method || "Conta bancária",
      bankName: `Banco ${bank.bank_code}`,
      bankBranchLast2: branch.slice(-2),
      bankAccountLast4: account.slice(-4),
      providerFirstName: context.canonical.providerFirstName,
    },
  });
}

async function resolveParams(service: any, delivery: any, config: any) {
  const entityType = String(delivery.business_entity_type).toUpperCase();
  let bookingId = delivery.business_entity_id;
  let paymentId: string | undefined;
  let refundId: string | undefined;
  let payoutId: string | undefined;

  if (entityType === "PAYMENT") {
    const payment = await single(service, "payments", bookingId, "id, booking_id");
    bookingId = payment.booking_id;
    paymentId = payment.id;
  } else if (entityType === "REFUND") {
    const refund = await single(service, "refunds", bookingId, "id, booking_id, payment_id");
    bookingId = refund.booking_id;
    refundId = refund.id;
    paymentId = refund.payment_id;
  } else if (entityType === "PAYOUT") {
    const payout = await single(service, "payouts", bookingId, "id, booking_id");
    bookingId = payout.booking_id;
    payoutId = payout.id;
  }

  const context = await bookingContext(service, bookingId);
  const template = delivery.template_name;
  const expectedRecipient = template === "pro-payout-completed"
    ? context.provider.user_id || context.booking.instructor_id
    : template === "pro-booking-confirmed" ? context.booking.instructor_id : context.booking.student_id;
  if (delivery.recipient_user_id !== expectedRecipient) throw new Error("EMAIL_RECIPIENT_ENTITY_MISMATCH");

  if (template === "student-payment-confirmed") {
    const payment = await latestPayment(service, bookingId, paymentId);
    return buildStudentPaymentConfirmedEmailData({ config, booking: context.canonical, payment: {
      publicReference: payment.public_reference, amountInCents: payment.amount_in_cents,
    } });
  }
  if (template === "student-cancellation-refund" || template === "student-refund-completed") {
    const refund = await latestRefund(service, bookingId, refundId).catch(() => null);
    if (!refund && template === "student-refund-completed") throw new Error("EMAIL_REFUND_REQUIRED");
    const payment = await latestPayment(service, bookingId, paymentId || refund?.payment_id);
    const input = { config, booking: context.canonical, payment: {
      publicReference: payment.public_reference, amountInCents: payment.amount_in_cents,
    }, refund: { amountInCents: refund?.amount_in_cents ?? context.booking.refund_amount_in_cents ?? 0 } };
    return template === "student-cancellation-refund"
      ? buildStudentCancellationRefundEmailData(input)
      : buildStudentRefundCompletedEmailData(input);
  }
  if (template === "pro-booking-confirmed") {
    return buildProBookingConfirmedEmailData({ config, booking: context.canonical });
  }
  if (template === "pro-payout-completed") {
    if (!payoutId) throw new Error("EMAIL_PAYOUT_REQUIRED");
    return payoutData(service, payoutId, { config, booking: context.canonical });
  }
  throw new Error("EMAIL_TEMPLATE_NOT_SUPPORTED");
}

async function markFailed(service: any, id: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await service.rpc("mark_email_delivery_failed", {
    p_delivery_id: id,
    p_error: message.replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]").slice(0, 1000),
  });
}

async function processClaimedDelivery(service: any, provider: any, delivery: any, mode: string, config: any) {
  if (mode === "dev-test") {
    const allowlist = (Deno.env.get("MAZZI_EMAIL_TEST_ALLOWLIST") || "")
      .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (!allowlist.includes(String(delivery.recipient_email).toLowerCase())) {
      await markFailed(service, delivery.id, "EMAIL_DEV_RECIPIENT_NOT_ALLOWLISTED");
      return { deliveryId: delivery.id, status: "FAILED", code: "RECIPIENT_NOT_ALLOWLISTED" };
    }
  }

  try {
    const params = await resolveParams(service, delivery, config);
    const html = await renderEmailTemplate(delivery.template_name, params);
    const result = await provider.send({
      to: delivery.recipient_email,
      subject: EMAIL_SUBJECTS[delivery.template_name],
      html,
      idempotencyKey: delivery.idempotency_key,
    });
    const { error: sentError } = await service.rpc("mark_email_delivery_sent", {
      p_delivery_id: delivery.id,
      p_provider: result.provider,
      p_provider_message_id: result.providerMessageId,
    });
    if (sentError) throw new Error("EMAIL_DELIVERY_FINALIZE_FAILED");
    return { deliveryId: delivery.id, status: "SENT", providerMessageId: result.providerMessageId };
  } catch (error) {
    await markFailed(service, delivery.id, error);
    return { deliveryId: delivery.id, status: "FAILED", code: "DELIVERY_FAILED" };
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return reply(405, { message: "Método não permitido." });
  const expectedToken = (Deno.env.get("MAZZI_EMAIL_DELIVERY_TOKEN") || "").trim();
  if (!expectedToken || request.headers.get("x-mazzi-email-delivery-token") !== expectedToken) {
    return reply(401, { message: "Não autorizado." });
  }
  const mode = (Deno.env.get("MAZZI_EMAIL_DELIVERY_MODE") || "disabled").trim();
  if (!["dev-test", "enabled"].includes(mode)) return reply(503, { message: "Delivery de e-mail está desabilitado." });

  let payload: any;
  try { payload = await request.json(); } catch { return reply(400, { message: "Payload inválido." }); }
  if (payload?.deliveryId !== undefined && !isUuid(payload.deliveryId)) {
    return reply(400, { message: "deliveryId inválido." });
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceRoleKey) return reply(503, { message: "Delivery de e-mail não configurado." });
  let provider;
  try { provider = createResendEmailProviderFromEnv({
    RESEND_API_KEY: Deno.env.get("RESEND_API_KEY"),
    RESEND_FROM_EMAIL: Deno.env.get("RESEND_FROM_EMAIL"),
  }); } catch { return reply(503, { message: "Provedor de e-mail não configurado." }); }

  const service = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let config;
  try {
    config = readEmailRuntimeConfig({
      MAZZI_STUDENT_APP_URL: Deno.env.get("MAZZI_STUDENT_APP_URL"),
      MAZZI_PRO_APP_URL: Deno.env.get("MAZZI_PRO_APP_URL"),
      MAZZI_EMAIL_LOGO_URL: Deno.env.get("MAZZI_EMAIL_LOGO_URL"),
    });
  } catch { return reply(503, { message: "URLs do e-mail não configuradas." }); }

  const requestedDeliveryId = payload.deliveryId;
  if (requestedDeliveryId && payload.retry === true) {
    const { error } = await service.rpc("retry_email_delivery", { p_delivery_id: requestedDeliveryId });
    if (error) return reply(409, { message: "A entrega não pode ser retentada neste estado." });
  }

  const results = [];
  const maxItems = requestedDeliveryId ? 1 : 10;
  for (let index = 0; index < maxItems; index += 1) {
    const claim = requestedDeliveryId
      ? await service.rpc("claim_email_delivery", { p_delivery_id: requestedDeliveryId })
      : await service.rpc("claim_next_email_delivery");
    if (claim.error) return reply(500, { message: "Não foi possível reservar a entrega." });
    const delivery = Array.isArray(claim.data) ? claim.data[0] : claim.data;
    if (!delivery) break;
    results.push(await processClaimedDelivery(service, provider, delivery, mode, config));
    if (requestedDeliveryId) break;
  }

  if (results.length === 0) {
    return requestedDeliveryId
      ? reply(409, { message: "A entrega já está em processamento, foi concluída ou não existe." })
      : reply(200, { status: "NO_WORK", processed: 0 });
  }
  return reply(200, { status: "PROCESSED", processed: results.length, results });
});
