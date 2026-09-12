import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const migration = read('supabase/migrations/20260907211534_instant_aula_agora_cancellation_refund_policy.sql');
const studentModal = read('src/apps/student/components/BookingDetailsModal.tsx');
const providerApp = read('src/apps/provider/ProviderApp.tsx');
const adminApp = read('src/apps/admin/AdminApp.tsx');
const adminComponents = read('src/apps/admin/AdminComponents.tsx');
const dbService = read('src/lib/db-service.ts');
const legacyCancellation = read('supabase/migrations/20260818000034_cancellation_flow_and_rpc.sql');
const stripeCancellation = read('supabase/migrations/20260910170337_student_instant_stripe_cancellation.sql');
const providerStripeCancellation = read('supabase/migrations/20260910180828_allow_provider_instant_stripe_cancellation.sql');
const stripeCancellationFunction = read('supabase/functions/cancel-instant-booking/index.ts');
const providerCancellationModal = read('src/apps/provider/components/ProviderCancellationModal.tsx');
const overduePayoutMigration = read('supabase/migrations/20260910181904_include_overdue_provider_payouts.sql');
const payoutAfterRefundMigration = read('supabase/migrations/20260910182218_process_provider_payouts_after_refund.sql');
const dualProfileProviderCancellation = read('supabase/migrations/20260910182810_fix_provider_cancel_dual_profile_authorization.sql');

describe('Aula Agora cancellation and refund policy', () => {
  it('keeps the policy backend-owned and separate from Agenda', () => {
    expect(migration).toContain('get_instant_cancellation_quote');
    expect(migration).toContain('cancel_instant_booking');
    expect(migration).toContain('so.source AS offering_source');
    expect(migration).toContain('FOR UPDATE OF b');
    expect(migration).toContain('checkin_instructor_at');
    expect(migration).toContain('lesson_started_at');
    expect(migration).toContain('ROUND((');
    expect(migration).toContain('REFUND_IDEMPOTENCY_COLLISION');
    expect(migration).toContain('REQUIRES_REGULATORY_VALIDATION');
    expect(legacyCancellation).toContain('cancel_booking_v2');
  });

  it('contains every configured boundary and provider/platform full-refund path', () => {
    for (const key of [
      'instant_refund_on_way_initial_percent',
      'instant_refund_on_way_middle_percent',
      'instant_refund_on_way_late_percent',
      'instant_refund_after_arrival_percent',
      'instant_refund_initial_window_minutes',
      'instant_refund_middle_window_minutes',
    ]) expect(migration).toContain(key);
    expect(migration).toContain("'BEFORE_PROVIDER_DEPARTURE'");
    expect(migration).toContain("'ON_THE_WAY_INITIAL'");
    expect(migration).toContain("'ON_THE_WAY_MIDDLE'");
    expect(migration).toContain("'ON_THE_WAY_LATE'");
    expect(migration).toContain("'AFTER_ARRIVAL'");
    expect(migration).toContain("IN ('PROVIDER', 'PLATFORM_FAILURE')");
    expect(migration).toContain("'INSTANT_CANCELLATION_STARTED'");
    expect(migration).toContain("'PLATFORM_FAILURE'");
  });

  it('routes preview and final actions through the service layer', () => {
    expect(dbService).toContain("rpc('get_instant_cancellation_quote'");
    expect(dbService).toContain("rpc('cancel_instant_booking'");
    expect(studentModal).toContain('dbService.getInstantCancellationQuote(booking.id)');
    expect(studentModal).toContain('dbService.cancelInstantBooking');
    expect(studentModal).toContain('instantCancellationQuote.refundAmountInCents');
    expect(studentModal).toContain('instantCancellationQuote.retainedAmountInCents');
    expect(providerApp).toContain('dbService.cancelInstantBooking');
  });

  it('exposes the six policy settings to Admin with server validation', () => {
    expect(dbService).toContain("rpc('update_admin_instant_cancellation_config'");
    expect(adminApp).toContain('instantRefundOnWayInitialPercent');
    expect(adminApp).toContain('instantRefundMiddleWindowMinutes');
    expect(adminComponents).toContain('Cancelamento e reembolso');
    expect(adminComponents).toContain('Primeiro limite (minutos)');
    expect(adminComponents).toContain('Segundo limite (minutos)');
    expect(migration).toContain('INVALID_INSTANT_REFUND_PERCENTAGES');
    expect(migration).toContain('INVALID_INSTANT_REFUND_WINDOWS');
  });

  it('routes real Stripe student cancellation through server confirmation', () => {
    expect(stripeCancellation).toContain('prepare_instant_booking_cancellation');
    expect(stripeCancellation).toContain('finalize_instant_booking_cancellation');
    expect(stripeCancellation).toContain("'PENDING'");
    expect(stripeCancellation).toContain("'PROCESSED'");
    expect(stripeCancellation).toContain('p_actor_id');
    expect(stripeCancellationFunction).toContain('https://api.stripe.com/v1/refunds');
    expect(stripeCancellationFunction).toContain('finalize_instant_booking_cancellation');
    expect(dbService).toContain("sp.functions.invoke('cancel-instant-booking'");
  });

  it('authorizes the responsible PRO in the Stripe cancellation path', () => {
    expect(providerStripeCancellation).toContain("v_user_role = 'INSTRUCTOR'");
    expect(providerStripeCancellation).toContain('UNAUTHORIZED_PROVIDER');
    expect(providerStripeCancellation).toContain("v_cancelled_by := 'PROVIDER'");
    expect(providerStripeCancellation).toContain('CANCELLED_BY_PROVIDER');
    expect(providerStripeCancellation).toContain('Cancelamento solicitado pelo profissional, sem motivo informado.');
  });

  it('authorizes a PRO by the booking provider link even when the legacy user role is STUDENT', () => {
    expect(dualProfileProviderCancellation).toContain("v_provider_user_id = v_uid AND v_provider_type = 'INSTRUCTOR'");
    expect(dualProfileProviderCancellation).toContain("v_provider_user_id = p_actor_id AND v_provider_type = 'INSTRUCTOR'");
    expect(dualProfileProviderCancellation).toContain("v_cancelled_by := 'PROVIDER'");
    expect(dualProfileProviderCancellation).toContain("PERFORM public.assert_current_user_student();");
  });

  it('shows provider cancellation failures through the friendly toast flow', () => {
    expect(providerApp).toContain("showProviderFeedback('error', 'Cancelamento não concluído'");
    expect(providerApp).toContain("mapFriendlyErrorMessage(err, 'Não foi possível cancelar a aula agora. Tente novamente em instantes.')");
    expect(providerCancellationModal).not.toContain('errorMessage');
    expect(providerCancellationModal).not.toContain('Edge Function returned');
  });

  it('keeps overdue pending payouts visible to the PRO', () => {
    expect(overduePayoutMigration).toContain("po.scheduled_release_at < NOW() + INTERVAL '7 days'");
    expect(overduePayoutMigration).toContain("po.status::TEXT IN ('PENDING', 'AVAILABLE', 'PROCESSING')");
    expect(overduePayoutMigration).toContain("'is_overdue', po.scheduled_release_at < NOW()");
    expect(overduePayoutMigration).not.toContain("po.scheduled_release_at >= NOW()");
  });

  it('allows the payout processor to release residual earnings after a partial refund', () => {
    expect(payoutAfterRefundMigration).toContain("'PARTIALLY_REFUNDED'");
    expect(payoutAfterRefundMigration).toContain("'REFUNDED'");
    expect(payoutAfterRefundMigration).toContain('claim_due_stripe_payouts');
  });
});
