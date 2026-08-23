-- TASK-081: the PRO price is the student's final price.
-- MAZZI's fee is split from that price; it is never added on top.
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_check1;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_total_equals_price_check
  CHECK (total_in_cents = price_in_cents) NOT VALID;

CREATE OR REPLACE FUNCTION public.create_quote_from_offering(
  p_offering_id UUID,
  p_scheduled_start_at TIMESTAMPTZ,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_offering public.service_offerings%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_existing_quote public.quotes%ROWTYPE;
  v_scheduled_end_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ;
  v_ttl_minutes INT := 10;
  v_platform_fee_percentage NUMERIC := 10;
  v_platform_fee_cents INT;
  v_total_in_cents INT;
  v_new_quote_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE((value->>'default_percentage')::NUMERIC, 10)
    INTO v_platform_fee_percentage
    FROM public.platform_configurations
   WHERE key = 'platform_fees';
  v_platform_fee_percentage := GREATEST(0, LEAST(100, COALESCE(v_platform_fee_percentage, 10)));

  UPDATE public.bookings
     SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
   WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_quote FROM public.quotes
     WHERE idempotency_key = TRIM(p_idempotency_key) AND student_id = v_uid LIMIT 1;
    IF FOUND THEN
      SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_existing_quote.offering_id;
      IF v_offering.category::TEXT <> 'B' THEN
        RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
      END IF;
      IF v_existing_quote.offering_id <> p_offering_id OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at THEN
        RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505';
      END IF;
      IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN
        RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'quote_id', v_existing_quote.id,
          'student_id', v_existing_quote.student_id, 'provider_id', v_existing_quote.provider_id,
          'instructor_id', v_existing_quote.instructor_id, 'vehicle_id', v_existing_quote.vehicle_id,
          'offering_id', v_existing_quote.offering_id, 'scheduled_start_at', v_existing_quote.scheduled_start_at,
          'scheduled_end_at', v_existing_quote.scheduled_end_at, 'price_in_cents', v_existing_quote.price_in_cents,
          'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents, 'total_in_cents', v_existing_quote.total_in_cents,
          'status', v_existing_quote.status, 'expires_at', v_existing_quote.expires_at);
      END IF;
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND_OR_INACTIVE' USING ERRCODE = '22023';
  END IF;
  IF v_offering.category::TEXT <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
  END IF;
  IF v_offering.instructor_id IS NULL THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ASSIGNED' USING ERRCODE = '22023'; END IF;
  IF v_offering.vehicle_id IS NULL THEN RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ASSIGNED' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_provider FROM public.providers WHERE id = v_offering.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'PROVIDER_INACTIVE' USING ERRCODE = '22023'; END IF;
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= v_now THEN RAISE EXCEPTION 'SLOT_MUST_BE_IN_FUTURE' USING ERRCODE = '22023'; END IF;
  IF NOT public.is_offering_slot_available(p_offering_id, p_scheduled_start_at) THEN RAISE EXCEPTION 'SELECTED_SLOT_NOT_AVAILABLE' USING ERRCODE = '22023'; END IF;

  v_scheduled_end_at := p_scheduled_start_at + MAKE_INTERVAL(mins => v_offering.duration_minutes);
  v_expires_at := v_now + MAKE_INTERVAL(mins => v_ttl_minutes);
  v_platform_fee_cents := ROUND((v_offering.price_in_cents * v_platform_fee_percentage) / 100.0)::INT;
  v_total_in_cents := v_offering.price_in_cents;
  v_new_quote_id := gen_random_uuid();

  INSERT INTO public.quotes (id, student_id, provider_id, instructor_id, vehicle_id, offering_id,
    scheduled_start_at, scheduled_end_at, price_in_cents, platform_fee_in_cents, total_in_cents,
    status, expires_at, created_at, idempotency_key)
  VALUES (v_new_quote_id, v_uid, v_offering.provider_id, v_offering.instructor_id, v_offering.vehicle_id,
    v_offering.id, p_scheduled_start_at, v_scheduled_end_at, v_offering.price_in_cents,
    v_platform_fee_cents, v_total_in_cents, 'ACTIVE', v_expires_at, v_now, NULLIF(TRIM(p_idempotency_key), ''))
  ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING * INTO v_existing_quote;

  IF v_existing_quote.id IS NULL THEN
    SELECT * INTO v_existing_quote FROM public.quotes
     WHERE student_id = v_uid AND idempotency_key = NULLIF(TRIM(p_idempotency_key), '');
    IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_CONCURRENT_CONFLICT_UNRESOLVABLE' USING ERRCODE = '40001'; END IF;
    IF v_existing_quote.offering_id <> p_offering_id OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at THEN
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505';
    END IF;
    IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN
      RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'quote_id', v_existing_quote.id,
        'student_id', v_existing_quote.student_id, 'provider_id', v_existing_quote.provider_id,
        'instructor_id', v_existing_quote.instructor_id, 'vehicle_id', v_existing_quote.vehicle_id,
        'offering_id', v_existing_quote.offering_id, 'scheduled_start_at', v_existing_quote.scheduled_start_at,
        'scheduled_end_at', v_existing_quote.scheduled_end_at, 'price_in_cents', v_existing_quote.price_in_cents,
        'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents, 'total_in_cents', v_existing_quote.total_in_cents,
        'status', v_existing_quote.status, 'expires_at', v_existing_quote.expires_at);
    END IF;
    RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'quote_id', v_existing_quote.id,
    'student_id', v_existing_quote.student_id, 'provider_id', v_existing_quote.provider_id,
    'instructor_id', v_existing_quote.instructor_id, 'vehicle_id', v_existing_quote.vehicle_id,
    'offering_id', v_existing_quote.offering_id, 'scheduled_start_at', v_existing_quote.scheduled_start_at,
    'scheduled_end_at', v_existing_quote.scheduled_end_at, 'price_in_cents', v_existing_quote.price_in_cents,
    'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents, 'total_in_cents', v_existing_quote.total_in_cents,
    'status', v_existing_quote.status, 'expires_at', v_existing_quote.expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_quote_from_offering(UUID, TIMESTAMPTZ, VARCHAR) TO authenticated, service_role;
