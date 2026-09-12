-- Configuração administrativa da abertura do check-in.
-- O valor é lido pelo backend; o padrão operacional é 15 minutos.

UPDATE public.platform_configurations
   SET value = value || jsonb_build_object('checkin_window_before_minutes', 15),
       updated_at = NOW()
 WHERE key = 'platform_operations';

INSERT INTO public.platform_configurations (key, value, description, updated_at)
SELECT 'platform_operations', jsonb_build_object('checkin_window_before_minutes', 15),
       'Parâmetros operacionais da plataforma', NOW()
 WHERE NOT EXISTS (SELECT 1 FROM public.platform_configurations WHERE key = 'platform_operations');

CREATE OR REPLACE FUNCTION public.get_checkin_window_before_minutes()
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT GREATEST(1, LEAST(60, COALESCE((value ->> 'checkin_window_before_minutes')::INTEGER, 15)))
    FROM public.platform_configurations
   WHERE key = 'platform_operations'
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_checkin_window_before_minutes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_checkin_window_before_minutes() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_admin_platform_configurations(p_updates JSONB)
RETURNS TABLE(key VARCHAR(100), value JSONB)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_item RECORD;
  v_before JSONB;
  v_after JSONB;
  v_fee_updates JSONB := '{}'::JSONB;
  v_operations_updates JSONB := '{}'::JSONB;
  v_allowed CONSTANT TEXT[] := ARRAY[
    'platformFeeDefaultPercentage','mercadoPagoFeePercentage','maxTotalFeePercentage',
    'availabilityHorizonDays','quoteExpirationMinutes','minimumBookingNoticeHours',
    'payoutSafetyPeriodHours','searchRadiusDefaultsKm','checkInWindowBeforeMinutes'
  ];
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.platform.manage_settings'::public.app_permission) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' OR p_updates = '{}'::JSONB THEN
    RAISE EXCEPTION 'INVALID_PLATFORM_CONFIG_UPDATES' USING ERRCODE = '22023';
  END IF;
  FOR v_item IN SELECT item.json_key FROM jsonb_object_keys(p_updates) AS item(json_key) LOOP
    IF NOT (v_item.json_key = ANY(v_allowed)) OR jsonb_typeof(p_updates -> v_item.json_key) <> 'number' THEN
      RAISE EXCEPTION 'UNSUPPORTED_PLATFORM_CONFIG_KEY: %', v_item.json_key USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_updates ? 'checkInWindowBeforeMinutes'
     AND ((p_updates->>'checkInWindowBeforeMinutes')::NUMERIC < 1 OR (p_updates->>'checkInWindowBeforeMinutes')::NUMERIC > 60) THEN
    RAISE EXCEPTION 'INVALID_CHECKIN_WINDOW' USING ERRCODE = '22023';
  END IF;
  IF p_updates ? 'platformFeeDefaultPercentage' AND ((p_updates->>'platformFeeDefaultPercentage')::NUMERIC < 0 OR (p_updates->>'platformFeeDefaultPercentage')::NUMERIC > 100) THEN RAISE EXCEPTION 'INVALID_FEE_PERCENTAGE' USING ERRCODE = '22023'; END IF;
  IF p_updates ? 'mercadoPagoFeePercentage' AND ((p_updates->>'mercadoPagoFeePercentage')::NUMERIC < 0 OR (p_updates->>'mercadoPagoFeePercentage')::NUMERIC > 100) THEN RAISE EXCEPTION 'INVALID_GATEWAY_FEE_PERCENTAGE' USING ERRCODE = '22023'; END IF;
  IF p_updates ? 'maxTotalFeePercentage' AND ((p_updates->>'maxTotalFeePercentage')::NUMERIC < 0 OR (p_updates->>'maxTotalFeePercentage')::NUMERIC > 100) THEN RAISE EXCEPTION 'INVALID_TOTAL_FEE_PERCENTAGE' USING ERRCODE = '22023'; END IF;
  IF (p_updates ? 'mercadoPagoFeePercentage') AND (p_updates ? 'maxTotalFeePercentage') AND (p_updates->>'mercadoPagoFeePercentage')::NUMERIC > (p_updates->>'maxTotalFeePercentage')::NUMERIC THEN RAISE EXCEPTION 'GATEWAY_FEE_EXCEEDS_TOTAL_FEE_CAP' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE(jsonb_object_agg(pc.key, pc.value), '{}'::JSONB) INTO v_before FROM public.platform_configurations pc WHERE pc.key IN ('platform_fees','platform_operations','quote_settings','scheduling_settings');
  IF p_updates ? 'platformFeeDefaultPercentage' THEN v_fee_updates := v_fee_updates || jsonb_build_object('default_percentage', p_updates->'platformFeeDefaultPercentage'); END IF;
  IF p_updates ? 'mercadoPagoFeePercentage' THEN v_fee_updates := v_fee_updates || jsonb_build_object('mercadopago_fee_percentage', p_updates->'mercadoPagoFeePercentage'); END IF;
  IF p_updates ? 'maxTotalFeePercentage' THEN v_fee_updates := v_fee_updates || jsonb_build_object('max_total_fee_percentage', p_updates->'maxTotalFeePercentage'); END IF;
  IF v_fee_updates <> '{}'::JSONB THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('platform_fees', v_fee_updates, v_uid, NOW())
    ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = NOW();
  END IF;
  IF p_updates ? 'quoteExpirationMinutes' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('quote_settings', jsonb_build_object('expiration_minutes', p_updates->'quoteExpirationMinutes'), v_uid, NOW())
    ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = NOW();
  END IF;
  IF p_updates ? 'availabilityHorizonDays' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('scheduling_settings', jsonb_build_object('max_booking_horizon_days', p_updates->'availabilityHorizonDays'), v_uid, NOW())
    ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = NOW();
  END IF;
  IF p_updates ? 'minimumBookingNoticeHours' THEN v_operations_updates := v_operations_updates || jsonb_build_object('minimum_notice_hours', p_updates->'minimumBookingNoticeHours'); END IF;
  IF p_updates ? 'searchRadiusDefaultsKm' THEN v_operations_updates := v_operations_updates || jsonb_build_object('search_radius_km', p_updates->'searchRadiusDefaultsKm'); END IF;
  IF p_updates ? 'payoutSafetyPeriodHours' THEN v_operations_updates := v_operations_updates || jsonb_build_object('payout_safety_period_hours', p_updates->'payoutSafetyPeriodHours'); END IF;
  IF p_updates ? 'checkInWindowBeforeMinutes' THEN v_operations_updates := v_operations_updates || jsonb_build_object('checkin_window_before_minutes', p_updates->'checkInWindowBeforeMinutes'); END IF;
  IF v_operations_updates <> '{}'::JSONB THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at) VALUES ('platform_operations', v_operations_updates, v_uid, NOW())
    ON CONFLICT ON CONSTRAINT platform_configurations_key_key DO UPDATE SET value = public.platform_configurations.value || excluded.value, updated_by = v_uid, updated_at = NOW();
  END IF;
  SELECT COALESCE(jsonb_object_agg(pc.key, pc.value), '{}'::JSONB) INTO v_after FROM public.platform_configurations pc WHERE pc.key IN ('platform_fees','platform_operations','quote_settings','scheduling_settings');
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at) VALUES (gen_random_uuid(), v_uid, 'PLATFORM_CONFIG_UPDATED', 'PlatformConfiguration', 'platform_configurations', v_before, v_after, NOW());
  RETURN QUERY SELECT pc.key, pc.value FROM public.platform_configurations pc ORDER BY pc.key;
