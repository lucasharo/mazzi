-- TASK-089 — Aula Agora
-- DEV only. Adds instant matching without replacing the canonical booking flow.

-- Extend the existing notification infrastructure for context-aware instant offers.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'NEW_MESSAGE', 'STUDENT_CHECKIN',
  'PROVIDER_CHECKIN', 'LESSON_STARTED', 'LESSON_COMPLETED', 'CONTESTATION_UPDATED',
  'COMPLIANCE_PENDING', 'PAYOUT_PAID', 'PAYOUT_BLOCKED', 'PAYOUT_FAILED',
  'INSTANT_LESSON_OFFER', 'REVIEW_AVAILABLE', 'REVIEW_RECEIVED'
));
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_navigation_action_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_navigation_action_check CHECK (
  navigation_action IS NULL OR navigation_action IN ('details', 'chat', 'review', 'reviews', 'compliance', 'instant_offer')
);

CREATE OR REPLACE FUNCTION public.assign_notification_navigation_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.navigation_action IS NULL THEN
    NEW.navigation_action := CASE
      WHEN NEW.type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'STUDENT_CHECKIN', 'PROVIDER_CHECKIN', 'LESSON_STARTED', 'CONTESTATION_UPDATED') THEN 'details'
      WHEN NEW.type = 'NEW_MESSAGE' THEN 'chat'
      WHEN NEW.type = 'LESSON_COMPLETED' AND NEW.app_context = 'STUDENT' THEN 'review'
      WHEN NEW.type IN ('PAYOUT_PAID', 'PAYOUT_BLOCKED', 'PAYOUT_FAILED') THEN 'details'
      WHEN NEW.type = 'COMPLIANCE_PENDING' THEN 'compliance'
      WHEN NEW.type = 'INSTANT_LESSON_OFFER' THEN 'instant_offer'
      WHEN NEW.type = 'REVIEW_RECEIVED' THEN 'reviews'
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.provider_instant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  offering_id UUID NOT NULL REFERENCES public.service_offerings(id) ON DELETE CASCADE,
  instant_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  instant_online BOOLEAN NOT NULL DEFAULT FALSE,
  instant_price_in_cents INTEGER NOT NULL CHECK (instant_price_in_cents > 0),
  max_distance_km INTEGER NOT NULL DEFAULT 5 CHECK (max_distance_km BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, offering_id),
  UNIQUE (offering_id)
);

