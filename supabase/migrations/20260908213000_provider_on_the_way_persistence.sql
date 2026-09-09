-- Persist the provider departure state as booking state.
-- snapshot_data remains populated for backwards compatibility with older
-- cancellation/check-in functions, while the dedicated column is canonical
-- for clients that hydrate the booking after a reload.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS provider_on_the_way_at TIMESTAMPTZ;

UPDATE public.bookings
SET provider_on_the_way_at = NULLIF(snapshot_data->>'provider_on_the_way_at', '')::TIMESTAMPTZ
WHERE provider_on_the_way_at IS NULL
  AND NULLIF(snapshot_data->>'provider_on_the_way_at', '') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_provider_on_the_way(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_previous_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_new_snapshot JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.instructor_id <> v_uid THEN
    RAISE EXCEPTION 'BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'BOOKING_STATUS_INVALID' USING ERRCODE = '22023';
  END IF;

  -- Repair rows written by the previous implementation, which only updated
  -- snapshot_data, without sending a duplicate notification.
  v_previous_at := v_booking.provider_on_the_way_at;
  IF v_previous_at IS NULL THEN
    v_previous_at := NULLIF(v_booking.snapshot_data->>'provider_on_the_way_at', '')::TIMESTAMPTZ;
  END IF;

  IF v_previous_at IS NOT NULL THEN
    v_new_snapshot := jsonb_set(
      COALESCE(v_booking.snapshot_data, '{}'::JSONB),
      '{provider_on_the_way_at}',
      to_jsonb(v_previous_at::TEXT),
      TRUE
    );

    UPDATE public.bookings
    SET provider_on_the_way_at = v_previous_at,
        snapshot_data = v_new_snapshot,
        updated_at = NOW()
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'is_idempotent', TRUE,
      'booking_id', p_booking_id,
      'provider_on_the_way_at', v_previous_at
    );
  END IF;

  v_new_snapshot := jsonb_set(
    COALESCE(v_booking.snapshot_data, '{}'::JSONB),
    '{provider_on_the_way_at}',
    to_jsonb(v_now::TEXT),
    TRUE
  );

  UPDATE public.bookings
  SET provider_on_the_way_at = v_now,
      snapshot_data = v_new_snapshot,
      updated_at = v_now
  WHERE id = p_booking_id;

  INSERT INTO public.notifications (
    user_id, type, title, body, entity_type, entity_id, app_context, navigation_action
  ) VALUES (
    v_booking.student_id,
    'PROVIDER_ON_THE_WAY',
    'PRO a caminho!',
    'Seu profissional já está a caminho do ponto de encontro.',
    'booking',
    p_booking_id,
    'STUDENT',
    'details'
  );

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, previous_value, new_value, severity
  ) VALUES (
    v_uid,
    'PROVIDER_ON_THE_WAY',
    'bookings',
    p_booking_id::TEXT,
    jsonb_build_object('provider_on_the_way_at', NULL),
    jsonb_build_object('provider_on_the_way_at', v_now),
    'INFO'
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'is_idempotent', FALSE,
    'booking_id', p_booking_id,
    'provider_on_the_way_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_provider_on_the_way(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_provider_on_the_way(UUID) TO authenticated;
