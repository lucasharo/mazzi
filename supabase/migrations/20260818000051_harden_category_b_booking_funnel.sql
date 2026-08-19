-- ============================================================================
-- MAZZI PLATFORM — SPRINT 21: HARDEN CATEGORY B BOOKING FUNNEL (TASK-040 REVISED)
-- Migration: 20260818000051_harden_category_b_booking_funnel.sql
-- ============================================================================

-- 1. get_provider_booking_context_public(UUID)
-- Parity: RETURNS TABLE(provider_id uuid, provider_name text, offering_id uuid, ...)
CREATE OR REPLACE FUNCTION public.get_provider_booking_context_public(
  p_provider_id UUID
)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  offering_id UUID,
  instructor_id UUID,
  instructor_name TEXT,
  vehicle_id UUID,
  category TEXT,
  transmission TEXT,
  duration_minutes INT,
  price_in_cents INT,
  vehicle_brand TEXT,
  vehicle_model TEXT,
  vehicle_year INT,
  vehicle_category TEXT,
  vehicle_transmission TEXT,
  vehicle_color TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    p.id AS provider_id,
    p.trade_name::TEXT AS provider_name,
    o.id AS offering_id,
    o.instructor_id,
    iu.name::TEXT AS instructor_name,
    o.vehicle_id,
    o.category::TEXT,
    o.transmission::TEXT,
    o.duration_minutes,
    o.price_in_cents,
    v.brand::TEXT AS vehicle_brand,
    v.model::TEXT AS vehicle_model,
    v.year AS vehicle_year,
    v.category::TEXT AS vehicle_category,
    v.transmission::TEXT AS vehicle_transmission,
    v.color::TEXT AS vehicle_color
  FROM public.providers p
  JOIN public.service_offerings o ON o.provider_id = p.id
  JOIN public.users iu ON iu.id = o.instructor_id AND iu.status = 'ACTIVE'
  JOIN public.vehicles v ON v.id = o.vehicle_id AND v.provider_id = p.id
  WHERE p.id = p_provider_id
    AND p.status = 'ACTIVE'
    AND o.status = 'ACTIVE'
    AND o.is_active = TRUE
    AND o.instructor_id IS NOT NULL
    AND o.category::TEXT = 'B'
    AND v.status = 'ACTIVE'
    AND v.deleted_at IS NULL
  ORDER BY o.price_in_cents, o.id;
$$;

