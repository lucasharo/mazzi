-- TASK-089 — Instant Lesson Provider On The Way RPC
-- Forward-only migration to record provider on-the-way displacement for confirmed instant bookings.

CREATE OR REPLACE FUNCTION public.set_provider_on_the_way(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_new_snapshot JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.instructor_id <> v_uid AND NOT EXISTS (
    SELECT 1 FROM public.providers p WHERE p.id = v_booking.provider_id AND p.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'BOOKING_STATUS_INVALID' USING ERRCODE = '22023';
  END IF;

  v_new_snapshot := jsonb_set(
    COALESCE(v_booking.snapshot_data, '{}'::JSONB),
    '{provider_on_the_way_at}',
    to_jsonb(v_now::TEXT),
    true
  );

  UPDATE public.bookings
  SET snapshot_data = v_new_snapshot,
      updated_at = v_now
  WHERE id = p_booking_id;

  -- Notify the student that the instructor is on their way
  INSERT INTO public.notifications (
    user_id, type, title, body, entity_type, entity_id, app_context, navigation_action
  )
  VALUES (
    v_booking.student_id,
    'PROVIDER_CHECKIN',
    'PRO a caminho!',
    'Seu profissional aceitou a Aula Agora e já está a caminho do ponto de encontro.',
    'booking',
    p_booking_id,
    'STUDENT',
    'details'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'provider_on_the_way_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_provider_on_the_way(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_provider_on_the_way(UUID) TO authenticated;
