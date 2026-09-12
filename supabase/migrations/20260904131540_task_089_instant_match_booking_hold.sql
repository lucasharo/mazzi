-- TASK-089: the PRO acceptance path must create the student's booking hold
-- without impersonating the student in create_booking_hold().
--
-- The normal checkout procedure remains unchanged and continues to require
-- auth.uid() = p_student_id. This private-by-privilege procedure is callable
-- only from the SECURITY DEFINER instant-offer workflow, and revalidates the
-- offer, request, quote and caller relationship before creating the hold.

CREATE OR REPLACE FUNCTION public.create_instant_booking_hold(
  p_offer_id uuid,
  p_quote_id uuid,
  p_student_id uuid,
  p_idempotency_key varchar DEFAULT NULL,
  p_hold_duration_minutes integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_offer record;
  v_request record;
  v_quote record;
  v_provider record;
  v_vehicle record;
  v_offering record;
  v_existing_booking record;
  v_booking_id uuid;
  v_now timestamptz := now();
  v_snapshot jsonb;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_student_id IS NULL OR p_quote_id IS NULL OR p_offer_id IS NULL THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_CONTEXT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT io.* INTO v_offer
    FROM public.instant_lesson_offers io
   WHERE io.id = p_offer_id
   FOR UPDATE;
  IF NOT FOUND OR NOT (
    v_offer.instructor_id = v_actor_id
    OR EXISTS (
      SELECT 1
        FROM public.providers p
       WHERE p.id = v_offer.provider_id
         AND p.user_id = v_actor_id
    )
  ) THEN
    RAISE EXCEPTION 'INSTANT_OFFER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT ilr.* INTO v_request
    FROM public.instant_lesson_requests ilr
   WHERE ilr.id = v_offer.request_id
   FOR UPDATE;
  IF NOT FOUND OR v_request.student_id IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_CONTEXT_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT q.* INTO v_quote
    FROM public.quotes q
   WHERE q.id = p_quote_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_quote.student_id IS DISTINCT FROM p_student_id
     OR v_quote.provider_id IS DISTINCT FROM v_offer.provider_id
     OR v_quote.instructor_id IS DISTINCT FROM v_offer.instructor_id
     OR v_quote.vehicle_id IS DISTINCT FROM v_offer.vehicle_id
     OR v_quote.offering_id IS DISTINCT FROM v_offer.offering_id THEN
    RAISE EXCEPTION 'INSTANT_QUOTE_CONTEXT_MISMATCH' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking
      FROM public.bookings
     WHERE idempotency_key = p_idempotency_key
       AND student_id = p_student_id;
    IF FOUND THEN
      IF v_existing_booking.quote_id = p_quote_id THEN
        RETURN jsonb_build_object(
          'success', true,
          'is_idempotent', true,
          'booking_id', v_existing_booking.id,
          'status', v_existing_booking.status,
          'hold_expires_at', v_existing_booking.hold_expires_at
        );
      END IF;
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505';
    END IF;
  END IF;

  UPDATE public.bookings
     SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
   WHERE status = 'PENDING_PAYMENT'
     AND hold_expires_at <= v_now;

  IF v_offer.status <> 'PENDING' OR v_offer.expires_at <= v_now THEN
    RAISE EXCEPTION 'INSTANT_OFFER_EXPIRED' USING ERRCODE = '22023';
  END IF;
  IF v_request.status <> 'SEARCHING' THEN
    RAISE EXCEPTION 'INSTANT_REQUEST_ALREADY_MATCHED' USING ERRCODE = '40001';
  END IF;
  IF v_quote.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'QUOTE_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;
  IF v_quote.expires_at <= v_now THEN
    UPDATE public.quotes SET status = 'EXPIRED' WHERE id = p_quote_id;
    RAISE EXCEPTION 'QUOTE_EXPIRED' USING ERRCODE = '22000';
  END IF;

  PERFORM public.lock_student_profile(p_student_id);

  PERFORM pg_advisory_xact_lock(
    hashtextextended('student-profile:' || p_student_id::text, 0)
  );

  SELECT * INTO v_provider
    FROM public.providers
   WHERE id = v_quote.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;
  SELECT * INTO v_offering
    FROM public.service_offerings
   WHERE id = v_quote.offering_id;
  IF NOT FOUND OR v_offering.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;
  IF public.is_self_booking_context(v_quote.provider_id, v_quote.instructor_id) THEN
    RAISE EXCEPTION 'SELF_BOOKING_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_vehicle
    FROM public.vehicles
   WHERE id = v_quote.vehicle_id;
  IF NOT FOUND OR v_vehicle.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;
  IF v_offering.category::text <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_offering_slot_available(v_quote.offering_id, v_quote.scheduled_start_at) THEN
    RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE = '23P01';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.bookings
     WHERE student_id = p_student_id
       AND status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
       AND slot_range && tstzrange(v_quote.scheduled_start_at, v_quote.scheduled_end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'STUDENT_ALREADY_BOOKED_FOR_SLOT' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('provider-schedule:' || v_quote.provider_id::text, 0)
  );

  v_snapshot := jsonb_build_object(
    'providerId', v_provider.id,
    'providerName', v_provider.trade_name,
    'providerType', v_provider.type,
    'instructorId', v_quote.instructor_id,
    'instructorName', 'Instrutor ' || v_quote.instructor_id,
    'vehicleId', v_vehicle.id,
    'vehicleName', v_vehicle.brand || ' ' || v_vehicle.model,
    'vehicleBrand', v_vehicle.brand,
    'vehicleModel', v_vehicle.model,
    'category', v_offering.category,
    'transmission', v_vehicle.transmission,
    'durationMinutes', v_offering.duration_minutes,
    'priceInCents', v_quote.price_in_cents,
    'platformFeeInCents', v_quote.platform_fee_in_cents,
    'totalInCents', v_quote.total_in_cents,
    'meetingPoint', coalesce(v_provider.neighborhood, v_provider.city)
  );

  v_booking_id := gen_random_uuid();
  INSERT INTO public.bookings (
    id, student_id, provider_id, instructor_id, vehicle_id, offering_id, quote_id,
    status, scheduled_start_at, scheduled_end_at, hold_expires_at, idempotency_key,
    price_in_cents, platform_fee_in_cents, total_in_cents, snapshot_data, created_at, updated_at
  )
  VALUES (
    v_booking_id, p_student_id, v_quote.provider_id, v_quote.instructor_id,
    v_quote.vehicle_id, v_quote.offering_id, p_quote_id, 'PENDING_PAYMENT',
    v_quote.scheduled_start_at, v_quote.scheduled_end_at, v_quote.expires_at,
    p_idempotency_key, v_quote.price_in_cents, v_quote.platform_fee_in_cents,
    v_quote.total_in_cents, v_snapshot, v_now, v_now
  );

  UPDATE public.quotes
     SET status = 'CONSUMED', consumed_at = v_now
   WHERE id = p_quote_id;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, new_value, ip_address, user_agent, severity, created_at
  ) VALUES (
    v_actor_id, 'BOOKING_CREATE_HOLD_INSTANT_MATCH', 'BOOKINGS', v_booking_id,
    jsonb_build_object(
      'booking_id', v_booking_id,
      'quote_id', p_quote_id,
      'offer_id', p_offer_id,
      'student_id', p_student_id
    ),
    '127.0.0.1', 'PostgreSQL Trigger (SECURITY DEFINER)', 'INFO', v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'status', 'PENDING_PAYMENT',
    'hold_expires_at', v_quote.expires_at
  );
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE = '23P01';
END;
$function$;

