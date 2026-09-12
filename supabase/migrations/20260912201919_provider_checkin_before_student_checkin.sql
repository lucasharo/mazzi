-- The PRO must confirm arrival before the student is allowed to check in.
-- This is enforced atomically here; the frontend only reflects the result.
CREATE OR REPLACE FUNCTION public.student_check_in_booking(
  p_booking_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_window INTEGER := public.get_checkin_window_before_minutes();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE='28000'; END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE='P0002'; END IF;
  IF v_booking.student_id<>v_uid THEN RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Acesso negado.' USING ERRCODE='42501'; END IF;
  IF v_booking.checkin_student_at IS NOT NULL THEN
    RETURN jsonb_build_object('success',TRUE,'is_idempotent',TRUE,'booking_id',p_booking_id,'checkin_student_at',v_booking.checkin_student_at,'checkin_student_latitude',v_booking.checkin_student_latitude,'checkin_student_longitude',v_booking.checkin_student_longitude,'message','Check-in do aluno já realizado anteriormente.');
  END IF;
  IF v_booking.checkin_instructor_at IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_CHECKIN_REQUIRED: Aguarde o check-in do PRO para liberar seu check-in.' USING ERRCODE='42209';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'CHECKIN_LOCATION_REQUIRED: A localização atual é necessária para registrar o check-in.' USING ERRCODE='22023';
  END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED','IN_PROGRESS') THEN RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE='42200'; END IF;
  IF v_now < v_booking.scheduled_start_at - make_interval(mins=>v_window) THEN RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só fica disponível % minutos antes do início da aula.',v_window USING ERRCODE='42204'; END IF;
  UPDATE public.bookings SET checkin_student_at=v_now,checkin_student_latitude=p_latitude,checkin_student_longitude=p_longitude,updated_at=v_now WHERE id=p_booking_id;
  INSERT INTO public.audit_logs(id,actor_id,action,entity_type,entity_id,previous_value,new_value,created_at)
  VALUES(gen_random_uuid(),v_uid,'STUDENT_CHECKIN_BOOKING','Booking',p_booking_id,
    jsonb_build_object('checkin_student_at',NULL,'checkin_student_latitude',NULL,'checkin_student_longitude',NULL),
    jsonb_build_object('checkin_student_at',v_now,'checkin_student_latitude',p_latitude,'checkin_student_longitude',p_longitude),v_now);
  RETURN jsonb_build_object('success',TRUE,'is_idempotent',FALSE,'booking_id',p_booking_id,'checkin_student_at',v_now,'checkin_student_latitude',p_latitude,'checkin_student_longitude',p_longitude,'message','Check-in do aluno realizado com sucesso.');
END;
$$;
REVOKE ALL ON FUNCTION public.student_check_in_booking(UUID,DOUBLE PRECISION,DOUBLE PRECISION) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.student_check_in_booking(UUID,DOUBLE PRECISION,DOUBLE PRECISION) TO authenticated,service_role;
