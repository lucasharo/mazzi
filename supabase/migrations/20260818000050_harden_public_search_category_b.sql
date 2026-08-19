-- ============================================================================
-- MAZZI PLATFORM — SPRINT 21: HARDEN PUBLIC SEARCH FOR CATEGORY B ONLY
-- Migration: 20260818000050_harden_public_search_category_b.sql
-- ============================================================================

-- Preserve EXACT LIVE signature to prevent function overload duplication:
-- search_providers_public(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION, INT, INT, INT, DATE)

CREATE OR REPLACE FUNCTION public.search_providers_public(
  p_user_lat DOUBLE PRECISION,
  p_user_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 5000,
  p_category TEXT DEFAULT NULL,
  p_provider_type TEXT DEFAULT 'ALL',
  p_transmission TEXT DEFAULT 'ALL',
  p_min_rating DOUBLE PRECISION DEFAULT 0.0,
  p_max_price_cents INT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_date DATE DEFAULT NULL
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
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search_point GEOGRAPHY(Point, 4326);
  v_radius DOUBLE PRECISION;
  v_limit INT;
  v_offset INT;
  v_effective_category TEXT;
BEGIN
  -- 1. Validate Coordinates
  IF p_user_lat IS NULL OR p_user_lat NOT BETWEEN -90 AND 90
    OR p_user_lng IS NULL OR p_user_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INVALID_SEARCH_COORDINATES' USING ERRCODE = '22023';
  END IF;

  -- 2. Validate Provider Type
  IF p_provider_type IS NULL OR p_provider_type NOT IN ('ALL', 'INSTRUCTOR', 'DRIVING_SCHOOL') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_TYPE' USING ERRCODE = '22023';
  END IF;

  -- 3. Validate Transmission
  IF p_transmission IS NOT NULL AND p_transmission NOT IN ('ALL', 'MANUAL', 'AUTOMATIC', 'NOT_APPLICABLE') THEN
    RAISE EXCEPTION 'INVALID_TRANSMISSION' USING ERRCODE = '22023';
  END IF;

  -- 4. HARDEN CATEGORY B ENFORCEMENT FOR PUBLIC SEARCH
  -- NULL or 'B' => category 'B'. 'A', 'ALL' or any other value => INVALID_PUBLIC_CATEGORY
  IF p_category IS NOT NULL AND p_category <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for public search' USING ERRCODE = '22023';
  END IF;

  v_effective_category := 'B';

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
      AND o.category::TEXT = v_effective_category
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
    AND (
      p_date IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.service_offerings so_avail
        WHERE so_avail.provider_id = p.id
          AND so_avail.is_active = TRUE
          AND so_avail.status = 'ACTIVE'
          AND so_avail.category::TEXT = v_effective_category
          AND (p_transmission = 'ALL' OR so_avail.transmission::TEXT = p_transmission)
          AND EXISTS (
            SELECT 1 FROM public.get_available_slots_public(so_avail.id, p_date, p_date)
          )
      )
    )
  ORDER BY ST_Distance(p.location_geography, v_search_point) ASC, p.id ASC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

-- Permissions with exact signature
REVOKE ALL ON FUNCTION public.search_providers_public(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION, INT, INT, INT, DATE
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_providers_public(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION, INT, INT, INT, DATE
) TO anon, authenticated, service_role;
