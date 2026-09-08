-- The latest quote RPC accidentally replaced the configurable expiration
-- with a hard-coded ten-minute deadline. Keep the database as the source of
-- truth for the Student checkout countdown and booking hold.

CREATE OR REPLACE FUNCTION public.create_quote_from_offering(
  p_offering_id uuid,
  p_scheduled_start_at timestamptz,
  p_idempotency_key varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_offering public.service_offerings%rowtype;
  v_provider public.providers%rowtype;
  v_existing_quote public.quotes%rowtype;
  v_scheduled_end_at timestamptz;
  v_now timestamptz := now();
  v_expires_at timestamptz;
  v_ttl_minutes integer;
  v_platform_fee_percentage numeric;
  v_platform_fee_cents int;
  v_total_in_cents int;
  v_new_quote_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();

  SELECT CASE
    WHEN value->>'expiration_minutes' ~ '^[0-9]+$'
      THEN (value->>'expiration_minutes')::integer
  END
    INTO v_ttl_minutes
    FROM public.platform_configurations
   WHERE key = 'quote_settings';
  IF v_ttl_minutes IS NULL OR v_ttl_minutes < 1 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: quoteExpirationMinutes não está configurado.' USING ERRCODE = '22023';
  END IF;

  SELECT CASE
    WHEN value->>'default_percentage' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (value->>'default_percentage')::numeric
  END INTO v_platform_fee_percentage
    FROM public.platform_configurations WHERE key = 'platform_fees';
  IF v_platform_fee_percentage IS NULL OR v_platform_fee_percentage < 0 OR v_platform_fee_percentage > 100 THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: platformFeeDefaultPercentage não está configurado.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.bookings SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
    WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;

  IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_quote FROM public.quotes
      WHERE idempotency_key = trim(p_idempotency_key) AND student_id = v_uid LIMIT 1;
    IF FOUND THEN
      SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_existing_quote.offering_id;
      IF NOT FOUND OR v_offering.category::text <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023'; END IF;
      IF public.is_self_booking_context(v_offering.provider_id, v_offering.instructor_id) THEN RAISE EXCEPTION 'SELF_BOOKING_NOT_ALLOWED' USING ERRCODE = '42501'; END IF;
      IF v_existing_quote.offering_id <> p_offering_id OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at THEN RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505'; END IF;
      IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN
        RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'quote_id', v_existing_quote.id, 'student_id', v_uid, 'provider_id', v_existing_quote.provider_id, 'instructor_id', v_existing_quote.instructor_id, 'vehicle_id', v_existing_quote.vehicle_id, 'offering_id', v_existing_quote.offering_id, 'scheduled_start_at', v_existing_quote.scheduled_start_at, 'scheduled_end_at', v_existing_quote.scheduled_end_at, 'price_in_cents', v_existing_quote.price_in_cents, 'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents, 'total_in_cents', v_existing_quote.total_in_cents, 'status', v_existing_quote.status, 'expires_at', v_existing_quote.expires_at);
      END IF;
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE THEN RAISE EXCEPTION 'OFFERING_NOT_FOUND_OR_INACTIVE' USING ERRCODE = '22023'; END IF;
  IF v_offering.category::text <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY' USING ERRCODE = '22023'; END IF;
  IF v_offering.instructor_id IS NULL THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ASSIGNED' USING ERRCODE = '22023'; END IF;
  IF v_offering.vehicle_id IS NULL THEN RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ASSIGNED' USING ERRCODE = '22023'; END IF;
  IF public.is_self_booking_context(v_offering.provider_id, v_offering.instructor_id) THEN RAISE EXCEPTION 'SELF_BOOKING_NOT_ALLOWED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_provider FROM public.providers WHERE id = v_offering.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'PROVIDER_INACTIVE' USING ERRCODE = '22023'; END IF;
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= v_now THEN RAISE EXCEPTION 'SLOT_MUST_BE_IN_FUTURE' USING ERRCODE = '22023'; END IF;
  IF NOT public.is_offering_slot_available(p_offering_id, p_scheduled_start_at) THEN RAISE EXCEPTION 'SELECTED_SLOT_NOT_AVAILABLE' USING ERRCODE = '22023'; END IF;

  v_scheduled_end_at := p_scheduled_start_at + make_interval(mins => v_offering.duration_minutes);
  v_expires_at := v_now + make_interval(mins => v_ttl_minutes);
  v_platform_fee_cents := round((v_offering.price_in_cents * v_platform_fee_percentage) / 100.0)::int;
  v_total_in_cents := v_offering.price_in_cents;
  v_new_quote_id := gen_random_uuid();
  INSERT INTO public.quotes (id, student_id, provider_id, instructor_id, vehicle_id, offering_id, scheduled_start_at, scheduled_end_at, price_in_cents, platform_fee_in_cents, total_in_cents, status, expires_at, created_at, idempotency_key)
  VALUES (v_new_quote_id, v_uid, v_offering.provider_id, v_offering.instructor_id, v_offering.vehicle_id, v_offering.id, p_scheduled_start_at, v_scheduled_end_at, v_offering.price_in_cents, v_platform_fee_cents, v_total_in_cents, 'ACTIVE', v_expires_at, v_now, NULLIF(trim(p_idempotency_key), ''))
  ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING * INTO v_existing_quote;
  IF v_existing_quote.id IS NULL THEN
    SELECT * INTO v_existing_quote FROM public.quotes WHERE student_id = v_uid AND idempotency_key = NULLIF(trim(p_idempotency_key), '');
    IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_CONCURRENT_CONFLICT_UNRESOLVABLE' USING ERRCODE = '40001'; END IF;
    IF v_existing_quote.offering_id <> p_offering_id OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at THEN RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505'; END IF;
    IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'quote_id', v_existing_quote.id, 'student_id', v_uid, 'provider_id', v_existing_quote.provider_id, 'instructor_id', v_existing_quote.instructor_id, 'vehicle_id', v_existing_quote.vehicle_id, 'offering_id', v_existing_quote.offering_id, 'scheduled_start_at', v_existing_quote.scheduled_start_at, 'scheduled_end_at', v_existing_quote.scheduled_end_at, 'price_in_cents', v_existing_quote.price_in_cents, 'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents, 'total_in_cents', v_existing_quote.total_in_cents, 'status', v_existing_quote.status, 'expires_at', v_existing_quote.expires_at); END IF;
    RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'quote_id', v_existing_quote.id, 'student_id', v_uid, 'provider_id', v_existing_quote.provider_id, 'instructor_id', v_existing_quote.instructor_id, 'vehicle_id', v_existing_quote.vehicle_id, 'offering_id', v_existing_quote.offering_id, 'scheduled_start_at', v_existing_quote.scheduled_start_at, 'scheduled_end_at', v_existing_quote.scheduled_end_at, 'price_in_cents', v_existing_quote.price_in_cents, 'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents, 'total_in_cents', v_existing_quote.total_in_cents, 'status', v_existing_quote.status, 'expires_at', v_existing_quote.expires_at);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_quote_from_offering(uuid, timestamptz, varchar) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_quote_from_offering(uuid, timestamptz, varchar) TO authenticated, service_role;
