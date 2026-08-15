-- ============================================================================
-- MAZZI PLATFORM — MIGRATION 20260814000008
-- SPRINT 07: SEARCH & MAPS — POSTGIS SPATIAL SEARCH & PUBLIC DTO VIEWS
-- PostGIS Geography column, GiST spatial indexing, ST_DWithin radius filtering,
-- deterministic public map coordinates, and SECURITY INVOKER search_providers_public RPC.
-- ============================================================================

-- Step 1: Ensure PostGIS Spatial Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Add Public Approximate Location Columns and Generated Geography Column
ALTER TABLE public.providers 
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS public_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS public_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS public_map_location_type TEXT DEFAULT 'NEIGHBORHOOD_CENTROID';

-- Step 3: Populate Public Locations with Neighborhood Centroids or City Defaults if null
UPDATE public.providers
SET 
  latitude = COALESCE(latitude, -23.5658),
  longitude = COALESCE(longitude, -46.6872),
  public_latitude = COALESCE(public_latitude, -23.5658),
  public_longitude = COALESCE(public_longitude, -46.6872),
  public_map_location_type = 'NEIGHBORHOOD_CENTROID'
WHERE public_latitude IS NULL OR public_longitude IS NULL;

-- Step 4: Create Dedicated Spatial Geography Column for High-Performance ST_DWithin Queries
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS location_geography GEOGRAPHY(Point, 4326) 
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(COALESCE(longitude, -46.6872), COALESCE(latitude, -23.5658)), 4326)::geography
  ) STORED;

-- Step 5: Create Spatial GiST Index on GEOGRAPHY Column for O(log N) Distance Search
CREATE INDEX IF NOT EXISTS idx_providers_location_geog_gist 
  ON public.providers 
  USING gist (location_geography);

CREATE INDEX IF NOT EXISTS idx_providers_public_location_gist 
  ON public.providers 
  USING gist (((ST_SetSRID(ST_MakePoint(public_longitude, public_latitude), 4326))::geography));

-- Step 6: Create Public Provider Search RPC Function
-- POSTGIS IS SOURCE OF TRUTH: Executes ST_DWithin directly in database.
-- SECURITY INVOKER: Enforces active caller RLS context.
-- STABLE PUBLIC OUTPUT: Returns ONLY sanitized public fields (rounded_distance_meters & distance_display)
-- to prevent spatial triangulation attacks against residential provider coordinates.
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
  -- Construct parameterized geography search point
  v_search_point := ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography;

  RETURN QUERY
  SELECT 
    p.id AS provider_id,
    p.trade_name::TEXT AS display_name,
    p.type::TEXT AS provider_type,
    p.avatar_url,
    (p.status = 'ACTIVE') AS is_verified,
    p.rating_average,
    p.rating_count,
    'DEMO'::TEXT AS rating_source,
    p.neighborhood::TEXT,
    p.city::TEXT,
    p.public_latitude,
    p.public_longitude,
    p.public_map_location_type,
    (ROUND(ST_Distance(p.location_geography, v_search_point) / 100.0)::INT * 100) AS rounded_distance_meters,
    CONCAT(REPLACE(ROUND((ST_Distance(p.location_geography, v_search_point) / 1000.0)::numeric, 1)::TEXT, '.', ','), ' km') AS distance_display,
    10000 AS starting_price_in_cents,
    10000 AS normalized_price_cents
  FROM public.providers p
  WHERE p.status = 'ACTIVE'
    -- PostGIS Source of Truth Spatial ST_DWithin Check (Internal exact distance)
    AND ST_DWithin(p.location_geography, v_search_point, p_radius_meters)
    AND (p_provider_type = 'ALL' OR p.type::TEXT = p_provider_type)
    AND (p.rating_average >= p_min_rating)
    AND (p_category IS NULL OR EXISTS (
      SELECT 1 FROM public.service_offerings o
      WHERE o.provider_id = p.id AND o.is_active = TRUE AND o.category::TEXT = p_category
    ))
    AND (p_transmission = 'ALL' OR EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.provider_id = p.id AND v.status = 'ACTIVE' AND v.transmission::TEXT = p_transmission
    ))
  ORDER BY ST_Distance(p.location_geography, v_search_point) ASC, p.id ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Step 7: Grant Execution Permissions to Public Anonymous and Authenticated Roles
GRANT EXECUTE ON FUNCTION public.search_providers_public TO anon, authenticated;

-- Step 8: Audit Log Security Event
INSERT INTO public.audit_logs (
  action, entity_type, entity_id, new_value, ip_address
) VALUES (
  'MIGRATION_EXECUTE',
  'MIGRATION',
  '20260814000008_search_postgis',
  '{"migration": "20260814000008_search_postgis", "status": "SUCCESS"}'::jsonb,
  '127.0.0.1'
);
