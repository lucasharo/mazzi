-- Prevent a multi-role Student from contracting their own professional profile.
-- The authenticated identity is always derived from auth.uid(); callers cannot
-- choose which student is evaluated.
CREATE OR REPLACE FUNCTION public.is_self_booking_context(
  p_provider_id uuid,
  p_instructor_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_provider_type text;
  v_provider_user_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT type::text, user_id
    INTO v_provider_type, v_provider_user_id
  FROM public.providers
  WHERE id = p_provider_id;

  -- An independent instructor owns the provider directly. A driving school
  -- remains searchable when the student is merely a school member; only an
  -- offering assigned to that same student is self-booking.
  RETURN (v_provider_type = 'INSTRUCTOR' AND v_provider_user_id = v_user_id)
    OR p_instructor_id = v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.is_self_booking_context(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_providers_public(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters double precision DEFAULT 5000,
  p_category text DEFAULT NULL,
  p_provider_type text DEFAULT 'ALL',
  p_transmission text DEFAULT 'ALL',
  p_min_rating double precision DEFAULT 0,
  p_max_price_cents integer DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_date date DEFAULT NULL
)
RETURNS TABLE(
  provider_id uuid, display_name text, provider_type text, avatar_url text,
  is_verified boolean, rating_average numeric, rating_count integer,
  rating_source text, neighborhood text, city text, public_latitude double precision,
  public_longitude double precision, public_map_location_type text,
  rounded_distance_meters integer, distance_display text,
  starting_price_in_cents integer, normalized_price_cents integer,
  categories text[], transmissions text[], public_offerings jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_search_point geography(Point, 4326);
  v_radius double precision;
  v_limit int;
  v_offset int;
BEGIN
  IF p_user_lat IS NULL OR p_user_lat NOT BETWEEN -90 AND 90
     OR p_user_lng IS NULL OR p_user_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INVALID_SEARCH_COORDINATES' USING ERRCODE = '22023';
  END IF;
  IF p_provider_type IS NULL OR p_provider_type NOT IN ('ALL', 'INSTRUCTOR', 'DRIVING_SCHOOL') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_TYPE' USING ERRCODE = '22023';
  END IF;
  IF p_transmission IS NOT NULL AND p_transmission NOT IN ('ALL', 'MANUAL', 'AUTOMATIC', 'NOT_APPLICABLE') THEN
    RAISE EXCEPTION 'INVALID_TRANSMISSION' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NOT NULL AND p_category <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for public search' USING ERRCODE = '22023';
  END IF;

  v_search_point := ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography;
  v_radius := LEAST(GREATEST(COALESCE(p_radius_meters, 5000), 0), 50000);
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  WITH eligible_offerings AS (
    SELECT o.provider_id,
      MIN(o.price_in_cents)::int AS starting_price_in_cents,
      ARRAY_AGG(DISTINCT o.category::text ORDER BY o.category::text) AS categories,
      ARRAY_AGG(DISTINCT o.transmission::text ORDER BY o.transmission::text) AS transmissions,
      JSONB_AGG(JSONB_BUILD_OBJECT(
        'id', o.id, 'providerId', o.provider_id, 'instructorId', o.instructor_id,
        'instructorName', u.name, 'vehicleId', o.vehicle_id,
        'vehicleTitle', CONCAT(v.brand, ' ', v.model, ' (', v.year, ')'),
        'vehicleType', v.vehicle_type, 'category', o.category,
        'transmission', o.transmission, 'photos', COALESCE(v.photos, ARRAY[]::text[]),
        'durationMinutes', o.duration_minutes, 'priceInCents', o.price_in_cents
      ) ORDER BY o.price_in_cents, o.id) AS public_offerings
    FROM public.service_offerings o
    JOIN public.vehicles v ON v.id = o.vehicle_id
      AND v.provider_id = o.provider_id AND v.status = 'ACTIVE'
      AND v.deleted_at IS NULL AND v.category = o.category
      AND v.transmission = o.transmission
    JOIN public.users u ON u.id = o.instructor_id AND u.status = 'ACTIVE'
    WHERE o.is_active = true AND o.status = 'ACTIVE'
      AND o.instructor_id IS NOT NULL AND o.category::text = 'B'
      AND (p_transmission = 'ALL' OR o.transmission::text = p_transmission)
      AND public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)
      AND NOT public.is_self_booking_context(o.provider_id, o.instructor_id)
    GROUP BY o.provider_id
  )
  SELECT p.id, p.trade_name::text, p.type::text,
    CASE WHEN p.type::text = 'INSTRUCTOR' THEN COALESCE(p.avatar_url, owner_user.avatar_url)
      ELSE p.avatar_url END,
    (p.status = 'ACTIVE'), p.rating_average, p.rating_count, 'REAL'::text,
    p.neighborhood::text, p.city::text, p.public_latitude, p.public_longitude,
    p.public_map_location_type,
    (ROUND(ST_Distance(p.location_geography, v_search_point) / 100.0)::int * 100),
    CONCAT(REPLACE(ROUND((ST_Distance(p.location_geography, v_search_point) / 1000.0)::numeric, 1)::text, '.', ','), ' km'),
    eo.starting_price_in_cents, eo.starting_price_in_cents, eo.categories,
    eo.transmissions, eo.public_offerings
  FROM public.providers p
  JOIN eligible_offerings eo ON eo.provider_id = p.id
  LEFT JOIN public.users owner_user ON owner_user.id = p.user_id AND owner_user.status = 'ACTIVE'
  WHERE p.status = 'ACTIVE' AND ST_DWithin(p.location_geography, v_search_point, v_radius)
    AND (p_provider_type = 'ALL' OR p.type::text = p_provider_type)
    AND p.rating_average >= COALESCE(p_min_rating, 0)
    AND (p_max_price_cents IS NULL OR eo.starting_price_in_cents <= p_max_price_cents)
    AND (p_date IS NULL OR EXISTS (
      SELECT 1 FROM public.service_offerings so_avail
      WHERE so_avail.provider_id = p.id AND so_avail.is_active = true
        AND so_avail.status = 'ACTIVE' AND so_avail.category::text = 'B'
        AND (p_transmission = 'ALL' OR so_avail.transmission::text = p_transmission)
        AND NOT public.is_self_booking_context(so_avail.provider_id, so_avail.instructor_id)
        AND EXISTS (SELECT 1 FROM public.get_available_slots_public(so_avail.id, p_date, p_date))
    ))
  ORDER BY ST_Distance(p.location_geography, v_search_point) ASC, p.id ASC
  LIMIT v_limit OFFSET v_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_provider_booking_context_public(p_provider_id uuid)
RETURNS TABLE(
  provider_id uuid, provider_name text, offering_id uuid, instructor_id uuid,
  instructor_name text, vehicle_id uuid, category text, transmission text,
  duration_minutes integer, price_in_cents integer, vehicle_brand text,
  vehicle_model text, vehicle_year integer, vehicle_category text,
  vehicle_transmission text, vehicle_color text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
  SELECT p.id, p.trade_name::text, o.id, o.instructor_id, u.name::text, v.id,
    o.category::text, o.transmission::text, o.duration_minutes, o.price_in_cents,
    v.brand::text, v.model::text, v.year, v.category::text, v.transmission::text,
    v.color::text
  FROM public.providers p
  JOIN public.service_offerings o ON o.provider_id = p.id
  JOIN public.users u ON u.id = o.instructor_id
  JOIN public.vehicles v ON v.id = o.vehicle_id AND v.provider_id = p.id
  WHERE p.id = p_provider_id AND p.status = 'ACTIVE' AND o.status = 'ACTIVE'
    AND o.is_active AND o.category::text = 'B' AND v.status = 'ACTIVE'
    AND v.deleted_at IS NULL
    AND public.is_provider_instructor_eligible(p.id, o.instructor_id, o.category)
    AND NOT public.is_self_booking_context(o.provider_id, o.instructor_id)
  ORDER BY o.price_in_cents, o.id;
$function$;

CREATE OR REPLACE FUNCTION public.get_available_slots_public(
  p_offering_id uuid, p_date_from date, p_date_to date
)
RETURNS TABLE(
  offering_id uuid, provider_id uuid, instructor_id uuid, vehicle_id uuid,
  slot_start_at timestamptz, slot_end_at timestamptz, local_date date,
  local_start_time time, local_end_time time, timezone text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_offering public.service_offerings%rowtype;
  v_max_horizon int := 30;
BEGIN
  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to < p_date_from THEN
    RAISE EXCEPTION 'INVALID_SLOT_DATE_RANGE' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE((value->>'max_booking_horizon_days')::int, 30)
    INTO v_max_horizon FROM public.platform_configurations
    WHERE key = 'scheduling_settings' LIMIT 1;
  IF p_date_to - p_date_from > 31 THEN
    RAISE EXCEPTION 'SLOT_DATE_RANGE_TOO_LARGE' USING ERRCODE = '22023';
  END IF;
  IF p_date_to > CURRENT_DATE + GREATEST(COALESCE(v_max_horizon, 30), 1) THEN
    RAISE EXCEPTION 'SLOT_DATE_BEYOND_BOOKING_HORIZON' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE
     OR v_offering.instructor_id IS NULL OR v_offering.vehicle_id IS NULL
     OR public.is_self_booking_context(v_offering.provider_id, v_offering.instructor_id) THEN
    RETURN;
  END IF;
  IF v_offering.category::text <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for public search' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  WITH days AS (
    SELECT d::date AS day_date FROM generate_series(GREATEST(p_date_from, CURRENT_DATE), p_date_to, interval '1 day') d
  ), recurring_candidates AS (
    SELECT DISTINCT a.timezone::text AS tz, gs AS start_at
    FROM public.availabilities a CROSS JOIN days
    CROSS JOIN LATERAL generate_series(
      date_trunc('hour', ((days.day_date + a.start_time) AT TIME ZONE a.timezone))
        + CASE WHEN EXTRACT(MINUTE FROM a.start_time) > 0 OR EXTRACT(SECOND FROM a.start_time) > 0 THEN interval '1 hour' ELSE interval '0' END,
      ((days.day_date + a.end_time) AT TIME ZONE a.timezone) - make_interval(mins => v_offering.duration_minutes), interval '1 hour'
    ) gs
    WHERE a.provider_id = v_offering.provider_id AND a.is_active IS TRUE
      AND (a.instructor_id IS NULL OR a.instructor_id = v_offering.instructor_id)
      AND (a.vehicle_id IS NULL OR a.vehicle_id = v_offering.vehicle_id)
      AND a.day_of_week = EXTRACT(ISODOW FROM days.day_date)::int
      AND (a.effective_from IS NULL OR days.day_date >= a.effective_from)
      AND (a.effective_to IS NULL OR days.day_date <= a.effective_to)
  ), override_candidates AS (
    SELECT DISTINCT 'America/Sao_Paulo'::text AS tz, gs AS start_at
    FROM public.availability_exceptions e
    CROSS JOIN LATERAL generate_series(
      date_trunc('hour', e.start_at) + CASE WHEN EXTRACT(MINUTE FROM e.start_at AT TIME ZONE 'America/Sao_Paulo') > 0 OR EXTRACT(SECOND FROM e.start_at AT TIME ZONE 'America/Sao_Paulo') > 0 THEN interval '1 hour' ELSE interval '0' END,
      e.end_at - make_interval(mins => v_offering.duration_minutes), interval '1 hour'
    ) gs
    WHERE e.provider_id = v_offering.provider_id AND e.type = 'AVAILABLE_OVERRIDE'
      AND e.is_active IS TRUE AND (e.instructor_id IS NULL OR e.instructor_id = v_offering.instructor_id)
      AND (e.vehicle_id IS NULL OR e.vehicle_id = v_offering.vehicle_id)
      AND (e.start_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_date_to
      AND (e.end_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_date_from
  ), candidates AS (
    SELECT DISTINCT tz, start_at FROM recurring_candidates
    UNION SELECT DISTINCT tz, start_at FROM override_candidates
  )
  SELECT v_offering.id, v_offering.provider_id, v_offering.instructor_id, v_offering.vehicle_id,
    c.start_at, c.start_at + make_interval(mins => v_offering.duration_minutes),
    (c.start_at AT TIME ZONE c.tz)::date, (c.start_at AT TIME ZONE c.tz)::time,
    ((c.start_at + make_interval(mins => v_offering.duration_minutes)) AT TIME ZONE c.tz)::time, c.tz
  FROM candidates c
  WHERE c.start_at > now() AND public.is_offering_slot_available(v_offering.id, c.start_at)
  ORDER BY c.start_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_quote_from_offering(
  p_offering_id uuid, p_scheduled_start_at timestamptz,
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
  v_platform_fee_percentage numeric := 10;
  v_platform_fee_cents int;
  v_total_in_cents int;
  v_new_quote_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();
  SELECT COALESCE((value->>'default_percentage')::numeric, 10) INTO v_platform_fee_percentage
    FROM public.platform_configurations WHERE key = 'platform_fees';
  v_platform_fee_percentage := GREATEST(0, LEAST(100, COALESCE(v_platform_fee_percentage, 10)));
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
  v_expires_at := v_now + interval '10 minutes';
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

CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_quote_id uuid, p_student_id uuid, p_idempotency_key varchar DEFAULT NULL,
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
  v_payment_id uuid;
  v_now timestamptz := now();
  v_hold_expires_at timestamptz;
  v_snapshot jsonb;
BEGIN
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_student_id IS DISTINCT FROM v_student_id THEN RAISE EXCEPTION 'STUDENT_ID_MISMATCH' USING ERRCODE = '42501'; END IF;
  PERFORM public.lock_student_profile(v_student_id); PERFORM public.assert_current_user_student();
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking FROM public.bookings WHERE idempotency_key = p_idempotency_key AND student_id = v_student_id;
    IF FOUND THEN
      IF v_existing_booking.quote_id = p_quote_id THEN
        SELECT id INTO v_payment_id FROM public.payments WHERE booking_id = v_existing_booking.id LIMIT 1;
        RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', v_existing_booking.id, 'payment_id', v_payment_id, 'status', v_existing_booking.status, 'hold_expires_at', v_existing_booking.hold_expires_at);
      END IF;
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505';
    END IF;
  END IF;
  UPDATE public.bookings SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_quote.student_id IS DISTINCT FROM v_student_id THEN RAISE EXCEPTION 'CROSS_STUDENT_QUOTE_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF v_quote.status <> 'ACTIVE' THEN RAISE EXCEPTION 'QUOTE_NOT_ACTIVE' USING ERRCODE = '22000'; END IF;
  IF v_quote.expires_at <= v_now THEN UPDATE public.quotes SET status = 'EXPIRED' WHERE id = p_quote_id; RAISE EXCEPTION 'QUOTE_EXPIRED' USING ERRCODE = '22000'; END IF;
  SELECT * INTO v_provider FROM public.providers WHERE id = v_quote.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE = '22000'; END IF;
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_quote.offering_id;
  IF NOT FOUND OR v_offering.is_active IS NOT TRUE THEN RAISE EXCEPTION 'OFFERING_NOT_ACTIVE' USING ERRCODE = '22000'; END IF;
  IF public.is_self_booking_context(v_quote.provider_id, v_quote.instructor_id) THEN RAISE EXCEPTION 'SELF_BOOKING_NOT_ALLOWED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_quote.vehicle_id;
  IF NOT FOUND OR v_vehicle.status <> 'ACTIVE' THEN RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE' USING ERRCODE = '22000'; END IF;
  IF v_offering.category::text <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY' USING ERRCODE = '22023'; END IF;
  IF NOT public.is_offering_slot_available(v_quote.offering_id, v_quote.scheduled_start_at) THEN RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE = '23P01'; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE student_id = v_student_id AND status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND slot_range && tstzrange(v_quote.scheduled_start_at, v_quote.scheduled_end_at, '[)')) THEN RAISE EXCEPTION 'STUDENT_ALREADY_BOOKED_FOR_SLOT' USING ERRCODE = 'P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_quote.provider_id::text, 0));
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::interval;
  v_snapshot := jsonb_build_object('providerId', v_provider.id, 'providerName', v_provider.trade_name, 'providerType', v_provider.type, 'instructorId', v_quote.instructor_id, 'instructorName', 'Instrutor ' || v_quote.instructor_id, 'vehicleId', v_vehicle.id, 'vehicleName', v_vehicle.brand || ' ' || v_vehicle.model, 'vehicleBrand', v_vehicle.brand, 'vehicleModel', v_vehicle.model, 'category', v_offering.category, 'transmission', v_vehicle.transmission, 'durationMinutes', v_offering.duration_minutes, 'priceInCents', v_quote.price_in_cents, 'platformFeeInCents', v_quote.platform_fee_in_cents, 'totalInCents', v_quote.total_in_cents, 'meetingPoint', coalesce(v_provider.neighborhood, v_provider.city));
  v_booking_id := gen_random_uuid();
  INSERT INTO public.bookings (id, student_id, provider_id, instructor_id, vehicle_id, offering_id, quote_id, status, scheduled_start_at, scheduled_end_at, hold_expires_at, idempotency_key, price_in_cents, platform_fee_in_cents, total_in_cents, snapshot_data, created_at, updated_at)
  VALUES (v_booking_id, v_student_id, v_quote.provider_id, v_quote.instructor_id, v_quote.vehicle_id, v_quote.offering_id, p_quote_id, 'PENDING_PAYMENT', v_quote.scheduled_start_at, v_quote.scheduled_end_at, v_hold_expires_at, p_idempotency_key, v_quote.price_in_cents, v_quote.platform_fee_in_cents, v_quote.total_in_cents, v_snapshot, v_now, v_now);
  UPDATE public.quotes SET status = 'CONSUMED', consumed_at = v_now WHERE id = p_quote_id;
  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (id, booking_id, method, status, amount_in_cents, idempotency_key, gateway_provider, created_at, updated_at) VALUES (v_payment_id, v_booking_id, 'PIX', 'PENDING', v_quote.total_in_cents, 'idem_pay_' || v_booking_id, 'fake_payment_gateway', v_now, v_now);
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_value, ip_address, user_agent, severity, created_at) VALUES (v_student_id, 'BOOKING_CREATE_HOLD', 'BOOKINGS', v_booking_id, jsonb_build_object('booking_id', v_booking_id, 'payment_id', v_payment_id, 'quote_id', p_quote_id), '127.0.0.1', 'PostgreSQL Trigger (SECURITY DEFINER)', 'INFO', v_now);
  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id, 'payment_id', v_payment_id, 'status', 'PENDING_PAYMENT', 'hold_expires_at', v_hold_expires_at);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.search_providers_public(double precision, double precision, double precision, text, text, text, double precision, integer, integer, integer, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_booking_context_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots_public(uuid, date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_quote_from_offering(uuid, timestamptz, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(uuid, uuid, varchar, integer) TO authenticated;
