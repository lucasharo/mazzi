-- TASK-089 — Use the dynamic schedule window for Aula Agora matching.
-- DEV only. Future lessons are allowed when the arrival, lesson duration and
-- safety margin fit before the next lesson for the instructor and vehicle.

CREATE OR REPLACE FUNCTION public.get_instant_price_options(
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category TEXT,
  p_transmission TEXT
)
RETURNS TABLE(max_price_in_cents INTEGER, eligible_provider_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_point GEOGRAPHY(Point, 4326);
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'STUDENT' AND u.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY;

  RETURN QUERY
  WITH candidate_base AS (
    SELECT
      s.instant_price_in_cents,
      o.instructor_id,
      o.vehicle_id,
      o.duration_minutes,
      CEIL(ST_Distance(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::GEOGRAPHY,
        v_point
      ) / 350.0)::INTEGER AS eta_minutes
    FROM public.provider_instant_settings s
    JOIN public.providers p ON p.id = s.provider_id AND p.status = 'ACTIVE'
    JOIN public.service_offerings o ON o.id = s.offering_id AND o.status = 'ACTIVE' AND o.is_active = TRUE
    JOIN public.vehicles v ON v.id = o.vehicle_id AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
    JOIN public.instant_provider_locations l
      ON l.provider_id = s.provider_id
      AND l.instructor_id = o.instructor_id
      AND l.recorded_at >= NOW() - INTERVAL '30 seconds'
    WHERE s.instant_enabled = TRUE
      AND s.instant_online = TRUE
      AND o.category::TEXT = p_category
      AND (p_transmission = 'ALL' OR v.transmission::TEXT = p_transmission)
      AND o.instructor_id <> auth.uid()
      AND public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::GEOGRAPHY,
        v_point,
        s.max_distance_km * 1000
      )
      AND s.instant_price_in_cents > 0
  ), candidates AS (
    SELECT cb.instant_price_in_cents
    FROM candidate_base cb
    WHERE cb.eta_minutes <= 30
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE (b.instructor_id = cb.instructor_id OR b.vehicle_id = cb.vehicle_id)
          AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
          AND b.scheduled_start_at <= NOW()
          AND b.scheduled_end_at > NOW()
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE (b.instructor_id = cb.instructor_id OR b.vehicle_id = cb.vehicle_id)
          AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
          AND b.scheduled_start_at > NOW()
          AND NOW() + MAKE_INTERVAL(mins => cb.eta_minutes + cb.duration_minutes + cb.eta_minutes + 15) > b.scheduled_start_at
      )
  ), buckets AS (
    SELECT DISTINCT instant_price_in_cents AS price
    FROM candidates
    ORDER BY price
    LIMIT 5
  )
  SELECT b.price, (SELECT COUNT(*) FROM candidates c WHERE c.instant_price_in_cents <= b.price)
  FROM buckets b
  UNION ALL
  SELECT NULL::INTEGER, COUNT(*) FROM candidates;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_instant_lesson_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_req public.instant_lesson_requests%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_wave INTEGER := 3;
  v_created INTEGER := 0;
  v_offer_id UUID;
  v_candidate RECORD;
  v_eta INTEGER;
  v_distance INTEGER;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_next RECORD;
