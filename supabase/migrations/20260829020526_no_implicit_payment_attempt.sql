-- Separate the temporary booking hold from payment intent creation.
-- A payment attempt must only be created after the student explicitly selects
-- Pix or Credit Card in the checkout.

CREATE OR REPLACE FUNCTION public.create_booking_hold(
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
  v_student_id uuid := auth.uid();
  v_quote record;
  v_provider record;
  v_vehicle record;
  v_offering record;
  v_existing_booking record;
  v_booking_id uuid;
  v_now timestamptz := now();
  v_hold_expires_at timestamptz;
  v_snapshot jsonb;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_student_id IS DISTINCT FROM v_student_id THEN
    RAISE EXCEPTION 'STUDENT_ID_MISMATCH' USING ERRCODE = '42501';
  END IF;

  PERFORM public.lock_student_profile(v_student_id);
  PERFORM public.assert_current_user_student();

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking
      FROM public.bookings
     WHERE idempotency_key = p_idempotency_key
       AND student_id = v_student_id;
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

  SELECT * INTO v_quote
    FROM public.quotes
   WHERE id = p_quote_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_quote.student_id IS DISTINCT FROM v_student_id THEN
    RAISE EXCEPTION 'CROSS_STUDENT_QUOTE_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_quote.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'QUOTE_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;
  IF v_quote.expires_at <= v_now THEN
    UPDATE public.quotes SET status = 'EXPIRED' WHERE id = p_quote_id;
    RAISE EXCEPTION 'QUOTE_EXPIRED' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_provider FROM public.providers WHERE id = v_quote.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_quote.offering_id;
  IF NOT FOUND OR v_offering.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;
  IF public.is_self_booking_context(v_quote.provider_id, v_quote.instructor_id) THEN
    RAISE EXCEPTION 'SELF_BOOKING_NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_quote.vehicle_id;
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
     WHERE student_id = v_student_id
       AND status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
       AND slot_range && tstzrange(v_quote.scheduled_start_at, v_quote.scheduled_end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'STUDENT_ALREADY_BOOKED_FOR_SLOT' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_quote.provider_id::text, 0));
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::interval;
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
    v_booking_id, v_student_id, v_quote.provider_id, v_quote.instructor_id,
    v_quote.vehicle_id, v_quote.offering_id, p_quote_id, 'PENDING_PAYMENT',
    v_quote.scheduled_start_at, v_quote.scheduled_end_at, v_hold_expires_at,
    p_idempotency_key, v_quote.price_in_cents, v_quote.platform_fee_in_cents,
    v_quote.total_in_cents, v_snapshot, v_now, v_now
  );

  UPDATE public.quotes
     SET status = 'CONSUMED', consumed_at = v_now
   WHERE id = p_quote_id;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, new_value, ip_address, user_agent, severity, created_at
  ) VALUES (
    v_student_id, 'BOOKING_CREATE_HOLD', 'BOOKINGS', v_booking_id,
    jsonb_build_object('booking_id', v_booking_id, 'quote_id', p_quote_id),
    '127.0.0.1', 'PostgreSQL Trigger (SECURITY DEFINER)', 'INFO', v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'status', 'PENDING_PAYMENT',
    'hold_expires_at', v_hold_expires_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_booking_hold(uuid, uuid, varchar, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(uuid, uuid, varchar, integer) TO authenticated, service_role;

-- Closing the previous pending attempt prevents an unused Pix or card attempt
-- from remaining active after the student changes the payment method.
CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id uuid,
  p_method public.payment_method,
  p_idempotency_key varchar DEFAULT NULL,
  p_gateway_provider varchar DEFAULT 'fake_payment_gateway'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_booking record;
  v_payment record;
  v_now timestamptz := now();
  v_payment_id uuid;
  v_requested_idem varchar := nullif(btrim(p_idempotency_key), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000';
  END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    IF v_booking.status = 'CONFIRMED' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    END IF;
    RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
  END IF;
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings
       SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
     WHERE id = p_booking_id;
    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;
  IF p_gateway_provider NOT IN ('fake_payment_gateway', 'mercadopago_test') THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000';
  END IF;

  IF v_requested_idem IS NOT NULL THEN
    SELECT * INTO v_payment
      FROM public.payments
     WHERE booking_id = p_booking_id
       AND idempotency_key = v_requested_idem
     ORDER BY created_at DESC
     LIMIT 1;
    IF FOUND AND v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
      UPDATE public.payments
         SET method = p_method, gateway_provider = p_gateway_provider, updated_at = v_now
       WHERE id = v_payment.id;
      RETURN jsonb_build_object(
        'success', true, 'is_idempotent', true, 'payment_id', v_payment.id,
        'booking_id', v_payment.booking_id, 'status', v_payment.status,
        'amount_in_cents', v_payment.amount_in_cents,
        'gateway_provider', p_gateway_provider
      );
    END IF;
  END IF;

  UPDATE public.payments
     SET status = 'CANCELLED', updated_at = v_now,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cancelled_reason', 'PAYMENT_METHOD_CHANGED')
   WHERE booking_id = p_booking_id
     AND status IN ('PENDING', 'AUTHORIZED')
     AND (v_requested_idem IS NULL OR idempotency_key <> v_requested_idem);

  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (
    id, booking_id, method, status, amount_in_cents, idempotency_key,
    gateway_provider, created_at, updated_at
  ) VALUES (
    v_payment_id, p_booking_id, p_method, 'PENDING', v_booking.total_in_cents,
    coalesce(v_requested_idem, 'idem_pay_' || p_booking_id || '_' || v_payment_id),
    p_gateway_provider, v_now, v_now
  );

  RETURN jsonb_build_object(
    'success', true, 'is_idempotent', false, 'payment_id', v_payment_id,
    'booking_id', p_booking_id, 'status', 'PENDING',
    'amount_in_cents', v_booking.total_in_cents,
    'gateway_provider', p_gateway_provider
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_booking_payment(uuid, public.payment_method, varchar, varchar) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(uuid, public.payment_method, varchar, varchar) TO authenticated, service_role;
