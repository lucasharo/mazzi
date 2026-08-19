-- ============================================================================
-- MAZZI PLATFORM — MIGRATION 43: FIX BOOKING HOLD GATEWAY
-- File: supabase/migrations/20260818000043_fix_booking_hold_gateway.sql
-- ============================================================================

-- Step 1: Update create_booking_hold to use fake_payment_gateway
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_quote_id UUID,
  p_student_id UUID,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_hold_duration_minutes INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID := auth.uid();
  v_quote RECORD;
  v_provider RECORD;
  v_vehicle RECORD;
  v_offering RECORD;
  v_existing_booking RECORD;
  v_booking_id UUID;
  v_payment_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_hold_expires_at TIMESTAMPTZ;
  v_snapshot JSONB;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_student_id IS DISTINCT FROM v_student_id THEN
    RAISE EXCEPTION 'STUDENT_ID_MISMATCH' USING ERRCODE = '42501';
  END IF;

  -- 1. Idempotency check bound to the authenticated user, not to a client-supplied identity.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking
    FROM public.bookings
    WHERE idempotency_key = p_idempotency_key
      AND student_id = v_student_id;

    IF FOUND THEN
      IF v_existing_booking.quote_id = p_quote_id THEN
        SELECT id INTO v_payment_id
        FROM public.payments
        WHERE booking_id = v_existing_booking.id
        LIMIT 1;

        RETURN jsonb_build_object(
          'success', true,
          'is_idempotent', true,
          'booking_id', v_existing_booking.id,
          'payment_id', v_payment_id,
          'status', v_existing_booking.status,
          'hold_expires_at', v_existing_booking.hold_expires_at
        );
      END IF;

      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505';
    END IF;
  END IF;

  -- 2. Housekeeping: expire stale PENDING_PAYMENT holds before evaluating availability.
  UPDATE public.bookings
  SET status = 'EXPIRED',
      expired_at = v_now,
      updated_at = v_now
  WHERE status = 'PENDING_PAYMENT'
    AND hold_expires_at <= v_now;

  -- 3. Load and lock quote. The quote must belong to auth.uid().
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

  IF v_quote.status != 'ACTIVE' THEN
    IF v_quote.status = 'CONSUMED' THEN
      RAISE EXCEPTION 'QUOTE_ALREADY_CONSUMED' USING ERRCODE = '22000';
    END IF;

    RAISE EXCEPTION 'QUOTE_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  IF v_quote.expires_at <= v_now THEN
    UPDATE public.quotes
    SET status = 'EXPIRED'
    WHERE id = p_quote_id;

    RAISE EXCEPTION 'QUOTE_EXPIRED' USING ERRCODE = '22000';
  END IF;

  -- 4. Revalidate provider, vehicle and offering operational eligibility.
  SELECT * INTO v_provider
  FROM public.providers
  WHERE id = v_quote.provider_id;

  IF NOT FOUND OR v_provider.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = v_quote.vehicle_id;

  IF NOT FOUND OR v_vehicle.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_offering
  FROM public.service_offerings
  WHERE id = v_quote.offering_id;

  IF NOT FOUND OR v_offering.is_active != true THEN
    RAISE EXCEPTION 'OFFERING_NOT_ACTIVE' USING ERRCODE = '22000';
  END IF;

  -- 5. Calculate hold expiration.
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::interval;

  -- 6. Construct immutable historical snapshot.
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
    'meetingPoint', COALESCE(v_provider.neighborhood, v_provider.city)
  );

  -- 7. Insert booking. student_id is always auth.uid().
  v_booking_id := gen_random_uuid();

  INSERT INTO public.bookings (
    id, student_id, provider_id, instructor_id, vehicle_id, offering_id, quote_id,
    status, scheduled_start_at, scheduled_end_at, hold_expires_at, idempotency_key,
    price_in_cents, platform_fee_in_cents, total_in_cents, snapshot_data,
    created_at, updated_at
  ) VALUES (
    v_booking_id, v_student_id, v_quote.provider_id, v_quote.instructor_id,
    v_quote.vehicle_id, v_quote.offering_id, p_quote_id,
    'PENDING_PAYMENT', v_quote.scheduled_start_at, v_quote.scheduled_end_at,
    v_hold_expires_at, p_idempotency_key, v_quote.price_in_cents,
    v_quote.platform_fee_in_cents, v_quote.total_in_cents, v_snapshot,
    v_now, v_now
  );

  -- 8. Mark quote as consumed.
  UPDATE public.quotes
  SET status = 'CONSUMED', consumed_at = v_now
  WHERE id = p_quote_id;

  -- 9. Insert corresponding pending payment row. (FIX: use fake_payment_gateway and new idempotency format)
  v_payment_id := gen_random_uuid();

  INSERT INTO public.payments (
    id, booking_id, method, status, amount_in_cents,
    idempotency_key, gateway_provider, created_at, updated_at
  ) VALUES (
    v_payment_id, v_booking_id, 'PIX', 'PENDING', v_quote.total_in_cents,
    'idem_pay_' || v_booking_id, 'fake_payment_gateway', v_now, v_now
  );

  -- 10. Audit log. actor_id is always auth.uid().
  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, new_value, ip_address, user_agent, severity, created_at
  ) VALUES (
    v_student_id, 'BOOKING_CREATE_HOLD', 'BOOKINGS', v_booking_id,
    jsonb_build_object('booking_id', v_booking_id, 'payment_id', v_payment_id, 'quote_id', p_quote_id),
    '127.0.0.1', 'PostgreSQL Trigger (SECURITY DEFINER)', 'INFO', v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'payment_id', v_payment_id,
    'status', 'PENDING_PAYMENT',
    'hold_expires_at', v_hold_expires_at
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE = '23P01';
END;
$$;

-- Step 2: Permissions for create_booking_hold
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM anon;
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) TO authenticated, service_role;

