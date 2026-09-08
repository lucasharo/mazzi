-- Store the real device location captured at the moment each participant checks in.
-- The client supplies the GPS reading; this RPC validates its shape and the
-- database remains the source of truth for the official check-in timestamp.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checkin_student_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkin_student_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkin_instructor_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkin_instructor_longitude DOUBLE PRECISION;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_checkin_student_location_pair,
  DROP CONSTRAINT IF EXISTS bookings_checkin_instructor_location_pair,
  ADD CONSTRAINT bookings_checkin_student_location_pair CHECK (
    (checkin_student_latitude IS NULL AND checkin_student_longitude IS NULL)
    OR (
      checkin_student_latitude BETWEEN -90 AND 90
      AND checkin_student_longitude BETWEEN -180 AND 180
    )
  ),
  ADD CONSTRAINT bookings_checkin_instructor_location_pair CHECK (
    (checkin_instructor_latitude IS NULL AND checkin_instructor_longitude IS NULL)
    OR (
      checkin_instructor_latitude BETWEEN -90 AND 90
      AND checkin_instructor_longitude BETWEEN -180 AND 180
    )
  );

-- The separate arrival marker is no longer part of the active check-in flow.
DROP TRIGGER IF EXISTS trg_provider_arrival_before_checkin ON public.bookings;
DROP FUNCTION IF EXISTS public.assert_provider_arrived_before_checkin();
DROP FUNCTION IF EXISTS public.provider_mark_arrived(UUID);

UPDATE public.bookings
SET snapshot_data = snapshot_data - 'provider_arrived_at'
WHERE snapshot_data ? 'provider_arrived_at';

DROP FUNCTION IF EXISTS public.student_check_in_booking(UUID);
CREATE FUNCTION public.student_check_in_booking(
  p_booking_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_window INTEGER := public.get_checkin_window_before_minutes();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();
  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Acesso negado.' USING ERRCODE = '42501';
  END IF;
  IF v_booking.checkin_student_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'is_idempotent', TRUE,
      'booking_id', p_booking_id,
      'checkin_student_at', v_booking.checkin_student_at,
      'checkin_student_latitude', v_booking.checkin_student_latitude,
      'checkin_student_longitude', v_booking.checkin_student_longitude,
      'message', 'Check-in do aluno já realizado anteriormente.'
    );
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'CHECKIN_LOCATION_REQUIRED: A localização atual é necessária para registrar o check-in.' USING ERRCODE = '22023';
  END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200';
  END IF;
  IF v_now < v_booking.scheduled_start_at - make_interval(mins => v_window) THEN
    RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só fica disponível % minutos antes do início da aula.', v_window USING ERRCODE = '42204';
  END IF;

  UPDATE public.bookings
  SET checkin_student_at = v_now,
      checkin_student_latitude = p_latitude,
      checkin_student_longitude = p_longitude,
      updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (
    gen_random_uuid(), v_uid, 'STUDENT_CHECKIN_BOOKING', 'Booking', p_booking_id,
    jsonb_build_object('checkin_student_at', NULL, 'checkin_student_latitude', NULL, 'checkin_student_longitude', NULL),
    jsonb_build_object('checkin_student_at', v_now, 'checkin_student_latitude', p_latitude, 'checkin_student_longitude', p_longitude),
    v_now
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'is_idempotent', FALSE,
    'booking_id', p_booking_id,
    'checkin_student_at', v_now,
    'checkin_student_latitude', p_latitude,
    'checkin_student_longitude', p_longitude,
    'message', 'Check-in do aluno realizado com sucesso.'
  );
END;
$$;

DROP FUNCTION IF EXISTS public.provider_check_in_booking(UUID);
CREATE FUNCTION public.provider_check_in_booking(
  p_booking_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_provider_user_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
  v_window INTEGER := public.get_checkin_window_before_minutes();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;
  IF v_booking.instructor_id = v_uid THEN
    v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN
      v_is_authorized := TRUE;
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM public.driving_school_staff
        WHERE school_id = v_booking.provider_id
          AND user_id = v_uid
          AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND is_active = TRUE
      ) INTO v_is_authorized;
    END IF;
  END IF;
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado.' USING ERRCODE = '40302';
  END IF;
  IF v_booking.checkin_instructor_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'is_idempotent', TRUE,
      'booking_id', p_booking_id,
      'status', v_booking.status::TEXT,
      'checkin_instructor_at', v_booking.checkin_instructor_at,
      'checkin_instructor_latitude', v_booking.checkin_instructor_latitude,
      'checkin_instructor_longitude', v_booking.checkin_instructor_longitude,
      'message', 'Check-in já realizado anteriormente.'
    );
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'CHECKIN_LOCATION_REQUIRED: A localização atual é necessária para registrar o check-in.' USING ERRCODE = '22023';
  END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200';
  END IF;
  IF v_now < v_booking.scheduled_start_at - make_interval(mins => v_window) THEN
    RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só pode ser feito a partir de % minutos antes do início da aula.', v_window USING ERRCODE = '42204';
  END IF;

  UPDATE public.bookings
  SET checkin_instructor_at = v_now,
      checkin_instructor_latitude = p_latitude,
      checkin_instructor_longitude = p_longitude,
      updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (
    gen_random_uuid(), v_uid, 'PROVIDER_CHECKIN_BOOKING', 'Booking', p_booking_id,
    jsonb_build_object('checkin_instructor_at', NULL, 'checkin_instructor_latitude', NULL, 'checkin_instructor_longitude', NULL),
    jsonb_build_object('checkin_instructor_at', v_now, 'checkin_instructor_latitude', p_latitude, 'checkin_instructor_longitude', p_longitude),
    v_now, NULL
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'is_idempotent', FALSE,
    'booking_id', p_booking_id,
    'status', v_booking.status::TEXT,
    'checkin_instructor_at', v_now,
    'checkin_instructor_latitude', p_latitude,
    'checkin_instructor_longitude', p_longitude
  );