REVOKE ALL ON FUNCTION public.get_provider_booking_context_public(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_provider_booking_context_public(UUID) TO anon, authenticated, service_role;


-- 2. get_available_slots_public(UUID, DATE, DATE)
-- Parity: RETURNS TABLE(offering_id uuid, provider_id uuid, instructor_id uuid, vehicle_id uuid, slot_start_at timestamptz, slot_end_at timestamptz, local_date date, local_start_time time, local_end_time time, timezone text)
CREATE OR REPLACE FUNCTION public.get_available_slots_public(
  p_offering_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS TABLE (
  offering_id UUID,
  provider_id UUID,
  instructor_id UUID,
  vehicle_id UUID,
  slot_start_at TIMESTAMPTZ,
  slot_end_at TIMESTAMPTZ,
  local_date DATE,
  local_start_time TIME,
  local_end_time TIME,
  timezone TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_offering public.service_offerings%ROWTYPE;
  v_interval_minutes INT := 60;
  v_max_horizon INT := 30;
BEGIN
  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to < p_date_from THEN
    RAISE EXCEPTION 'INVALID_SLOT_DATE_RANGE' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE((value->>'slot_interval_minutes')::INT, 60),
         COALESCE((value->>'max_booking_horizon_days')::INT, 30)
    INTO v_interval_minutes, v_max_horizon
  FROM public.platform_configurations
  WHERE key = 'scheduling_settings'
  LIMIT 1;
  v_interval_minutes := GREATEST(COALESCE(v_interval_minutes, 60), 1);
  v_max_horizon := GREATEST(COALESCE(v_max_horizon, 30), 1);

  IF p_date_to - p_date_from > 31 THEN
    RAISE EXCEPTION 'SLOT_DATE_RANGE_TOO_LARGE' USING ERRCODE = '22023';
  END IF;
  IF p_date_to > (CURRENT_DATE + v_max_horizon) THEN
    RAISE EXCEPTION 'SLOT_DATE_BEYOND_BOOKING_HORIZON' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE
     OR v_offering.instructor_id IS NULL OR v_offering.vehicle_id IS NULL THEN
    RETURN;
  END IF;

  IF v_offering.category::TEXT <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for public search' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH base_candidates AS (
    SELECT DISTINCT
      a.timezone::TEXT AS tz,
      gs AS start_at,
      gs + MAKE_INTERVAL(mins => v_offering.duration_minutes) AS end_at
    FROM public.availabilities a
    CROSS JOIN LATERAL GENERATE_SERIES(
      GREATEST(p_date_from, CURRENT_DATE),
      p_date_to,
      INTERVAL '1 day'
    ) d(day_ts)
    CROSS JOIN LATERAL GENERATE_SERIES(
      ((d.day_ts::DATE + a.start_time) AT TIME ZONE a.timezone),
      ((d.day_ts::DATE + a.end_time) AT TIME ZONE a.timezone) - MAKE_INTERVAL(mins => v_offering.duration_minutes),
      MAKE_INTERVAL(mins => v_interval_minutes)
    ) gs
    WHERE a.provider_id = v_offering.provider_id
      AND a.is_active = TRUE
      AND (a.instructor_id IS NULL OR a.instructor_id = v_offering.instructor_id)
      AND (a.vehicle_id IS NULL OR a.vehicle_id = v_offering.vehicle_id)
      AND a.day_of_week = EXTRACT(ISODOW FROM d.day_ts)::INT
      AND (a.effective_from IS NULL OR d.day_ts::DATE >= a.effective_from)
      AND (a.effective_to IS NULL OR d.day_ts::DATE <= a.effective_to)
  ),
  override_candidates AS (
    SELECT DISTINCT
      'America/Sao_Paulo'::TEXT AS tz,
      gs AS start_at,
      gs + MAKE_INTERVAL(mins => v_offering.duration_minutes) AS end_at
    FROM public.availability_exceptions e
    CROSS JOIN LATERAL GENERATE_SERIES(
      e.start_at,
      e.end_at - MAKE_INTERVAL(mins => v_offering.duration_minutes),
      MAKE_INTERVAL(mins => v_interval_minutes)
    ) gs
    WHERE e.provider_id = v_offering.provider_id
      AND e.type = 'AVAILABLE_OVERRIDE'
      AND (e.instructor_id IS NULL OR e.instructor_id = v_offering.instructor_id)
      AND (e.vehicle_id IS NULL OR e.vehicle_id = v_offering.vehicle_id)
      AND (e.start_at AT TIME ZONE 'America/Sao_Paulo')::DATE BETWEEN p_date_from AND p_date_to
  ),
  candidates AS (
    SELECT * FROM base_candidates
    UNION
    SELECT * FROM override_candidates
  )
  SELECT
    v_offering.id,
    v_offering.provider_id,
    v_offering.instructor_id,
    v_offering.vehicle_id,
    c.start_at AS slot_start_at,
    c.end_at AS slot_end_at,
    (c.start_at AT TIME ZONE c.tz)::DATE AS local_date,
    (c.start_at AT TIME ZONE c.tz)::TIME AS local_start_time,
    (c.end_at AT TIME ZONE c.tz)::TIME AS local_end_time,
    c.tz AS timezone
  FROM candidates c
  WHERE c.start_at > NOW()
    AND public.is_offering_slot_available(v_offering.id, c.start_at)
  ORDER BY c.start_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots_public(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots_public(UUID, DATE, DATE) TO anon, authenticated, service_role;


-- 3. create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR)
-- Parity: 100% LIVE logic + Category B defense on offering & fast-path retry
CREATE OR REPLACE FUNCTION public.create_quote_from_offering(
  p_offering_id UUID,
  p_scheduled_start_at TIMESTAMPTZ,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid                UUID         := auth.uid();
  v_offering           public.service_offerings%ROWTYPE;
  v_provider           public.providers%ROWTYPE;
  v_existing_quote     public.quotes%ROWTYPE;
  v_scheduled_end_at   TIMESTAMPTZ;
  v_now                TIMESTAMPTZ  := NOW();
  v_expires_at         TIMESTAMPTZ;
  v_ttl_minutes        INT          := 15;
  v_platform_fee_cents INT          := 1000;
  v_new_quote_id       UUID;
BEGIN
  -- ── 1. Authentication ─────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- ── 2. WRITE PATH HOUSEKEEPING ────────────────────────────────────────────
  UPDATE public.bookings
  SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
  WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;

  -- ── 3. FAST PATH Idempotency Check ────────────────────────────────────────
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_quote
    FROM public.quotes
    WHERE idempotency_key = TRIM(p_idempotency_key)
      AND student_id = v_uid
    LIMIT 1;

    IF FOUND THEN
      -- Defense: Reject Category A even on fast-path idempotent retry
      SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_existing_quote.offering_id;
      IF v_offering.category::TEXT <> 'B' THEN
        RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
      END IF;

      -- Guard: same key must match same request parameters
      IF v_existing_quote.offering_id <> p_offering_id
         OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at
      THEN
        RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
          USING ERRCODE = '23505';
      END IF;

      IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN
        RETURN jsonb_build_object(
          'success',               true,
          'is_idempotent',         true,
          'quote_id',              v_existing_quote.id,
          'student_id',            v_existing_quote.student_id,
          'provider_id',           v_existing_quote.provider_id,
          'instructor_id',         v_existing_quote.instructor_id,
          'vehicle_id',            v_existing_quote.vehicle_id,
          'offering_id',           v_existing_quote.offering_id,
          'scheduled_start_at',    v_existing_quote.scheduled_start_at,
          'scheduled_end_at',      v_existing_quote.scheduled_end_at,
          'price_in_cents',        v_existing_quote.price_in_cents,
          'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents,
          'total_in_cents',        v_existing_quote.total_in_cents,
          'status',                v_existing_quote.status,
          'expires_at',            v_existing_quote.expires_at
        );
      ELSE
        RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  -- ── 4. Offering Validation ─────────────────────────────────────────────────
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND_OR_INACTIVE' USING ERRCODE = '22023';
  END IF;

  IF v_offering.category::TEXT <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
  END IF;

  IF v_offering.instructor_id IS NULL THEN
    RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ASSIGNED' USING ERRCODE = '22023';
  END IF;

  IF v_offering.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ASSIGNED' USING ERRCODE = '22023';
  END IF;

  -- ── 5. Provider Validation ─────────────────────────────────────────────────
  SELECT * INTO v_provider FROM public.providers WHERE id = v_offering.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'PROVIDER_INACTIVE' USING ERRCODE = '22023';
  END IF;

  -- ── 6. Time Validation ────────────────────────────────────────────────────
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= v_now THEN
    RAISE EXCEPTION 'SLOT_MUST_BE_IN_FUTURE' USING ERRCODE = '22023';
  END IF;

  -- ── 7. Slot Availability ──────────────────────────────────────────────────
  IF NOT public.is_offering_slot_available(p_offering_id, p_scheduled_start_at) THEN
    RAISE EXCEPTION 'SELECTED_SLOT_NOT_AVAILABLE' USING ERRCODE = '22023';
  END IF;

  -- ── 8. Compute Values ─────────────────────────────────────────────────────
  v_scheduled_end_at := p_scheduled_start_at + MAKE_INTERVAL(mins => v_offering.duration_minutes);
  v_expires_at       := v_now + MAKE_INTERVAL(mins => v_ttl_minutes);
  v_new_quote_id     := gen_random_uuid();

  -- ── 9. ATOMIC Idempotent INSERT (TOCTOU-safe) ─────────────────────────────
  INSERT INTO public.quotes (
    id,
    student_id,
    provider_id,
    instructor_id,
    vehicle_id,
    offering_id,
    scheduled_start_at,
    scheduled_end_at,
    price_in_cents,
    platform_fee_in_cents,
    total_in_cents,
    status,
    expires_at,
    created_at,
    idempotency_key
  ) VALUES (
    v_new_quote_id,
    v_uid,
    v_offering.provider_id,
    v_offering.instructor_id,
    v_offering.vehicle_id,
    v_offering.id,
    p_scheduled_start_at,
    v_scheduled_end_at,
    v_offering.price_in_cents,
    v_platform_fee_cents,
    (v_offering.price_in_cents + v_platform_fee_cents),
    'ACTIVE',
    v_expires_at,
    v_now,
    NULLIF(TRIM(p_idempotency_key), '')
  )
  ON CONFLICT (student_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_existing_quote;

  -- ── 10. Conflict Branch ───────────────────────────────────────────────────
  IF v_existing_quote.id IS NULL THEN
    SELECT * INTO v_existing_quote
    FROM public.quotes
    WHERE student_id      = v_uid
      AND idempotency_key = NULLIF(TRIM(p_idempotency_key), '');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'QUOTE_CONCURRENT_CONFLICT_UNRESOLVABLE' USING ERRCODE = '40001';
    END IF;

    -- Defense: Reject Category A even on conflict resolution branch
    SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_existing_quote.offering_id;
    IF v_offering.category::TEXT <> 'B' THEN
      RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
    END IF;

    IF v_existing_quote.offering_id <> p_offering_id
       OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at
    THEN
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST'
        USING ERRCODE = '23505';
    END IF;

    IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN
      RETURN jsonb_build_object(
        'success',               true,
        'is_idempotent',         true,
        'quote_id',              v_existing_quote.id,
        'student_id',            v_existing_quote.student_id,
        'provider_id',           v_existing_quote.provider_id,
        'instructor_id',         v_existing_quote.instructor_id,
        'vehicle_id',            v_existing_quote.vehicle_id,
        'offering_id',           v_existing_quote.offering_id,
        'scheduled_start_at',    v_existing_quote.scheduled_start_at,
        'scheduled_end_at',      v_existing_quote.scheduled_end_at,
        'price_in_cents',        v_existing_quote.price_in_cents,
        'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents,
        'total_in_cents',        v_existing_quote.total_in_cents,
        'status',                v_existing_quote.status,
        'expires_at',            v_existing_quote.expires_at
      );
    ELSE
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- ── 11. New Insert Branch ─────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',               true,
    'is_idempotent',         false,
    'quote_id',              v_existing_quote.id,
    'student_id',            v_existing_quote.student_id,
    'provider_id',           v_existing_quote.provider_id,
    'instructor_id',         v_existing_quote.instructor_id,
    'vehicle_id',            v_existing_quote.vehicle_id,
    'offering_id',           v_existing_quote.offering_id,
    'scheduled_start_at',    v_existing_quote.scheduled_start_at,
    'scheduled_end_at',      v_existing_quote.scheduled_end_at,
    'price_in_cents',        v_existing_quote.price_in_cents,
    'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents,
    'total_in_cents',        v_existing_quote.total_in_cents,
    'status',                v_existing_quote.status,
    'expires_at',            v_existing_quote.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR) TO authenticated, service_role;


-- 4. create_booking_hold(UUID, UUID, VARCHAR, INT)
-- Parity: 100% Migration 49 / LIVE logic + Category B defense on offering & fast-path retry
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_quote_id UUID,
  p_student_id UUID,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_hold_duration_minutes INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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
      -- Defense: Reject Category A even on fast-path idempotent retry
      SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_existing_booking.offering_id;
      IF v_offering.category::TEXT <> 'B' THEN
        RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for booking holds' USING ERRCODE = '22023';
      END IF;

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

  IF v_offering.category::TEXT <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for booking holds' USING ERRCODE = '22023';
  END IF;

  -- 6. Calculate hold expiration.
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::INTERVAL;

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

REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(UUID, UUID, VARCHAR, INT) TO authenticated, service_role;
