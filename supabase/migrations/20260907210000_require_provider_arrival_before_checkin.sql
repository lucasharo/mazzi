-- Require the Aula Agora arrival step before the provider can check in.
-- The UI exposes: Estou a caminho -> Cheguei ao local -> Fazer check-in.

CREATE OR REPLACE FUNCTION public.provider_mark_arrived(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_provider_user_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
  v_new_snapshot JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  IF v_booking.instructor_id = v_uid THEN
    v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id
    FROM public.providers
    WHERE id = v_booking.provider_id;

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

  IF COALESCE(v_booking.snapshot_data->>'source', '') <> 'AULA_AGORA' THEN
    RAISE EXCEPTION 'ARRIVAL_STEP_NOT_REQUIRED: Esta aula não usa o fluxo de chegada da Aula Agora.' USING ERRCODE = '42200';
  END IF;

  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'BOOKING_STATUS_INVALID: A aula precisa estar confirmada.' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(v_booking.snapshot_data->>'provider_arrived_at', '') IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'is_idempotent', TRUE,
      'booking_id', p_booking_id,
      'provider_arrived_at', v_booking.snapshot_data->>'provider_arrived_at'
    );
  END IF;

  IF NULLIF(v_booking.snapshot_data->>'provider_on_the_way_at', '') IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_DEPARTURE_REQUIRED: Informe que está a caminho antes de confirmar a chegada.' USING ERRCODE = '42207';
  END IF;

  v_new_snapshot := jsonb_set(
    COALESCE(v_booking.snapshot_data, '{}'::JSONB),
    '{provider_arrived_at}',
    to_jsonb(v_now::TEXT),
    TRUE
  );

  UPDATE public.bookings
  SET snapshot_data = v_new_snapshot,
      updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at
  ) VALUES (
    gen_random_uuid(),
    v_uid,
    'PROVIDER_ARRIVED_BOOKING',
    'Booking',
    p_booking_id,
    jsonb_build_object('provider_arrived_at', NULL),
    jsonb_build_object('provider_arrived_at', v_now),
    v_now
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'is_idempotent', FALSE,
    'booking_id', p_booking_id,
    'provider_arrived_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provider_mark_arrived(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_mark_arrived(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_provider_arrived_before_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.checkin_instructor_at IS NOT NULL
     AND OLD.checkin_instructor_at IS NULL
     AND COALESCE(NEW.snapshot_data->>'source', '') = 'AULA_AGORA'
     AND NULLIF(NEW.snapshot_data->>'provider_arrived_at', '') IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_ARRIVAL_REQUIRED: Confirme sua chegada ao local antes de fazer o check-in.' USING ERRCODE = '42208';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_arrival_before_checkin ON public.bookings;
CREATE TRIGGER trg_provider_arrival_before_checkin
  BEFORE UPDATE OF checkin_instructor_at ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_provider_arrived_before_checkin();
