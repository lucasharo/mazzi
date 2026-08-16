-- MAZZI Sprint 16 final hotfix: real provider prices in public search.
-- This migration supersedes the hard-coded price projection from 20260814000008.

CREATE INDEX IF NOT EXISTS idx_service_offerings_search_price
  ON public.service_offerings (provider_id, category, transmission, price_in_cents)
  WHERE is_active = TRUE AND status = 'ACTIVE';

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
  normalized_price_cents INT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search_point GEOGRAPHY(Point, 4326);
BEGIN
  v_search_point := ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography;

  RETURN QUERY
  WITH eligible_offerings AS (
    SELECT
      o.provider_id,
      MIN(o.price_in_cents)::INT AS starting_price_in_cents
    FROM public.service_offerings o
    JOIN public.vehicles v
      ON v.id = o.vehicle_id
     AND v.provider_id = o.provider_id
     AND v.status = 'ACTIVE'
     AND v.deleted_at IS NULL
     AND v.category = o.category
     AND v.transmission = o.transmission
    WHERE o.is_active = TRUE
      AND o.status = 'ACTIVE'
      AND (p_category IS NULL OR o.category::TEXT = p_category)
      AND (p_transmission = 'ALL' OR o.transmission::TEXT = p_transmission)
    GROUP BY o.provider_id
  )
  SELECT
    p.id AS provider_id,
    p.trade_name::TEXT AS display_name,
    p.type::TEXT AS provider_type,
    p.avatar_url,
    (p.status = 'ACTIVE') AS is_verified,
    p.rating_average,
    p.rating_count,
    'REAL'::TEXT AS rating_source,
    p.neighborhood::TEXT,
    p.city::TEXT,
    p.public_latitude,
    p.public_longitude,
    p.public_map_location_type,
    (ROUND(ST_Distance(p.location_geography, v_search_point) / 100.0)::INT * 100) AS rounded_distance_meters,
    CONCAT(REPLACE(ROUND((ST_Distance(p.location_geography, v_search_point) / 1000.0)::NUMERIC, 1)::TEXT, '.', ','), ' km') AS distance_display,
    eo.starting_price_in_cents,
    eo.starting_price_in_cents AS normalized_price_cents
  FROM public.providers p
  JOIN eligible_offerings eo ON eo.provider_id = p.id
  WHERE p.status = 'ACTIVE'
    AND ST_DWithin(p.location_geography, v_search_point, p_radius_meters)
    AND (p_provider_type = 'ALL' OR p.type::TEXT = p_provider_type)
    AND p.rating_average >= p_min_rating
    AND (p_max_price_cents IS NULL OR eo.starting_price_in_cents <= p_max_price_cents)
  ORDER BY ST_Distance(p.location_geography, v_search_point) ASC, p.id ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_providers_public(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT,
  DOUBLE PRECISION, INT, INT, INT
) TO anon, authenticated;

INSERT INTO public.audit_logs (action, entity_type, entity_id, new_value, ip_address)
VALUES (
  'MIGRATION_EXECUTE',
  'MIGRATION',
  '20260816000017_sprint16_real_search_prices',
  '{"migration":"20260816000017_sprint16_real_search_prices","status":"SUCCESS"}'::jsonb,
  '127.0.0.1'
);
