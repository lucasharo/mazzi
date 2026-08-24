-- TASK-091: active exception semantics and full-hour override parity.

CREATE OR REPLACE FUNCTION public.is_offering_slot_available(p_offering_id UUID, p_scheduled_start_at TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  o public.service_offerings%ROWTYPE;
  p public.providers%ROWTYPE;
  v public.vehicles%ROWTYPE;
  e TIMESTAMPTZ;
  local_start TIMESTAMP;
  local_end TIMESTAMP;
  dow INTEGER;
BEGIN
  SELECT * INTO o FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR o.status <> 'ACTIVE' OR o.is_active IS NOT TRUE OR o.instructor_id IS NULL THEN RETURN FALSE; END IF;
  SELECT * INTO p FROM public.providers WHERE id = o.provider_id;
  IF NOT FOUND OR p.status <> 'ACTIVE' OR NOT public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category) THEN RETURN FALSE; END IF;
  SELECT * INTO v FROM public.vehicles WHERE id = o.vehicle_id;
  IF NOT FOUND OR v.status <> 'ACTIVE' OR v.deleted_at IS NOT NULL OR v.provider_id <> o.provider_id THEN RETURN FALSE; END IF;
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= NOW() THEN RETURN FALSE; END IF;
  local_start := p_scheduled_start_at AT TIME ZONE 'America/Sao_Paulo';
  IF EXTRACT(MINUTE FROM local_start) <> 0 OR EXTRACT(SECOND FROM local_start) <> 0 THEN RETURN FALSE; END IF;
  e := p_scheduled_start_at + make_interval(mins => o.duration_minutes);

  IF EXISTS (SELECT 1 FROM public.instructor_global_blocks b WHERE b.instructor_id = o.instructor_id AND b.start_at < e AND b.end_at > p_scheduled_start_at) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.availability_exceptions x WHERE x.provider_id = o.provider_id AND x.type = 'BLOCK' AND x.is_active IS TRUE AND (x.instructor_id IS NULL OR x.instructor_id = o.instructor_id) AND (x.vehicle_id IS NULL OR x.vehicle_id = o.vehicle_id) AND x.start_at < e AND x.end_at > p_scheduled_start_at) THEN RETURN FALSE; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.availability_exceptions x WHERE x.provider_id = o.provider_id AND x.type = 'AVAILABLE_OVERRIDE' AND x.is_active IS TRUE AND (x.instructor_id IS NULL OR x.instructor_id = o.instructor_id) AND (x.vehicle_id IS NULL OR x.vehicle_id = o.vehicle_id) AND x.start_at <= p_scheduled_start_at AND x.end_at >= e) THEN
    local_end := e AT TIME ZONE 'America/Sao_Paulo';
    dow := EXTRACT(ISODOW FROM local_start)::INTEGER;
    IF NOT EXISTS (SELECT 1 FROM public.availabilities a WHERE a.provider_id = o.provider_id AND a.is_active IS TRUE AND (a.instructor_id IS NULL OR a.instructor_id = o.instructor_id) AND (a.vehicle_id IS NULL OR a.vehicle_id = o.vehicle_id) AND a.day_of_week IN (dow, dow % 7) AND a.start_time <= local_start::TIME AND a.end_time >= local_end::TIME) THEN RETURN FALSE; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.instructor_id = o.instructor_id AND b.status IN ('CONFIRMED','IN_PROGRESS') AND b.slot_range && tstzrange(p_scheduled_start_at, e, '[)')) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.instructor_id = o.instructor_id AND b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW()) AND b.slot_range && tstzrange(p_scheduled_start_at, e, '[)')) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.vehicle_id = o.vehicle_id AND b.status IN ('CONFIRMED','IN_PROGRESS') AND b.slot_range && tstzrange(p_scheduled_start_at, e, '[)')) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.vehicle_id = o.vehicle_id AND b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW()) AND b.slot_range && tstzrange(p_scheduled_start_at, e, '[)')) THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_available_slots_public(p_offering_id UUID, p_date_from DATE, p_date_to DATE)
