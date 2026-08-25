-- TASK-096A4N: expose instructor user avatar in public search without changing school logo semantics.

CREATE OR REPLACE FUNCTION public.search_providers_public(
  p_user_lat double precision,
  p_user_lng double precision,
  p_radius_meters double precision DEFAULT 5000,
  p_category text DEFAULT NULL::text,
  p_provider_type text DEFAULT 'ALL'::text,
  p_transmission text DEFAULT 'ALL'::text,
  p_min_rating double precision DEFAULT 0.0,
  p_max_price_cents integer DEFAULT NULL::integer,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_date date DEFAULT NULL::date
)
RETURNS TABLE(
  provider_id uuid,
  display_name text,
  provider_type text,
  avatar_url text,
  is_verified boolean,
  rating_average numeric,
  rating_count integer,
  rating_source text,
  neighborhood text,
  city text,
  public_latitude double precision,
  public_longitude double precision,
  public_map_location_type text,
  rounded_distance_meters integer,
  distance_display text,
  starting_price_in_cents integer,
  normalized_price_cents integer,
  categories text[],
  transmissions text[],
  public_offerings jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_search_point GEOGRAPHY(Point, 4326);
  v_radius DOUBLE PRECISION;
  v_limit INT;
  v_offset INT;
BEGIN
  IF p_user_lat IS NULL OR p_user_lat NOT BETWEEN -90 AND 90 OR p_user_lng IS NULL OR p_user_lng NOT BETWEEN -180 AND 180 THEN
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
    SELECT o.provider_id, MIN(o.price_in_cents)::INT AS starting_price_in_cents,
      ARRAY_AGG(DISTINCT o.category::TEXT ORDER BY o.category::TEXT) AS categories,
      ARRAY_AGG(DISTINCT o.transmission::TEXT ORDER BY o.transmission::TEXT) AS transmissions,
      JSONB_AGG(JSONB_BUILD_OBJECT('id',o.id,'providerId',o.provider_id,'instructorId',o.instructor_id,'instructorName',u.name,
        'vehicleId',o.vehicle_id,'vehicleTitle',CONCAT(v.brand,' ',v.model,' (',v.year,')'),'vehicleType',v.vehicle_type,
        'category',o.category,'transmission',o.transmission,'photos',COALESCE(v.photos,ARRAY[]::TEXT[]),
        'durationMinutes',o.duration_minutes,'priceInCents',o.price_in_cents) ORDER BY o.price_in_cents,o.id) AS public_offerings
    FROM public.service_offerings o
    JOIN public.vehicles v ON v.id=o.vehicle_id AND v.provider_id=o.provider_id AND v.status='ACTIVE' AND v.deleted_at IS NULL
      AND v.category=o.category AND v.transmission=o.transmission
    JOIN public.users u ON u.id=o.instructor_id AND u.status='ACTIVE'
    WHERE o.is_active=TRUE AND o.status='ACTIVE' AND o.instructor_id IS NOT NULL AND o.category::TEXT='B'
      AND (p_transmission='ALL' OR o.transmission::TEXT=p_transmission)
      AND public.is_provider_instructor_eligible(o.provider_id,o.instructor_id,o.category)
    GROUP BY o.provider_id
  )
  SELECT
    p.id,
    p.trade_name::TEXT,
    p.type::TEXT,
    CASE
      WHEN p.type::TEXT = 'INSTRUCTOR' THEN COALESCE(p.avatar_url, owner_user.avatar_url)
      ELSE p.avatar_url
    END,
    (p.status='ACTIVE'),
    p.rating_average,
    p.rating_count,
    'REAL'::TEXT,
    p.neighborhood::TEXT,
    p.city::TEXT,
    p.public_latitude,
    p.public_longitude,
    p.public_map_location_type,
    (ROUND(ST_Distance(p.location_geography,v_search_point)/100.0)::INT*100),
    CONCAT(REPLACE(ROUND((ST_Distance(p.location_geography,v_search_point)/1000.0)::NUMERIC,1)::TEXT,'.',','),' km'),
    eo.starting_price_in_cents,
    eo.starting_price_in_cents,
    eo.categories,
    eo.transmissions,
    eo.public_offerings
  FROM public.providers p
  JOIN eligible_offerings eo ON eo.provider_id=p.id
  LEFT JOIN public.users owner_user ON owner_user.id=p.user_id AND owner_user.status='ACTIVE'
  WHERE p.status='ACTIVE' AND ST_DWithin(p.location_geography,v_search_point,v_radius)
    AND (p_provider_type='ALL' OR p.type::TEXT=p_provider_type) AND p.rating_average>=COALESCE(p_min_rating,0)
    AND (p_max_price_cents IS NULL OR eo.starting_price_in_cents<=p_max_price_cents)
    AND (p_date IS NULL OR EXISTS (SELECT 1 FROM public.service_offerings so_avail
      WHERE so_avail.provider_id=p.id AND so_avail.is_active=TRUE AND so_avail.status='ACTIVE' AND so_avail.category::TEXT='B'
        AND (p_transmission='ALL' OR so_avail.transmission::TEXT=p_transmission)
        AND EXISTS (SELECT 1 FROM public.get_available_slots_public(so_avail.id,p_date,p_date))))
  ORDER BY ST_Distance(p.location_geography,v_search_point) ASC,p.id ASC LIMIT v_limit OFFSET v_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_providers_public(double precision,double precision,double precision,text,text,text,double precision,integer,integer,integer,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_providers_public(double precision,double precision,double precision,text,text,text,double precision,integer,integer,integer,date) TO anon, authenticated, service_role;
