-- Só disponibiliza no marketplace quem já concluiu o recebimento via Stripe Connect.
-- A Stripe continua sendo a responsável por coletar os dados bancários.

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
      AND EXISTS (
        SELECT 1
        FROM public.availabilities a
        WHERE a.provider_id = o.provider_id
          AND a.is_active IS TRUE
          AND (a.instructor_id IS NULL OR a.instructor_id = o.instructor_id)
          AND (a.vehicle_id IS NULL OR a.vehicle_id = o.vehicle_id)
      )
      AND EXISTS (
        SELECT 1
        FROM public.provider_payment_accounts ppa
        WHERE ppa.provider_id = o.provider_id
          AND ppa.gateway = 'STRIPE'
          AND ppa.status = 'ACTIVE'
          AND ppa.charges_enabled IS TRUE
          AND ppa.payouts_enabled IS TRUE
          AND NULLIF(BTRIM(ppa.external_account_id), '') IS NOT NULL
      )
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

GRANT EXECUTE ON FUNCTION public.search_providers_public(double precision, double precision, double precision, text, text, text, double precision, integer, integer, integer, date) TO anon, authenticated;
