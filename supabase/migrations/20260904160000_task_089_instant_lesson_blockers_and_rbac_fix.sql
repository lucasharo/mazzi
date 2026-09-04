-- TASK-089 — Aula Agora Blockers & Operational Consolidation
-- Forward-only migration to fix:
-- 1. Multi-role student verification via public.user_has_role
-- 2. RBAC isolation for live location reporting (auth.uid() = p_instructor_id)
-- 3. FAIL CLOSED exact travel estimation to next scheduled booking (student -> next booking)
-- 4. Provider count deduplication (COUNT DISTINCT instructor_id)
-- 5. Wave dispatch deduplication per instructor (DISTINCT ON instructor_id)

-- 1. CANONICAL MULTI-ROLE HELPER
CREATE OR REPLACE FUNCTION public.user_has_role(
  p_user_id UUID,
  p_role public.user_role
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id AND u.status = 'ACTIVE'::public.user_status
      AND (
        u.role = p_role
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = p_user_id AND ur.role = p_role
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_role(UUID, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_role(UUID, public.user_role) TO authenticated;

-- 2. HARDENED INSTRUCTOR LIVE LOCATION REPORTING (RBAC)
CREATE OR REPLACE FUNCTION public.upsert_my_instant_location(
  p_provider_id UUID,
  p_instructor_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_instructor_id THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INSTANT_LOCATION_INVALID' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.service_offerings o
    WHERE o.provider_id = p_provider_id AND o.instructor_id = p_instructor_id AND o.status = 'ACTIVE' AND o.is_active = TRUE
  ) AND NOT EXISTS (
    SELECT 1 FROM public.providers p WHERE p.id = p_provider_id AND p.user_id = p_instructor_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.driving_school_staff s WHERE s.school_id = p_provider_id AND s.user_id = p_instructor_id AND s.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SCOPE_DENIED' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.instant_provider_locations(provider_id, instructor_id, latitude, longitude, recorded_at)
  VALUES (p_provider_id, p_instructor_id, p_latitude, p_longitude, NOW())
  ON CONFLICT (provider_id, instructor_id) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    recorded_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_instant_location(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_my_instant_location(UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- 3. GET INSTANT PRICE OPTIONS (MULTI-ROLE + UNIQUE INSTRUCTORS + FAIL CLOSED NEXT LESSON TRAVEL)
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
  v_uid UUID := auth.uid();
  v_point GEOGRAPHY(Point, 4326);
BEGIN
  IF v_uid IS NULL OR NOT public.user_has_role(v_uid, 'STUDENT'::public.user_role) THEN
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
      ) / 350.0)::INTEGER AS eta_minutes,
      nb.id AS next_booking_id,
      nb.scheduled_start_at AS next_start_at,
      CASE
        WHEN nb.id IS NULL THEN NULL
        WHEN (nb.meeting_point->>'latitude') IS NOT NULL AND (nb.meeting_point->>'longitude') IS NOT NULL
             AND ((nb.meeting_point->>'latitude')::DOUBLE PRECISION BETWEEN -90 AND 90)
             AND ((nb.meeting_point->>'longitude')::DOUBLE PRECISION BETWEEN -180 AND 180)
        THEN ST_SetSRID(ST_MakePoint((nb.meeting_point->>'longitude')::DOUBLE PRECISION, (nb.meeting_point->>'latitude')::DOUBLE PRECISION), 4326)::GEOGRAPHY
        WHEN np.location IS NOT NULL THEN np.location
        ELSE NULL
      END AS next_location
    FROM public.provider_instant_settings s
    JOIN public.providers p ON p.id = s.provider_id AND p.status = 'ACTIVE'
    JOIN public.service_offerings o ON o.id = s.offering_id AND o.status = 'ACTIVE' AND o.is_active = TRUE
    JOIN public.vehicles v ON v.id = o.vehicle_id AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
    JOIN public.instant_provider_locations l
      ON l.provider_id = s.provider_id
      AND l.instructor_id = o.instructor_id
      AND l.recorded_at >= NOW() - INTERVAL '30 seconds'
    LEFT JOIN LATERAL (
      SELECT b.id, b.scheduled_start_at, b.meeting_point, b.provider_id
      FROM public.bookings b
      WHERE (b.instructor_id = o.instructor_id OR b.vehicle_id = o.vehicle_id)
        AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
        AND b.scheduled_start_at > NOW()
      ORDER BY b.scheduled_start_at
      LIMIT 1
    ) nb ON TRUE
    LEFT JOIN public.providers np ON np.id = nb.provider_id
    WHERE s.instant_enabled = TRUE
      AND s.instant_online = TRUE
      AND o.category::TEXT = p_category
      AND (p_transmission = 'ALL' OR v.transmission::TEXT = p_transmission)
      AND o.instructor_id <> v_uid
      AND public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)
      AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::GEOGRAPHY,
        v_point,
        s.max_distance_km * 1000
      )
      AND s.instant_price_in_cents > 0
  ), evaluated_candidates AS (
    SELECT
      cb.instant_price_in_cents,
      cb.instructor_id,
      cb.eta_minutes,
      cb.duration_minutes,
      cb.next_booking_id,
      cb.next_start_at,
      cb.next_location,
      CASE
        WHEN cb.next_booking_id IS NULL THEN 0
        WHEN cb.next_location IS NULL THEN NULL
        ELSE CEIL(ST_Distance(v_point, cb.next_location) / 350.0)::INTEGER
      END AS eta_to_next_minutes
    FROM candidate_base cb
  ), candidates AS (
    SELECT ec.instant_price_in_cents, ec.instructor_id
    FROM evaluated_candidates ec
    WHERE ec.eta_minutes <= 30
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE (b.instructor_id = ec.instructor_id)
          AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
          AND b.scheduled_start_at <= NOW()
          AND b.scheduled_end_at > NOW()
      )
      -- FAIL CLOSED RULE:
      -- If there is NO upcoming booking (next_booking_id IS NULL), candidate is eligible.
      -- If there IS an upcoming booking:
      --   1. Target next_location MUST be available (non-null).
      --   2. ETA from student meeting point to next booking location MUST fit within schedule window + 15 min safety buffer.
      AND (
        ec.next_booking_id IS NULL
        OR (
          ec.next_location IS NOT NULL
          AND ec.eta_to_next_minutes IS NOT NULL
          AND NOW() + MAKE_INTERVAL(mins => ec.eta_minutes + ec.duration_minutes + ec.eta_to_next_minutes + 15) <= ec.next_start_at
        )
      )
  ), buckets AS (
    SELECT DISTINCT instant_price_in_cents AS price
    FROM candidates
    ORDER BY price
    LIMIT 5
  )
  SELECT b.price, (SELECT COUNT(DISTINCT c.instructor_id) FROM candidates c WHERE c.instant_price_in_cents <= b.price)
  FROM buckets b
  UNION ALL
  SELECT NULL::INTEGER, COUNT(DISTINCT instructor_id) FROM candidates;
