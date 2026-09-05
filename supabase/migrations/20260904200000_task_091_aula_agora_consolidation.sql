-- TASK-091 — Aula Agora PRO consolidation (DEV, forward-only)
-- Booking status remains canonical; displacement is operational metadata.

BEGIN;

-- The semantic notification is distinct from participant check-in.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'NEW_MESSAGE', 'STUDENT_CHECKIN',
  'PROVIDER_CHECKIN', 'PROVIDER_ON_THE_WAY', 'LESSON_STARTED', 'LESSON_COMPLETED',
  'CONTESTATION_UPDATED', 'COMPLIANCE_PENDING', 'PAYOUT_PAID', 'PAYOUT_BLOCKED',
  'PAYOUT_FAILED', 'INSTANT_LESSON_OFFER', 'REVIEW_AVAILABLE', 'REVIEW_RECEIVED'
));

CREATE OR REPLACE FUNCTION public.assign_notification_navigation_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.navigation_action IS NULL THEN
    NEW.navigation_action := CASE
      WHEN NEW.type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'STUDENT_CHECKIN', 'PROVIDER_CHECKIN', 'PROVIDER_ON_THE_WAY', 'LESSON_STARTED', 'CONTESTATION_UPDATED') THEN 'details'
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

-- Multi-role users retain Student access when STUDENT exists in user_roles.
CREATE OR REPLACE FUNCTION public.user_has_role(p_user_id UUID, p_role public.user_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id AND u.status = 'ACTIVE'::public.user_status
      AND (u.role = p_role OR EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user_id AND ur.role = p_role
      ))
  );
