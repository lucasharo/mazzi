-- Admin-configurable cooldown after an Aula Agora offer is declined.
-- The cooldown applies to the same student/instructor pair and affects both
-- visible price options and backend offer dispatch.

BEGIN;

INSERT INTO public.platform_configurations (key, value, description)
VALUES (
  'instant_lesson_settings',
  jsonb_build_object(
    'max_eta_minutes', 30,
    'offer_expiration_seconds', 15,
    'payment_expiration_minutes', 5,
    'decline_cooldown_minutes', 5
  ),
  'Parâmetros operacionais das ofertas Aula Agora.'
)
ON CONFLICT (key) DO UPDATE SET
  value = public.platform_configurations.value
    || jsonb_build_object(
      'decline_cooldown_minutes',
      COALESCE(public.platform_configurations.value->'decline_cooldown_minutes', '5'::jsonb)
    );

CREATE OR REPLACE FUNCTION public.get_instant_price_options(
  p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION,
  p_category TEXT, p_transmission TEXT
)
RETURNS TABLE(max_price_in_cents INTEGER, eligible_provider_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_point GEOGRAPHY(Point, 4326);
  v_max_eta_minutes INTEGER;
  v_decline_cooldown_minutes INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.user_has_role(v_uid, 'STUDENT'::public.user_role) THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INSTANT_LOCATION_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT GREATEST(1, LEAST(120, COALESCE((value->>'max_eta_minutes')::INTEGER, 30))),
         GREATEST(1, LEAST(60, COALESCE((value->>'decline_cooldown_minutes')::INTEGER, 5)))
    INTO v_max_eta_minutes, v_decline_cooldown_minutes
  FROM public.platform_configurations
  WHERE key = 'instant_lesson_settings'
  LIMIT 1;
  v_max_eta_minutes := COALESCE(v_max_eta_minutes, 30);
  v_decline_cooldown_minutes := COALESCE(v_decline_cooldown_minutes, 5);
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
      AND o.instructor_id <> v_uid
      AND public.is_provider_instructor_eligible(o.provider_id,o.instructor_id,o.category)
      AND ST_DWithin(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY,v_point,s.max_distance_km*1000)
      AND s.instant_price_in_cents > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.instant_lesson_offers pending
        WHERE pending.instructor_id = o.instructor_id
          AND pending.status = 'PENDING'
          AND pending.expires_at > NOW()
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.instant_lesson_offers declined
        JOIN public.instant_lesson_requests declined_request ON declined_request.id = declined.request_id
        WHERE declined.instructor_id = o.instructor_id
          AND declined_request.student_id = v_uid
          AND declined.status = 'DECLINED'
          AND declined.updated_at > NOW() - MAKE_INTERVAL(mins => v_decline_cooldown_minutes)
      )
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
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_instant_lesson_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_req public.instant_lesson_requests%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_created INTEGER := 0;
  v_wave INTEGER := 3;
  v_offer_id UUID;
  v_max_eta_minutes INTEGER;
  v_offer_expiration_seconds INTEGER;
  v_decline_cooldown_minutes INTEGER;
  c RECORD;