CREATE TABLE IF NOT EXISTS public.instant_lesson_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  meeting_point JSONB NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  category vehicle_category NOT NULL,
  transmission TEXT NOT NULL CHECK (transmission IN ('ALL', 'MANUAL', 'AUTOMATIC', 'NOT_APPLICABLE')),
  max_price_in_cents INTEGER CHECK (max_price_in_cents IS NULL OR max_price_in_cents > 0),
  status TEXT NOT NULL DEFAULT 'SEARCHING' CHECK (status IN ('SEARCHING', 'MATCHED', 'CANCELLED', 'EXPIRED', 'FAILED')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  matched_provider_id UUID REFERENCES public.providers(id) ON DELETE RESTRICT,
  matched_offering_id UUID REFERENCES public.service_offerings(id) ON DELETE RESTRICT,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  idempotency_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_instant_active_request_per_student
  ON public.instant_lesson_requests(student_id) WHERE status = 'SEARCHING';

CREATE TABLE IF NOT EXISTS public.instant_lesson_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.instant_lesson_requests(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  offering_id UUID NOT NULL REFERENCES public.service_offerings(id) ON DELETE RESTRICT,
  instructor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  offered_price_in_cents INTEGER NOT NULL CHECK (offered_price_in_cents > 0),
  distance_meters INTEGER NOT NULL CHECK (distance_meters >= 0),
  eta_minutes INTEGER NOT NULL CHECK (eta_minutes >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'LOST_RACE')),
  expires_at TIMESTAMPTZ NOT NULL,
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_instant_offer_per_request_resource
  ON public.instant_lesson_offers(request_id, instructor_id, vehicle_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_instant_pending_offer_per_instructor
  ON public.instant_lesson_offers(instructor_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_instant_offers_request_status
  ON public.instant_lesson_offers(request_id, status, expires_at);

CREATE TABLE IF NOT EXISTS public.instant_provider_locations (
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS idx_instant_provider_locations_recorded_at
  ON public.instant_provider_locations(recorded_at);
CREATE INDEX IF NOT EXISTS idx_instant_settings_online
  ON public.provider_instant_settings(instant_enabled, instant_online);

ALTER TABLE public.provider_instant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instant_lesson_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instant_lesson_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instant_provider_locations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.provider_instant_settings, public.instant_lesson_requests,
  public.instant_lesson_offers, public.instant_provider_locations FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS instant_settings_no_direct_select ON public.provider_instant_settings;
DROP POLICY IF EXISTS instant_requests_no_direct_select ON public.instant_lesson_requests;
DROP POLICY IF EXISTS instant_offers_no_direct_select ON public.instant_lesson_offers;
DROP POLICY IF EXISTS instant_locations_no_direct_select ON public.instant_provider_locations;

-- All reads/writes go through the RPC contracts below. This also prevents anon
-- and generic authenticated clients from inspecting exact operational locations.
CREATE POLICY instant_settings_no_direct_select ON public.provider_instant_settings FOR SELECT USING (FALSE);
CREATE POLICY instant_requests_no_direct_select ON public.instant_lesson_requests FOR SELECT USING (FALSE);
CREATE POLICY instant_offers_no_direct_select ON public.instant_lesson_offers FOR SELECT USING (FALSE);
CREATE POLICY instant_locations_no_direct_select ON public.instant_provider_locations FOR SELECT USING (FALSE);

CREATE OR REPLACE FUNCTION public.instant_is_provider_member(p_provider_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers p WHERE p.id = p_provider_id AND p.user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.driving_school_staff s
    WHERE s.school_id = p_provider_id AND s.user_id = p_user_id AND s.is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.instant_is_provider_member(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_instant_settings(p_provider_id UUID)
RETURNS TABLE (
  id UUID, provider_id UUID, offering_id UUID, instant_enabled BOOLEAN,
  instant_online BOOLEAN, instant_price_in_cents INTEGER, max_distance_km INTEGER,
  updated_at TIMESTAMPTZ, category TEXT, transmission TEXT, duration_minutes INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.instant_is_provider_member(p_provider_id, auth.uid()) THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT s.id, s.provider_id, s.offering_id, s.instant_enabled, s.instant_online,
    s.instant_price_in_cents, s.max_distance_km, s.updated_at,
    o.category::TEXT, v.transmission::TEXT, o.duration_minutes
  FROM public.provider_instant_settings s
  JOIN public.service_offerings o ON o.id = s.offering_id
  JOIN public.vehicles v ON v.id = o.vehicle_id
  WHERE s.provider_id = p_provider_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_my_instant_setting(
  p_provider_id UUID, p_offering_id UUID, p_instant_enabled BOOLEAN,
  p_instant_price_in_cents INTEGER, p_max_distance_km INTEGER
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.provider_instant_settings%ROWTYPE;
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
  IF NOT EXISTS (
    SELECT 1 FROM public.service_offerings o
    WHERE o.id = p_offering_id AND o.provider_id = p_provider_id
      AND o.status = 'ACTIVE' AND o.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'INSTANT_OFFERING_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.provider_instant_settings (provider_id, offering_id, instant_enabled, instant_price_in_cents, max_distance_km)
  VALUES (p_provider_id, p_offering_id, COALESCE(p_instant_enabled, FALSE), p_instant_price_in_cents, p_max_distance_km)
  ON CONFLICT (provider_id, offering_id) DO UPDATE SET
    instant_enabled = EXCLUDED.instant_enabled,
    instant_price_in_cents = EXCLUDED.instant_price_in_cents,
    max_distance_km = EXCLUDED.max_distance_km,
    updated_at = NOW();
  SELECT * INTO v_row FROM public.provider_instant_settings WHERE provider_id = p_provider_id AND offering_id = p_offering_id;
  RETURN jsonb_build_object('id', v_row.id, 'provider_id', v_row.provider_id, 'offering_id', v_row.offering_id,
    'instant_enabled', v_row.instant_enabled, 'instant_online', v_row.instant_online,
    'instant_price_in_cents', v_row.instant_price_in_cents, 'max_distance_km', v_row.max_distance_km);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_instant_online(p_provider_id UUID, p_offering_id UUID, p_online BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.instant_is_provider_member(p_provider_id, auth.uid()) THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  UPDATE public.provider_instant_settings
  SET instant_online = COALESCE(p_online, FALSE), updated_at = NOW()
  WHERE provider_id = p_provider_id AND offering_id = p_offering_id AND instant_enabled = TRUE;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RAISE EXCEPTION 'INSTANT_SETTING_NOT_ENABLED' USING ERRCODE = '22023'; END IF;
  RETURN jsonb_build_object('success', TRUE, 'instant_online', p_online);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_my_instant_location(
  p_provider_id UUID, p_instructor_id UUID, p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.instant_is_provider_member(p_provider_id, auth.uid()) THEN
    RAISE EXCEPTION 'INSTANT_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INSTANT_LOCATION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.service_offerings o
    WHERE o.provider_id = p_provider_id AND o.instructor_id = p_instructor_id AND o.status = 'ACTIVE' AND o.is_active = TRUE
  ) AND NOT EXISTS (SELECT 1 FROM public.providers p WHERE p.id = p_provider_id AND p.user_id = p_instructor_id) THEN
    RAISE EXCEPTION 'INSTANT_INSTRUCTOR_SCOPE_DENIED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.instant_provider_locations(provider_id, instructor_id, latitude, longitude, recorded_at)
  VALUES (p_provider_id, p_instructor_id, p_latitude, p_longitude, NOW())
  ON CONFLICT (provider_id, instructor_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, recorded_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_instant_price_options(
  p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION, p_category TEXT, p_transmission TEXT
)
RETURNS TABLE(max_price_in_cents INTEGER, eligible_provider_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_point GEOGRAPHY(Point, 4326);
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'STUDENT' AND u.status = 'ACTIVE') THEN
    RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::GEOGRAPHY;
  RETURN QUERY
  WITH candidates AS (
    SELECT s.instant_price_in_cents
    FROM public.provider_instant_settings s
    JOIN public.providers p ON p.id = s.provider_id AND p.status = 'ACTIVE'
    JOIN public.service_offerings o ON o.id = s.offering_id AND o.status = 'ACTIVE' AND o.is_active = TRUE
    JOIN public.vehicles v ON v.id = o.vehicle_id AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
    JOIN public.instant_provider_locations l ON l.provider_id = s.provider_id AND l.instructor_id = o.instructor_id
      AND l.recorded_at >= NOW() - INTERVAL '30 seconds'
    WHERE s.instant_enabled = TRUE AND s.instant_online = TRUE
       AND o.category::TEXT = p_category
       AND (p_transmission = 'ALL' OR v.transmission::TEXT = p_transmission)
       AND public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)
       AND ST_DWithin(ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::GEOGRAPHY, v_point, s.max_distance_km * 1000)
      AND s.instant_price_in_cents > 0
  ), buckets AS (
    SELECT DISTINCT instant_price_in_cents AS price FROM candidates ORDER BY price LIMIT 5
  )
  SELECT b.price, (SELECT COUNT(*) FROM candidates c WHERE c.instant_price_in_cents <= b.price)
  FROM buckets b
  UNION ALL
  SELECT NULL::INTEGER, COUNT(*) FROM candidates;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_instant_lesson_request(
  p_meeting_point JSONB, p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION,
  p_category TEXT, p_transmission TEXT, p_max_price_in_cents INTEGER, p_idempotency_key VARCHAR
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid UUID := auth.uid(); v_existing public.instant_lesson_requests%ROWTYPE; v_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid AND u.role = 'STUDENT' AND u.status = 'ACTIVE') THEN
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
  SELECT * INTO v_existing FROM public.instant_lesson_requests WHERE student_id = v_uid AND idempotency_key = NULLIF(TRIM(p_idempotency_key), '');
  IF FOUND THEN RETURN jsonb_build_object('success', TRUE, 'is_idempotent', TRUE, 'request_id', v_existing.id, 'status', v_existing.status, 'expires_at', v_existing.expires_at); END IF;
  UPDATE public.instant_lesson_requests SET status = 'EXPIRED', updated_at = NOW() WHERE student_id = v_uid AND status = 'SEARCHING' AND expires_at <= NOW();
  IF EXISTS (SELECT 1 FROM public.instant_lesson_requests WHERE student_id = v_uid AND status = 'SEARCHING') THEN
    RAISE EXCEPTION 'INSTANT_ACTIVE_REQUEST_EXISTS' USING ERRCODE = '22000';
  END IF;
  INSERT INTO public.instant_lesson_requests (student_id, meeting_point, latitude, longitude, category, transmission, max_price_in_cents, idempotency_key)
  VALUES (v_uid, p_meeting_point, p_latitude, p_longitude, p_category::vehicle_category, p_transmission, p_max_price_in_cents, NULLIF(TRIM(p_idempotency_key), ''))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', TRUE, 'is_idempotent', FALSE, 'request_id', v_id, 'status', 'SEARCHING', 'expires_at', NOW() + INTERVAL '5 minutes');
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_instant_lesson_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_req public.instant_lesson_requests%ROWTYPE; v_now TIMESTAMPTZ := NOW(); v_wave INTEGER := 3;
  v_created INTEGER := 0; v_offer_id UUID; v_candidate RECORD; v_eta INTEGER; v_distance INTEGER; v_start TIMESTAMPTZ; v_end TIMESTAMPTZ; v_next RECORD;
BEGIN
  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.student_id <> auth.uid() THEN RAISE EXCEPTION 'INSTANT_REQUEST_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  IF v_req.status <> 'SEARCHING' THEN RETURN jsonb_build_object('success', TRUE, 'status', v_req.status, 'offers_created', 0); END IF;
  IF v_req.expires_at <= v_now THEN UPDATE public.instant_lesson_requests SET status = 'EXPIRED', updated_at = v_now WHERE id = p_request_id; RETURN jsonb_build_object('success', TRUE, 'status', 'EXPIRED', 'offers_created', 0); END IF;
  UPDATE public.instant_lesson_offers SET status = 'EXPIRED', updated_at = v_now WHERE request_id = p_request_id AND status = 'PENDING' AND expires_at <= v_now;
  -- Keep the dispatch in a small wave: the next wave opens only after the
  -- current offers are declined or expired.
  IF EXISTS (SELECT 1 FROM public.instant_lesson_offers WHERE request_id = p_request_id AND status = 'PENDING' AND expires_at > v_now) THEN
    RETURN jsonb_build_object('success', TRUE, 'status', 'SEARCHING', 'offers_created', 0, 'wave_size', v_wave);
  END IF;
  FOR v_candidate IN
    SELECT s.*, p.trade_name, o.instructor_id, o.vehicle_id, o.category, v.transmission, o.duration_minutes,
      CEIL(ST_Distance(ST_SetSRID(ST_MakePoint(l.longitude, l.latitude),4326)::GEOGRAPHY, ST_SetSRID(ST_MakePoint(v_req.longitude, v_req.latitude),4326)::GEOGRAPHY) / 350.0)::INTEGER AS eta,
      ROUND(ST_Distance(ST_SetSRID(ST_MakePoint(l.longitude, l.latitude),4326)::GEOGRAPHY, ST_SetSRID(ST_MakePoint(v_req.longitude, v_req.latitude),4326)::GEOGRAPHY))::INTEGER AS distance
    FROM public.provider_instant_settings s
    JOIN public.providers p ON p.id = s.provider_id AND p.status = 'ACTIVE'
    JOIN public.service_offerings o ON o.id = s.offering_id AND o.status = 'ACTIVE' AND o.is_active = TRUE
    JOIN public.vehicles v ON v.id = o.vehicle_id AND v.status = 'ACTIVE' AND v.deleted_at IS NULL
    JOIN public.instant_provider_locations l ON l.provider_id = s.provider_id AND l.instructor_id = o.instructor_id
      AND l.recorded_at >= v_now - INTERVAL '30 seconds'
    WHERE s.instant_enabled = TRUE AND s.instant_online = TRUE
      AND o.category = v_req.category
      AND (v_req.transmission = 'ALL' OR v.transmission::TEXT = v_req.transmission)
      AND (v_req.max_price_in_cents IS NULL OR s.instant_price_in_cents <= v_req.max_price_in_cents)
      AND public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)
      AND ST_DWithin(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY, ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY, s.max_distance_km * 1000)
      AND o.instructor_id <> v_req.student_id
      AND NOT EXISTS (SELECT 1 FROM public.instant_lesson_offers old WHERE old.request_id = p_request_id AND old.offering_id = s.offering_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE (b.instructor_id = o.instructor_id OR b.vehicle_id = o.vehicle_id)
          AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS')
          AND b.scheduled_end_at > v_now
      )
    ORDER BY eta ASC, distance ASC, s.updated_at ASC, s.provider_id
    LIMIT v_wave
  LOOP
    v_eta := GREATEST(0, v_candidate.eta); v_distance := GREATEST(0, v_candidate.distance);
    IF v_eta > 30 THEN CONTINUE; END IF;
    v_start := v_now + MAKE_INTERVAL(mins => v_eta);
    v_end := v_start + MAKE_INTERVAL(mins => v_candidate.duration_minutes);
    SELECT b.scheduled_start_at INTO v_next FROM public.bookings b
    WHERE b.instructor_id = v_candidate.instructor_id
      AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND b.scheduled_start_at > v_now
    ORDER BY b.scheduled_start_at LIMIT 1;
    IF FOUND AND v_end + MAKE_INTERVAL(mins => v_eta + 15) > v_next.scheduled_start_at THEN CONTINUE; END IF;
    BEGIN
      INSERT INTO public.instant_lesson_offers (request_id, provider_id, offering_id, instructor_id, vehicle_id, offered_price_in_cents, distance_meters, eta_minutes, expires_at, idempotency_key)
      VALUES (p_request_id, v_candidate.provider_id, v_candidate.offering_id, v_candidate.instructor_id, v_candidate.vehicle_id, v_candidate.instant_price_in_cents, v_distance, v_eta, v_now + INTERVAL '15 seconds', 'instant_offer:' || p_request_id::TEXT || ':' || v_candidate.offering_id::TEXT)
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_offer_id;
      IF FOUND THEN
        v_created := v_created + 1;
        INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
        SELECT recipient.user_id, 'INSTANT_LESSON_OFFER', 'Nova Aula Agora',
          'Há uma solicitação de aula próxima para você avaliar.', 'instant_offer', v_offer_id, 'PRO', 'instant_offer'
        FROM (
          SELECT v_candidate.instructor_id AS user_id
          UNION
          SELECT p.user_id FROM public.providers p WHERE p.id = v_candidate.provider_id AND p.user_id IS NOT NULL
        ) recipient
        JOIN public.users u ON u.id = recipient.user_id AND u.status = 'ACTIVE';
      END IF;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;
  IF v_created = 0 AND NOT EXISTS (SELECT 1 FROM public.instant_lesson_offers WHERE request_id = p_request_id AND status = 'PENDING' AND expires_at > v_now) THEN
    IF EXISTS (SELECT 1 FROM public.provider_instant_settings s WHERE s.instant_enabled AND s.instant_online) THEN
      UPDATE public.instant_lesson_requests SET status = 'FAILED', updated_at = v_now WHERE id = p_request_id;
      RETURN jsonb_build_object('success', TRUE, 'status', 'FAILED', 'offers_created', 0);
    END IF;
  END IF;
  RETURN jsonb_build_object('success', TRUE, 'status', 'SEARCHING', 'offers_created', v_created, 'wave_size', v_wave);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_active_instant_request()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_req RECORD; v_offer RECORD;
BEGIN
  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE student_id = auth.uid() AND status IN ('SEARCHING','MATCHED') ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT io.*, p.trade_name AS provider_name, o.category::TEXT, v.transmission::TEXT, o.duration_minutes
  INTO v_offer FROM public.instant_lesson_offers io JOIN public.providers p ON p.id = io.provider_id JOIN public.service_offerings o ON o.id = io.offering_id JOIN public.vehicles v ON v.id = io.vehicle_id
  WHERE io.request_id = v_req.id AND io.status = 'ACCEPTED' LIMIT 1;
  RETURN jsonb_build_object('id', v_req.id, 'student_id', v_req.student_id, 'meeting_point', v_req.meeting_point,
    'category', v_req.category, 'transmission', v_req.transmission, 'max_price_in_cents', v_req.max_price_in_cents,
    'status', v_req.status, 'expires_at', v_req.expires_at, 'matched_provider_id', v_req.matched_provider_id,
    'matched_offering_id', v_req.matched_offering_id, 'booking_id', v_req.booking_id,
    'offer', CASE WHEN v_offer.id IS NULL THEN NULL ELSE jsonb_build_object('id',v_offer.id,'request_id',v_offer.request_id,'provider_id',v_offer.provider_id,'offering_id',v_offer.offering_id,'instructor_id',v_offer.instructor_id,'vehicle_id',v_offer.vehicle_id,'provider_name',v_offer.provider_name,'category',v_offer.category,'transmission',v_offer.transmission,'duration_minutes',v_offer.duration_minutes,'offered_price_in_cents',v_offer.offered_price_in_cents,'distance_meters',v_offer.distance_meters,'eta_minutes',v_offer.eta_minutes,'status',v_offer.status,'expires_at',v_offer.expires_at,'created_at',v_offer.created_at) END);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_instant_lesson_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.instant_lesson_requests SET status = 'CANCELLED', updated_at = NOW()
  WHERE id = p_request_id AND student_id = auth.uid() AND status = 'SEARCHING';
  IF NOT FOUND THEN RAISE EXCEPTION 'INSTANT_REQUEST_NOT_CANCELLABLE' USING ERRCODE = '22023'; END IF;
  UPDATE public.instant_lesson_offers SET status = 'DECLINED', updated_at = NOW() WHERE request_id = p_request_id AND status = 'PENDING';
  RETURN jsonb_build_object('success', TRUE, 'status', 'CANCELLED');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_instant_offers()
RETURNS TABLE (
  id UUID, request_id UUID, provider_id UUID, offering_id UUID, instructor_id UUID, vehicle_id UUID,
  provider_name TEXT, category TEXT, transmission TEXT, duration_minutes INTEGER,
  offered_price_in_cents INTEGER, distance_meters INTEGER, eta_minutes INTEGER,
  status TEXT, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY
  SELECT io.id, io.request_id, io.provider_id, io.offering_id, io.instructor_id, io.vehicle_id,
    p.trade_name::TEXT, o.category::TEXT, v.transmission::TEXT, o.duration_minutes,
    io.offered_price_in_cents, io.distance_meters, io.eta_minutes, io.status, io.expires_at, io.created_at
  FROM public.instant_lesson_offers io
  JOIN public.providers p ON p.id = io.provider_id
  JOIN public.service_offerings o ON o.id = io.offering_id
  JOIN public.vehicles v ON v.id = io.vehicle_id
  WHERE (p.user_id = auth.uid() OR io.instructor_id = auth.uid())
    AND io.status = 'PENDING' AND io.expires_at > NOW()
  ORDER BY io.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_instant_offer(p_offer_id UUID, p_action TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_offer public.instant_lesson_offers%ROWTYPE; v_req public.instant_lesson_requests%ROWTYPE; v_uid UUID := auth.uid(); v_quote_id UUID; v_booking JSONB; v_fee_pct NUMERIC := 10; v_fee INTEGER; v_total INTEGER;
BEGIN
  SELECT io.* INTO v_offer FROM public.instant_lesson_offers io WHERE io.id = p_offer_id FOR UPDATE;
  IF NOT FOUND OR NOT (v_offer.instructor_id = v_uid OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id = v_offer.provider_id AND p.user_id = v_uid)) THEN
    RAISE EXCEPTION 'INSTANT_OFFER_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'DECLINE' THEN
    IF v_offer.status = 'PENDING' THEN UPDATE public.instant_lesson_offers SET status = 'DECLINED', updated_at = NOW() WHERE id = p_offer_id; END IF;
    RETURN jsonb_build_object('success', TRUE, 'status', 'DECLINED');
  END IF;
  IF p_action <> 'ACCEPT' THEN RAISE EXCEPTION 'INSTANT_ACTION_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id = v_offer.request_id FOR UPDATE;
  IF v_offer.status <> 'PENDING' OR v_offer.expires_at <= NOW() THEN
    UPDATE public.instant_lesson_offers SET status = 'EXPIRED', updated_at = NOW() WHERE id = p_offer_id AND status = 'PENDING';
    RAISE EXCEPTION 'INSTANT_OFFER_EXPIRED' USING ERRCODE = '22023';
  END IF;
  IF v_req.status <> 'SEARCHING' THEN
    UPDATE public.instant_lesson_offers SET status = 'LOST_RACE', updated_at = NOW() WHERE id = p_offer_id;
    RAISE EXCEPTION 'INSTANT_REQUEST_ALREADY_MATCHED' USING ERRCODE = '40001';
  END IF;
  SELECT COALESCE((value->>'default_percentage')::NUMERIC, 10) INTO v_fee_pct FROM public.platform_configurations WHERE key = 'platform_fees';
  v_fee_pct := GREATEST(0, LEAST(100, COALESCE(v_fee_pct, 10)));
  v_fee := ROUND((v_offer.offered_price_in_cents * v_fee_pct) / 100.0)::INTEGER;
  v_total := v_offer.offered_price_in_cents;
  v_quote_id := gen_random_uuid();
  INSERT INTO public.quotes (id, student_id, provider_id, instructor_id, vehicle_id, offering_id, scheduled_start_at, scheduled_end_at, price_in_cents, platform_fee_in_cents, total_in_cents, status, expires_at, idempotency_key)
  VALUES (v_quote_id, v_req.student_id, v_offer.provider_id, v_offer.instructor_id, v_offer.vehicle_id, v_offer.offering_id,
    NOW() + MAKE_INTERVAL(mins => v_offer.eta_minutes), NOW() + MAKE_INTERVAL(mins => v_offer.eta_minutes + (SELECT duration_minutes FROM public.service_offerings WHERE id = v_offer.offering_id)),
    v_offer.offered_price_in_cents, v_fee, v_total, 'ACTIVE', NOW() + INTERVAL '10 minutes', 'instant_quote:' || v_offer.request_id::TEXT);
  v_booking := public.create_booking_hold(v_quote_id, v_req.student_id, 'instant_booking:' || v_req.id::TEXT, 10);
  UPDATE public.bookings SET meeting_point = v_req.meeting_point, snapshot_data = snapshot_data || jsonb_build_object('source', 'AULA_AGORA', 'offeredPriceInCents', v_offer.offered_price_in_cents) WHERE id = (v_booking->>'booking_id')::UUID;
  UPDATE public.instant_lesson_requests SET status = 'MATCHED', matched_provider_id = v_offer.provider_id, matched_offering_id = v_offer.offering_id, booking_id = (v_booking->>'booking_id')::UUID, updated_at = NOW() WHERE id = v_req.id;
  UPDATE public.instant_lesson_offers SET status = 'ACCEPTED', updated_at = NOW() WHERE id = v_offer.id;
  UPDATE public.instant_lesson_offers SET status = 'LOST_RACE', updated_at = NOW() WHERE request_id = v_req.id AND id <> v_offer.id AND status = 'PENDING';
  RETURN jsonb_build_object('success', TRUE, 'status', 'ACCEPTED', 'booking_id', (v_booking->>'booking_id')::UUID, 'request_id', v_req.id);
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'INSTANT_SCHEDULE_CONFLICT' USING ERRCODE = '23P01';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_instant_tracking(p_booking_id UUID)
RETURNS TABLE(booking_id UUID, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, recorded_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.id = p_booking_id AND (b.student_id = auth.uid() OR b.instructor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id = b.provider_id AND p.user_id = auth.uid()))
  ) THEN RAISE EXCEPTION 'INSTANT_TRACKING_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT p_booking_id, l.latitude, l.longitude, l.recorded_at
  FROM public.bookings b JOIN public.instant_provider_locations l ON l.provider_id = b.provider_id AND l.instructor_id = b.instructor_id
  WHERE b.id = p_booking_id AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND l.recorded_at >= NOW() - INTERVAL '2 minutes';
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_instant_settings(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_my_instant_setting(UUID,UUID,BOOLEAN,INTEGER,INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_instant_online(UUID,UUID,BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_my_instant_location(UUID,UUID,DOUBLE PRECISION,DOUBLE PRECISION) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_instant_lesson_request(JSONB,DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,INTEGER,VARCHAR) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dispatch_instant_lesson_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_active_instant_request() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_instant_lesson_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_instant_offers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_instant_offer(UUID,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_instant_tracking(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_instant_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_my_instant_setting(UUID,UUID,BOOLEAN,INTEGER,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_instant_online(UUID,UUID,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_my_instant_location(UUID,UUID,DOUBLE PRECISION,DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_instant_lesson_request(JSONB,DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,INTEGER,VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_instant_lesson_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_active_instant_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_instant_lesson_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_instant_offers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_instant_offer(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_instant_tracking(UUID) TO authenticated;
