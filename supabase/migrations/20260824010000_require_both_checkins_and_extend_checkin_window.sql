-- TASK-090: both participants must check in before a lesson starts.
-- Check-in opens 30 minutes before the lesson and remains available while
-- the booking is operational; retries remain idempotent.

CREATE OR REPLACE FUNCTION public.student_check_in_booking(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Acesso negado.' USING ERRCODE = '42501'; END IF;
  IF v_booking.checkin_student_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'checkin_student_at', v_booking.checkin_student_at, 'message', 'Check-in do aluno já realizado anteriormente.');
  END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200';
  END IF;
  IF v_now < v_booking.scheduled_start_at - INTERVAL '30 minutes' THEN
    RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só fica disponível 30 minutos antes do início da aula.' USING ERRCODE = '42204';
  END IF;
  UPDATE public.bookings SET checkin_student_at = v_now, updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (gen_random_uuid(), v_uid, 'STUDENT_CHECKIN_BOOKING', 'Booking', p_booking_id, jsonb_build_object('checkin_student_at', NULL), jsonb_build_object('checkin_student_at', v_now), v_now);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'checkin_student_at', v_now, 'message', 'Check-in do aluno realizado com sucesso.');
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_check_in_booking(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_provider_user_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401'; END IF;
  IF v_booking.instructor_id = v_uid THEN v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN v_is_authorized := TRUE;
    ELSE
      SELECT EXISTS (SELECT 1 FROM public.driving_school_staff WHERE school_id = v_booking.provider_id AND user_id = v_uid AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') AND is_active = TRUE) INTO v_is_authorized;
    END IF;
  END IF;
  IF NOT v_is_authorized THEN RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado.' USING ERRCODE = '40302'; END IF;
  IF v_booking.checkin_instructor_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'status', v_booking.status::TEXT, 'checkin_instructor_at', v_booking.checkin_instructor_at, 'message', 'Check-in já realizado anteriormente.');
  END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200'; END IF;
  IF v_now < v_booking.scheduled_start_at - INTERVAL '30 minutes' THEN RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só pode ser feito a partir de 30 minutos antes do início da aula.' USING ERRCODE = '42204'; END IF;
  UPDATE public.bookings SET checkin_instructor_at = v_now, updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (gen_random_uuid(), v_uid, 'PROVIDER_CHECKIN_BOOKING', 'Booking', p_booking_id, jsonb_build_object('checkin_instructor_at', NULL), jsonb_build_object('checkin_instructor_at', v_now), v_now, NULL);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'status', v_booking.status::TEXT, 'checkin_instructor_at', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_start_lesson(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_provider_user_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401'; END IF;
  IF v_booking.instructor_id = v_uid THEN v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN v_is_authorized := TRUE;
    ELSE SELECT EXISTS (SELECT 1 FROM public.driving_school_staff WHERE school_id = v_booking.provider_id AND user_id = v_uid AND role::TEXT IN ('SCHOOL_ADMIN','DRIVING_SCHOOL') AND is_active = TRUE) INTO v_is_authorized; END IF;
  END IF;
  IF NOT v_is_authorized THEN RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado.' USING ERRCODE = '40302'; END IF;
  IF v_booking.status::TEXT = 'IN_PROGRESS' THEN RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'status', 'IN_PROGRESS', 'lesson_started_at', v_booking.lesson_started_at, 'message', 'Aula já iniciada.'); END IF;
  IF v_booking.status::TEXT <> 'CONFIRMED' THEN RAISE EXCEPTION 'INVALID_STATUS: A aula precisa estar confirmada.' USING ERRCODE = '42200'; END IF;
  IF v_booking.checkin_instructor_at IS NULL THEN RAISE EXCEPTION 'INSTRUCTOR_CHECKIN_REQUIRED: Faça seu check-in antes de iniciar a aula.' USING ERRCODE = '42205'; END IF;
  IF v_booking.checkin_student_at IS NULL THEN RAISE EXCEPTION 'STUDENT_CHECKIN_REQUIRED: O aluno precisa realizar o check-in antes do início da aula.' USING ERRCODE = '42206'; END IF;
  UPDATE public.bookings SET status = 'IN_PROGRESS', lesson_started_at = COALESCE(lesson_started_at, v_now), updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (gen_random_uuid(), v_uid, 'PROVIDER_START_LESSON', 'Booking', p_booking_id, jsonb_build_object('status', 'CONFIRMED'), jsonb_build_object('status', 'IN_PROGRESS', 'lesson_started_at', v_now), v_now, NULL);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'status', 'IN_PROGRESS', 'lesson_started_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.student_check_in_booking(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provider_check_in_booking(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provider_start_lesson(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_check_in_booking(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_check_in_booking(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_start_lesson(UUID) TO authenticated, service_role;
