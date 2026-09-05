-- TASK-089 — Keep Aula Agora operational offers independent from agenda offers.
-- Existing agenda rows are preserved as AGENDA. Aula Agora gets its own
-- service-offering row only as an internal booking anchor; it is never exposed
-- by the agenda/public-search contracts.

BEGIN;

ALTER TABLE public.service_offerings
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'AGENDA';

ALTER TABLE public.service_offerings
  DROP CONSTRAINT IF EXISTS service_offerings_source_check;
ALTER TABLE public.service_offerings
  ADD CONSTRAINT service_offerings_source_check
  CHECK (source IN ('AGENDA', 'AULA_AGORA'));

DROP INDEX IF EXISTS public.idx_uniq_active_offering;
DROP INDEX IF EXISTS public.service_offerings_active_equivalence_idx;
CREATE UNIQUE INDEX IF NOT EXISTS service_offerings_active_source_equivalence_idx
  ON public.service_offerings(provider_id, instructor_id, vehicle_id, category, transmission, duration_minutes, source)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_service_offerings_source
  ON public.service_offerings(provider_id, source, status);

-- Keep the agenda and public marketplace isolated from internal Aula Agora rows.
DROP POLICY IF EXISTS offerings_public_select ON public.service_offerings;
CREATE POLICY offerings_public_select ON public.service_offerings
  FOR SELECT USING (is_active = TRUE AND source = 'AGENDA');

DROP VIEW IF EXISTS public.public_service_offerings;
CREATE VIEW public.public_service_offerings
WITH (security_invoker = true) AS
SELECT
  so.id,
  so.provider_id,
  so.vehicle_id,
  so.category,
  so.duration_minutes,
  so.price_in_cents,
  so.status,
  pv.brand AS vehicle_brand,
  pv.model AS vehicle_model,
  pv.year AS vehicle_year,
  pv.transmission AS vehicle_transmission,
  pv.photos AS vehicle_photos
FROM public.service_offerings so
JOIN public.public_vehicles pv ON pv.id = so.vehicle_id
JOIN public.providers p ON p.id = so.provider_id
WHERE so.status = 'ACTIVE'
  AND so.source = 'AGENDA'
  AND p.status = 'ACTIVE';

-- Convert old Aula Agora settings into their own internal offer without
-- changing the agenda row or its price.
DO $$
DECLARE r RECORD;
DECLARE v_instant_offering_id UUID;
BEGIN
  FOR r IN
    SELECT s.id AS setting_id, s.provider_id, s.instant_enabled, s.instant_online,
      s.instant_price_in_cents, s.max_distance_km,
      o.instructor_id, o.vehicle_id, o.category, o.transmission, o.duration_minutes,
      o.status, o.is_active
    FROM public.provider_instant_settings s
    JOIN public.service_offerings o ON o.id = s.offering_id
  LOOP
    SELECT id INTO v_instant_offering_id
    FROM public.service_offerings
    WHERE provider_id = r.provider_id
      AND instructor_id = r.instructor_id
      AND vehicle_id = r.vehicle_id
      AND category = r.category
      AND transmission = r.transmission
      AND duration_minutes = r.duration_minutes
      AND source = 'AULA_AGORA'
    ORDER BY created_at
    LIMIT 1;

    IF v_instant_offering_id IS NULL THEN
      INSERT INTO public.service_offerings (
        provider_id, instructor_id, vehicle_id, category, transmission,
        duration_minutes, price_in_cents, is_active, status, source
      ) VALUES (
        r.provider_id, r.instructor_id, r.vehicle_id, r.category, r.transmission,
        r.duration_minutes, r.instant_price_in_cents,
        TRUE, 'ACTIVE', 'AULA_AGORA'
      ) RETURNING id INTO v_instant_offering_id;
    END IF;

    UPDATE public.provider_instant_settings
    SET offering_id = v_instant_offering_id, updated_at = NOW()
    WHERE id = r.setting_id;
  END LOOP;
END;
$$;

