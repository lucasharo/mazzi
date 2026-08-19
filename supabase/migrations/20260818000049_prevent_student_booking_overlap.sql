-- ============================================================================
-- MAZZI PLATFORM — SPRINT 19: PREVENT STUDENT OVERLAPPING BOOKINGS
-- Migration: 20260818000049_prevent_student_booking_overlap.sql
-- ============================================================================

-- 1. Data Safety Guard: Fail migration if active blocking student overlaps exist in database
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bookings a
    JOIN public.bookings b
      ON a.student_id = b.student_id
     AND a.id < b.id
     AND a.slot_range && b.slot_range
    WHERE a.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
      AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
  ) THEN
    RAISE EXCEPTION 'STUDENT_OVERLAP_EXISTING_DATA: Cannot add exclude_student_overlapping_bookings constraint while overlapping student bookings exist in database.'
      USING ERRCODE = '23P01';
  END IF;
END $$;

-- 2. Add Exclusion Constraint for Student Overlapping Bookings
ALTER TABLE public.bookings
  ADD CONSTRAINT exclude_student_overlapping_bookings
  EXCLUDE USING gist (
    student_id WITH =,
    slot_range WITH &&
  )
  WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'));

-- 3. Update create_booking_hold Procedure with Student Overlap Precheck & Diagnostic Error Handler
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

  -- 1. Idempotency check bound to the authenticated user.
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

  -- 4. Precheck: Verify if student already has a blocking booking overlapping the quote timeslot
  IF EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE student_id = v_student_id
      AND status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
      AND slot_range && tstzrange(v_quote.scheduled_start_at, v_quote.scheduled_end_at, '[)')
  ) THEN
    RAISE EXCEPTION 'STUDENT_ALREADY_BOOKED_FOR_SLOT' USING ERRCODE = 'P0001';
  END IF;

  -- 5. Revalidate provider, vehicle and offering operational eligibility.
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

  -- 6. Calculate hold expiration.
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::interval;

  -- 7. Construct immutable historical snapshot.
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

  -- 8. Insert booking. student_id is always auth.uid().
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

  -- 9. Mark quote as consumed.
  UPDATE public.quotes
  SET status = 'CONSUMED', consumed_at = v_now
  WHERE id = p_quote_id;

  -- 10. Insert corresponding pending payment row using fake_payment_gateway.
  v_payment_id := gen_random_uuid();

  INSERT INTO public.payments (
    id, booking_id, method, status, amount_in_cents,
    idempotency_key, gateway_provider, created_at, updated_at
  ) VALUES (
    v_payment_id, v_booking_id, 'PIX', 'PENDING', v_quote.total_in_cents,
    'idem_pay_' || v_booking_id, 'fake_payment_gateway', v_now, v_now
  );

  -- 11. Audit log. actor_id is always auth.uid().
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
    DECLARE
      v_constraint_name TEXT;
    BEGIN
      GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
      IF v_constraint_name = 'exclude_student_overlapping_bookings' THEN
        RAISE EXCEPTION 'STUDENT_ALREADY_BOOKED_FOR_SLOT' USING ERRCODE = '23P01';
      ELSIF v_constraint_name IN ('exclude_instructor_overlapping_bookings', 'exclude_vehicle_overlapping_bookings') THEN
        RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE = '23P01';
      ELSE
        RAISE;
      END IF;
    END;
END;
$$;

-- Permissions for create_booking_hold
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM anon;
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) TO authenticated, service_role;
