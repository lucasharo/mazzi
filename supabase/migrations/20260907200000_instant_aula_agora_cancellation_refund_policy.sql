-- MAZZI — Aula Agora — política própria de cancelamento e reembolso
-- DEV only. A Agenda continua usando cancel_booking_v2 e DEC-013.
-- REQUIRES_REGULATORY_VALIDATION before any commercial activation.

BEGIN;

CREATE SCHEMA IF NOT EXISTS mazzi_internal;

INSERT INTO public.platform_configurations (key, value, description)
VALUES (
  'instant_lesson_settings',
  jsonb_build_object(
    'instant_refund_on_way_initial_percent', 90,
    'instant_refund_on_way_middle_percent', 80,
    'instant_refund_on_way_late_percent', 70,
    'instant_refund_after_arrival_percent', 60,
    'instant_refund_initial_window_minutes', 3,
    'instant_refund_middle_window_minutes', 7
  ),
  'Parâmetros operacionais das ofertas Aula Agora.'
)
ON CONFLICT (key) DO UPDATE SET
  value = public.platform_configurations.value || jsonb_build_object(
    'instant_refund_on_way_initial_percent', COALESCE(public.platform_configurations.value->'instant_refund_on_way_initial_percent', '90'::jsonb),
    'instant_refund_on_way_middle_percent', COALESCE(public.platform_configurations.value->'instant_refund_on_way_middle_percent', '80'::jsonb),
    'instant_refund_on_way_late_percent', COALESCE(public.platform_configurations.value->'instant_refund_on_way_late_percent', '70'::jsonb),
    'instant_refund_after_arrival_percent', COALESCE(public.platform_configurations.value->'instant_refund_after_arrival_percent', '60'::jsonb),
    'instant_refund_initial_window_minutes', COALESCE(public.platform_configurations.value->'instant_refund_initial_window_minutes', '3'::jsonb),
    'instant_refund_middle_window_minutes', COALESCE(public.platform_configurations.value->'instant_refund_middle_window_minutes', '7'::jsonb)
  );

