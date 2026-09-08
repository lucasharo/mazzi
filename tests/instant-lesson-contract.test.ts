import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { targetFromNotification } from '../src/lib/notification-navigation';
import { isPendingPaymentHoldActive } from '../src/domain/booking';
import { getInstantOfferSecondsLeft } from '../src/domain/instant-lesson';

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
const instantVehicleVisibilityMigration = readFileSync('supabase/migrations/20260905223000_instant_vehicle_visibility.sql', 'utf8');
const canonicalInstructorAvailabilityMigration = readFileSync('supabase/migrations/20260905230000_task_089_canonical_instructor_availability.sql', 'utf8');
const canonicalStatusRlsMigration = readFileSync('supabase/migrations/20260905232000_task_089_canonical_status_rls.sql', 'utf8');
const availabilityWindowMigration = readFileSync('supabase/migrations/20260905234000_task_089_instructor_availability_window.sql', 'utf8');
const dbService = readFileSync('src/lib/db-service.ts', 'utf8');
const instantModal = readFileSync('src/apps/student/components/InstantLessonModal.tsx', 'utf8');
const instantWizard = readFileSync('src/components/instant/InstantLessonWizard.tsx', 'utf8');
const leafletMap = readFileSync('src/components/maps/LeafletMap.tsx', 'utf8');
const searchMap = readFileSync('src/components/search/MapView.tsx', 'utf8');
const studentApp = readFileSync('src/apps/student/StudentApp.tsx', 'utf8');
const providerApp = readFileSync('src/apps/provider/ProviderApp.tsx', 'utf8');
const providerModal = readFileSync('src/apps/provider/components/ProviderBookingDetailsModal.tsx', 'utf8');
const providerInstantPanel = readFileSync('src/apps/provider/components/ProviderInstantLessonPanel.tsx', 'utf8');
const instantOfferCard = readFileSync('src/components/instant/InstantLessonOfferCard.tsx', 'utf8');
const countdownTimer = readFileSync('src/components/ui/CountdownTimer.tsx', 'utf8');
const checkoutModal = readFileSync('src/apps/student/components/CheckoutModal.tsx', 'utf8');
const studentBookingDetails = readFileSync('src/apps/student/components/BookingDetailsModal.tsx', 'utf8');
const stripeCheckoutReturnScreen = readFileSync('src/apps/student/components/StripeCheckoutReturnScreen.tsx', 'utf8');
const bookingChatPanel = readFileSync('src/components/chat/BookingChatPanel.tsx', 'utf8');
const bookingDetailsShared = readFileSync('src/components/booking/BookingDetailsShared.tsx', 'utf8');
const bottomSheet = readFileSync('src/components/ui/BottomSheet.tsx', 'utf8');
const appLogin = readFileSync('src/components/auth/AppLogin.tsx', 'utf8');
const stripeReturnScreen = readFileSync('src/apps/student/components/StripeCheckoutReturnScreen.tsx', 'utf8');