END;
$$;

REVOKE ALL ON FUNCTION public.update_admin_platform_configurations(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_platform_configurations(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_check_in_booking(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_uid UUID := auth.uid(); v_booking RECORD; v_now TIMESTAMPTZ := NOW(); v_window INTEGER := public.get_checkin_window_before_minutes();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000'; END IF;
  PERFORM public.lock_student_profile(v_uid); PERFORM public.assert_current_user_student();
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Acesso negado.' USING ERRCODE = '42501'; END IF;
  IF v_booking.checkin_student_at IS NOT NULL THEN RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'checkin_student_at', v_booking.checkin_student_at, 'message', 'Check-in do aluno já realizado anteriormente.'); END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200'; END IF;
  IF v_now < v_booking.scheduled_start_at - make_interval(mins => v_window) THEN RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só fica disponível % minutos antes do início da aula.', v_window USING ERRCODE = '42204'; END IF;
  UPDATE public.bookings SET checkin_student_at = v_now, updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at) VALUES (gen_random_uuid(), v_uid, 'STUDENT_CHECKIN_BOOKING', 'Booking', p_booking_id, jsonb_build_object('checkin_student_at', NULL), jsonb_build_object('checkin_student_at', v_now), v_now);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'checkin_student_at', v_now, 'message', 'Check-in do aluno realizado com sucesso.');
END; $$;

CREATE OR REPLACE FUNCTION public.provider_check_in_booking(p_booking_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v_uid UUID := auth.uid(); v_booking RECORD; v_provider_user_id UUID; v_is_authorized BOOLEAN := FALSE; v_now TIMESTAMPTZ := NOW(); v_window INTEGER := public.get_checkin_window_before_minutes();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401'; END IF;
  IF v_booking.instructor_id = v_uid THEN v_is_authorized := TRUE;
  ELSE SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN v_is_authorized := TRUE;
    ELSE SELECT EXISTS (SELECT 1 FROM public.driving_school_staff WHERE school_id = v_booking.provider_id AND user_id = v_uid AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') AND is_active = TRUE) INTO v_is_authorized; END IF;
  END IF;
  IF NOT v_is_authorized THEN RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado.' USING ERRCODE = '40302'; END IF;
  IF v_booking.checkin_instructor_at IS NOT NULL THEN RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'status', v_booking.status::TEXT, 'checkin_instructor_at', v_booking.checkin_instructor_at, 'message', 'Check-in já realizado anteriormente.'); END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200'; END IF;
  IF v_now < v_booking.scheduled_start_at - make_interval(mins => v_window) THEN RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só pode ser feito a partir de % minutos antes do início da aula.', v_window USING ERRCODE = '42204'; END IF;
  UPDATE public.bookings SET checkin_instructor_at = v_now, updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address) VALUES (gen_random_uuid(), v_uid, 'PROVIDER_CHECKIN_BOOKING', 'Booking', p_booking_id, jsonb_build_object('checkin_instructor_at', NULL), jsonb_build_object('checkin_instructor_at', v_now), v_now, NULL);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'status', v_booking.status::TEXT, 'checkin_instructor_at', v_now);
END; $$;
