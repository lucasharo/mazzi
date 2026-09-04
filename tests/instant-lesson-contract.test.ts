import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { targetFromNotification } from '../src/lib/notification-navigation';

const migration = readFileSync('supabase/migrations/20260904011639_task_089_instant_lesson.sql', 'utf8');
const dynamicScheduleMigration = readFileSync('supabase/migrations/20260904032658_task_089_dynamic_schedule_window.sql', 'utf8');
const offerClockMigration = readFileSync('supabase/migrations/20260904034327_task_089_offer_server_clock.sql', 'utf8');
const instantMatchHoldMigration = readFileSync('supabase/migrations/20260904131400_task_089_instant_match_booking_hold.sql', 'utf8');
const instantMatchActorLockMigration = readFileSync('supabase/migrations/20260904132315_task_089_instant_match_actor_lock.sql', 'utf8');
const instantMatchContextMigration = readFileSync('supabase/migrations/20260904132533_task_089_instant_match_context_checks.sql', 'utf8');
const instantMatchSlotMigration = readFileSync('supabase/migrations/20260904132856_task_089_instant_match_slot_validation.sql', 'utf8');
const instantRequestCleanupMigration = readFileSync('supabase/migrations/20260904140000_task_089_instant_request_cleanup_after_cancel.sql', 'utf8');
const instantPaymentStatusMigration = readFileSync('supabase/migrations/20260904143000_task_089_instant_payment_status_notification.sql', 'utf8');
const instantPaymentMapGateMigration = readFileSync('supabase/migrations/20260904150000_task_089_instant_payment_map_gate.sql', 'utf8');
const instantBlockersFixMigration = readFileSync('supabase/migrations/20260904160000_task_089_instant_lesson_blockers_and_rbac_fix.sql', 'utf8');
const dbService = readFileSync('src/lib/db-service.ts', 'utf8');
const instantModal = readFileSync('src/apps/student/components/InstantLessonModal.tsx', 'utf8');
const instantWizard = readFileSync('src/components/instant/InstantLessonWizard.tsx', 'utf8');
const studentApp = readFileSync('src/apps/student/StudentApp.tsx', 'utf8');
const providerApp = readFileSync('src/apps/provider/ProviderApp.tsx', 'utf8');
const providerInstantPanel = readFileSync('src/apps/provider/components/ProviderInstantLessonPanel.tsx', 'utf8');
const instantOfferCard = readFileSync('src/components/instant/InstantLessonOfferCard.tsx', 'utf8');
const stripeReturnScreen = readFileSync('src/apps/student/components/StripeCheckoutReturnScreen.tsx', 'utf8');

