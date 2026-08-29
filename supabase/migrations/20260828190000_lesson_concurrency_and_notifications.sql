-- Garante no backend uma única aula em andamento por aluno e instrutor.
-- Também publica eventos operacionais para os participantes da aula.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'BOOKING_CONFIRMED',
      'BOOKING_CANCELLED',
      'NEW_MESSAGE',
      'STUDENT_CHECKIN',
      'PROVIDER_CHECKIN',
      'LESSON_STARTED',
      'LESSON_COMPLETED',
      'REVIEW_AVAILABLE',
      'REVIEW_RECEIVED'
    )
  );

DROP INDEX IF EXISTS public.idx_notifications_unique_lesson_events;
CREATE UNIQUE INDEX idx_notifications_unique_lesson_events
  ON public.notifications(user_id, type, entity_type, entity_id)
  WHERE type IN (
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'STUDENT_CHECKIN',
    'PROVIDER_CHECKIN',
    'LESSON_STARTED',
    'LESSON_COMPLETED',
    'REVIEW_AVAILABLE'
  );

CREATE OR REPLACE FUNCTION public.notify_booking_participants(
  p_booking_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT id, student_id, instructor_id, provider_id
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT DISTINCT recipient_id,
    p_type,
    p_title,
    p_body,
    'booking',
    p_booking_id
  FROM (
    SELECT v_booking.student_id AS recipient_id
    UNION ALL
    SELECT v_booking.instructor_id
    UNION ALL
    SELECT p.user_id
    FROM public.providers p
    WHERE p.id = v_booking.provider_id
  ) recipients
  WHERE recipient_id IS NOT NULL
    AND (p_exclude_user_id IS NULL OR recipient_id <> p_exclude_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_booking_participants(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_booking_participants(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.student_check_in_booking(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000'; END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Acesso negado.' USING ERRCODE = '42501'; END IF;
  IF v_booking.checkin_student_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'checkin_student_at', v_booking.checkin_student_at, 'message', 'Check-in do aluno já realizado anteriormente.');
  END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200'; END IF;
  IF v_now < v_booking.scheduled_start_at - INTERVAL '30 minutes' THEN RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só fica disponível 30 minutos antes do início da aula.' USING ERRCODE = '42204'; END IF;
  UPDATE public.bookings SET checkin_student_at = v_now, updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (gen_random_uuid(), v_uid, 'STUDENT_CHECKIN_BOOKING', 'Booking', p_booking_id, jsonb_build_object('checkin_student_at', NULL), jsonb_build_object('checkin_student_at', v_now), v_now);
  PERFORM public.notify_booking_participants(p_booking_id, 'STUDENT_CHECKIN', 'Aluno realizou o check-in', 'O aluno realizou o check-in para esta aula.', v_uid);
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
  PERFORM public.notify_booking_participants(p_booking_id, 'PROVIDER_CHECKIN', 'Prestador realizou o check-in', 'O prestador realizou o check-in para esta aula.', v_uid);
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

  -- Serializa inícios concorrentes para o mesmo aluno e instrutor.
  PERFORM pg_advisory_xact_lock(hashtextextended('lesson_student:' || v_booking.student_id::TEXT, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('lesson_instructor:' || v_booking.instructor_id::TEXT, 0));
  IF EXISTS (SELECT 1 FROM public.bookings WHERE student_id = v_booking.student_id AND status::TEXT = 'IN_PROGRESS' AND id <> p_booking_id) THEN
    RAISE EXCEPTION 'STUDENT_ALREADY_HAS_IN_PROGRESS_LESSON: O aluno já possui uma aula em andamento.' USING ERRCODE = '55006';
  END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE instructor_id = v_booking.instructor_id AND status::TEXT = 'IN_PROGRESS' AND id <> p_booking_id) THEN
    RAISE EXCEPTION 'INSTRUCTOR_ALREADY_HAS_IN_PROGRESS_LESSON: O instrutor já possui uma aula em andamento.' USING ERRCODE = '55006';
  END IF;

  UPDATE public.bookings SET status = 'IN_PROGRESS', lesson_started_at = COALESCE(lesson_started_at, v_now), updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (gen_random_uuid(), v_uid, 'PROVIDER_START_LESSON', 'Booking', p_booking_id, jsonb_build_object('status', 'CONFIRMED'), jsonb_build_object('status', 'IN_PROGRESS', 'lesson_started_at', v_now), v_now, NULL);
  PERFORM public.notify_booking_participants(p_booking_id, 'LESSON_STARTED', 'Aula iniciada', 'A aula foi iniciada.', v_uid);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'status', 'IN_PROGRESS', 'lesson_started_at', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.provider_complete_lesson(
  p_booking_id UUID,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_provider_user_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
  v_effective_key VARCHAR;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100'; END IF;
  v_effective_key := NULLIF(TRIM(p_idempotency_key), '');
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401'; END IF;
  IF v_booking.instructor_id = v_uid THEN v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN v_is_authorized := TRUE;
    ELSE SELECT EXISTS (SELECT 1 FROM public.driving_school_staff WHERE school_id = v_booking.provider_id AND user_id = v_uid AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') AND is_active = TRUE) INTO v_is_authorized; END IF;
  END IF;
  IF NOT v_is_authorized THEN RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado. Você não é o instrutor nem o responsável por este agendamento.' USING ERRCODE = '40302'; END IF;
  IF v_booking.status::TEXT = 'COMPLETED' THEN
    IF v_booking.completion_idempotency_key IS DISTINCT FROM v_effective_key THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST: A chave de idempotência informada diverge da utilizada na conclusão deste agendamento.' USING ERRCODE = '23505'; END IF;
    RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'status', 'COMPLETED', 'completed_at', v_booking.completed_at, 'lesson_finished_at', v_booking.lesson_finished_at, 'message', 'Aula já concluída.');
  END IF;
  IF v_booking.status::TEXT <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'INVALID_STATUS: Somente aulas em andamento (IN_PROGRESS) podem ser concluídas.' USING ERRCODE = '42200'; END IF;
  IF v_effective_key IS NULL THEN RAISE EXCEPTION 'COMPLETION_IDEMPOTENCY_KEY_REQUIRED: A chave de idempotência é obrigatória para concluir a aula.' USING ERRCODE = '42200'; END IF;
  UPDATE public.bookings SET status = 'COMPLETED', completed_at = COALESCE(completed_at, v_now), lesson_finished_at = COALESCE(lesson_finished_at, v_now), completion_idempotency_key = v_effective_key, updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (gen_random_uuid(), v_uid, 'PROVIDER_COMPLETE_LESSON', 'Booking', p_booking_id, jsonb_build_object('status', 'IN_PROGRESS'), jsonb_build_object('status', 'COMPLETED', 'completed_at', v_now, 'lesson_finished_at', v_now, 'completion_idempotency_key', v_effective_key), v_now, NULL);
  PERFORM public.notify_booking_participants(p_booking_id, 'LESSON_COMPLETED', 'Aula concluída', 'A aula foi concluída.', v_uid);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'status', 'COMPLETED', 'completed_at', v_now, 'lesson_finished_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.student_check_in_booking(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provider_check_in_booking(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provider_start_lesson(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.provider_complete_lesson(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_check_in_booking(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_check_in_booking(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_start_lesson(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_complete_lesson(UUID, VARCHAR) TO authenticated, service_role;