RETURNS TABLE(offering_id UUID, provider_id UUID, instructor_id UUID, vehicle_id UUID, slot_start_at TIMESTAMPTZ, slot_end_at TIMESTAMPTZ, local_date DATE, local_start_time TIME, local_end_time TIME, timezone TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_offering public.service_offerings%ROWTYPE;
  v_max_horizon INT := 30;
BEGIN
  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to < p_date_from THEN RAISE EXCEPTION 'INVALID_SLOT_DATE_RANGE' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE((value->>'max_booking_horizon_days')::INT, 30) INTO v_max_horizon FROM public.platform_configurations WHERE key = 'scheduling_settings' LIMIT 1;
  IF p_date_to - p_date_from > 31 THEN RAISE EXCEPTION 'SLOT_DATE_RANGE_TOO_LARGE' USING ERRCODE = '22023'; END IF;
  IF p_date_to > CURRENT_DATE + GREATEST(COALESCE(v_max_horizon, 30), 1) THEN RAISE EXCEPTION 'SLOT_DATE_BEYOND_BOOKING_HORIZON' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE OR v_offering.instructor_id IS NULL OR v_offering.vehicle_id IS NULL THEN RETURN; END IF;
  IF v_offering.category::TEXT <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for public search' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  WITH days AS (
    SELECT d::DATE AS day_date FROM generate_series(GREATEST(p_date_from, CURRENT_DATE), p_date_to, INTERVAL '1 day') d
  ),
  recurring_candidates AS (
    SELECT DISTINCT a.timezone::TEXT AS tz, gs AS start_at
    FROM public.availabilities a CROSS JOIN days
    CROSS JOIN LATERAL generate_series(
      date_trunc('hour', ((days.day_date + a.start_time) AT TIME ZONE a.timezone))
        + CASE WHEN EXTRACT(MINUTE FROM a.start_time) > 0 OR EXTRACT(SECOND FROM a.start_time) > 0 THEN INTERVAL '1 hour' ELSE INTERVAL '0' END,
      ((days.day_date + a.end_time) AT TIME ZONE a.timezone) - make_interval(mins => v_offering.duration_minutes), INTERVAL '1 hour') gs
    WHERE a.provider_id = v_offering.provider_id AND a.is_active IS TRUE
      AND (a.instructor_id IS NULL OR a.instructor_id = v_offering.instructor_id) AND (a.vehicle_id IS NULL OR a.vehicle_id = v_offering.vehicle_id)
      AND a.day_of_week = EXTRACT(ISODOW FROM days.day_date)::INT
      AND (a.effective_from IS NULL OR days.day_date >= a.effective_from) AND (a.effective_to IS NULL OR days.day_date <= a.effective_to)
  ),
  override_candidates AS (
    SELECT DISTINCT 'America/Sao_Paulo'::TEXT AS tz, gs AS start_at
    FROM public.availability_exceptions e
    CROSS JOIN LATERAL generate_series(
      date_trunc('hour', e.start_at) + CASE WHEN EXTRACT(MINUTE FROM e.start_at AT TIME ZONE 'America/Sao_Paulo') > 0 OR EXTRACT(SECOND FROM e.start_at AT TIME ZONE 'America/Sao_Paulo') > 0 THEN INTERVAL '1 hour' ELSE INTERVAL '0' END,
      e.end_at - make_interval(mins => v_offering.duration_minutes), INTERVAL '1 hour') gs
    WHERE e.provider_id = v_offering.provider_id AND e.type = 'AVAILABLE_OVERRIDE' AND e.is_active IS TRUE
      AND (e.instructor_id IS NULL OR e.instructor_id = v_offering.instructor_id) AND (e.vehicle_id IS NULL OR e.vehicle_id = v_offering.vehicle_id)
      AND (e.start_at AT TIME ZONE 'America/Sao_Paulo')::DATE <= p_date_to AND (e.end_at AT TIME ZONE 'America/Sao_Paulo')::DATE >= p_date_from
  ),
  candidates AS (SELECT DISTINCT tz, start_at FROM recurring_candidates UNION SELECT DISTINCT tz, start_at FROM override_candidates)
  SELECT v_offering.id, v_offering.provider_id, v_offering.instructor_id, v_offering.vehicle_id, c.start_at, c.start_at + make_interval(mins => v_offering.duration_minutes), (c.start_at AT TIME ZONE c.tz)::DATE, (c.start_at AT TIME ZONE c.tz)::TIME, ((c.start_at + make_interval(mins => v_offering.duration_minutes)) AT TIME ZONE c.tz)::TIME, c.tz
  FROM candidates c
  WHERE c.start_at > NOW() AND public.is_offering_slot_available(v_offering.id, c.start_at)
  ORDER BY c.start_at;
END;
$$;

REVOKE ALL ON FUNCTION public.is_offering_slot_available(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_offering_slot_available(UUID, TIMESTAMPTZ) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_available_slots_public(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots_public(UUID, DATE, DATE) TO anon, authenticated, service_role;
