-- TASK-089 — Keep the Aula Agora price preview aligned with dispatch eligibility.
-- DEV only. Price options must not advertise professionals that dispatch will reject.

CREATE OR REPLACE FUNCTION public.get_instant_price_options(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category TEXT,
  p_transmission TEXT
)
RETURNS TABLE(max_price_in_cents INTEGER, eligible_provider_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_point GEOGRAPHY;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'STUDENT' AND u.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY;

  RETURN QUERY
  WITH candidates AS (
    SELECT s.instant_price_in_cents
    FROM public.provider_instant_settings s
    JOIN public.providers p ON p.id = s.provider_id AND p.status = 'ACTIVE'
    JOIN public.service_offerings o ON o.id = s.offering_id AND o.status = 'ACTIVE' AND o.is_active = TRUE
    JOIN public.vehicles v ON v.id = o.vehicle_id AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
    JOIN public.instant_provider_locations l
      ON l.provider_id = s.provider_id
      AND l.instructor_id = o.instructor_id
      AND l.recorded_at >= NOW() - INTERVAL '30 seconds'
    WHERE s.instant_enabled = TRUE
      AND s.instant_online = TRUE
      AND o.category::TEXT = p_category
      AND (p_transmission = 'ALL' OR v.transmission::TEXT = p_transmission)
      AND public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::GEOGRAPHY,
        v_point,
        s.max_distance_km * 1000
      )
      AND CEIL(ST_Distance(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::GEOGRAPHY,
        v_point
      ) / 350.0)::INTEGER <= 30
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE (b.instructor_id = o.instructor_id OR b.vehicle_id = o.vehicle_id)
          AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
          AND b.scheduled_end_at > NOW()
      )
      AND s.instant_price_in_cents > 0
  ), buckets AS (
    SELECT DISTINCT instant_price_in_cents AS price
    FROM candidates
    ORDER BY price
    LIMIT 5
  )
  SELECT b.price, (SELECT COUNT(*) FROM candidates c WHERE c.instant_price_in_cents <= b.price)
  FROM buckets b
  UNION ALL
  SELECT NULL::INTEGER, COUNT(*) FROM candidates;
END;
$$;

REVOKE ALL ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO authenticated;