-- This function is an internal callee of the SECURITY DEFINER workflow above.
-- It is deliberately not exposed to browser roles.
REVOKE ALL ON FUNCTION public.create_instant_booking_hold(uuid, uuid, uuid, varchar, integer)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_instant_offer(p_offer_id UUID, p_action TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_offer public.instant_lesson_offers%ROWTYPE;
  v_req public.instant_lesson_requests%ROWTYPE;
  v_uid UUID := auth.uid();
  v_quote_id UUID;
  v_booking JSONB;
  v_fee_pct NUMERIC := 10;
  v_fee INTEGER;
  v_total INTEGER;
BEGIN
  SELECT io.* INTO v_offer
    FROM public.instant_lesson_offers io
   WHERE io.id = p_offer_id
   FOR UPDATE;
  IF NOT FOUND OR NOT (
    v_offer.instructor_id = v_uid
    OR EXISTS (
      SELECT 1 FROM public.providers p
       WHERE p.id = v_offer.provider_id AND p.user_id = v_uid
    )
  ) THEN
    RAISE EXCEPTION 'INSTANT_OFFER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'DECLINE' THEN
    IF v_offer.status = 'PENDING' THEN
      UPDATE public.instant_lesson_offers
         SET status = 'DECLINED', updated_at = NOW()
       WHERE id = p_offer_id;
    END IF;
    RETURN jsonb_build_object('success', TRUE, 'status', 'DECLINED');
  END IF;
  IF p_action <> 'ACCEPT' THEN
    RAISE EXCEPTION 'INSTANT_ACTION_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_req
    FROM public.instant_lesson_requests
   WHERE id = v_offer.request_id
   FOR UPDATE;
  IF v_offer.status <> 'PENDING' OR v_offer.expires_at <= NOW() THEN
    UPDATE public.instant_lesson_offers
       SET status = 'EXPIRED', updated_at = NOW()
     WHERE id = p_offer_id AND status = 'PENDING';
    RAISE EXCEPTION 'INSTANT_OFFER_EXPIRED' USING ERRCODE = '22023';
  END IF;
  IF v_req.status <> 'SEARCHING' THEN
    UPDATE public.instant_lesson_offers
       SET status = 'LOST_RACE', updated_at = NOW()
     WHERE id = p_offer_id;
    RAISE EXCEPTION 'INSTANT_REQUEST_ALREADY_MATCHED' USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE((value->>'default_percentage')::NUMERIC, 10)
    INTO v_fee_pct
    FROM public.platform_configurations
   WHERE key = 'platform_fees';
  v_fee_pct := GREATEST(0, LEAST(100, COALESCE(v_fee_pct, 10)));
  v_fee := ROUND((v_offer.offered_price_in_cents * v_fee_pct) / 100.0)::INTEGER;
  v_total := v_offer.offered_price_in_cents;
  v_quote_id := gen_random_uuid();
  INSERT INTO public.quotes (
    id, student_id, provider_id, instructor_id, vehicle_id, offering_id,
    scheduled_start_at, scheduled_end_at, price_in_cents, platform_fee_in_cents,
    total_in_cents, status, expires_at, idempotency_key
  )
  VALUES (
    v_quote_id, v_req.student_id, v_offer.provider_id, v_offer.instructor_id,
    v_offer.vehicle_id, v_offer.offering_id,
    NOW() + MAKE_INTERVAL(mins => v_offer.eta_minutes),
    NOW() + MAKE_INTERVAL(mins => v_offer.eta_minutes + (
      SELECT duration_minutes FROM public.service_offerings WHERE id = v_offer.offering_id
    )),
    v_offer.offered_price_in_cents, v_fee, v_total, 'ACTIVE',
    NOW() + INTERVAL '10 minutes', 'instant_quote:' || v_offer.request_id::TEXT
  );

  v_booking := public.create_instant_booking_hold(
    p_offer_id,
    v_quote_id,
    v_req.student_id,
    'instant_booking:' || v_req.id::TEXT,
    10
  );
  UPDATE public.bookings
     SET meeting_point = v_req.meeting_point,
         snapshot_data = snapshot_data || jsonb_build_object(
           'source', 'AULA_AGORA',
           'offeredPriceInCents', v_offer.offered_price_in_cents
         )
   WHERE id = (v_booking->>'booking_id')::UUID;
  UPDATE public.instant_lesson_requests
     SET status = 'MATCHED',
         matched_provider_id = v_offer.provider_id,
         matched_offering_id = v_offer.offering_id,
         booking_id = (v_booking->>'booking_id')::UUID,
         updated_at = NOW()
   WHERE id = v_req.id;
  UPDATE public.instant_lesson_offers
     SET status = 'ACCEPTED', updated_at = NOW()
   WHERE id = v_offer.id;
  UPDATE public.instant_lesson_offers
     SET status = 'LOST_RACE', updated_at = NOW()
   WHERE request_id = v_req.id AND id <> v_offer.id AND status = 'PENDING';

  RETURN jsonb_build_object(
    'success', TRUE,
    'status', 'ACCEPTED',
    'booking_id', (v_booking->>'booking_id')::UUID,
    'request_id', v_req.id
  );
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'INSTANT_SCHEDULE_CONFLICT' USING ERRCODE = '23P01';
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_instant_offer(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_instant_offer(UUID, TEXT) TO authenticated;
