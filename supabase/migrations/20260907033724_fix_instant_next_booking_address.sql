-- Aula Agora matching must understand the canonical provider address.
-- Some confirmed lessons store only PROVIDER_ADDRESS in meeting_point while
-- the coordinates live in providers.address, not in providers.location.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_instant_price_options(
  p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION,
  p_category TEXT, p_transmission TEXT
)
RETURNS TABLE(max_price_in_cents INTEGER, eligible_provider_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_point GEOGRAPHY(Point, 4326);
  v_max_eta_minutes INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.user_has_role(v_uid, 'STUDENT'::public.user_role) THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INSTANT_LOCATION_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT GREATEST(1, LEAST(120, COALESCE((value->>'max_eta_minutes')::INTEGER, 30)))
    INTO v_max_eta_minutes
  FROM public.platform_configurations
  WHERE key = 'instant_lesson_settings'
  LIMIT 1;
  v_max_eta_minutes := COALESCE(v_max_eta_minutes, 30);
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
          WHEN np.location IS NOT NULL THEN np.location
          WHEN (np.address->>'latitude') IS NOT NULL AND (np.address->>'longitude') IS NOT NULL
            AND (np.address->>'latitude')::DOUBLE PRECISION BETWEEN -90 AND 90
            AND (np.address->>'longitude')::DOUBLE PRECISION BETWEEN -180 AND 180
          THEN ST_SetSRID(ST_MakePoint((np.address->>'longitude')::DOUBLE PRECISION,(np.address->>'latitude')::DOUBLE PRECISION),4326)::GEOGRAPHY
          ELSE NULL
        END AS next_location
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
    WHERE e.eta_minutes <= v_max_eta_minutes
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
  v_max_eta_minutes INTEGER;
  v_offer_expiration_seconds INTEGER;
  c RECORD;
BEGIN
  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.student_id<>auth.uid() THEN RAISE EXCEPTION 'INSTANT_REQUEST_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF v_req.status<>'SEARCHING' THEN RETURN jsonb_build_object('success',TRUE,'status',v_req.status,'offers_created',0); END IF;
  IF v_req.expires_at<=v_now THEN UPDATE public.instant_lesson_requests SET status='EXPIRED',updated_at=v_now WHERE id=p_request_id; RETURN jsonb_build_object('success',TRUE,'status','EXPIRED','offers_created',0); END IF;
  SELECT GREATEST(1, LEAST(120, COALESCE((value->>'max_eta_minutes')::INTEGER, 30))),
         GREATEST(5, LEAST(120, COALESCE((value->>'offer_expiration_seconds')::INTEGER, 15)))
    INTO v_max_eta_minutes, v_offer_expiration_seconds
  FROM public.platform_configurations
  WHERE key = 'instant_lesson_settings'
  LIMIT 1;
  v_max_eta_minutes := COALESCE(v_max_eta_minutes, 30);
  v_offer_expiration_seconds := COALESCE(v_offer_expiration_seconds, 15);
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
            WHEN np.location IS NOT NULL THEN np.location
            WHEN (np.address->>'latitude') IS NOT NULL AND (np.address->>'longitude') IS NOT NULL
              AND (np.address->>'latitude')::DOUBLE PRECISION BETWEEN -90 AND 90
              AND (np.address->>'longitude')::DOUBLE PRECISION BETWEEN -180 AND 180
            THEN ST_SetSRID(ST_MakePoint((np.address->>'longitude')::DOUBLE PRECISION,(np.address->>'latitude')::DOUBLE PRECISION),4326)::GEOGRAPHY
            ELSE NULL
          END AS next_location
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
      WHERE e.eta<=v_max_eta_minutes
        AND (e.next_booking_id IS NULL OR (e.next_location IS NOT NULL AND v_now+MAKE_INTERVAL(mins=>e.eta+e.duration_minutes+e.eta_next+15)<=e.scheduled_start_at))
    )
    SELECT provider_id,offering_id,instant_price_in_cents,instructor_id,vehicle_id,distance,eta
    FROM viable WHERE vehicle_rank=1 ORDER BY eta,distance,instructor_id,vehicle_id LIMIT v_wave
  LOOP
    INSERT INTO public.instant_lesson_offers(request_id,provider_id,offering_id,instructor_id,vehicle_id,offered_price_in_cents,distance_meters,eta_minutes,expires_at,idempotency_key)
    VALUES(p_request_id,c.provider_id,c.offering_id,c.instructor_id,c.vehicle_id,c.instant_price_in_cents,GREATEST(0,c.distance),GREATEST(0,c.eta),v_now+MAKE_INTERVAL(secs=>v_offer_expiration_seconds),'instant_offer:'||p_request_id::TEXT||':'||c.instructor_id::TEXT)
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

REVOKE ALL ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.dispatch_instant_lesson_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_instant_lesson_request(UUID) TO authenticated;

COMMIT;
