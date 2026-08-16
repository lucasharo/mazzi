-- MAZZI Student Experience Phase 1: public search DTO, booking names and safe formatting data.

DROP FUNCTION IF EXISTS public.search_providers_public(double precision, double precision, double precision, text, text, text, double precision, integer, integer, integer);

CREATE FUNCTION public.search_providers_public(
  p_user_lat DOUBLE PRECISION,
  p_user_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 5000,
  p_category TEXT DEFAULT NULL,
  p_provider_type TEXT DEFAULT 'ALL',
  p_transmission TEXT DEFAULT 'ALL',
  p_min_rating DOUBLE PRECISION DEFAULT 0.0,
  p_max_price_cents INT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  provider_id UUID,
  display_name TEXT,
  provider_type TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN,
  rating_average NUMERIC,
  rating_count INT,
  rating_source TEXT,
  neighborhood TEXT,
  city TEXT,
  public_latitude DOUBLE PRECISION,
  public_longitude DOUBLE PRECISION,
  public_map_location_type TEXT,
  rounded_distance_meters INT,
  distance_display TEXT,
  starting_price_in_cents INT,
  normalized_price_cents INT,
  categories TEXT[],
  transmissions TEXT[],
  public_offerings JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search_point GEOGRAPHY(Point, 4326);
  v_radius DOUBLE PRECISION;
  v_limit INT;
  v_offset INT;
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

  v_search_point := ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography;
  v_radius := LEAST(GREATEST(COALESCE(p_radius_meters, 5000), 0), 50000);
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  WITH eligible_offerings AS (
    SELECT
      o.provider_id,
      MIN(o.price_in_cents)::INT AS starting_price_in_cents,
      ARRAY_AGG(DISTINCT o.category::TEXT ORDER BY o.category::TEXT) AS categories,
      ARRAY_AGG(DISTINCT o.transmission::TEXT ORDER BY o.transmission::TEXT) AS transmissions,
      JSONB_AGG(JSONB_BUILD_OBJECT(
        'id', o.id,
        'providerId', o.provider_id,
        'instructorId', o.instructor_id,
        'instructorName', u.name,
        'vehicleId', o.vehicle_id,
        'vehicleTitle', CONCAT(v.brand, ' ', v.model, ' (', v.year, ')'),
        'vehicleType', v.vehicle_type,
        'category', o.category,
        'transmission', o.transmission,
        'photos', COALESCE(v.photos, ARRAY[]::TEXT[]),
        'durationMinutes', o.duration_minutes,
        'priceInCents', o.price_in_cents
      ) ORDER BY o.price_in_cents, o.id) AS public_offerings
    FROM public.service_offerings o
    JOIN public.vehicles v
      ON v.id = o.vehicle_id
     AND v.provider_id = o.provider_id
     AND v.status = 'ACTIVE'
     AND v.deleted_at IS NULL
     AND v.category = o.category
     AND v.transmission = o.transmission
    JOIN public.users u ON u.id = o.instructor_id AND u.status = 'ACTIVE'
    WHERE o.is_active = TRUE
      AND o.status = 'ACTIVE'
      AND o.instructor_id IS NOT NULL
      AND (p_category IS NULL OR o.category::TEXT = p_category)
      AND (p_transmission = 'ALL' OR o.transmission::TEXT = p_transmission)
    GROUP BY o.provider_id
  )
  SELECT
    p.id,
    p.trade_name::TEXT,
    p.type::TEXT,
    p.avatar_url,
    (p.status = 'ACTIVE'),
    p.rating_average,
    p.rating_count,
    'REAL'::TEXT,
    p.neighborhood::TEXT,
    p.city::TEXT,
    p.public_latitude,
    p.public_longitude,
    p.public_map_location_type,
    (ROUND(ST_Distance(p.location_geography, v_search_point) / 100.0)::INT * 100),
    CONCAT(REPLACE(ROUND((ST_Distance(p.location_geography, v_search_point) / 1000.0)::NUMERIC, 1)::TEXT, '.', ','), ' km'),
    eo.starting_price_in_cents,
    eo.starting_price_in_cents,
    eo.categories,
    eo.transmissions,
    eo.public_offerings
  FROM public.providers p
  JOIN eligible_offerings eo ON eo.provider_id = p.id
  WHERE p.status = 'ACTIVE'
    AND ST_DWithin(p.location_geography, v_search_point, v_radius)
    AND (p_provider_type = 'ALL' OR p.type::TEXT = p_provider_type)
    AND p.rating_average >= COALESCE(p_min_rating, 0)
    AND (p_max_price_cents IS NULL OR eo.starting_price_in_cents <= p_max_price_cents)
  ORDER BY ST_Distance(p.location_geography, v_search_point) ASC, p.id ASC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.search_providers_public(double precision, double precision, double precision, text, text, text, double precision, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_providers_public(double precision, double precision, double precision, text, text, text, double precision, integer, integer, integer) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_provider_booking_context_public(uuid);
CREATE FUNCTION public.get_provider_booking_context_public(p_provider_id UUID)
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
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.trade_name::TEXT, o.id, o.instructor_id, iu.name::TEXT, o.vehicle_id,
    o.category::TEXT, o.transmission::TEXT, o.duration_minutes, o.price_in_cents,
    v.brand::TEXT, v.model::TEXT, v.year, v.category::TEXT, v.transmission::TEXT, v.color::TEXT
  FROM public.providers p
  JOIN public.service_offerings o ON o.provider_id = p.id
  JOIN public.users iu ON iu.id = o.instructor_id AND iu.status = 'ACTIVE'
  JOIN public.vehicles v ON v.id = o.vehicle_id AND v.provider_id = p.id
  WHERE p.id = p_provider_id AND p.status = 'ACTIVE'
    AND o.status = 'ACTIVE' AND o.is_active = TRUE AND o.instructor_id IS NOT NULL
    AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
  ORDER BY o.price_in_cents ASC, o.id ASC;
$$;

REVOKE ALL ON FUNCTION public.get_provider_booking_context_public(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_booking_context_public(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.normalize_booking_snapshot_names()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_instructor_name TEXT;
  v_provider_name TEXT;
  v_vehicle_name TEXT;
  v_meeting_point TEXT;
BEGIN
  SELECT u.name INTO v_instructor_name FROM public.users u WHERE u.id = NEW.instructor_id;
  SELECT p.trade_name, COALESCE(p.neighborhood, p.city) INTO v_provider_name, v_meeting_point
    FROM public.providers p WHERE p.id = NEW.provider_id;
  SELECT CONCAT(v.brand, ' ', v.model) INTO v_vehicle_name FROM public.vehicles v WHERE v.id = NEW.vehicle_id;
  NEW.snapshot_data := jsonb_set(COALESCE(NEW.snapshot_data, '{}'::JSONB), '{instructorName}', TO_JSONB(COALESCE(v_instructor_name, '')) , TRUE);
  NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{providerName}', TO_JSONB(COALESCE(v_provider_name, '')), TRUE);
  NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{vehicleName}', TO_JSONB(COALESCE(v_vehicle_name, '')), TRUE);
  NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{meetingPoint}', TO_JSONB(COALESCE(v_meeting_point, '')), TRUE);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_booking_snapshot_names ON public.bookings;
CREATE TRIGGER trg_normalize_booking_snapshot_names
BEFORE INSERT OR UPDATE OF instructor_id, provider_id, vehicle_id, snapshot_data ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.normalize_booking_snapshot_names();

REVOKE ALL ON FUNCTION public.normalize_booking_snapshot_names() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_booking_names(p_booking_ids UUID[])
RETURNS TABLE (
  booking_id UUID,
  instructor_name TEXT,
  provider_name TEXT,
  vehicle_name TEXT,
  meeting_point JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.id, iu.name::TEXT, p.trade_name::TEXT,
    CONCAT(v.brand, ' ', v.model)::TEXT, b.meeting_point
  FROM public.bookings b
  JOIN public.users iu ON iu.id = b.instructor_id
  JOIN public.providers p ON p.id = b.provider_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.student_id = auth.uid() AND b.id = ANY(p_booking_ids);
$$;

REVOKE ALL ON FUNCTION public.get_my_booking_names(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_booking_names(uuid[]) TO authenticated;