BEGIN
  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.student_id<>auth.uid() THEN RAISE EXCEPTION 'INSTANT_REQUEST_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF v_req.status<>'SEARCHING' THEN RETURN jsonb_build_object('success',TRUE,'status',v_req.status,'offers_created',0); END IF;
  IF v_req.expires_at<=v_now THEN UPDATE public.instant_lesson_requests SET status='EXPIRED',updated_at=v_now WHERE id=p_request_id; RETURN jsonb_build_object('success',TRUE,'status','EXPIRED','offers_created',0); END IF;

  SELECT GREATEST(1, LEAST(120, COALESCE((value->>'max_eta_minutes')::INTEGER, 30))),
         GREATEST(5, LEAST(120, COALESCE((value->>'offer_expiration_seconds')::INTEGER, 15))),
         GREATEST(1, LEAST(60, COALESCE((value->>'decline_cooldown_minutes')::INTEGER, 5)))
    INTO v_max_eta_minutes, v_offer_expiration_seconds, v_decline_cooldown_minutes
  FROM public.platform_configurations
  WHERE key = 'instant_lesson_settings'
  LIMIT 1;
  v_max_eta_minutes := COALESCE(v_max_eta_minutes, 30);
  v_offer_expiration_seconds := COALESCE(v_offer_expiration_seconds, 15);
  v_decline_cooldown_minutes := COALESCE(v_decline_cooldown_minutes, 5);

  UPDATE public.instant_lesson_offers
     SET status='EXPIRED', updated_at=v_now
   WHERE status='PENDING' AND expires_at<=v_now;

  IF EXISTS(SELECT 1 FROM public.instant_lesson_offers WHERE request_id=p_request_id AND status='PENDING' AND expires_at>v_now) THEN
    RETURN jsonb_build_object('success',TRUE,'status','SEARCHING','offers_created',0,'wave_size',v_wave);
  END IF;

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
        AND NOT EXISTS(SELECT 1 FROM public.instant_lesson_offers pending WHERE pending.instructor_id=o.instructor_id AND pending.status='PENDING' AND pending.expires_at>v_now)
        AND NOT EXISTS(
          SELECT 1
          FROM public.instant_lesson_offers declined
          JOIN public.instant_lesson_requests declined_request ON declined_request.id=declined.request_id
          WHERE declined.instructor_id=o.instructor_id
            AND declined_request.student_id=v_req.student_id
            AND declined.status='DECLINED'
            AND declined.updated_at>v_now-MAKE_INTERVAL(mins=>v_decline_cooldown_minutes)
        )
        AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE (b.instructor_id=o.instructor_id OR b.vehicle_id=o.vehicle_id) AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND b.scheduled_start_at<=v_now AND b.scheduled_end_at>v_now)
    ), evaluated AS (
      SELECT candidate_rows.*, CASE WHEN candidate_rows.next_booking_id IS NULL THEN 0 WHEN candidate_rows.next_location IS NULL THEN NULL ELSE CEIL(ST_Distance(ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY,candidate_rows.next_location)/350.0)::INTEGER END AS eta_next
      FROM candidates candidate_rows
    ), viable AS (
      SELECT evaluated_rows.*,ROW_NUMBER() OVER(PARTITION BY evaluated_rows.instructor_id ORDER BY evaluated_rows.eta,evaluated_rows.eta_next NULLS LAST,evaluated_rows.distance,evaluated_rows.vehicle_id) AS vehicle_rank
      FROM evaluated evaluated_rows
      WHERE evaluated_rows.eta<=v_max_eta_minutes
        AND (evaluated_rows.next_booking_id IS NULL OR (evaluated_rows.next_location IS NOT NULL AND v_now+MAKE_INTERVAL(mins=>evaluated_rows.eta+evaluated_rows.duration_minutes+evaluated_rows.eta_next+15)<=evaluated_rows.scheduled_start_at))
    )
    SELECT viable.provider_id,viable.offering_id,viable.instant_price_in_cents,viable.instructor_id,viable.vehicle_id,viable.distance,viable.eta
    FROM viable WHERE viable.vehicle_rank=1 ORDER BY viable.eta,viable.distance,viable.instructor_id,viable.vehicle_id LIMIT v_wave
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
$function$;

CREATE OR REPLACE FUNCTION public.update_admin_instant_lesson_config(
  p_max_eta_minutes INTEGER,
  p_offer_expiration_seconds INTEGER,
  p_payment_expiration_minutes INTEGER,
  p_decline_cooldown_minutes INTEGER
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_before JSONB;
  v_after JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.platform.manage_settings'::public.app_permission) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_max_eta_minutes IS NULL OR p_max_eta_minutes NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'INVALID_INSTANT_MAX_ETA' USING ERRCODE = '22023';
  END IF;
  IF p_offer_expiration_seconds IS NULL OR p_offer_expiration_seconds NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'INVALID_INSTANT_OFFER_EXPIRATION' USING ERRCODE = '22023';
  END IF;
  IF p_payment_expiration_minutes IS NULL OR p_payment_expiration_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'INVALID_INSTANT_LESSON_EXPIRATION' USING ERRCODE = '22023';
  END IF;
  IF p_decline_cooldown_minutes IS NULL OR p_decline_cooldown_minutes NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'INVALID_INSTANT_DECLINE_COOLDOWN' USING ERRCODE = '22023';
  END IF;

  SELECT value INTO v_before
    FROM public.platform_configurations
   WHERE key = 'instant_lesson_settings'
   FOR UPDATE;

  INSERT INTO public.platform_configurations (key, value, description, updated_by, updated_at)
  VALUES (
    'instant_lesson_settings',
    jsonb_build_object(
      'max_eta_minutes', p_max_eta_minutes,
      'offer_expiration_seconds', p_offer_expiration_seconds,
      'payment_expiration_minutes', p_payment_expiration_minutes,
      'decline_cooldown_minutes', p_decline_cooldown_minutes
    ),
    'Parâmetros operacionais das ofertas Aula Agora.',
    v_uid,
    NOW()
  )
  ON CONFLICT (key) DO UPDATE SET
    value = public.platform_configurations.value || jsonb_build_object(
      'max_eta_minutes', EXCLUDED.value->'max_eta_minutes',
      'offer_expiration_seconds', EXCLUDED.value->'offer_expiration_seconds',
      'payment_expiration_minutes', EXCLUDED.value->'payment_expiration_minutes',
      'decline_cooldown_minutes', EXCLUDED.value->'decline_cooldown_minutes'
    ),
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  SELECT value INTO v_after
    FROM public.platform_configurations
   WHERE key = 'instant_lesson_settings';

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (v_uid, 'PLATFORM_CONFIG_UPDATED', 'PlatformConfiguration', 'instant_lesson_settings', COALESCE(v_before, '{}'::JSONB), v_after, NOW());
END;
$function$;

REVOKE ALL ON FUNCTION public.update_admin_instant_lesson_config(INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_instant_lesson_config(INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;

COMMIT;
