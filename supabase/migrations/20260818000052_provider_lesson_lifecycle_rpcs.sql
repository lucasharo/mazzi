-- ============================================================================
-- MAZZI PLATFORM — SPRINT 21: PROVIDER LESSON LIFECYCLE RPCS (TASK-049 HARDENED)
-- Migration: 20260818000052_provider_lesson_lifecycle_rpcs.sql
-- ============================================================================

-- 0. Schema enhancement for completion idempotency persistence
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS completion_idempotency_key VARCHAR NULL;


-- 1. provider_check_in_booking(UUID)
CREATE OR REPLACE FUNCTION public.provider_check_in_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_booking RECORD;
  v_provider_user_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Authenticate caller
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  -- 2. Lock booking for update
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  -- 3. Authorization check (Instructor, Provider owner, or School Admin)
  IF v_booking.instructor_id = v_uid THEN
    v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN
      v_is_authorized := TRUE;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.driving_school_staff
        WHERE school_id = v_booking.provider_id
          AND user_id = v_uid
          AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND is_active = TRUE
      ) INTO v_is_authorized;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado. Você não é o instrutor nem o responsável por este agendamento.' USING ERRCODE = '40302';
  END IF;

  -- 4. Idempotency check: If check-in is ALREADY done, return success idempotently regardless of subsequent status (e.g. IN_PROGRESS/COMPLETED)
  IF v_booking.checkin_instructor_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', p_booking_id,
      'status', v_booking.status::TEXT,
      'checkin_instructor_at', v_booking.checkin_instructor_at,
      'message', 'Check-in já realizado anteriormente.'
    );
  END IF;

  -- 5. Status whitelist check for NEW check-in: strictly CONFIRMED
  IF v_booking.status::TEXT <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para agendamentos confirmados (CONFIRMED).' USING ERRCODE = '42200';
  END IF;

  -- 6. Check-in time window guard (-30 min to +60 min)
  IF v_now < (v_booking.scheduled_start_at - INTERVAL '30 minutes') THEN
    RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só pode ser feito a partir de 30 minutos antes do início da aula.' USING ERRCODE = '42204';
  END IF;

  IF v_now > (v_booking.scheduled_end_at + INTERVAL '60 minutes') THEN
    RAISE EXCEPTION 'CHECKIN_WINDOW_EXPIRED: A janela para realizar check-in desta aula expirou.' USING ERRCODE = '42204';
  END IF;

  -- 7. Execute update
  UPDATE public.bookings
  SET checkin_instructor_at = v_now,
      updated_at = v_now
  WHERE id = p_booking_id;

  -- 8. Audit Log
  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address
  ) VALUES (
    gen_random_uuid(), v_uid, 'PROVIDER_CHECKIN_BOOKING', 'Booking', p_booking_id,
    jsonb_build_object('checkin_instructor_at', v_booking.checkin_instructor_at),
    jsonb_build_object('checkin_instructor_at', v_now),
    v_now, NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'booking_id', p_booking_id,
    'status', v_booking.status::TEXT,
    'checkin_instructor_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provider_check_in_booking(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_check_in_booking(UUID) TO authenticated, service_role;


-- 2. provider_start_lesson(UUID)
CREATE OR REPLACE FUNCTION public.provider_start_lesson(
  p_booking_id UUID
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
BEGIN
  -- 1. Authenticate caller
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  -- 2. Lock booking for update
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  -- 3. Authorization check
  IF v_booking.instructor_id = v_uid THEN
    v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN
      v_is_authorized := TRUE;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.driving_school_staff
        WHERE school_id = v_booking.provider_id
          AND user_id = v_uid
          AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND is_active = TRUE
      ) INTO v_is_authorized;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado. Você não é o instrutor nem o responsável por este agendamento.' USING ERRCODE = '40302';
  END IF;

  -- 4. Idempotency check
  IF v_booking.status::TEXT = 'IN_PROGRESS' THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', p_booking_id,
      'status', 'IN_PROGRESS',
      'lesson_started_at', v_booking.lesson_started_at,
      'message', 'Aula já iniciada.'
    );
  END IF;

  -- 5. Status whitelist
  IF v_booking.status::TEXT <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'INVALID_STATUS: A aula precisa estar confirmada (CONFIRMED) para ser iniciada.' USING ERRCODE = '42200';
  END IF;

  -- 6. Check-in requirement
  IF v_booking.checkin_instructor_at IS NULL THEN
    RAISE EXCEPTION 'CHECKIN_REQUIRED: O check-in do instrutor deve ser realizado antes de iniciar a aula.' USING ERRCODE = '42205';
  END IF;

  -- 7. Execute status transition
  UPDATE public.bookings
  SET status = 'IN_PROGRESS',
      lesson_started_at = COALESCE(lesson_started_at, v_now),
      updated_at = v_now
  WHERE id = p_booking_id;

  -- 8. Audit Log
  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address
  ) VALUES (
    gen_random_uuid(), v_uid, 'PROVIDER_START_LESSON', 'Booking', p_booking_id,
    jsonb_build_object('status', 'CONFIRMED'),
    jsonb_build_object('status', 'IN_PROGRESS', 'lesson_started_at', v_now),
    v_now, NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'booking_id', p_booking_id,
    'status', 'IN_PROGRESS',
    'lesson_started_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provider_start_lesson(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_start_lesson(UUID) TO authenticated, service_role;


-- 3. provider_complete_lesson(UUID, VARCHAR)
CREATE OR REPLACE FUNCTION public.provider_complete_lesson(
  p_booking_id UUID,
  p_idempotency_key VARCHAR DEFAULT NULL
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
  v_effective_key VARCHAR;
BEGIN
  -- 1. Authenticate caller
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  v_effective_key := NULLIF(TRIM(p_idempotency_key), '');

  -- 2. Lock booking for update
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  -- 3. Authorization check
  IF v_booking.instructor_id = v_uid THEN
    v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN
      v_is_authorized := TRUE;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.driving_school_staff
        WHERE school_id = v_booking.provider_id
          AND user_id = v_uid
          AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND is_active = TRUE
      ) INTO v_is_authorized;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado. Você não é o instrutor nem o responsável por este agendamento.' USING ERRCODE = '40302';
  END IF;

  -- 4. Idempotency check for already COMPLETED booking
  IF v_booking.status::TEXT = 'COMPLETED' THEN
    -- Check if effective key is distinct from persisted key
    IF v_booking.completion_idempotency_key IS DISTINCT FROM v_effective_key THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST: A chave de idempotência informada diverge da utilizada na conclusão deste agendamento.' USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', p_booking_id,
      'status', 'COMPLETED',
      'completed_at', v_booking.completed_at,
      'lesson_finished_at', v_booking.lesson_finished_at,
      'message', 'Aula já concluída.'
    );
  END IF;

  -- 5. Status whitelist check: MUST BE IN_PROGRESS
  IF v_booking.status::TEXT <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'INVALID_STATUS: Somente aulas em andamento (IN_PROGRESS) podem ser concluídas.' USING ERRCODE = '42200';
  END IF;

  -- 6. Mandatory Idempotency Key check for new completion
  IF v_effective_key IS NULL THEN
    RAISE EXCEPTION 'COMPLETION_IDEMPOTENCY_KEY_REQUIRED: A chave de idempotência é obrigatória para concluir a aula.' USING ERRCODE = '42200';
  END IF;

  -- 7. Execute completion transition and persist completion idempotency key
  UPDATE public.bookings
  SET status = 'COMPLETED',
      completed_at = COALESCE(completed_at, v_now),
      lesson_finished_at = COALESCE(lesson_finished_at, v_now),
      completion_idempotency_key = v_effective_key,
      updated_at = v_now
  WHERE id = p_booking_id;

  -- 8. Audit Log
  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address
  ) VALUES (
    gen_random_uuid(), v_uid, 'PROVIDER_COMPLETE_LESSON', 'Booking', p_booking_id,
    jsonb_build_object('status', 'IN_PROGRESS'),
    jsonb_build_object('status', 'COMPLETED', 'completed_at', v_now, 'lesson_finished_at', v_now, 'completion_idempotency_key', v_effective_key),
    v_now, NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'booking_id', p_booking_id,
    'status', 'COMPLETED',
    'completed_at', v_now,
    'lesson_finished_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provider_complete_lesson(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_complete_lesson(UUID, VARCHAR) TO authenticated, service_role;
