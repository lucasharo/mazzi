-- MAZZI — FIX PUBLIC AVAILABILITY DAY-OF-WEEK MAPPING
-- availabilities.day_of_week is canonical PostgreSQL DOW: 0=Sunday ... 6=Saturday.
-- The public slot RPC was comparing it with ISO DOW, where Sunday is 7.

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
    INTO v_max_horizon
  FROM public.platform_configurations
  WHERE key = 'scheduling_settings'
  LIMIT 1;

  IF p_date_to - p_date_from > 31 THEN
    RAISE EXCEPTION 'SLOT_DATE_RANGE_TOO_LARGE' USING ERRCODE = '22023';
  END IF;
  IF p_date_to > CURRENT_DATE + GREATEST(COALESCE(v_max_horizon, 30), 1) THEN
    RAISE EXCEPTION 'SLOT_DATE_BEYOND_BOOKING_HORIZON' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_offering
  FROM public.service_offerings
  WHERE id = p_offering_id;

  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE
     OR v_offering.instructor_id IS NULL OR v_offering.vehicle_id IS NULL
     OR public.is_self_booking_context(v_offering.provider_id, v_offering.instructor_id) THEN
    RETURN;
  END IF;
  IF v_offering.category::text <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for public search'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT d::date AS day_date
    FROM generate_series(GREATEST(p_date_from, CURRENT_DATE), p_date_to, interval '1 day') d
  ), recurring_candidates AS (
    SELECT DISTINCT a.timezone::text AS tz, gs AS start_at
    FROM public.availabilities a
    CROSS JOIN days
    CROSS JOIN LATERAL generate_series(
      date_trunc('hour', ((days.day_date + a.start_time) AT TIME ZONE a.timezone))
        + CASE
            WHEN EXTRACT(MINUTE FROM a.start_time) > 0
              OR EXTRACT(SECOND FROM a.start_time) > 0
            THEN interval '1 hour'
            ELSE interval '0'
          END,
      ((days.day_date + a.end_time) AT TIME ZONE a.timezone)
        - make_interval(mins => v_offering.duration_minutes),
      interval '1 hour'
    ) gs
    WHERE a.provider_id = v_offering.provider_id
      AND a.is_active IS TRUE
      AND (a.instructor_id IS NULL OR a.instructor_id = v_offering.instructor_id)
      AND (a.vehicle_id IS NULL OR a.vehicle_id = v_offering.vehicle_id)
      -- PostgreSQL DOW matches the stored contract: Sunday=0 ... Saturday=6.
      AND a.day_of_week = EXTRACT(DOW FROM days.day_date)::int
      AND (a.effective_from IS NULL OR days.day_date >= a.effective_from)
      AND (a.effective_to IS NULL OR days.day_date <= a.effective_to)
  ), override_candidates AS (
    SELECT DISTINCT 'America/Sao_Paulo'::text AS tz, gs AS start_at
    FROM public.availability_exceptions e
    CROSS JOIN LATERAL generate_series(
      date_trunc('hour', e.start_at)
        + CASE
            WHEN EXTRACT(MINUTE FROM e.start_at AT TIME ZONE 'America/Sao_Paulo') > 0
              OR EXTRACT(SECOND FROM e.start_at AT TIME ZONE 'America/Sao_Paulo') > 0
            THEN interval '1 hour'
            ELSE interval '0'
          END,
      e.end_at - make_interval(mins => v_offering.duration_minutes),
      interval '1 hour'
    ) gs
    WHERE e.provider_id = v_offering.provider_id
      AND e.type = 'AVAILABLE_OVERRIDE'
      AND e.is_active IS TRUE
      AND (e.instructor_id IS NULL OR e.instructor_id = v_offering.instructor_id)
      AND (e.vehicle_id IS NULL OR e.vehicle_id = v_offering.vehicle_id)
      AND (e.start_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_date_to
      AND (e.end_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_date_from
  ), candidates AS (
    SELECT DISTINCT tz, start_at FROM recurring_candidates
    UNION
    SELECT DISTINCT tz, start_at FROM override_candidates
  )
  SELECT v_offering.id,
    v_offering.provider_id,
    v_offering.instructor_id,
    v_offering.vehicle_id,
    c.start_at,
    c.start_at + make_interval(mins => v_offering.duration_minutes),
    (c.start_at AT TIME ZONE c.tz)::date,
    (c.start_at AT TIME ZONE c.tz)::time,
    ((c.start_at + make_interval(mins => v_offering.duration_minutes)) AT TIME ZONE c.tz)::time,
    c.tz
  FROM candidates c
  WHERE c.start_at > now()
    AND public.is_offering_slot_available(v_offering.id, c.start_at)
  ORDER BY c.start_at;
END;
$function$;