END;
$$;

REVOKE ALL ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT) TO authenticated;

-- 4. DISPATCH INSTANT LESSON REQUEST (DEDUPLICATED WAVES + FAIL CLOSED NEXT LESSON TRAVEL)
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
  v_eta_next INTEGER;
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
    WITH ranked_candidates AS (
      SELECT DISTINCT ON (o.instructor_id)
        s.provider_id, s.offering_id, s.instant_price_in_cents, s.max_distance_km, s.updated_at,
        p.trade_name, o.instructor_id, o.vehicle_id, o.category, v.transmission, o.duration_minutes,
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
      ORDER BY o.instructor_id, eta ASC, distance ASC, s.updated_at ASC
    )
    SELECT * FROM ranked_candidates
    ORDER BY eta ASC, distance ASC, updated_at ASC, provider_id
    LIMIT v_wave
  LOOP
    v_eta := GREATEST(0, v_candidate.eta);
    v_distance := GREATEST(0, v_candidate.distance);
    IF v_eta > 30 THEN CONTINUE; END IF;

    v_start := v_now + MAKE_INTERVAL(mins => v_eta);
    v_end := v_start + MAKE_INTERVAL(mins => v_candidate.duration_minutes);

    SELECT b.scheduled_start_at,
           CASE
             WHEN (b.meeting_point->>'latitude') IS NOT NULL AND (b.meeting_point->>'longitude') IS NOT NULL
                  AND ((b.meeting_point->>'latitude')::DOUBLE PRECISION BETWEEN -90 AND 90)
                  AND ((b.meeting_point->>'longitude')::DOUBLE PRECISION BETWEEN -180 AND 180)
             THEN ST_SetSRID(ST_MakePoint((b.meeting_point->>'longitude')::DOUBLE PRECISION, (b.meeting_point->>'latitude')::DOUBLE PRECISION), 4326)::GEOGRAPHY
             WHEN p.location IS NOT NULL THEN p.location
             ELSE NULL
           END AS next_location
    INTO v_next
    FROM public.bookings b
    JOIN public.providers p ON p.id = b.provider_id
    WHERE (b.instructor_id = v_candidate.instructor_id OR b.vehicle_id = v_candidate.vehicle_id)
      AND b.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS')
      AND b.scheduled_start_at > v_now
    ORDER BY b.scheduled_start_at
    LIMIT 1;

    IF FOUND THEN
      -- FAIL CLOSED RULE:
      -- If an upcoming booking exists but has no usable coordinates (next_location IS NULL), reject candidate.
      IF v_next.next_location IS NULL THEN
        CONTINUE;
      END IF;

      v_eta_next := CEIL(ST_Distance(
        ST_SetSRID(ST_MakePoint(v_req.longitude, v_req.latitude), 4326)::GEOGRAPHY,
        v_next.next_location
      ) / 350.0)::INTEGER;

      IF v_end + MAKE_INTERVAL(mins => v_eta_next + 15) > v_next.scheduled_start_at THEN
        CONTINUE;
      END IF;
    END IF;

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