-- New direct read contract. The legacy get_my_instant_settings contract remains
-- available for older clients, but the app no longer depends on agenda rows.
CREATE OR REPLACE FUNCTION public.get_my_instant_vehicle_settings(p_provider_id UUID)
RETURNS TABLE (
  id UUID, provider_id UUID, offering_id UUID, instructor_id UUID, vehicle_id UUID,
  instant_enabled BOOLEAN, instant_online BOOLEAN, instant_price_in_cents INTEGER,
  max_distance_km INTEGER, updated_at TIMESTAMPTZ, category TEXT,
  transmission TEXT, duration_minutes INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.instant_is_provider_member(p_provider_id, auth.uid()) THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id, s.provider_id, s.offering_id, o.instructor_id, o.vehicle_id,
    s.instant_enabled, s.instant_online, s.instant_price_in_cents,
    s.max_distance_km, s.updated_at, o.category::TEXT,
    o.transmission::TEXT, o.duration_minutes
  FROM public.provider_instant_settings s
  JOIN public.service_offerings o ON o.id = s.offering_id
  WHERE s.provider_id = p_provider_id AND o.source = 'AULA_AGORA';
END;
$$;

CREATE OR REPLACE FUNCTION public.save_my_instant_vehicle_setting(
  p_provider_id UUID, p_instructor_id UUID, p_vehicle_id UUID,
  p_instant_enabled BOOLEAN, p_instant_price_in_cents INTEGER,
  p_max_distance_km INTEGER
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_vehicle public.vehicles%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_offering public.service_offerings%ROWTYPE;
  v_setting public.provider_instant_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.instant_is_provider_member(p_provider_id, auth.uid()) THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_instant_price_in_cents IS NULL OR p_instant_price_in_cents <= 0 OR p_instant_price_in_cents <> TRUNC(p_instant_price_in_cents) THEN
    RAISE EXCEPTION 'INSTANT_PRICE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_max_distance_km IS NULL OR p_max_distance_km < 1 OR p_max_distance_km > 100 THEN
    RAISE EXCEPTION 'INSTANT_DISTANCE_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_provider FROM public.providers WHERE id = p_provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = p_vehicle_id AND provider_id = p_provider_id
    AND status = 'ACTIVE' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE' USING ERRCODE = '22023'; END IF;
  IF p_instructor_id IS NULL OR NOT public.is_provider_instructor_eligible(p_provider_id, p_instructor_id, v_vehicle.category) THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_offering
  FROM public.service_offerings
  WHERE provider_id = p_provider_id AND instructor_id = p_instructor_id
    AND vehicle_id = p_vehicle_id AND source = 'AULA_AGORA'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.service_offerings (
      provider_id, instructor_id, vehicle_id, category, transmission,
      duration_minutes, price_in_cents, is_active, status, source
    ) VALUES (
      p_provider_id, p_instructor_id, p_vehicle_id, v_vehicle.category,
      v_vehicle.transmission, 50, p_instant_price_in_cents, TRUE, 'ACTIVE', 'AULA_AGORA'
    ) RETURNING * INTO v_offering;
  ELSE
    UPDATE public.service_offerings
    SET price_in_cents = p_instant_price_in_cents,
        is_active = TRUE, status = 'ACTIVE', updated_at = NOW()
    WHERE id = v_offering.id
    RETURNING * INTO v_offering;
  END IF;

  INSERT INTO public.provider_instant_settings (
    provider_id, offering_id, instant_enabled,
    instant_price_in_cents, max_distance_km
  ) VALUES (
    p_provider_id, v_offering.id, COALESCE(p_instant_enabled, FALSE),
    p_instant_price_in_cents, p_max_distance_km
  )
  ON CONFLICT (provider_id, offering_id) DO UPDATE SET
    instant_enabled = EXCLUDED.instant_enabled,
    instant_price_in_cents = EXCLUDED.instant_price_in_cents,
    max_distance_km = EXCLUDED.max_distance_km,
    updated_at = NOW();

  SELECT * INTO v_setting
  FROM public.provider_instant_settings
  WHERE provider_id = p_provider_id AND offering_id = v_offering.id;

  RETURN jsonb_build_object(
    'id', v_setting.id,
    'provider_id', v_setting.provider_id,
    'offering_id', v_setting.offering_id,
    'instructor_id', v_offering.instructor_id,
    'vehicle_id', v_offering.vehicle_id,
    'instant_enabled', v_setting.instant_enabled,
    'instant_online', v_setting.instant_online,
    'instant_price_in_cents', v_setting.instant_price_in_cents,
    'max_distance_km', v_setting.max_distance_km,
    'category', v_offering.category,
    'transmission', v_offering.transmission,
    'duration_minutes', v_offering.duration_minutes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_instant_vehicle_settings(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_my_instant_vehicle_setting(UUID, UUID, UUID, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_instant_vehicle_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_instant_vehicle_setting(UUID, UUID, UUID, BOOLEAN, INTEGER, INTEGER) TO authenticated;

-- The existing agenda mutation must never treat an Aula Agora row as a
-- duplicate agenda offer.
CREATE OR REPLACE FUNCTION public.provider_save_service_offering(
  p_offering_id uuid DEFAULT NULL, p_provider_id uuid DEFAULT NULL,
  p_instructor_id uuid DEFAULT NULL, p_vehicle_id uuid DEFAULT NULL,
  p_category public.vehicle_category DEFAULT NULL,
  p_transmission public.vehicle_transmission DEFAULT NULL,
  p_duration_minutes integer DEFAULT 50, p_price_in_cents integer DEFAULT NULL,
  p_active boolean DEFAULT false
)
RETURNS public.service_offerings
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v public.service_offerings; v_vehicle public.vehicles; v_provider public.providers;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_active() THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_provider_id IS NULL OR p_vehicle_id IS NULL OR p_instructor_id IS NULL THEN RAISE EXCEPTION 'OFFERING_REQUIRED_FIELDS' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_provider FROM public.providers WHERE id=p_provider_id;
  IF NOT FOUND OR NOT (v_provider.user_id=auth.uid() OR public.is_school_admin(p_provider_id) OR public.is_platform_admin()) THEN RAISE EXCEPTION 'OFFERING_PROVIDER_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id=p_vehicle_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_vehicle.provider_id<>p_provider_id THEN RAISE EXCEPTION 'OFFERING_VEHICLE_PROVIDER_MISMATCH' USING ERRCODE='23514'; END IF;
  IF p_category IS NULL OR p_transmission IS NULL OR p_category<>v_vehicle.category OR p_transmission<>v_vehicle.transmission THEN RAISE EXCEPTION 'OFFERING_VEHICLE_ATTRIBUTES_MISMATCH' USING ERRCODE='23514'; END IF;
  IF p_duration_minutes <> 50 THEN RAISE EXCEPTION 'OFFERING_DURATION_MUST_BE_50' USING ERRCODE='22023'; END IF;
  IF p_price_in_cents IS NULL OR p_price_in_cents <= 0 OR p_price_in_cents <> trunc(p_price_in_cents) THEN RAISE EXCEPTION 'OFFERING_PRICE_INVALID' USING ERRCODE='22023'; END IF;
  IF NOT public.can_manage_service_offering(p_provider_id,p_instructor_id,p_vehicle_id) THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
  IF p_active AND v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'OFFERING_PROVIDER_NOT_ACTIVE' USING ERRCODE='22023'; END IF;
  IF p_active AND v_vehicle.status <> 'ACTIVE' THEN RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ACTIVE' USING ERRCODE='22023'; END IF;
  IF p_active AND NOT public.is_provider_instructor_eligible(p_provider_id,p_instructor_id,p_category) THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE='22023'; END IF;
  IF p_offering_id IS NULL THEN
    IF p_active AND EXISTS (SELECT 1 FROM public.service_offerings WHERE provider_id=p_provider_id AND instructor_id=p_instructor_id AND vehicle_id=p_vehicle_id AND category=p_category AND transmission=p_transmission AND duration_minutes=50 AND status='ACTIVE' AND source='AGENDA') THEN RAISE EXCEPTION 'DUPLICATE_ACTIVE_OFFERING' USING ERRCODE='23505'; END IF;
    INSERT INTO public.service_offerings(provider_id,instructor_id,vehicle_id,category,transmission,duration_minutes,price_in_cents,is_active,status,source)
    VALUES(p_provider_id,p_instructor_id,p_vehicle_id,p_category,p_transmission,50,p_price_in_cents,p_active,CASE WHEN p_active THEN 'ACTIVE' ELSE 'INACTIVE' END,'AGENDA') RETURNING * INTO v;
  ELSE
    SELECT * INTO v FROM public.service_offerings WHERE id=p_offering_id FOR UPDATE;
    IF NOT FOUND OR v.provider_id<>p_provider_id OR v.source<>'AGENDA' THEN RAISE EXCEPTION 'OFFERING_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
    IF p_active AND v.status<>'ACTIVE' AND EXISTS (SELECT 1 FROM public.service_offerings WHERE id<>p_offering_id AND provider_id=p_provider_id AND instructor_id=p_instructor_id AND vehicle_id=p_vehicle_id AND category=p_category AND transmission=p_transmission AND duration_minutes=50 AND status='ACTIVE' AND source='AGENDA') THEN RAISE EXCEPTION 'DUPLICATE_ACTIVE_OFFERING' USING ERRCODE='23505'; END IF;
    UPDATE public.service_offerings SET instructor_id=p_instructor_id,vehicle_id=p_vehicle_id,category=p_category,transmission=p_transmission,duration_minutes=50,price_in_cents=p_price_in_cents,is_active=p_active,status=CASE WHEN p_active THEN 'ACTIVE' ELSE 'INACTIVE' END,updated_at=now() WHERE id=p_offering_id RETURNING * INTO v;
  END IF;
  RETURN v;
END;
$$;

-- Public search must ignore internal Aula Agora anchors.
CREATE OR REPLACE FUNCTION public.search_providers_public(
  p_user_lat DOUBLE PRECISION, p_user_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 5000, p_category TEXT DEFAULT NULL,
  p_provider_type TEXT DEFAULT 'ALL', p_transmission TEXT DEFAULT 'ALL',
  p_min_rating DOUBLE PRECISION DEFAULT 0.0, p_max_price_cents INT DEFAULT NULL,
  p_limit INT DEFAULT 20, p_offset INT DEFAULT 0, p_date DATE DEFAULT NULL
)
RETURNS TABLE (
  provider_id UUID, display_name TEXT, provider_type TEXT, avatar_url TEXT,
  is_verified BOOLEAN, rating_average NUMERIC, rating_count INT, rating_source TEXT,
  neighborhood TEXT, city TEXT, public_latitude DOUBLE PRECISION, public_longitude DOUBLE PRECISION,
  public_map_location_type TEXT, rounded_distance_meters INT, distance_display TEXT,
  starting_price_in_cents INT, normalized_price_cents INT, categories TEXT[], transmissions TEXT[], public_offerings JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_search_point GEOGRAPHY(Point, 4326); v_radius DOUBLE PRECISION; v_limit INT; v_offset INT;
BEGIN
  IF p_user_lat IS NULL OR p_user_lat NOT BETWEEN -90 AND 90 OR p_user_lng IS NULL OR p_user_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'INVALID_SEARCH_COORDINATES' USING ERRCODE = '22023'; END IF;
  IF p_provider_type IS NULL OR p_provider_type NOT IN ('ALL', 'INSTRUCTOR', 'DRIVING_SCHOOL') THEN RAISE EXCEPTION 'INVALID_PROVIDER_TYPE' USING ERRCODE = '22023'; END IF;
  IF p_transmission IS NOT NULL AND p_transmission NOT IN ('ALL', 'MANUAL', 'AUTOMATIC', 'NOT_APPLICABLE') THEN RAISE EXCEPTION 'INVALID_TRANSMISSION' USING ERRCODE = '22023'; END IF;
  IF p_category IS NOT NULL AND p_category <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for public search' USING ERRCODE = '22023'; END IF;
  v_search_point := ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography;
  v_radius := LEAST(GREATEST(COALESCE(p_radius_meters, 5000), 0), 50000);
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50); v_offset := GREATEST(COALESCE(p_offset, 0), 0);
  RETURN QUERY
  WITH eligible_offerings AS (
    SELECT o.provider_id, MIN(o.price_in_cents)::INT AS starting_price_in_cents,
      ARRAY_AGG(DISTINCT o.category::TEXT ORDER BY o.category::TEXT) AS categories,
      ARRAY_AGG(DISTINCT o.transmission::TEXT ORDER BY o.transmission::TEXT) AS transmissions,
      JSONB_AGG(JSONB_BUILD_OBJECT('id',o.id,'providerId',o.provider_id,'instructorId',o.instructor_id,'instructorName',u.name,'vehicleId',o.vehicle_id,'vehicleTitle',CONCAT(v.brand,' ',v.model,' (',v.year,')'),'vehicleType',v.vehicle_type,'category',o.category,'transmission',o.transmission,'photos',COALESCE(v.photos,ARRAY[]::TEXT[]),'durationMinutes',o.duration_minutes,'priceInCents',o.price_in_cents) ORDER BY o.price_in_cents,o.id) AS public_offerings
    FROM public.service_offerings o
    JOIN public.vehicles v ON v.id=o.vehicle_id AND v.provider_id=o.provider_id AND v.status='ACTIVE' AND v.deleted_at IS NULL AND v.category=o.category AND v.transmission=o.transmission
    JOIN public.users u ON u.id=o.instructor_id AND u.status='ACTIVE'
    WHERE o.source='AGENDA' AND o.is_active=TRUE AND o.status='ACTIVE' AND o.instructor_id IS NOT NULL AND o.category::TEXT='B'
      AND (p_transmission='ALL' OR o.transmission::TEXT=p_transmission) AND public.is_provider_instructor_eligible(o.provider_id,o.instructor_id,o.category)
    GROUP BY o.provider_id
  )
  SELECT p.id,p.trade_name::TEXT,p.type::TEXT,p.avatar_url,(p.status='ACTIVE'),p.rating_average,p.rating_count,'REAL'::TEXT,p.neighborhood::TEXT,p.city::TEXT,p.public_latitude,p.public_longitude,p.public_map_location_type,
    (ROUND(ST_Distance(p.location_geography,v_search_point)/100.0)::INT*100),CONCAT(REPLACE(ROUND((ST_Distance(p.location_geography,v_search_point)/1000.0)::NUMERIC,1)::TEXT,'.',','),' km'),eo.starting_price_in_cents,eo.starting_price_in_cents,eo.categories,eo.transmissions,eo.public_offerings
  FROM public.providers p JOIN eligible_offerings eo ON eo.provider_id=p.id
  WHERE p.status='ACTIVE' AND ST_DWithin(p.location_geography,v_search_point,v_radius) AND (p_provider_type='ALL' OR p.type::TEXT=p_provider_type) AND p.rating_average>=COALESCE(p_min_rating,0)
    AND (p_max_price_cents IS NULL OR eo.starting_price_in_cents<=p_max_price_cents)
    AND (p_date IS NULL OR EXISTS (SELECT 1 FROM public.service_offerings so_avail WHERE so_avail.provider_id=p.id AND so_avail.source='AGENDA' AND so_avail.is_active=TRUE AND so_avail.status='ACTIVE' AND so_avail.category::TEXT='B' AND (p_transmission='ALL' OR so_avail.transmission::TEXT=p_transmission) AND EXISTS (SELECT 1 FROM public.get_available_slots_public(so_avail.id,p_date,p_date))))
  ORDER BY ST_Distance(p.location_geography,v_search_point) ASC,p.id ASC LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_providers_public(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, DOUBLE PRECISION, INT, INT, INT, DATE) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_provider_booking_context_public(p_provider_id UUID)
RETURNS TABLE (
  provider_id UUID, provider_name TEXT, offering_id UUID, instructor_id UUID,
  instructor_name TEXT, vehicle_id UUID, category TEXT, transmission TEXT,
  duration_minutes INT, price_in_cents INT, vehicle_brand TEXT, vehicle_model TEXT,
  vehicle_year INT, vehicle_category TEXT, vehicle_transmission TEXT, vehicle_color TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.id, p.trade_name::TEXT, o.id, o.instructor_id, iu.name::TEXT, o.vehicle_id,
    o.category::TEXT, o.transmission::TEXT, o.duration_minutes, o.price_in_cents,
    v.brand::TEXT, v.model::TEXT, v.year, v.category::TEXT, v.transmission::TEXT, v.color::TEXT
  FROM public.providers p
  JOIN public.service_offerings o ON o.provider_id = p.id
  JOIN public.users iu ON iu.id = o.instructor_id AND iu.status = 'ACTIVE'
  JOIN public.vehicles v ON v.id = o.vehicle_id AND v.provider_id = p.id
  WHERE p.id = p_provider_id AND p.status = 'ACTIVE' AND o.source = 'AGENDA'
    AND o.status = 'ACTIVE' AND o.is_active = TRUE AND o.instructor_id IS NOT NULL
    AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
  ORDER BY o.price_in_cents ASC, o.id ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_booking_context_public(UUID) TO anon, authenticated;

COMMIT;