BEGIN
  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.student_id <> auth.uid() THEN
    RAISE EXCEPTION 'INSTANT_REQUEST_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_req.status <> 'SEARCHING' THEN
    RETURN jsonb_build_object('success', TRUE, 'status', v_req.status, 'offers_created', 0);
  END IF;
  IF v_req.expires_at <= v_now THEN
    UPDATE public.instant_lesson_requests SET status = 'EXPIRED', updated_at = v_now WHERE id = p_request_id;
    RETURN jsonb_build_object('success', TRUE, 'status', 'EXPIRED', 'offers_created', 0);
  END IF;
  UPDATE public.instant_lesson_offers
  SET status = 'EXPIRED', updated_at = v_now
  WHERE request_id = p_request_id AND status = 'PENDING' AND expires_at <= v_now;

  IF EXISTS (
    SELECT 1 FROM public.instant_lesson_offers
    WHERE request_id = p_request_id AND status = 'PENDING' AND expires_at > v_now
  ) THEN
    RETURN jsonb_build_object('success', TRUE, 'status', 'SEARCHING', 'offers_created', 0, 'wave_size', v_wave);
  END IF;

  FOR v_candidate IN
    SELECT s.*, p.trade_name, o.instructor_id, o.vehicle_id, o.category, v.transmission, o.duration_minutes,
      CEIL(ST_Distance(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::GEOGRAPHY,
        ST_SetSRID(ST_MakePoint(v_req.longitude, v_req.latitude), 4326)::GEOGRAPHY
      ) / 350.0)::INTEGER AS eta,
      ROUND(ST_Distance(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::GEOGRAPHY,
        ST_SetSRID(ST_MakePoint(v_req.longitude, v_req.latitude), 4326)::GEOGRAPHY
      ))::INTEGER AS distance
    FROM public.provider_instant_settings s
    JOIN public.providers p ON p.id = s.provider_id AND p.status = 'ACTIVE'
    JOIN public.service_offerings o ON o.id = s.offering_id AND o.status = 'ACTIVE' AND o.is_active = TRUE
    JOIN public.vehicles v ON v.id = o.vehicle_id AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
    JOIN public.instant_provider_locations l
      ON l.provider_id = s.provider_id
      AND l.instructor_id = o.instructor_id
      AND l.recorded_at >= v_now - INTERVAL '30 seconds'
    WHERE s.instant_enabled = TRUE
      AND s.instant_online = TRUE
      AND o.category = v_req.category
      AND (v_req.transmission = 'ALL' OR v.transmission::TEXT = v_req.transmission)
      AND (v_req.max_price_in_cents IS NULL OR s.instant_price_in_cents <= v_req.max_price_in_cents)
      AND public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::GEOGRAPHY,
        ST_SetSRID(ST_MakePoint(v_req.longitude, v_req.latitude), 4326)::GEOGRAPHY,
        s.max_distance_km * 1000
      )
      AND o.instructor_id <> v_req.student_id
      AND NOT EXISTS (
        SELECT 1 FROM public.instant_lesson_offers old
        WHERE old.request_id = p_request_id AND old.offering_id = s.offering_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE (b.instructor_id = o.instructor_id OR b.vehicle_id = o.vehicle_id)
          AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
          AND b.scheduled_start_at <= v_now
          AND b.scheduled_end_at > v_now
      )
    ORDER BY eta ASC, distance ASC, s.updated_at ASC, s.provider_id
    LIMIT v_wave
  LOOP
    v_eta := GREATEST(0, v_candidate.eta);
    v_distance := GREATEST(0, v_candidate.distance);
    IF v_eta > 30 THEN CONTINUE; END IF;

    v_start := v_now + MAKE_INTERVAL(mins => v_eta);
    v_end := v_start + MAKE_INTERVAL(mins => v_candidate.duration_minutes);
    SELECT b.scheduled_start_at INTO v_next
    FROM public.bookings b
    WHERE (b.instructor_id = v_candidate.instructor_id OR b.vehicle_id = v_candidate.vehicle_id)
      AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
      AND b.scheduled_start_at > v_now
    ORDER BY b.scheduled_start_at
    LIMIT 1;
    IF FOUND AND v_end + MAKE_INTERVAL(mins => v_eta + 15) > v_next.scheduled_start_at THEN CONTINUE; END IF;

    BEGIN
      INSERT INTO public.instant_lesson_offers (
        request_id, provider_id, offering_id, instructor_id, vehicle_id,
        offered_price_in_cents, distance_meters, eta_minutes, expires_at, idempotency_key
      )
      VALUES (
        p_request_id, v_candidate.provider_id, v_candidate.offering_id,
        v_candidate.instructor_id, v_candidate.vehicle_id, v_candidate.instant_price_in_cents,
        v_distance, v_eta, v_now + INTERVAL '15 seconds',
        'instant_offer:' || p_request_id::TEXT || ':' || v_candidate.offering_id::TEXT
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_offer_id;
      IF FOUND THEN
        v_created := v_created + 1;
        INSERT INTO public.notifications (
          user_id, type, title, body, entity_type, entity_id, app_context, navigation_action
        )
        SELECT recipient.user_id, 'INSTANT_LESSON_OFFER', 'Nova Aula Agora',
          'Há uma solicitação de aula próxima para você avaliar.', 'instant_offer', v_offer_id,
          'PRO', 'instant_offer'
        FROM (
          SELECT v_candidate.instructor_id AS user_id
          UNION
          SELECT p.user_id FROM public.providers p
          WHERE p.id = v_candidate.provider_id AND p.user_id IS NOT NULL
        ) recipient
        JOIN public.users u ON u.id = recipient.user_id AND u.status = 'ACTIVE';
      END IF;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;

  IF v_created = 0 AND NOT EXISTS (
    SELECT 1 FROM public.instant_lesson_offers
    WHERE request_id = p_request_id AND status = 'PENDING' AND expires_at > v_now
  ) THEN
    IF EXISTS (SELECT 1 FROM public.provider_instant_settings s WHERE s.instant_enabled AND s.instant_online) THEN
      UPDATE public.instant_lesson_requests SET status = 'FAILED', updated_at = v_now WHERE id = p_request_id;
      RETURN jsonb_build_object('success', TRUE, 'status', 'FAILED', 'offers_created', 0);
    END IF;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'status', 'SEARCHING', 'offers_created', v_created, 'wave_size', v_wave);
END;
$$;

REVOKE ALL ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.dispatch_instant_lesson_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_instant_lesson_request(UUID) TO authenticated;