describe('TASK-089 Aula Agora persistence contract', () => {
  it('takes searching map coordinates from the meeting point contract', () => {
    expect(instantModal).toContain('activeRequest.request.meetingPoint?.latitude');
    expect(instantModal).toContain('activeRequest.request.meetingPoint?.longitude');
    expect(instantModal).not.toContain('activeRequest.request.latitude');
    expect(instantModal).not.toContain('activeRequest.request.longitude');
  });
  it('creates the four private matching entities with restrictive RLS', () => {
    for (const table of ['provider_instant_settings', 'instant_lesson_requests', 'instant_lesson_offers', 'instant_provider_locations']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain('USING (FALSE)');
    }
    expect(migration).toContain('REVOKE ALL ON TABLE public.provider_instant_settings, public.instant_lesson_requests');
    expect(migration).not.toContain('service_role');
  });

  it('keeps money in integer cents and accepts a match atomically', () => {
    expect(migration).toContain('instant_price_in_cents INTEGER NOT NULL');
    expect(migration).toContain('offered_price_in_cents INTEGER NOT NULL');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("SET status = 'ACCEPTED'");
    expect(migration).toContain("SET status = 'LOST_RACE'");
    expect(migration).toContain('public.create_booking_hold');
    expect(migration).toContain("'AULA_AGORA'");
    expect(migration).toContain("public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)");
    expect(migration).toContain("'INSTANT_LESSON_OFFER'");
    expect(migration).toContain("'instant_offer', v_offer_id, 'PRO', 'instant_offer'");
  });

  it('exposes only authenticated RPCs to the frontend service layer', () => {
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.create_instant_lesson_request');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.respond_to_instant_offer');
    expect(dbService).toContain("sp.rpc('get_instant_price_options'");
    expect(dbService).toContain("sp.rpc('respond_to_instant_offer'");
    expect(dbService).not.toContain("sp.from('instant_lesson_requests')");
    expect(dbService).not.toContain("sp.from('instant_lesson_offers')");
  });

  it('routes an instant offer notification to the PRO Aula Agora tab', () => {
    const target = targetFromNotification({
      type: 'INSTANT_LESSON_OFFER',
      appContext: 'PRO',
      entityType: 'instant_offer',
      entityId: '11111111-1111-4111-8111-111111111111',
    });
    expect(target).toEqual({ ok: true, target: {
      version: 1, appContext: 'PRO', entityType: 'instant_offer',
      entityId: '11111111-1111-4111-8111-111111111111', action: 'instant_offer',
    } });
  });

  it('keeps the Aula Agora actions from submitting an outer form', () => {
    expect(instantWizard).toContain('<Button type="button"');
    expect(instantWizard).not.toMatch(/<Button\s+(?!type="button")/);
  });

  it('allows a future lesson when the live arrival and safety window fit', () => {
    expect(dynamicScheduleMigration).toContain('b.scheduled_start_at <= v_now');
    expect(dynamicScheduleMigration).toContain('b.vehicle_id = v_candidate.vehicle_id');
    expect(dynamicScheduleMigration).toContain('v_end + MAKE_INTERVAL(mins => v_eta + 15) > v_next.scheduled_start_at');
    expect(dynamicScheduleMigration).not.toMatch(/b\.scheduled_start_at > NOW\(\)\s+AND b\.scheduled_end_at > NOW\(\)/);
  });

  it('keeps stale price previews from showing a transient search state', () => {
    expect(studentApp).toContain('const latestPriceOptions = await dbService.getInstantPriceOptions(params);');
    expect(studentApp).toContain("dispatched.status === 'FAILED' || dispatched.offersCreated < 1");
    expect(studentApp).not.toContain('setActiveInstantLesson({ request: nextRequest });');
    expect(instantWizard).toContain('INSTANT_NO_PROFESSIONAL_AVAILABLE');
  });

  it('renews the online professional location before the freshness window expires', () => {
    expect(providerApp).toContain('INSTANT_PROVIDER_LOCATION_INTERVAL_SECONDS * 1000');
    expect(providerApp).toContain("document.addEventListener('visibilitychange', refresh)");
    expect(providerApp).toContain('const refresh = () => void refreshInstantProviderLocation();');
    expect(providerApp).toContain('dbService.upsertMyInstantLocation');
  });

  it('refreshes incoming offers immediately when the PRO tab becomes visible', () => {
    expect(providerApp).toContain('const refreshOnVisibility = () => {');
    expect(providerApp).toContain("if (document.visibilityState === 'visible') void loadInstantOffers();");
    expect(providerApp).toContain("document.addEventListener('visibilitychange', refreshOnVisibility);");
    expect(providerApp).toContain("document.removeEventListener('visibilitychange', refreshOnVisibility);");
  });

  it('uses the backend clock for the offer countdown', () => {
    expect(dbService).toContain("sp.rpc('get_my_instant_offers_snapshot')");
    expect(offerClockMigration).toContain('get_my_instant_offers_snapshot');
    expect(offerClockMigration).toContain("'server_now', v_server_now");
    expect(providerInstantPanel).toContain('serverClockOffsetMs');
    expect(providerInstantPanel).toContain('instantOffersServerNow');
    expect(providerInstantPanel).toContain('new Date(offer.expiresAt).getTime() - (now + serverClockOffsetMs)');
    expect(providerInstantPanel).toContain("document.addEventListener('visibilitychange', syncNow);");
    expect(providerInstantPanel).toContain("window.addEventListener('focus', syncNow);");
  });

  it('prevents duplicate offer responses and clears stale cards after rejection', () => {
    expect(providerApp).toContain('instantOfferRespondingRef.current.has(offerId)');
    expect(providerApp).toContain('instantOfferRespondingRef.current.add(offerId);');
    expect(providerApp).toContain('await loadInstantOffers();');
    expect(providerApp).toContain('instantOfferRespondingRef.current.delete(offerId);');
  });

  it('does not reuse an idempotency key after a terminal instant search', () => {
    expect(studentApp).toContain('if (!active) instantRequestIdempotencyRef.current = null;');
  });

  it('keeps the offer action server-authoritative when a tab timer is stale', () => {
    expect(instantOfferCard).toContain("const actionable = offer.status === 'PENDING';");
    expect(instantOfferCard).not.toContain("offer.status === 'PENDING' && (secondsLeft == null || secondsLeft > 0)");
  });

  it('releases Aula Agora after its payment hold is cancelled', () => {
    expect(instantRequestCleanupMigration).toContain("SET status = 'CANCELLED'");
    expect(instantRequestCleanupMigration).toContain('ilr.booking_id = p_booking_id');
    expect(instantRequestCleanupMigration).toContain("b.status IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER', 'EXPIRED', 'PAYMENT_FAILED')");
    expect(instantRequestCleanupMigration).toContain("b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')");
    expect(instantRequestCleanupMigration).toContain('CREATE OR REPLACE FUNCTION public.get_my_active_instant_request()');
    expect(instantRequestCleanupMigration).toContain('CREATE OR REPLACE FUNCTION public.cancel_pending_booking');
    expect(instantRequestCleanupMigration).toContain("SET status = 'DECLINED'");
  });

  it('shows the payment handoff to the provider and notifies both app contexts', () => {
    expect(providerInstantPanel).toContain('pendingPaymentInstantBookings');
    expect(providerInstantPanel).toContain("O aluno está finalizando o pagamento");
    expect(providerInstantPanel).toContain("Aguarde a confirmação do pagamento antes de se deslocar.");
    expect(instantPaymentStatusMigration).toContain("CASE WHEN recipient_id = v_booking.student_id THEN 'STUDENT' ELSE 'PRO' END");
    expect(instantPaymentStatusMigration).toContain("'BOOKING_CONFIRMED'");
    expect(instantPaymentStatusMigration).toContain('public.notify_booking_participants');
    expect(instantModal).toContain('confirme o pagamento para iniciar');
  });

  it('opens the existing payment confirmation and returns to the Aula Agora map after payment', () => {
    expect(instantModal).toContain('onPayBooking?: (bookingId: string) => void');
    expect(instantModal).toContain('Confirmar pagamento');
    expect(studentApp).toContain('openInstantBookingCheckout');
    expect(studentApp).toContain("setIsInstantLessonOpen(false);");
    expect(studentApp).toContain("setResumeBooking(booking);");
    expect(studentApp).toContain("confirmedBooking?.snapshot?.source === 'AULA_AGORA'");
    expect(studentApp).toContain("setIsInstantLessonOpen(true);");
    expect(studentApp).toContain('INSTANT_PAYMENT_BOOKING_STORAGE_KEY');
    expect(instantPaymentMapGateMigration).toContain("b.status IN ('CONFIRMED', 'IN_PROGRESS')");
    expect(instantPaymentMapGateMigration).not.toContain("b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')");
    expect(stripeReturnScreen).toContain('onSuccessComplete?: () => void');
    expect(stripeReturnScreen).toContain('if (isSuccess) onSuccessComplete?.();');
  });

  it('creates the instant booking hold with the matched student context', () => {
    expect(instantMatchHoldMigration).toContain('CREATE OR REPLACE FUNCTION public.create_instant_booking_hold(');
    expect(instantMatchHoldMigration).toContain('v_request.student_id IS DISTINCT FROM p_student_id');
    expect(instantMatchHoldMigration).toContain('v_quote.student_id IS DISTINCT FROM p_student_id');
    expect(instantMatchHoldMigration).toContain('v_offer.instructor_id = v_actor_id');
    expect(instantMatchHoldMigration).toContain("'BOOKING_CREATE_HOLD_INSTANT_MATCH'");
    expect(instantMatchHoldMigration).toContain('v_booking := public.create_instant_booking_hold(');
    expect(instantMatchHoldMigration).not.toContain('v_booking := public.create_booking_hold(');
    expect(instantMatchHoldMigration).toContain('REVOKE ALL ON FUNCTION public.create_instant_booking_hold');
    expect(instantMatchActorLockMigration).toContain("hashtextextended(''student-profile:'' || p_student_id::text, 0)");
    expect(instantMatchActorLockMigration).toContain('INSTANT_BOOKING_HOLD_LOCK_NOT_FOUND');
    expect(instantMatchActorLockMigration).toContain('pg_advisory_xact_lock');
    expect(instantMatchContextMigration).toContain('INSTANT_BOOKING_HOLD_SELF_BOOKING_CHECK_NOT_FOUND');
    expect(instantMatchContextMigration).toContain('PRO is expected to accept an offer for its own offering');
    expect(instantMatchSlotMigration).toContain('INSTANT_BOOKING_HOLD_SLOT_CHECK_NOT_FOUND');
    expect(instantMatchSlotMigration).toContain('booking exclusion constraints');
  });

  it('enforces multi-role check, location RBAC, distinct count, and wave deduplication', () => {
    expect(instantBlockersFixMigration).toContain('public.user_has_role');
    expect(instantBlockersFixMigration).toContain('auth.uid() <> p_instructor_id');
    expect(instantBlockersFixMigration).toContain('COUNT(DISTINCT c.instructor_id)');
    expect(instantBlockersFixMigration).toContain('DISTINCT ON (o.instructor_id)');
  });
});