-- Step 3: Data-fix for legacy payments
-- We migrate legacy pending payments created with supabase_gateway and idempotency key LIKE 'pay_hold_%'
-- but we only update them if the booking is still 'PENDING_PAYMENT' and the new idempotency key does not violate uniqueness.
UPDATE public.payments p
SET gateway_provider = 'fake_payment_gateway',
    idempotency_key = 'idem_pay_' || p.booking_id,
    updated_at = NOW()
FROM public.bookings b
WHERE p.booking_id = b.id
  AND b.status = 'PENDING_PAYMENT'
  AND p.gateway_provider = 'supabase_gateway'
  AND p.idempotency_key LIKE 'pay_hold_%'
  AND p.status = 'PENDING'
  AND NOT EXISTS (
    SELECT 1 FROM public.payments pp WHERE pp.idempotency_key = 'idem_pay_' || p.booking_id
  );

-- Step 4: Fix create_booking_payment to handle supabase_gateway safely
CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id UUID,
  p_method public.payment_method,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_gateway_provider VARCHAR DEFAULT 'fake_payment_gateway'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_booking RECORD;
  v_payment RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_payment_id UUID;
  v_effective_idem_key VARCHAR;
BEGIN
  -- 1. Authentication Check
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000';
  END IF;

  -- 2. Lock & Load Booking (FOR UPDATE)
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Ownership Check (Must belong to authenticated student)
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 4. Booking Status Check
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    IF v_booking.status = 'CONFIRMED' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    ELSE
      RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 5. Hold Expiration Check
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings
    SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'BOOKING_HOLD_EXPIRED',
      'message', 'The booking hold has expired'
    );
  END IF;

  -- 6. Gateway Whitelist
  IF p_gateway_provider <> 'fake_payment_gateway' THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000';
  END IF;

  -- 7. Idempotency Key Cross-Booking Reuse Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment
    FROM public.payments
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND AND v_payment.booking_id <> p_booking_id THEN
      RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BOOKING' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 8. Existing Payment Lookup for this booking
  SELECT * INTO v_payment
  FROM public.payments
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_payment.status = 'PAID' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    END IF;

    IF v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
      IF v_payment.gateway_provider = 'supabase_gateway' THEN
        -- Safely migrate this payment so it can be confirmed
        UPDATE public.payments
        SET gateway_provider = 'fake_payment_gateway',
            idempotency_key = 'idem_pay_' || p_booking_id,
            method = p_method,
            updated_at = v_now
        WHERE id = v_payment.id;
      ELSIF v_payment.method <> p_method AND v_payment.status = 'PENDING' THEN
        UPDATE public.payments
        SET method = p_method, updated_at = v_now
        WHERE id = v_payment.id;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'is_idempotent', true,
        'payment_id', v_payment.id,
        'booking_id', v_payment.booking_id,
        'status', v_payment.status,
        'amount_in_cents', v_payment.amount_in_cents
      );
    END IF;
    -- If status is FAILED, DECLINED, or CANCELLED, fall through to create a new PENDING payment attempt below.
  END IF;

  -- 9. Create New Payment Attempt
  v_payment_id := gen_random_uuid();
  v_effective_idem_key := COALESCE(p_idempotency_key, 'idem_pay_' || v_booking.id || '_' || extract(epoch from v_now)::bigint);

  INSERT INTO public.payments (
    id, booking_id, student_id, provider_id, method, status,
    amount_in_cents, platform_fee_in_cents, provider_amount_in_cents,
    idempotency_key, gateway_provider, created_at, updated_at
  ) VALUES (
    v_payment_id, v_booking.id, v_booking.student_id, v_booking.provider_id,
    p_method, 'PENDING', v_booking.total_in_cents, v_booking.platform_fee_in_cents,
    (v_booking.total_in_cents - v_booking.platform_fee_in_cents),
    v_effective_idem_key, p_gateway_provider, v_now, v_now
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'payment_id', v_payment_id,
    'booking_id', v_booking.id,
    'status', 'PENDING',
    'amount_in_cents', v_booking.total_in_cents
  );
END;
$$;

-- Permissions for create_booking_payment
REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) TO authenticated, service_role;