-- Single backend calculation used by preview and final cancellation. It never
-- receives a client-calculated percentage and always rounds integer cents.
CREATE OR REPLACE FUNCTION mazzi_internal.get_instant_refund_settings()
RETURNS TABLE (
  initial_percent integer,
  middle_percent integer,
  late_percent integer,
  arrived_percent integer,
  initial_window_minutes integer,
  middle_window_minutes integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_initial_percent integer;
  v_middle_percent integer;
  v_late_percent integer;
  v_arrived_percent integer;
  v_initial_window_minutes integer;
  v_middle_window_minutes integer;
BEGIN
  SELECT
    CASE WHEN pc.value->>'instant_refund_on_way_initial_percent' ~ '^[0-9]+$' THEN (pc.value->>'instant_refund_on_way_initial_percent')::integer END,
    CASE WHEN pc.value->>'instant_refund_on_way_middle_percent' ~ '^[0-9]+$' THEN (pc.value->>'instant_refund_on_way_middle_percent')::integer END,
    CASE WHEN pc.value->>'instant_refund_on_way_late_percent' ~ '^[0-9]+$' THEN (pc.value->>'instant_refund_on_way_late_percent')::integer END,
    CASE WHEN pc.value->>'instant_refund_after_arrival_percent' ~ '^[0-9]+$' THEN (pc.value->>'instant_refund_after_arrival_percent')::integer END,
    CASE WHEN pc.value->>'instant_refund_initial_window_minutes' ~ '^[0-9]+$' THEN (pc.value->>'instant_refund_initial_window_minutes')::integer END,
    CASE WHEN pc.value->>'instant_refund_middle_window_minutes' ~ '^[0-9]+$' THEN (pc.value->>'instant_refund_middle_window_minutes')::integer END
  INTO
    v_initial_percent,
    v_middle_percent,
    v_late_percent,
    v_arrived_percent,
    v_initial_window_minutes,
    v_middle_window_minutes
  FROM public.platform_configurations AS pc
  WHERE pc.key = 'instant_lesson_settings'
  LIMIT 1;

  IF v_initial_percent IS NULL OR v_initial_percent NOT BETWEEN 0 AND 100
     OR v_middle_percent IS NULL OR v_middle_percent NOT BETWEEN 0 AND 100
     OR v_late_percent IS NULL OR v_late_percent NOT BETWEEN 0 AND 100
     OR v_arrived_percent IS NULL OR v_arrived_percent NOT BETWEEN 0 AND 100
     OR v_initial_percent < v_middle_percent
     OR v_middle_percent < v_late_percent
     OR v_late_percent < v_arrived_percent
     OR v_initial_window_minutes IS NULL OR v_initial_window_minutes <= 0
     OR v_middle_window_minutes IS NULL OR v_middle_window_minutes <= v_initial_window_minutes THEN
    RAISE EXCEPTION 'PLATFORM_CONFIGURATION_INVALID: política de reembolso da Aula Agora não está configurada.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT
    v_initial_percent,
    v_middle_percent,
    v_late_percent,
    v_arrived_percent,
    v_initial_window_minutes,
    v_middle_window_minutes;
END;
$function$;

CREATE OR REPLACE FUNCTION mazzi_internal.calculate_instant_cancellation(
  p_total_paid_cents bigint,
  p_provider_on_the_way_at timestamptz,
  p_provider_arrived_at timestamptz,
  p_lesson_started_at timestamptz,
  p_cancelled_by text,
  p_now timestamptz
)
RETURNS TABLE (
  cancellation_stage text,
  reason_code text,
  refund_percentage integer,
  refund_amount_in_cents bigint,
  retained_amount_in_cents bigint,
  settings_snapshot jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH stage AS (
    SELECT
      e.*,
      CASE
        WHEN UPPER(COALESCE(p_cancelled_by, 'STUDENT')) IN ('PROVIDER', 'PLATFORM_FAILURE')
          THEN 'PROVIDER_OR_PLATFORM_FAILURE'
        WHEN p_lesson_started_at IS NOT NULL THEN 'LESSON_STARTED'
        WHEN p_provider_arrived_at IS NOT NULL THEN 'AFTER_ARRIVAL'
        WHEN p_provider_on_the_way_at IS NULL THEN 'BEFORE_PROVIDER_DEPARTURE'
        WHEN EXTRACT(EPOCH FROM (p_now - p_provider_on_the_way_at)) / 60 < e.initial_window_minutes
          THEN 'ON_THE_WAY_INITIAL'
        WHEN EXTRACT(EPOCH FROM (p_now - p_provider_on_the_way_at)) / 60 < e.middle_window_minutes
          THEN 'ON_THE_WAY_MIDDLE'
        ELSE 'ON_THE_WAY_LATE'
      END AS calculated_stage
    FROM mazzi_internal.get_instant_refund_settings() AS e
  ), percentages AS (
    SELECT
      s.*,
      CASE s.calculated_stage
        WHEN 'PROVIDER_OR_PLATFORM_FAILURE' THEN 100
        WHEN 'LESSON_STARTED' THEN 0
        WHEN 'AFTER_ARRIVAL' THEN s.arrived_percent
        WHEN 'BEFORE_PROVIDER_DEPARTURE' THEN 100
        WHEN 'ON_THE_WAY_INITIAL' THEN s.initial_percent
        WHEN 'ON_THE_WAY_MIDDLE' THEN s.middle_percent
        ELSE s.late_percent
      END AS calculated_percent
    FROM stage s
  )
  SELECT
    p.calculated_stage,
    p.calculated_stage,
    p.calculated_percent,
    ROUND((GREATEST(COALESCE(p_total_paid_cents, 0), 0)::numeric * p.calculated_percent::numeric) / 100)::bigint,
    GREATEST(COALESCE(p_total_paid_cents, 0), 0)::bigint - ROUND((GREATEST(COALESCE(p_total_paid_cents, 0), 0)::numeric * p.calculated_percent::numeric) / 100)::bigint,
    jsonb_build_object(
      'instant_refund_on_way_initial_percent', p.initial_percent,
      'instant_refund_on_way_middle_percent', p.middle_percent,
      'instant_refund_on_way_late_percent', p.late_percent,
      'instant_refund_after_arrival_percent', p.arrived_percent,
      'instant_refund_initial_window_minutes', p.initial_window_minutes,
      'instant_refund_middle_window_minutes', p.middle_window_minutes
    )
  FROM percentages p;
$$;

REVOKE ALL ON FUNCTION mazzi_internal.get_instant_refund_settings() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_admin_instant_cancellation_config(
  p_initial_percent integer,
  p_middle_percent integer,
  p_late_percent integer,
  p_arrived_percent integer,
  p_initial_window_minutes integer,
  p_middle_window_minutes integer
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.platform.manage_settings'::public.app_permission) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_initial_percent NOT BETWEEN 0 AND 100
     OR p_middle_percent NOT BETWEEN 0 AND 100
     OR p_late_percent NOT BETWEEN 0 AND 100
     OR p_arrived_percent NOT BETWEEN 0 AND 100
     OR p_initial_percent < p_middle_percent
     OR p_middle_percent < p_late_percent
     OR p_late_percent < p_arrived_percent THEN
    RAISE EXCEPTION 'INVALID_INSTANT_REFUND_PERCENTAGES' USING ERRCODE = '22023';
  END IF;
  IF p_initial_window_minutes IS NULL OR p_initial_window_minutes <= 0
     OR p_middle_window_minutes IS NULL OR p_middle_window_minutes <= p_initial_window_minutes THEN
    RAISE EXCEPTION 'INVALID_INSTANT_REFUND_WINDOWS' USING ERRCODE = '22023';
  END IF;

  SELECT value INTO v_before
  FROM public.platform_configurations
  WHERE key = 'instant_lesson_settings'
  FOR UPDATE;

  INSERT INTO public.platform_configurations (key, value, description, updated_by, updated_at)
  VALUES (
    'instant_lesson_settings',
    jsonb_build_object(
      'instant_refund_on_way_initial_percent', p_initial_percent,
      'instant_refund_on_way_middle_percent', p_middle_percent,
      'instant_refund_on_way_late_percent', p_late_percent,
      'instant_refund_after_arrival_percent', p_arrived_percent,
      'instant_refund_initial_window_minutes', p_initial_window_minutes,
      'instant_refund_middle_window_minutes', p_middle_window_minutes
    ),
    'Parâmetros operacionais das ofertas Aula Agora.',
    v_uid,
    now()
  )
  ON CONFLICT (key) DO UPDATE SET
    value = public.platform_configurations.value || EXCLUDED.value,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  SELECT value INTO v_after
  FROM public.platform_configurations
  WHERE key = 'instant_lesson_settings';

  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (gen_random_uuid(), v_uid, 'PLATFORM_CONFIG_UPDATED', 'PlatformConfiguration', 'instant_lesson_settings', COALESCE(v_before, '{}'::jsonb), v_after, now(), NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_instant_cancellation_quote(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_booking record;
  v_payment record;
  v_calc record;
  v_on_way_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT b.*, so.source AS offering_source
  INTO v_booking
  FROM public.bookings b
  JOIN public.service_offerings so ON so.id = b.offering_id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.offering_source <> 'AULA_AGORA' THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status::text = 'IN_PROGRESS' OR v_booking.lesson_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'INSTANT_CANCELLATION_STARTED' USING ERRCODE = '42204';
  END IF;
  IF v_booking.status::text <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'INSTANT_CANCELLATION_STATUS_INVALID' USING ERRCODE = '42200';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_payment.status::text <> 'PAID' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'booking_id', p_booking_id,
      'reason_code', 'PAYMENT_NOT_CONFIRMED',
      'refund_percentage', 0,
      'refund_amount_in_cents', 0,
      'retained_amount_in_cents', 0,
      'calculated_at', now()
    );
  END IF;

  v_on_way_at := NULLIF(v_booking.snapshot_data->>'provider_on_the_way_at', '')::timestamptz;
  SELECT * INTO v_calc
  FROM mazzi_internal.calculate_instant_cancellation(
    v_payment.amount_in_cents::bigint,
    v_on_way_at,
    v_booking.checkin_instructor_at,
    v_booking.lesson_started_at,
    'STUDENT',
    now()
  );

  RETURN jsonb_build_object(
    'eligible', true,
    'booking_id', p_booking_id,
    'cancellation_stage', v_calc.cancellation_stage,
    'reason_code', v_calc.reason_code,
    'refund_percentage', v_calc.refund_percentage,
    'refund_amount_in_cents', v_calc.refund_amount_in_cents,
    'retained_amount_in_cents', v_calc.retained_amount_in_cents,
    'provider_on_the_way_at', v_on_way_at,
    'provider_arrived_at', v_booking.checkin_instructor_at,
    'calculated_at', now(),
    'settings_snapshot', v_calc.settings_snapshot
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_instant_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL,
  p_reason_code text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_role text;
  v_booking record;
  v_payment record;
  v_existing public.refunds%rowtype;
  v_provider_user_id uuid;
  v_provider_type text;
  v_is_authorized_school_admin boolean := false;
  v_cancelled_by text;
  v_final_reason text;
  v_key text;
  v_on_way_at timestamptz;
  v_calc record;
  v_cancellation_data jsonb;
  v_refund public.refunds%rowtype;
  v_processed bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT role::text INTO v_user_role FROM public.users WHERE id = v_uid;
  IF v_user_role IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT b.*, so.source AS offering_source
  INTO v_booking
  FROM public.bookings b
  JOIN public.service_offerings so ON so.id = b.offering_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.offering_source <> 'AULA_AGORA' THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF v_user_role = 'STUDENT' THEN
    IF v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'UNAUTHORIZED_STUDENT' USING ERRCODE = '42501'; END IF;
    v_cancelled_by := 'STUDENT';
  ELSIF v_user_role = 'INSTRUCTOR' THEN
    SELECT user_id, type::text INTO v_provider_user_id, v_provider_type FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id IS DISTINCT FROM v_uid OR v_provider_type IS DISTINCT FROM 'INSTRUCTOR' THEN
      RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER' USING ERRCODE = '42501';
    END IF;
    v_cancelled_by := 'PROVIDER';
  ELSIF v_user_role IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') THEN
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN
      v_is_authorized_school_admin := true;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.driving_school_staff
        WHERE school_id = v_booking.provider_id AND user_id = v_uid
          AND role::text IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') AND is_active = true
      ) INTO v_is_authorized_school_admin;
    END IF;
    IF NOT v_is_authorized_school_admin THEN RAISE EXCEPTION 'UNAUTHORIZED_SCHOOL_ADMIN' USING ERRCODE = '42501'; END IF;
    v_cancelled_by := 'PROVIDER';
  ELSIF v_user_role = 'PLATFORM_ADMIN' AND UPPER(COALESCE(p_reason_code, '')) = 'PLATFORM_FAILURE' THEN
    v_cancelled_by := 'PLATFORM_FAILURE';
  ELSE
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status::text IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER') THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', p_booking_id,
      'status', v_booking.status::text,
      'refund_amount_in_cents', COALESCE(v_booking.refund_amount_in_cents, 0),
      'cancellation_data', COALESCE(v_booking.cancellation_data, '{}'::jsonb)
    );
  END IF;
  IF v_booking.status::text = 'IN_PROGRESS' OR v_booking.lesson_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'INSTANT_CANCELLATION_STARTED' USING ERRCODE = '42204';
  END IF;
  IF v_booking.status::text <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'INSTANT_CANCELLATION_STATUS_INVALID' USING ERRCODE = '42200';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND OR v_payment.status::text <> 'PAID' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_CONFIRMED' USING ERRCODE = '42201';
  END IF;
  IF UPPER(COALESCE(v_payment.gateway_provider, '')) NOT IN ('FAKE_PAYMENT_GATEWAY', 'MOCK_VALIDATION', 'FAKE') THEN
    RAISE EXCEPTION 'REAL_GATEWAY_REFUND_REQUIRES_SERVER_CONFIRMATION' USING ERRCODE = '42501';
  END IF;

  v_key := COALESCE(NULLIF(BTRIM(p_idempotency_key), ''), 'instant_cancel:' || p_booking_id::text || ':' || v_uid::text);
  SELECT * INTO v_existing FROM public.refunds WHERE idempotency_key = v_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.booking_id <> p_booking_id OR v_existing.payment_id <> v_payment.id THEN
      RAISE EXCEPTION 'REFUND_IDEMPOTENCY_COLLISION' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', p_booking_id,
      'status', v_booking.status::text,
      'refund_id', v_existing.id,
      'refund_amount_in_cents', v_existing.amount_in_cents,
      'cancellation_data', COALESCE(v_booking.cancellation_data, '{}'::jsonb)
    );
  END IF;

  SELECT COALESCE(SUM(amount_in_cents), 0)::bigint INTO v_processed
  FROM public.refunds
  WHERE payment_id = v_payment.id AND status = 'PROCESSED';
  IF v_processed <> 0 THEN RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000'; END IF;

  v_on_way_at := NULLIF(v_booking.snapshot_data->>'provider_on_the_way_at', '')::timestamptz;
  SELECT * INTO v_calc
  FROM mazzi_internal.calculate_instant_cancellation(
    v_payment.amount_in_cents::bigint,
    v_on_way_at,
    v_booking.checkin_instructor_at,
    v_booking.lesson_started_at,
    v_cancelled_by,
    now()
  );
  v_final_reason := COALESCE(NULLIF(BTRIM(p_reason), ''), NULLIF(BTRIM(p_reason_code), ''), 'Cancelamento Aula Agora');
  v_cancellation_data := jsonb_build_object(
    'policy', 'AULA_AGORA_INSTANT_V1',
    'source', 'AULA_AGORA',
    'cancellation_stage', v_calc.cancellation_stage,
    'reason_code', v_calc.reason_code,
    'reason', v_final_reason,
    'cancelled_by', v_cancelled_by,
    'refund_percentage', v_calc.refund_percentage,
    'refund_amount_in_cents', v_calc.refund_amount_in_cents,
    'retained_amount_in_cents', v_calc.retained_amount_in_cents,
    'provider_on_the_way_at', v_on_way_at,
    'provider_arrived_at', v_booking.checkin_instructor_at,
    'lesson_started_at', v_booking.lesson_started_at,
    'cancelled_at', now(),
    'settings_snapshot', v_calc.settings_snapshot
  );

  IF v_calc.refund_amount_in_cents > 0 THEN
    INSERT INTO public.refunds (payment_id, booking_id, amount_in_cents, reason, external_refund_id, idempotency_key, status)
    VALUES (v_payment.id, p_booking_id, v_calc.refund_amount_in_cents::integer, v_final_reason, NULL, v_key, 'PROCESSED')
    RETURNING * INTO v_refund;
    UPDATE public.payments
    SET status = CASE WHEN v_calc.refund_amount_in_cents = v_payment.amount_in_cents THEN 'REFUNDED'::public.payment_status ELSE 'PARTIALLY_REFUNDED'::public.payment_status END,
        updated_at = now()
    WHERE id = v_payment.id;
  END IF;

  UPDATE public.bookings
  SET status = CASE WHEN v_cancelled_by = 'STUDENT' THEN 'CANCELLED_BY_STUDENT'::public.booking_status ELSE 'CANCELLED_BY_PROVIDER'::public.booking_status END,
      cancelled_at = now(),
      cancelled_by = v_cancelled_by,
      cancellation_reason = v_final_reason,
      refund_amount_in_cents = v_calc.refund_amount_in_cents::integer,
      cancellation_data = v_cancellation_data,
      updated_at = now()
  WHERE id = p_booking_id;

  UPDATE public.instant_lesson_offers
  SET status = 'DECLINED', updated_at = now()
  WHERE request_id IN (SELECT id FROM public.instant_lesson_requests WHERE booking_id = p_booking_id)
    AND status IN ('PENDING', 'ACCEPTED');
  UPDATE public.instant_lesson_requests
  SET status = 'CANCELLED', updated_at = now()
  WHERE booking_id = p_booking_id AND status NOT IN ('CANCELLED', 'EXPIRED');

  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (
    gen_random_uuid(), v_uid, 'INSTANT_BOOKING_CANCELLED', 'Booking', p_booking_id,
    jsonb_build_object('status', v_booking.status::text, 'payment_status', v_payment.status::text),
    v_cancellation_data || jsonb_build_object('payment_status', CASE WHEN v_calc.refund_amount_in_cents = v_payment.amount_in_cents THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END, 'refund_id', CASE WHEN v_calc.refund_amount_in_cents > 0 THEN v_refund.id ELSE NULL END),
    now(), NULL
  );

  SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
  IF v_cancelled_by = 'STUDENT' THEN
    IF v_provider_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
      VALUES (v_provider_user_id, 'BOOKING_CANCELLED', 'Aula Agora cancelada', 'O aluno cancelou a Aula Agora.', 'booking', p_booking_id, 'PRO', 'booking');
    END IF;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
    VALUES (v_booking.student_id, 'BOOKING_CANCELLED', 'Aula Agora cancelada', 'A Aula Agora foi cancelada pelo prestador. O reembolso integral será processado.', 'booking', p_booking_id, 'STUDENT', 'booking');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'booking_id', p_booking_id,
    'status', CASE WHEN v_cancelled_by = 'STUDENT' THEN 'CANCELLED_BY_STUDENT' ELSE 'CANCELLED_BY_PROVIDER' END,
    'refund_percentage', v_calc.refund_percentage,
    'refund_amount_in_cents', v_calc.refund_amount_in_cents,
    'retained_amount_in_cents', v_calc.retained_amount_in_cents,
    'cancellation_stage', v_calc.cancellation_stage,
    'cancellation_data', v_cancellation_data,
    'cancelled_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION mazzi_internal.calculate_instant_cancellation(bigint, timestamptz, timestamptz, timestamptz, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_admin_instant_cancellation_config(integer, integer, integer, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_instant_cancellation_config(integer, integer, integer, integer, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.get_instant_cancellation_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_instant_cancellation_quote(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_instant_booking(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_instant_booking(uuid, text, text, text) TO authenticated;

COMMIT;