describe('TASK-089 Aula Agora persistence contract', () => {
  it('takes searching map coordinates from the meeting point contract', () => {
    expect(instantModal).toContain('activeRequest.request.meetingPoint?.latitude');
    expect(instantModal).toContain('activeRequest.request.meetingPoint?.longitude');
    expect(instantModal).not.toContain('activeRequest.request.latitude');
    expect(instantModal).not.toContain('activeRequest.request.longitude');
  });
  it('keeps static maps non-interactive and reserves map actions for tracking', () => {
    expect(instantWizard).toContain('showMeetingPointPopup={false}');
    expect(instantWizard).toContain('interactive={false}');
    expect(instantModal).toContain('showMeetingPointPopup={false}');
    expect(searchMap).toContain('interactive={false}');
    expect(leafletMap).toContain('interactive = true');
    expect(leafletMap).toContain('if (interactive && showMeetingPointPopup && !followSelectedProvider)');
    expect(leafletMap).toContain('if (interactive && providerMarker !== \'vehicle\') marker.bindPopup');
    expect(leafletMap).toContain('Keep address-driven maps centered');
    expect(leafletMap).toContain('without remounting the Leaflet instance');
    expect(leafletMap).toContain('map.setView([center.lat, center.lng]');
    expect(instantWizard).toContain('mapCenter={draft.location}');
  });

  it('shows the student tracking action after the PRO starts displacement', () => {
    expect(studentBookingDetails).toContain("['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)");
    expect(studentBookingDetails).toContain('booking?.providerOnTheWayAt');
    expect(studentBookingDetails).toContain('onOpenTracking={() => setIsTrackingOpen(true)}');
  });

  it('removes student maps after the lesson starts', () => {
    expect(studentBookingDetails).toContain("const isLessonStarted = booking?.status === 'IN_PROGRESS' || Boolean(booking?.lessonStartedAt);");
    expect(studentBookingDetails).toContain('!isLessonStarted && isProviderOnTheWay');
    expect(studentBookingDetails).toContain('{!isLessonStarted && !isPendingPayment && visibleMapPoint');
    expect(instantModal).toContain("const isLessonStarted = bookingStatus === 'IN_PROGRESS' || booking?.status === 'IN_PROGRESS' || Boolean(booking?.lessonStartedAt);");
    expect(instantModal).toContain('const showTrackingMap = !isLessonStarted');
  });

  it('keeps the PRO booking detail underneath the nested chat modal', () => {
    expect(providerApp).toContain('onOpenChat={(b) => {\n          setSelectedBookingForChat(b);\n        }}');
    expect(providerApp).not.toContain('setSelectedBooking(null);\n          setSelectedBookingForChat(b);');
    expect(providerApp).toContain('layer="nested"');
  });

  it('keeps chat navigation in the modal header without an internal back button', () => {
    expect(bookingChatPanel).not.toContain('Voltar aos detalhes');
    expect(bookingChatPanel).not.toContain('onBack?: () => void');
  });

  it('shows the student name in the PRO chat details', () => {
    expect(bookingChatPanel).toContain('booking.studentName || \'Aluno não informado\'');
    expect(bookingChatPanel).toContain('const isStudent =');
  });

  it('releases the PRO address one hour before class while keeping the student address protected', () => {
    expect(studentBookingDetails).toContain("const shouldHideProviderLocation = !isLessonStarted");
    expect(studentBookingDetails).toContain('const isAddressReleaseWindowOpen =');
    expect(studentBookingDetails).toContain('scheduledStartMs - (60 * 60 * 1_000)');
    expect(studentBookingDetails).toContain('&& isProviderAddress');
    expect(studentBookingDetails).toContain('&& !isAddressReleaseWindowOpen;');
    expect(studentBookingDetails).not.toContain('O endereço e o mapa serão liberados quando o instrutor clicar em');
    expect(studentBookingDetails).toContain('meetingPoint={visibleMeetingPoint}');
    expect(studentBookingDetails).toContain('meetingPointNotice={meetingPointNotice}');
    expect(studentBookingDetails).toContain('visibleMapPoint');
    expect(studentBookingDetails).toContain('showNavigation={isProviderAddress && !shouldHideProviderLocation && Boolean(mapPoint)}');
    expect(bookingDetailsShared).toContain('showNavigation?: boolean;');
    expect(bookingDetailsShared).toContain('Abrir navegação');
  });

  it('keeps the checkout return summary consistent with the booking detail address release rule', () => {
    expect(stripeCheckoutReturnScreen).toContain('const isAddressReleaseWindowOpen =');
    expect(stripeCheckoutReturnScreen).toContain('scheduledStartMs - (60 * 60 * 1_000)');
    expect(stripeCheckoutReturnScreen).toContain('const shouldHideMeetingPoint = Boolean(booking)');
    expect(stripeCheckoutReturnScreen).toContain('meetingPointNotice');
    expect(stripeCheckoutReturnScreen).toContain('Endereço estará disponível a partir de');
    expect(stripeCheckoutReturnScreen).toContain('Endereço estará disponível quando o instrutor estiver a caminho.');
  });

  it('shows only an unmarked approximate map in the checkout return summary', () => {
    expect(stripeCheckoutReturnScreen).toContain('const meetingPointCoordinates =');
    expect(stripeCheckoutReturnScreen).toContain('mapCenter={mapCenter}');
    expect(stripeCheckoutReturnScreen).toContain('providers={[]}');
    expect(stripeCheckoutReturnScreen).toContain('interactive={false}');
    expect(stripeCheckoutReturnScreen).toContain('sem marcador do endereço exato');
  });

  it('shows the same unmarked regional map while booking details protect the address', () => {
    expect(bookingDetailsShared).toContain('showMarker?: boolean;');
    expect(bookingDetailsShared).toContain('meetingPoint={showMarker ? { lat: latitude, lng: longitude, title } : undefined}');
    expect(studentBookingDetails).toContain('showMarker={false}');
    expect(providerModal).toContain('showMarker={false}');
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

  it('does not poll instant offers while every instructor is paused or expired', () => {
    expect(providerApp).toContain('const instantOffersPollingEnabled = useMemo(() =>');
    expect(providerApp).toContain('isInstantInstructorAvailabilityActive(status, bookingClockMs)');
    expect(providerApp).toContain('if (!instantOffersPollingEnabled) return Promise.resolve();');
    expect(providerApp).toContain('!instantOffersPollingEnabled) return;');
  });

  it('uses the backend clock for the offer countdown', () => {
    expect(dbService).toContain("sp.rpc('get_my_instant_offers_snapshot')");
    expect(offerClockMigration).toContain('get_my_instant_offers_snapshot');
    expect(offerClockMigration).toContain("'server_now', v_server_now");
    expect(providerInstantPanel).toContain('serverClockOffsetMs');
    expect(providerInstantPanel).toContain('instantOffersServerNow');
    expect(providerInstantPanel).not.toContain('Solicitações recebidas');
    expect(providerInstantPanel).not.toContain('offers: InstantLessonOffer[]');
    expect(providerInstantPanel).toContain("document.addEventListener('visibilitychange', syncNow);");
    expect(providerInstantPanel).toContain("window.addEventListener('focus', syncNow);");
  });

  it('uses the backend clock in the PRO offer modal too', () => {
    const expiresAt = '2026-09-07T16:01:00.000Z';
    const localNow = Date.parse('2026-09-07T16:00:30.000Z');
    const localClockIsThirtySecondsAhead = -30_000;

    expect(getInstantOfferSecondsLeft(expiresAt, localNow, localClockIsThirtySecondsAhead)).toBe(60);
    expect(providerApp).toContain('instantOffersServerClockOffsetMs');
    expect(providerApp).toContain('getInstantOfferSecondsLeft(instantOfferSheetOffer.expiresAt, instantOffersClockMs, instantOffersServerClockOffsetMs)');
  });

  it('redirects the PRO from Aula Agora to the confirmed booking details after payment', () => {
    expect(providerApp).toContain("setIsInstantSettingsOpen(false);");
    expect(providerApp).toContain("setIsInstantOperationalModalOpen(false);");
    expect(providerApp).toContain("setIsExternalNavModalOpen(false);");
    expect(providerApp).toContain("setActiveTab('bookings');");
    expect(providerApp).toContain("setSelectedBooking(activeInstantBooking);");
  });

  it('opens the offer bottom sheet when the instant settings screen is opened', () => {
    expect(providerApp).toContain('instantSettingsSheetRequestRef');
    expect(providerApp).toContain('if (!isInstantSettingsOpen)');
    expect(providerApp).toContain("const pendingOffer = instantOffers.find((offer) => offer.status === 'PENDING');");
    expect(providerApp).toContain('setInstantOfferSheetId(pendingOffer.id);');
    expect(bottomSheet).toContain('z-[120]');
    expect(bottomSheet).toContain('createPortal(content, document.body)');
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

  it('routes the empty Aula Agora alternative into the existing agenda wizard', () => {
    expect(instantWizard).toContain('onScheduleLesson?: (location?: { address: string; coordinates: { lat: number; lng: number } }) => void;');
    expect(instantWizard).toContain('if (onScheduleLesson) {');
    expect(instantWizard).toContain('onClose();');
    expect(instantModal).toContain('onScheduleLesson?: (location?: { address: string; coordinates: { lat: number; lng: number } }) => void;');
    expect(instantWizard).toContain('onScheduleLesson(addressValid && draft.location ? { address: draft.address.trim(), coordinates: draft.location } : undefined)');
    expect(studentApp).toContain('setSearchLocation(instantLocation.address);');
    expect(studentApp).toContain('latitude: instantLocation.coordinates.lat');
    expect(studentApp).toContain('onScheduleLesson={openBookingSearch}');
    expect(studentApp).toContain('onClick={() => openBookingSearch()}');
    expect(studentApp).not.toContain('onClick={openBookingSearch}');
    expect(studentApp).not.toContain('onAction={openBookingSearch}');
    expect(studentApp).toContain('resolveMeetingPointAddress(location.lat, location.lng)');
    expect(studentApp).toContain('setSearchLocation((current) => needsMeetingPointAddress(current) ? address : current);');
  });

  it('uses one shared MM:SS timer presentation across countdown surfaces', () => {
    expect(countdownTimer).toContain('rounded-2xl');
    expect(countdownTimer).toContain('font-mono');
    expect(countdownTimer).toContain('Este valor fica reservado por mais');
    expect(instantOfferCard).toContain('<CountdownTimer secondsRemaining={secondsLeft}');
    expect(checkoutModal).toContain('<CountdownTimer secondsRemaining={quoteTimeRemainingSec} />');
    expect(checkoutModal).toContain('<CountdownTimer secondsRemaining={holdTimeRemainingSec}');
    expect(bookingDetailsShared).toContain('<CountdownTimer secondsRemaining={secondsLeft} />');
    expect(appLogin).toContain('<CountdownTimer secondsRemaining={resendCooldown}');
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

  it('does not keep an expired payment handoff visible to the provider', () => {
    const now = Date.parse('2026-09-07T16:00:00Z');
    const pendingBooking = {
      status: 'PENDING_PAYMENT',
      holdExpiresAt: '2026-09-07T15:59:59Z',
    } as any;
    const activeBooking = {
      ...pendingBooking,
      holdExpiresAt: '2026-09-07T16:00:01Z',
    };

    expect(isPendingPaymentHoldActive(pendingBooking, now)).toBe(false);
    expect(isPendingPaymentHoldActive(activeBooking, now)).toBe(true);
    expect(providerApp).toContain('isPendingPaymentHoldActive(b, bookingClockMs, platformConfiguration?.instantLessonExpirationMinutes)');
    expect(providerInstantPanel).toContain('visiblePendingPaymentInstantBookings');
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

  it('keeps Aula Agora independent per vehicle and expires stale disabled offers', () => {
    expect(providerInstantPanel).toContain('Disponível por até 1h após a ativação.');
    expect(providerInstantPanel).toContain("const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'ACTIVE');");
    expect(providerInstantPanel).not.toContain('Veículo ativo');
    expect(providerInstantPanel).toContain("{isOnline ? 'Online' : 'Offline'}");
    expect(providerInstantPanel).toContain('Carro habilitado para Aula Agora');
    expect(providerInstantPanel).not.toContain('Aceitar Aula Agora');
    expect(providerApp).toContain('dbService.setMyInstantInstructorOnline');
    expect(providerApp).not.toContain('dbService.setMyInstantOnline');
    expect(providerApp).not.toContain('const instructorWasOnline = instantSettings.some');
    expect(providerApp).not.toContain('saved = { ...saved, instantOnline: true }');
    expect(instantVehicleVisibilityMigration).toContain('NEW.instant_online := FALSE');
    expect(instantVehicleVisibilityMigration).toContain("SET status = 'EXPIRED'");
    expect(instantVehicleVisibilityMigration).not.toContain('UPDATE public.provider_instant_settings');
  });

  it('uses one canonical instructor status while keeping vehicle eligibility independent', () => {
    expect(canonicalInstructorAvailabilityMigration).toContain('CREATE TABLE IF NOT EXISTS public.provider_instant_instructor_status');
    expect(canonicalInstructorAvailabilityMigration).toContain('PRIMARY KEY (provider_id, instructor_id)');
    expect(canonicalInstructorAvailabilityMigration).toContain('auth.uid() <> p_instructor_id');
    expect(canonicalInstructorAvailabilityMigration).toContain('CREATE OR REPLACE FUNCTION public.set_my_instant_instructor_online');
    expect(canonicalInstructorAvailabilityMigration).toContain('old.instructor_id=o.instructor_id');
    expect(canonicalInstructorAvailabilityMigration).toContain('ROW_NUMBER() OVER(PARTITION BY e.instructor_id');
    expect(canonicalInstructorAvailabilityMigration).toContain('INSTANT_VEHICLE_UNAVAILABLE');
    expect(canonicalInstructorAvailabilityMigration).toContain('provider_instant_instructor_status ist');
    expect(canonicalStatusRlsMigration).toContain('USING (FALSE)');
  });

  it('keeps instructor availability in a backend-owned one-hour window', () => {
    expect(availabilityWindowMigration).toContain('online_since TIMESTAMPTZ');
    expect(availabilityWindowMigration).toContain('online_expires_at TIMESTAMPTZ');
    expect(availabilityWindowMigration).toContain("v_online_expires_at := v_online_since + INTERVAL '1 hour'");
    expect(availabilityWindowMigration).toContain('ist.online_expires_at > NOW()');
    expect(availabilityWindowMigration).toContain('ist.online_expires_at>v_now');
    expect(availabilityWindowMigration).toContain('DROP FUNCTION IF EXISTS public.get_my_instant_instructor_statuses(UUID)');
    expect(providerInstantPanel).toContain('A disponibilidade da Aula Agora expirou. Ative novamente para receber novas solicitações.');
    expect(providerInstantPanel).toContain('isInstantInstructorAvailabilityActive');
    expect(providerApp).toContain('isInstantInstructorAvailabilityActive');
  });
});