REVOKE ALL ON FUNCTION public.dispatch_instant_lesson_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_instant_lesson_request(UUID) TO authenticated;

-- 5. OTHER INSTANT RPCS MULTI-ROLE RECONCILIATION
CREATE OR REPLACE FUNCTION public.create_instant_lesson_request(
  p_meeting_point JSONB,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_category TEXT,
  p_transmission TEXT,
  p_max_price_in_cents INTEGER,
  p_idempotency_key VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing public.instant_lesson_requests%ROWTYPE;
  v_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.user_has_role(v_uid, 'STUDENT'::public.user_role) THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_idempotency_key IS NULL OR TRIM(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'INSTANT_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_meeting_point IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INSTANT_LOCATION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_category NOT IN ('A', 'B') OR p_transmission NOT IN ('ALL', 'MANUAL', 'AUTOMATIC', 'NOT_APPLICABLE') THEN
    RAISE EXCEPTION 'INSTANT_FILTER_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_max_price_in_cents IS NOT NULL AND (p_max_price_in_cents <= 0 OR p_max_price_in_cents <> TRUNC(p_max_price_in_cents)) THEN
    RAISE EXCEPTION 'INSTANT_PRICE_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.instant_lesson_requests
  WHERE student_id = v_uid AND idempotency_key = NULLIF(TRIM(p_idempotency_key), '');
  IF FOUND THEN
    RETURN jsonb_build_object('success', TRUE, 'is_idempotent', TRUE, 'request_id', v_existing.id, 'status', v_existing.status, 'expires_at', v_existing.expires_at);
  END IF;

  INSERT INTO public.instant_lesson_requests(
    student_id, meeting_point, latitude, longitude, category, transmission, max_price_in_cents, idempotency_key
  )
  VALUES (
    v_uid, p_meeting_point, p_latitude, p_longitude, p_category::public.vehicle_category,
    p_transmission, p_max_price_in_cents, NULLIF(TRIM(p_idempotency_key), '')
  )
  RETURNING id INTO v_id;

  PERFORM public.dispatch_instant_lesson_request(v_id);

  SELECT * INTO v_existing FROM public.instant_lesson_requests WHERE id = v_id;
  RETURN jsonb_build_object('success', TRUE, 'is_idempotent', FALSE, 'request_id', v_existing.id, 'status', v_existing.status, 'expires_at', v_existing.expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.create_instant_lesson_request(JSONB, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_instant_lesson_request(JSONB, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, INTEGER, VARCHAR) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_student_instant_lesson_status(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.instant_lesson_requests%ROWTYPE;
  v_accepted public.instant_lesson_offers%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.user_has_role(v_uid, 'STUDENT'::public.user_role) THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id = p_request_id AND student_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSTANT_REQUEST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status = 'SEARCHING' THEN
    PERFORM public.dispatch_instant_lesson_request(p_request_id);
    SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id = p_request_id AND student_id = v_uid;
  END IF;

  SELECT * INTO v_accepted FROM public.instant_lesson_offers WHERE request_id = p_request_id AND status = 'ACCEPTED';

  RETURN jsonb_build_object(
    'request_id', v_req.id,
    'status', v_req.status,
    'expires_at', v_req.expires_at,
    'matched_provider_id', v_req.matched_provider_id,
    'matched_offering_id', v_req.matched_offering_id,
    'booking_id', v_req.booking_id,
    'accepted_offer', CASE WHEN v_accepted.id IS NOT NULL THEN jsonb_build_object(
      'id', v_accepted.id,
      'offered_price_in_cents', v_accepted.offered_price_in_cents,
      'eta_minutes', v_accepted.eta_minutes
    ) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_instant_lesson_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_instant_lesson_status(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_student_instant_lesson_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.instant_lesson_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.user_has_role(v_uid, 'STUDENT'::public.user_role) THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id = p_request_id AND student_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSTANT_REQUEST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_req.status IN ('CANCELLED', 'EXPIRED', 'FAILED') THEN
    RETURN jsonb_build_object('success', TRUE, 'status', v_req.status);
  END IF;

  UPDATE public.instant_lesson_requests SET status = 'CANCELLED', updated_at = NOW() WHERE id = p_request_id;
  UPDATE public.instant_lesson_offers SET status = 'EXPIRED', updated_at = NOW() WHERE request_id = p_request_id AND status = 'PENDING';

  RETURN jsonb_build_object('success', TRUE, 'status', 'CANCELLED');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_student_instant_lesson_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_student_instant_lesson_request(UUID) TO authenticated;