$$;
REVOKE ALL ON FUNCTION public.user_has_role(UUID, public.user_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_role(UUID, public.user_role) TO authenticated;

-- Keep only the original booking status values. ON_THE_WAY is not a DB enum value.
CREATE OR REPLACE FUNCTION public.set_provider_on_the_way(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_previous_at TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_new_snapshot JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.instructor_id <> v_uid THEN
    RAISE EXCEPTION 'BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'BOOKING_STATUS_INVALID' USING ERRCODE = '22023';
  END IF;

  v_previous_at := v_booking.snapshot_data->>'provider_on_the_way_at';
  IF v_previous_at IS NOT NULL AND BTRIM(v_previous_at) <> '' THEN
    RETURN jsonb_build_object(
      'success', TRUE, 'is_idempotent', TRUE, 'booking_id', p_booking_id,
      'provider_on_the_way_at', v_previous_at
    );
  END IF;

  v_new_snapshot := jsonb_set(
    COALESCE(v_booking.snapshot_data, '{}'::JSONB),
    '{provider_on_the_way_at}', to_jsonb(v_now::TEXT), TRUE
  );
  UPDATE public.bookings
  SET snapshot_data = v_new_snapshot, updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO public.notifications (
    user_id, type, title, body, entity_type, entity_id, app_context, navigation_action
  ) VALUES (
    v_booking.student_id, 'PROVIDER_ON_THE_WAY', 'PRO a caminho!',
    'Seu profissional já está a caminho do ponto de encontro.',
    'booking', p_booking_id, 'STUDENT', 'details'
  );

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, previous_value, new_value, severity
  ) VALUES (
    v_uid, 'PROVIDER_ON_THE_WAY', 'bookings', p_booking_id::TEXT,
    jsonb_build_object('provider_on_the_way_at', NULL),
    jsonb_build_object('provider_on_the_way_at', v_now), 'INFO'
  );

  RETURN jsonb_build_object(
    'success', TRUE, 'is_idempotent', FALSE, 'booking_id', p_booking_id,
    'provider_on_the_way_at', v_now
  );
END;
$$;
REVOKE ALL ON FUNCTION public.set_provider_on_the_way(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_provider_on_the_way(UUID) TO authenticated;

-- Price options: unique instructors and the canonical travel window.
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
  WITH base AS (
    SELECT s.instant_price_in_cents, o.instructor_id, o.duration_minutes,
      CEIL(ST_Distance(ST_SetSRID(ST_MakePoint(l.longitude, l.latitude),4326)::GEOGRAPHY, v_point) / 350.0)::INTEGER AS eta_minutes,
      nb.id AS next_booking_id, nb.scheduled_start_at, nb.next_location
    FROM public.provider_instant_settings s
    JOIN public.providers p ON p.id=s.provider_id AND p.status='ACTIVE'
    JOIN public.service_offerings o ON o.id=s.offering_id AND o.status='ACTIVE' AND o.is_active
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
    WHERE s.instant_enabled AND s.instant_online AND o.category::TEXT=p_category
      AND (p_transmission='ALL' OR v.transmission::TEXT=p_transmission)
      AND o.instructor_id <> v_uid AND public.is_provider_instructor_eligible(o.provider_id,o.instructor_id,o.category)
      AND ST_DWithin(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY,v_point,s.max_distance_km*1000)
      AND s.instant_price_in_cents > 0
  ), evaluated AS (
    SELECT b.*,
      CASE
        WHEN b.next_booking_id IS NULL THEN 0
        WHEN b.next_location IS NULL THEN NULL
        ELSE CEIL(ST_Distance(v_point,b.next_location)/350.0)::INTEGER
      END AS eta_next
    FROM base b
  ), eligible AS (
    SELECT DISTINCT ON (b.instructor_id) b.*
    FROM evaluated b
    WHERE b.eta_minutes <= 30
      AND NOT EXISTS (SELECT 1 FROM public.bookings x WHERE x.instructor_id=b.instructor_id AND x.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND x.scheduled_start_at <= NOW() AND x.scheduled_end_at > NOW())
      AND (b.next_booking_id IS NULL OR (b.next_location IS NOT NULL AND NOW()+MAKE_INTERVAL(mins=>b.eta_minutes+b.duration_minutes+b.eta_next+15) <= b.scheduled_start_at))
    ORDER BY b.instructor_id, b.eta_minutes
  ), buckets AS (
    SELECT DISTINCT instant_price_in_cents AS price FROM eligible ORDER BY price LIMIT 5
  )
  SELECT b.price, (SELECT COUNT(DISTINCT e.instructor_id) FROM eligible e WHERE e.instant_price_in_cents <= b.price) FROM buckets b
  UNION ALL SELECT NULL::INTEGER, COUNT(DISTINCT instructor_id) FROM eligible;
END;
$$;
REVOKE ALL ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instant_price_options(DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT) TO authenticated;

-- Keep creation authorized for a user with a secondary STUDENT role.
CREATE OR REPLACE FUNCTION public.create_instant_lesson_request(
  p_meeting_point JSONB, p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION,
  p_category TEXT, p_transmission TEXT, p_max_price_in_cents INTEGER, p_idempotency_key VARCHAR
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid UUID := auth.uid(); v_existing public.instant_lesson_requests%ROWTYPE; v_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.user_has_role(v_uid,'STUDENT'::public.user_role) THEN RAISE EXCEPTION 'INSTANT_STUDENT_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key)='' THEN RAISE EXCEPTION 'INSTANT_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='22023'; END IF;
  IF p_meeting_point IS NULL OR p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'INSTANT_LOCATION_INVALID' USING ERRCODE='22023'; END IF;
  IF p_category NOT IN ('A','B') OR p_transmission NOT IN ('ALL','MANUAL','AUTOMATIC','NOT_APPLICABLE') THEN RAISE EXCEPTION 'INSTANT_FILTER_INVALID' USING ERRCODE='22023'; END IF;
  IF p_max_price_in_cents IS NOT NULL AND p_max_price_in_cents <= 0 THEN RAISE EXCEPTION 'INSTANT_PRICE_INVALID' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_existing FROM public.instant_lesson_requests WHERE student_id=v_uid AND idempotency_key=NULLIF(BTRIM(p_idempotency_key),'');
  IF FOUND THEN RETURN jsonb_build_object('success',TRUE,'is_idempotent',TRUE,'request_id',v_existing.id,'status',v_existing.status,'expires_at',v_existing.expires_at); END IF;
  UPDATE public.instant_lesson_requests SET status='EXPIRED',updated_at=NOW() WHERE student_id=v_uid AND status='SEARCHING' AND expires_at <= NOW();
  INSERT INTO public.instant_lesson_requests(student_id,meeting_point,latitude,longitude,category,transmission,max_price_in_cents,idempotency_key)
  VALUES(v_uid,p_meeting_point,p_latitude,p_longitude,p_category::public.vehicle_category,p_transmission,p_max_price_in_cents,NULLIF(BTRIM(p_idempotency_key),'')) RETURNING id INTO v_id;
  PERFORM public.dispatch_instant_lesson_request(v_id);
  SELECT * INTO v_existing FROM public.instant_lesson_requests WHERE id=v_id;
  RETURN jsonb_build_object('success',TRUE,'is_idempotent',FALSE,'request_id',v_existing.id,'status',v_existing.status,'expires_at',v_existing.expires_at);
END;
$$;
REVOKE ALL ON FUNCTION public.create_instant_lesson_request(JSONB,DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,INTEGER,VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_instant_lesson_request(JSONB,DOUBLE PRECISION,DOUBLE PRECISION,TEXT,TEXT,INTEGER,VARCHAR) TO authenticated;

-- Provider dispatch is student-scoped and keeps three distinct instructors per wave.
CREATE OR REPLACE FUNCTION public.dispatch_instant_lesson_request(p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_req public.instant_lesson_requests%ROWTYPE; v_now TIMESTAMPTZ:=NOW(); v_created INTEGER:=0; v_wave INTEGER:=3; v_offer_id UUID; c RECORD; n RECORD; eta_next INTEGER;
BEGIN
  SELECT * INTO v_req FROM public.instant_lesson_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.student_id<>auth.uid() THEN RAISE EXCEPTION 'INSTANT_REQUEST_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF v_req.status<>'SEARCHING' THEN RETURN jsonb_build_object('success',TRUE,'status',v_req.status,'offers_created',0); END IF;
  IF v_req.expires_at<=v_now THEN UPDATE public.instant_lesson_requests SET status='EXPIRED',updated_at=v_now WHERE id=p_request_id; RETURN jsonb_build_object('success',TRUE,'status','EXPIRED','offers_created',0); END IF;
  UPDATE public.instant_lesson_offers SET status='EXPIRED',updated_at=v_now WHERE request_id=p_request_id AND status='PENDING' AND expires_at<=v_now;
  IF EXISTS(SELECT 1 FROM public.instant_lesson_offers WHERE request_id=p_request_id AND status='PENDING' AND expires_at>v_now) THEN RETURN jsonb_build_object('success',TRUE,'status','SEARCHING','offers_created',0,'wave_size',v_wave); END IF;
  FOR c IN
    SELECT DISTINCT ON (o.instructor_id) s.provider_id,s.offering_id,s.instant_price_in_cents,o.instructor_id,o.vehicle_id,o.duration_minutes,
      CEIL(ST_Distance(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY,ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY)/350.0)::INTEGER AS eta,
      ROUND(ST_Distance(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY,ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY))::INTEGER AS distance
    FROM public.provider_instant_settings s JOIN public.providers p ON p.id=s.provider_id AND p.status='ACTIVE'
    JOIN public.service_offerings o ON o.id=s.offering_id AND o.status='ACTIVE' AND o.is_active JOIN public.vehicles v ON v.id=o.vehicle_id AND v.status='ACTIVE' AND v.deleted_at IS NULL
    JOIN public.instant_provider_locations l ON l.provider_id=s.provider_id AND l.instructor_id=o.instructor_id AND l.recorded_at>=v_now-INTERVAL '30 seconds'
    WHERE s.instant_enabled AND s.instant_online AND o.category=v_req.category AND (v_req.transmission='ALL' OR v.transmission::TEXT=v_req.transmission)
      AND (v_req.max_price_in_cents IS NULL OR s.instant_price_in_cents<=v_req.max_price_in_cents) AND public.is_provider_instructor_eligible(o.provider_id,o.instructor_id,o.category)
      AND ST_DWithin(ST_SetSRID(ST_MakePoint(l.longitude,l.latitude),4326)::GEOGRAPHY,ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY,s.max_distance_km*1000)
      AND o.instructor_id<>v_req.student_id AND NOT EXISTS(SELECT 1 FROM public.instant_lesson_offers old WHERE old.request_id=p_request_id AND old.offering_id=s.offering_id)
      AND NOT EXISTS(SELECT 1 FROM public.bookings b WHERE (b.instructor_id=o.instructor_id OR b.vehicle_id=o.vehicle_id) AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND b.scheduled_start_at<=v_now AND b.scheduled_end_at>v_now)
    ORDER BY o.instructor_id,eta,distance,s.updated_at
    LIMIT v_wave
  LOOP
    IF c.eta>30 THEN CONTINUE; END IF;
    SELECT b.scheduled_start_at, CASE WHEN (b.meeting_point->>'latitude') IS NOT NULL AND (b.meeting_point->>'longitude') IS NOT NULL AND (b.meeting_point->>'latitude')::DOUBLE PRECISION BETWEEN -90 AND 90 AND (b.meeting_point->>'longitude')::DOUBLE PRECISION BETWEEN -180 AND 180 THEN ST_SetSRID(ST_MakePoint((b.meeting_point->>'longitude')::DOUBLE PRECISION,(b.meeting_point->>'latitude')::DOUBLE PRECISION),4326)::GEOGRAPHY WHEN p.location IS NOT NULL THEN p.location ELSE NULL END AS next_location INTO n
    FROM public.bookings b JOIN public.providers p ON p.id=b.provider_id WHERE (b.instructor_id=c.instructor_id OR b.vehicle_id=c.vehicle_id) AND b.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND b.scheduled_start_at>v_now ORDER BY b.scheduled_start_at LIMIT 1;
    IF FOUND THEN
      IF n.next_location IS NULL THEN CONTINUE; END IF;
      eta_next:=CEIL(ST_Distance(ST_SetSRID(ST_MakePoint(v_req.longitude,v_req.latitude),4326)::GEOGRAPHY,n.next_location)/350.0)::INTEGER;
      IF v_now+MAKE_INTERVAL(mins=>c.eta+c.duration_minutes+eta_next+15)>n.scheduled_start_at THEN CONTINUE; END IF;
    END IF;
    INSERT INTO public.instant_lesson_offers(request_id,provider_id,offering_id,instructor_id,vehicle_id,offered_price_in_cents,distance_meters,eta_minutes,expires_at,idempotency_key)
    VALUES(p_request_id,c.provider_id,c.offering_id,c.instructor_id,c.vehicle_id,c.instant_price_in_cents,GREATEST(0,c.distance),GREATEST(0,c.eta),v_now+INTERVAL '15 seconds','instant_offer:'||p_request_id::TEXT||':'||c.offering_id::TEXT) ON CONFLICT DO NOTHING RETURNING id INTO v_offer_id;
    IF FOUND THEN v_created:=v_created+1; INSERT INTO public.notifications(user_id,type,title,body,entity_type,entity_id,app_context,navigation_action) SELECT c.instructor_id,'INSTANT_LESSON_OFFER','Nova Aula Agora','Há uma solicitação de aula próxima para você avaliar.','instant_offer',v_offer_id,'PRO','instant_offer' WHERE EXISTS(SELECT 1 FROM public.users u WHERE u.id=c.instructor_id AND u.status='ACTIVE'); END IF;
  END LOOP;
  IF v_created=0 AND NOT EXISTS(SELECT 1 FROM public.instant_lesson_offers WHERE request_id=p_request_id AND status='PENDING' AND expires_at>v_now) THEN UPDATE public.instant_lesson_requests SET status='FAILED',updated_at=v_now WHERE id=p_request_id; RETURN jsonb_build_object('success',TRUE,'status','FAILED','offers_created',0); END IF;
  RETURN jsonb_build_object('success',TRUE,'status','SEARCHING','offers_created',v_created,'wave_size',v_wave);
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_instant_lesson_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_instant_lesson_request(UUID) TO authenticated;

-- Redacted provider read contract. It never returns the exact instant point while unpaid.
CREATE OR REPLACE FUNCTION public.get_my_provider_bookings(p_provider_id UUID)
RETURNS SETOF JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid UUID:=auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.providers p WHERE p.id=p_provider_id AND (
      p.user_id=v_uid OR EXISTS(SELECT 1 FROM public.driving_school_staff s WHERE s.school_id=p.id AND s.user_id=v_uid AND s.is_active AND s.membership_status='ACTIVE')
      OR EXISTS(SELECT 1 FROM public.service_offerings o WHERE o.provider_id=p.id AND o.instructor_id=v_uid)
    )
  ) THEN RAISE EXCEPTION 'BOOKING_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT to_jsonb(b) || jsonb_build_object(
    'meeting_point', CASE
      WHEN b.status='PENDING_PAYMENT' AND b.snapshot_data->>'source'='AULA_AGORA' THEN
        jsonb_strip_nulls(jsonb_build_object('type','REDACTED','label','Região do ponto de encontro','neighborhood',b.meeting_point->>'neighborhood','city',b.meeting_point->>'city'))
      ELSE b.meeting_point END,
    'snapshot_data', CASE
      WHEN b.status='PENDING_PAYMENT' AND b.snapshot_data->>'source'='AULA_AGORA' THEN
        (COALESCE(b.snapshot_data,'{}'::jsonb) - ARRAY['meetingPoint','meeting_point','fullMeetingPoint','latitude','longitude'])
        || jsonb_build_object('meetingPoint',jsonb_strip_nulls(jsonb_build_object('type','REDACTED','label','Região do ponto de encontro','neighborhood',b.meeting_point->>'neighborhood','city',b.meeting_point->>'city')))
      ELSE b.snapshot_data END)
  FROM public.bookings b WHERE b.provider_id=p_provider_id ORDER BY b.scheduled_start_at;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_provider_bookings(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_bookings(UUID) TO authenticated;

-- The instructor-specific calendar uses the same redaction rule.
DROP FUNCTION IF EXISTS public.get_my_unified_instructor_bookings();
CREATE FUNCTION public.get_my_unified_instructor_bookings()
RETURNS TABLE(id uuid, student_id uuid, student_name text, provider_id uuid, provider_name text, instructor_id uuid, instructor_name text, vehicle_id uuid, vehicle_name text, offering_id uuid, quote_id uuid, status public.booking_status, scheduled_start_at timestamptz, scheduled_end_at timestamptz, checkin_student_at timestamptz, checkin_instructor_at timestamptz, lesson_started_at timestamptz, lesson_finished_at timestamptz, completed_at timestamptz, confirmed_at timestamptz, updated_at timestamptz, hold_expires_at timestamptz, idempotency_key varchar, cancelled_at timestamptz, cancelled_by text, cancellation_reason text, refund_amount_in_cents bigint, expired_at timestamptz, price_in_cents integer, platform_fee_in_cents integer, total_in_cents integer, snapshot_data jsonb, meeting_point jsonb, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid:=auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT b.id,b.student_id,COALESCE(b.snapshot_data->>'studentName',b.snapshot_data->>'student_name',su.name,'')::text,b.provider_id,COALESCE(b.snapshot_data->>'providerName',p.trade_name,p.legal_name,'')::text,b.instructor_id,COALESCE(b.snapshot_data->>'instructorName',iu.name,'')::text,b.vehicle_id,COALESCE(b.snapshot_data->>'vehicleName',v.brand||' '||v.model,'')::text,b.offering_id,b.quote_id,b.status,b.scheduled_start_at,b.scheduled_end_at,b.checkin_student_at,b.checkin_instructor_at,b.lesson_started_at,b.lesson_finished_at,b.completed_at,b.confirmed_at,b.updated_at,b.hold_expires_at,b.idempotency_key,b.cancelled_at,b.cancelled_by,b.cancellation_reason,b.refund_amount_in_cents,b.expired_at,b.price_in_cents,b.platform_fee_in_cents,b.total_in_cents,
    CASE WHEN b.status='PENDING_PAYMENT' AND b.snapshot_data->>'source'='AULA_AGORA' THEN
      (COALESCE(b.snapshot_data,'{}'::jsonb) - ARRAY['meetingPoint','meeting_point','fullMeetingPoint','latitude','longitude'])
      || jsonb_build_object('meetingPoint',jsonb_strip_nulls(jsonb_build_object('type','REDACTED','label','Região do ponto de encontro','neighborhood',b.meeting_point->>'neighborhood','city',b.meeting_point->>'city')))
    ELSE b.snapshot_data END,
    CASE WHEN b.status='PENDING_PAYMENT' AND b.snapshot_data->>'source'='AULA_AGORA' THEN jsonb_strip_nulls(jsonb_build_object('type','REDACTED','label','Região do ponto de encontro','neighborhood',b.meeting_point->>'neighborhood','city',b.meeting_point->>'city')) ELSE b.meeting_point END,b.created_at
  FROM public.bookings b LEFT JOIN public.providers p ON p.id=b.provider_id LEFT JOIN public.users su ON su.id=b.student_id LEFT JOIN public.users iu ON iu.id=b.instructor_id LEFT JOIN public.vehicles v ON v.id=b.vehicle_id WHERE b.instructor_id=v_uid ORDER BY b.scheduled_start_at;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_unified_instructor_bookings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_unified_instructor_bookings() TO authenticated;

COMMIT;
