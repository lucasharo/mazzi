-- TASK-089 — Make the canonical instructor availability a non-renewing,
-- backend-owned one-hour window. The legacy vehicle setting remains
-- compatibility-only and never controls matching.

BEGIN;

ALTER TABLE public.provider_instant_instructor_status
  ADD COLUMN IF NOT EXISTS online_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS online_expires_at TIMESTAMPTZ;

-- Existing online flags cannot safely receive an arbitrary future hour.
-- Treat their last canonical update as the start of a one-time migration
-- window; subsequent activations always get a fresh window from the RPC.
UPDATE public.provider_instant_instructor_status
SET online_since = COALESCE(online_since, updated_at),
    online_expires_at = COALESCE(online_expires_at, updated_at + INTERVAL '1 hour')
WHERE instant_online = TRUE;

UPDATE public.provider_instant_instructor_status
SET online_since = NULL,
    online_expires_at = NULL
WHERE instant_online = FALSE;

ALTER TABLE public.provider_instant_instructor_status
  DROP CONSTRAINT IF EXISTS provider_instant_instructor_status_window_check;

ALTER TABLE public.provider_instant_instructor_status
  ADD CONSTRAINT provider_instant_instructor_status_window_check
  CHECK (
    (instant_online = TRUE AND online_since IS NOT NULL AND online_expires_at IS NOT NULL AND online_expires_at > online_since)
    OR
    (instant_online = FALSE AND online_since IS NULL AND online_expires_at IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_provider_instant_instructor_status_instructor
  ON public.provider_instant_instructor_status (instructor_id);

DROP FUNCTION IF EXISTS public.get_my_instant_instructor_statuses(UUID);
CREATE FUNCTION public.get_my_instant_instructor_statuses(p_provider_id UUID)
RETURNS TABLE (
  provider_id UUID,
  instructor_id UUID,
  instant_online BOOLEAN,
  online_since TIMESTAMPTZ,
  online_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.instant_is_provider_member(p_provider_id, auth.uid()) THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.provider_instant_instructor_status s
  SET instant_online = FALSE,
      online_since = NULL,
      online_expires_at = NULL,
      updated_at = NOW()
  WHERE s.provider_id = p_provider_id
    AND s.instant_online = TRUE
    AND s.online_expires_at <= NOW();

  RETURN QUERY
  SELECT s.provider_id, s.instructor_id, s.instant_online,
    s.online_since, s.online_expires_at, s.updated_at
  FROM public.provider_instant_instructor_status s
  WHERE s.provider_id = p_provider_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_instant_instructor_online(
  p_provider_id UUID, p_instructor_id UUID, p_online BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_online BOOLEAN := COALESCE(p_online, FALSE);
  v_online_since TIMESTAMPTZ;
  v_online_expires_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_instructor_id THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SELF_ONLY' USING ERRCODE = '42501';
  END IF;
  IF NOT public.instant_is_provider_member(p_provider_id, auth.uid()) THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_online AND NOT EXISTS (
    SELECT 1
    FROM public.provider_instant_settings s
    JOIN public.service_offerings o ON o.id = s.offering_id
      AND o.source = 'AULA_AGORA' AND o.instructor_id = p_instructor_id
      AND o.status = 'ACTIVE' AND o.is_active = TRUE
    JOIN public.vehicles v ON v.id = o.vehicle_id
      AND v.provider_id = p_provider_id AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
    WHERE s.provider_id = p_provider_id AND s.instant_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'INSTANT_VEHICLE_NOT_ENABLED' USING ERRCODE = '22023';
  END IF;

  IF v_online THEN
    v_online_since := NOW();
    v_online_expires_at := v_online_since + INTERVAL '1 hour';
  END IF;

  INSERT INTO public.provider_instant_instructor_status (
    provider_id, instructor_id, instant_online, online_since,
    online_expires_at, updated_at
  )
  VALUES (
    p_provider_id, p_instructor_id, v_online, v_online_since,
    v_online_expires_at, NOW()
  )
  ON CONFLICT (provider_id, instructor_id) DO UPDATE SET
    instant_online = EXCLUDED.instant_online,
    online_since = EXCLUDED.online_since,
    online_expires_at = EXCLUDED.online_expires_at,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'success', TRUE,
    'provider_id', p_provider_id,
    'instructor_id', p_instructor_id,
    'instant_online', v_online,
    'online_since', v_online_since,
    'online_expires_at', v_online_expires_at
  );
END;
$$;

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
    s.instant_enabled,
    COALESCE(ist.instant_online AND ist.online_expires_at > NOW(), FALSE),
    s.instant_price_in_cents, s.max_distance_km, s.updated_at,
    o.category::TEXT, o.transmission::TEXT, o.duration_minutes
  FROM public.provider_instant_settings s
  JOIN public.service_offerings o ON o.id = s.offering_id AND o.source = 'AULA_AGORA'
  LEFT JOIN public.provider_instant_instructor_status ist
    ON ist.provider_id = s.provider_id AND ist.instructor_id = o.instructor_id
  WHERE s.provider_id = p_provider_id;
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
  v_instructor_online BOOLEAN;
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
  SELECT * INTO v_vehicle FROM public.vehicles
  WHERE id = p_vehicle_id AND provider_id = p_provider_id
    AND status = 'ACTIVE' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE' USING ERRCODE = '22023'; END IF;
  IF p_instructor_id IS NULL OR NOT public.is_provider_instructor_eligible(p_provider_id, p_instructor_id, v_vehicle.category) THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.provider_instant_instructor_status (provider_id, instructor_id)
  VALUES (p_provider_id, p_instructor_id)
  ON CONFLICT (provider_id, instructor_id) DO NOTHING;

  SELECT * INTO v_offering FROM public.service_offerings
  WHERE provider_id = p_provider_id AND instructor_id = p_instructor_id
    AND vehicle_id = p_vehicle_id AND source = 'AULA_AGORA'
  ORDER BY created_at LIMIT 1 FOR UPDATE;

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
    SET price_in_cents = p_instant_price_in_cents, is_active = TRUE,
        status = 'ACTIVE', updated_at = NOW()
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

  SELECT * INTO v_setting FROM public.provider_instant_settings
  WHERE provider_id = p_provider_id AND offering_id = v_offering.id;
  SELECT (ist.instant_online AND ist.online_expires_at > NOW())
    INTO v_instructor_online
  FROM public.provider_instant_instructor_status ist
  WHERE ist.provider_id = p_provider_id AND ist.instructor_id = p_instructor_id;

  RETURN jsonb_build_object(
    'id', v_setting.id, 'provider_id', v_setting.provider_id,
    'offering_id', v_setting.offering_id, 'instructor_id', v_offering.instructor_id,
    'vehicle_id', v_offering.vehicle_id, 'instant_enabled', v_setting.instant_enabled,
    'instant_online', COALESCE(v_instructor_online, FALSE),
    'instant_price_in_cents', v_setting.instant_price_in_cents,
    'max_distance_km', v_setting.max_distance_km,
    'category', v_offering.category, 'transmission', v_offering.transmission,
    'duration_minutes', v_offering.duration_minutes
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_instant_price_options(
  p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION,
  p_category TEXT, p_transmission TEXT
)
RETURNS TABLE(max_price_in_cents INTEGER, eligible_provider_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_point GEOGRAPHY(Point, 4326);
BEGIN
  IF v_uid IS NULL OR NOT public.user_has_role(v_uid, 'STUDENT'::public.user_role) THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INSTANT_LOCATION_INVALID' USING ERRCODE = '22023';
  END IF;
  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY;

  RETURN QUERY
  WITH candidates AS (
    SELECT s.instant_price_in_cents, o.instructor_id, o.vehicle_id, o.duration_minutes,
      CEIL(ST_Distance(ST_SetSRID(ST_MakePoint(l.longitude, l.latitude),4326)::GEOGRAPHY, v_point) / 350.0)::INTEGER AS eta_minutes,
      nb.id AS next_booking_id, nb.scheduled_start_at, nb.next_location
    FROM public.provider_instant_settings s
    JOIN public.provider_instant_instructor_status ist
      ON ist.provider_id = s.provider_id
      AND ist.instructor_id = (SELECT instructor_id FROM public.service_offerings WHERE id = s.offering_id)
      AND ist.instant_online = TRUE AND ist.online_expires_at > NOW()
    JOIN public.providers p ON p.id=s.provider_id AND p.status='ACTIVE'
    JOIN public.service_offerings o ON o.id=s.offering_id AND o.source='AULA_AGORA' AND o.status='ACTIVE' AND o.is_active
    JOIN public.vehicles v ON v.id=o.vehicle_id AND v.status='ACTIVE' AND v.deleted_at IS NULL
    JOIN public.instant_provider_locations l ON l.provider_id=s.provider_id AND l.instructor_id=o.instructor_id AND l.recorded_at >= NOW()-INTERVAL '30 seconds'
    LEFT JOIN LATERAL (
      SELECT b.id, b.scheduled_start_at,
        CASE
          WHEN (b.meeting_point->>'latitude') IS NOT NULL AND (b.meeting_point->>'longitude') IS NOT NULL
            AND (b.meeting_point->>'latitude')::DOUBLE PRECISION BETWEEN -90 AND 90
            AND (b.meeting_point->>'longitude')::DOUBLE PRECISION BETWEEN -180 AND 180
          THEN ST_SetSRID(ST_MakePoint((b.meeting_point->>'longitude')::DOUBLE PRECISION,(b.meeting_point->>'latitude')::DOUBLE PRECISION),4326)::GEOGRAPHY
          WHEN np.location IS NOT NULL THEN np.location ELSE NULL END AS next_location
      FROM public.bookings b JOIN public.providers np ON np.id=b.provider_id
      WHERE (b.instructor_id=o.instructor_id OR b.vehicle_id=o.vehicle_id)
        AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND b.scheduled_start_at > NOW()
      ORDER BY b.scheduled_start_at LIMIT 1
    ) nb ON TRUE
    WHERE s.instant_enabled=TRUE AND o.category::TEXT=p_category
      AND (p_transmission='ALL' OR v.transmission::TEXT=p_transmission)
      AND o.instructor_id <> v_uid AND public.is_provider_instructor_eligible(o.provider_id,o.instructor_id,o.category)
      AND ST_DWithin(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY,v_point,s.max_distance_km*1000)
      AND s.instant_price_in_cents > 0
  ), evaluated AS (
    SELECT c.*, CASE WHEN c.next_booking_id IS NULL THEN 0 WHEN c.next_location IS NULL THEN NULL ELSE CEIL(ST_Distance(v_point,c.next_location)/350.0)::INTEGER END AS eta_next
    FROM candidates c
  ), ranked AS (
    SELECT e.*, ROW_NUMBER() OVER (PARTITION BY e.instructor_id ORDER BY e.eta_minutes, e.eta_next NULLS LAST, e.vehicle_id) AS vehicle_rank
    FROM evaluated e
    WHERE e.eta_minutes <= 30
      AND NOT EXISTS (SELECT 1 FROM public.bookings x WHERE x.instructor_id=e.instructor_id AND x.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND x.scheduled_start_at <= NOW() AND x.scheduled_end_at > NOW())
      AND (e.next_booking_id IS NULL OR (e.next_location IS NOT NULL AND NOW()+MAKE_INTERVAL(mins=>e.eta_minutes+e.duration_minutes+e.eta_next+15) <= e.scheduled_start_at))
  ), eligible AS (SELECT * FROM ranked WHERE vehicle_rank=1), buckets AS (
    SELECT DISTINCT instant_price_in_cents AS price FROM eligible ORDER BY price LIMIT 5
  )
  SELECT b.price, (SELECT COUNT(DISTINCT e.instructor_id) FROM eligible e WHERE e.instant_price_in_cents <= b.price) FROM buckets b
  UNION ALL SELECT NULL::INTEGER, COUNT(DISTINCT instructor_id) FROM eligible;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_instant_lesson_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_req public.instant_lesson_requests%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_created INTEGER := 0;
  v_wave INTEGER := 3;
  v_offer_id UUID;
  c RECORD;
BEGIN
  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.student_id<>auth.uid() THEN RAISE EXCEPTION 'INSTANT_REQUEST_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF v_req.status<>'SEARCHING' THEN RETURN jsonb_build_object('success',TRUE,'status',v_req.status,'offers_created',0); END IF;
  IF v_req.expires_at<=v_now THEN UPDATE public.instant_lesson_requests SET status='EXPIRED',updated_at=v_now WHERE id=p_request_id; RETURN jsonb_build_object('success',TRUE,'status','EXPIRED','offers_created',0); END IF;
  UPDATE public.instant_lesson_offers SET status='EXPIRED',updated_at=v_now WHERE request_id=p_request_id AND status='PENDING' AND expires_at<=v_now;
  IF EXISTS(SELECT 1 FROM public.instant_lesson_offers WHERE request_id=p_request_id AND status='PENDING' AND expires_at>v_now) THEN RETURN jsonb_build_object('success',TRUE,'status','SEARCHING','offers_created',0,'wave_size',v_wave); END IF;

  FOR c IN
    WITH candidates AS (
      SELECT s.provider_id,s.offering_id,s.instant_price_in_cents,o.instructor_id,o.vehicle_id,o.duration_minutes,
        CEIL(ST_Distance(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY,ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY)/350.0)::INTEGER AS eta,
        ROUND(ST_Distance(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY,ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY))::INTEGER AS distance,
        nb.id AS next_booking_id, nb.scheduled_start_at, nb.next_location
      FROM public.provider_instant_settings s
      JOIN public.service_offerings o ON o.id=s.offering_id AND o.source='AULA_AGORA' AND o.instructor_id IS NOT NULL AND o.status='ACTIVE' AND o.is_active
      JOIN public.provider_instant_instructor_status ist ON ist.provider_id=s.provider_id AND ist.instructor_id=o.instructor_id AND ist.instant_online=TRUE AND ist.online_expires_at>v_now
      JOIN public.providers p ON p.id=s.provider_id AND p.status='ACTIVE'
      JOIN public.vehicles v ON v.id=o.vehicle_id AND v.status='ACTIVE' AND v.deleted_at IS NULL
      JOIN public.instant_provider_locations l ON l.provider_id=s.provider_id AND l.instructor_id=o.instructor_id AND l.recorded_at>=v_now-INTERVAL '30 seconds'
      LEFT JOIN LATERAL (
        SELECT b.id,b.scheduled_start_at,
          CASE
            WHEN (b.meeting_point->>'latitude') IS NOT NULL AND (b.meeting_point->>'longitude') IS NOT NULL
              AND (b.meeting_point->>'latitude')::DOUBLE PRECISION BETWEEN -90 AND 90
              AND (b.meeting_point->>'longitude')::DOUBLE PRECISION BETWEEN -180 AND 180
            THEN ST_SetSRID(ST_MakePoint((b.meeting_point->>'longitude')::DOUBLE PRECISION,(b.meeting_point->>'latitude')::DOUBLE PRECISION),4326)::GEOGRAPHY
            WHEN np.location IS NOT NULL THEN np.location ELSE NULL END AS next_location
        FROM public.bookings b JOIN public.providers np ON np.id=b.provider_id
        WHERE (b.instructor_id=o.instructor_id OR b.vehicle_id=o.vehicle_id) AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND b.scheduled_start_at>v_now
        ORDER BY b.scheduled_start_at LIMIT 1
      ) nb ON TRUE
      WHERE s.instant_enabled=TRUE AND o.category=v_req.category
        AND (v_req.transmission='ALL' OR v.transmission::TEXT=v_req.transmission)
        AND (v_req.max_price_in_cents IS NULL OR s.instant_price_in_cents<=v_req.max_price_in_cents)
        AND public.is_provider_instructor_eligible(o.provider_id,o.instructor_id,o.category)
        AND ST_DWithin(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY,ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY,s.max_distance_km*1000)
        AND o.instructor_id<>v_req.student_id
        AND NOT EXISTS(SELECT 1 FROM public.instant_lesson_offers old WHERE old.request_id=p_request_id AND old.instructor_id=o.instructor_id)
        AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE (b.instructor_id=o.instructor_id OR b.vehicle_id=o.vehicle_id) AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND b.scheduled_start_at<=v_now AND b.scheduled_end_at>v_now)
    ), evaluated AS (
      SELECT c.*,CASE WHEN c.next_booking_id IS NULL THEN 0 WHEN c.next_location IS NULL THEN NULL ELSE CEIL(ST_Distance(ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY,c.next_location)/350.0)::INTEGER END AS eta_next
      FROM candidates c
    ), viable AS (
      SELECT e.*,ROW_NUMBER() OVER(PARTITION BY e.instructor_id ORDER BY e.eta,e.eta_next NULLS LAST,e.distance,e.vehicle_id) AS vehicle_rank
      FROM evaluated e
      WHERE e.eta<=30
        AND (e.next_booking_id IS NULL OR (e.next_location IS NOT NULL AND v_now+MAKE_INTERVAL(mins=>e.eta+e.duration_minutes+e.eta_next+15)<=e.scheduled_start_at))
    )
    SELECT provider_id,offering_id,instant_price_in_cents,instructor_id,vehicle_id,distance,eta
    FROM viable WHERE vehicle_rank=1 ORDER BY eta,distance,instructor_id,vehicle_id LIMIT v_wave
  LOOP
    INSERT INTO public.instant_lesson_offers(request_id,provider_id,offering_id,instructor_id,vehicle_id,offered_price_in_cents,distance_meters,eta_minutes,expires_at,idempotency_key)
    VALUES(p_request_id,c.provider_id,c.offering_id,c.instructor_id,c.vehicle_id,c.instant_price_in_cents,GREATEST(0,c.distance),GREATEST(0,c.eta),v_now+INTERVAL '15 seconds','instant_offer:'||p_request_id::TEXT||':'||c.instructor_id::TEXT)
    ON CONFLICT DO NOTHING RETURNING id INTO v_offer_id;
    IF FOUND THEN
      v_created:=v_created+1;
      INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,app_context,navigation_action)
      SELECT c.instructor_id,'INSTANT_LESSON_OFFER','Nova Aula Agora','Há uma solicitação de aula próxima para você avaliar.','instant_offer',v_offer_id,'PRO','instant_offer'
      WHERE EXISTS(SELECT 1 FROM public.users u WHERE u.id=c.instructor_id AND u.status='ACTIVE');
    END IF;
  END LOOP;
  IF v_created=0 AND NOT EXISTS(SELECT 1 FROM public.instant_lesson_offers WHERE request_id=p_request_id AND status='PENDING' AND expires_at>v_now) THEN
    UPDATE public.instant_lesson_requests SET status='FAILED',updated_at=v_now WHERE id=p_request_id;
    RETURN jsonb_build_object('success',TRUE,'status','FAILED','offers_created',0);
  END IF;
  RETURN jsonb_build_object('success',TRUE,'status','SEARCHING','offers_created',v_created,'wave_size',v_wave);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_instant_instructor_statuses(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_instant_instructor_online(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_instant_vehicle_settings(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_my_instant_vehicle_setting(UUID, UUID, UUID, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dispatch_instant_lesson_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_instant_instructor_statuses(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_instant_instructor_online(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_instant_vehicle_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_instant_vehicle_setting(UUID, UUID, UUID, BOOLEAN, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_instant_lesson_request(UUID) TO authenticated;

COMMIT;