END;
$$;

REVOKE ALL ON FUNCTION public.student_check_in_booking(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provider_check_in_booking(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_check_in_booking(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_check_in_booking(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_my_unified_instructor_bookings();
CREATE FUNCTION public.get_my_unified_instructor_bookings()
RETURNS TABLE(
  id uuid, student_id uuid, student_name text, provider_id uuid, provider_name text,
  instructor_id uuid, instructor_name text, vehicle_id uuid, vehicle_name text,
  offering_id uuid, quote_id uuid, status public.booking_status,
  scheduled_start_at timestamptz, scheduled_end_at timestamptz,
  checkin_student_at timestamptz, checkin_instructor_at timestamptz,
  checkin_student_latitude double precision, checkin_student_longitude double precision,
  checkin_instructor_latitude double precision, checkin_instructor_longitude double precision,
  lesson_started_at timestamptz, lesson_finished_at timestamptz,
  completed_at timestamptz, confirmed_at timestamptz, updated_at timestamptz,
  hold_expires_at timestamptz, idempotency_key varchar, cancelled_at timestamptz,
  cancelled_by text, cancellation_reason text, refund_amount_in_cents bigint,
  expired_at timestamptz, price_in_cents integer, platform_fee_in_cents integer,
  total_in_cents integer, snapshot_data jsonb, meeting_point jsonb, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT
    b.id, b.student_id, COALESCE(b.snapshot_data->>'studentName', b.snapshot_data->>'student_name', su.name, '')::text,
    b.provider_id, COALESCE(b.snapshot_data->>'providerName', p.trade_name, p.legal_name, '')::text,
    b.instructor_id, COALESCE(b.snapshot_data->>'instructorName', iu.name, '')::text,
    b.vehicle_id, COALESCE(b.snapshot_data->>'vehicleName', v.brand || ' ' || v.model, '')::text,
    b.offering_id, b.quote_id, b.status, b.scheduled_start_at, b.scheduled_end_at,
    b.checkin_student_at, b.checkin_instructor_at,
    b.checkin_student_latitude, b.checkin_student_longitude,
    b.checkin_instructor_latitude, b.checkin_instructor_longitude,
    b.lesson_started_at, b.lesson_finished_at, b.completed_at, b.confirmed_at,
    b.updated_at, b.hold_expires_at, b.idempotency_key, b.cancelled_at, b.cancelled_by,
    b.cancellation_reason, b.refund_amount_in_cents, b.expired_at, b.price_in_cents,
    b.platform_fee_in_cents, b.total_in_cents,
    CASE WHEN b.status = 'PENDING_PAYMENT' AND b.snapshot_data->>'source' = 'AULA_AGORA' THEN
      (COALESCE(b.snapshot_data, '{}'::jsonb) - ARRAY['meetingPoint','meeting_point','fullMeetingPoint','latitude','longitude'])
      || jsonb_build_object('meetingPoint', jsonb_strip_nulls(jsonb_build_object('type', 'REDACTED', 'label', 'Região do ponto de encontro', 'neighborhood', b.meeting_point->>'neighborhood', 'city', b.meeting_point->>'city')))
    ELSE b.snapshot_data END,
    CASE WHEN b.status = 'PENDING_PAYMENT' AND b.snapshot_data->>'source' = 'AULA_AGORA' THEN
      jsonb_strip_nulls(jsonb_build_object('type', 'REDACTED', 'label', 'Região do ponto de encontro', 'neighborhood', b.meeting_point->>'neighborhood', 'city', b.meeting_point->>'city'))
    WHEN b.meeting_point->>'type' = 'PROVIDER_ADDRESS' THEN
      jsonb_strip_nulls(COALESCE(b.meeting_point, '{}'::jsonb) || jsonb_build_object('full_address', p.address->>'formatted', 'latitude', p.latitude, 'longitude', p.longitude))
    ELSE b.meeting_point END,
    b.created_at
  FROM public.bookings b
  LEFT JOIN public.providers p ON p.id = b.provider_id
  LEFT JOIN public.users su ON su.id = b.student_id
  LEFT JOIN public.users iu ON iu.id = b.instructor_id
  LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.instructor_id = v_uid
  ORDER BY b.scheduled_start_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_unified_instructor_bookings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_unified_instructor_bookings() TO authenticated, service_role;
