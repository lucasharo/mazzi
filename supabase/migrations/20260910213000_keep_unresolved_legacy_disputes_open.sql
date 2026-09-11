-- Reservas CONFIRMED antigas não têm conclusão nem repasse liberado.
-- Enquanto permanecerem sem resolução e o horário já tiver terminado,
-- continuam elegíveis para contestação, sem expirar pela janela de payout.

CREATE OR REPLACE FUNCTION public.open_booking_dispute(p_booking_id UUID, p_reason_code VARCHAR, p_description TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_provider_user UUID;
  v_role VARCHAR(20);
  v_reference_at TIMESTAMPTZ;
  v_deadline TIMESTAMPTZ;
  v_dispute public.booking_disputes%ROWTYPE;
  v_payout public.payouts%ROWTYPE;
  v_status VARCHAR(30);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE='P0002'; END IF;

  SELECT pr.user_id INTO v_provider_user
  FROM public.providers pr
  WHERE pr.id = v_booking.provider_id;

  IF v_booking.student_id = v_uid THEN
    v_role := 'STUDENT';
  ELSIF v_provider_user = v_uid THEN
    v_role := 'PROVIDER';
  ELSE
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;

  IF v_booking.status NOT IN ('COMPLETED', 'CONFIRMED') THEN
    RAISE EXCEPTION 'BOOKING_NOT_COMPLETED' USING ERRCODE='22000';
  END IF;

  IF v_booking.status = 'CONFIRMED'
    AND COALESCE(v_booking.scheduled_end_at, v_booking.lesson_finished_at) IS NOT NULL
    AND COALESCE(v_booking.scheduled_end_at, v_booking.lesson_finished_at) > clock_timestamp() THEN
    RAISE EXCEPTION 'BOOKING_NOT_COMPLETED' USING ERRCODE='22000';
  END IF;

  IF v_booking.status = 'COMPLETED' THEN
    v_reference_at := COALESCE(v_booking.completed_at, v_booking.lesson_finished_at, v_booking.scheduled_end_at, v_booking.updated_at);
    v_deadline := v_reference_at + make_interval(hours => public.get_payout_safety_period_hours());
    IF clock_timestamp() > v_deadline THEN
      RAISE EXCEPTION 'DISPUTE_WINDOW_EXPIRED' USING ERRCODE='22000';
    END IF;
  END IF;

  IF upper(btrim(COALESCE(p_reason_code, ''))) NOT IN (
    'PROVIDER_NO_SHOW', 'STUDENT_NO_SHOW', 'LESSON_NOT_DELIVERED', 'TIME_MISMATCH',
    'MEETING_POINT_MISMATCH', 'SERVICE_MISMATCH', 'SAFETY_CONCERN', 'OTHER'
  ) THEN
    RAISE EXCEPTION 'INVALID_DISPUTE_REASON' USING ERRCODE='22023';
  END IF;

  v_status := CASE WHEN v_role = 'STUDENT' THEN 'AWAITING_PROVIDER_RESPONSE' ELSE 'AWAITING_STUDENT_RESPONSE' END;

  INSERT INTO public.booking_disputes (booking_id, opened_by, opened_by_role, reason_code, description, status)
  VALUES (p_booking_id, v_uid, v_role, upper(btrim(p_reason_code)), btrim(p_description), v_status)
  RETURNING * INTO v_dispute;

  SELECT * INTO v_payout
  FROM public.payouts
  WHERE booking_id = p_booking_id
  FOR UPDATE;

  IF FOUND AND v_payout.status IN ('PENDING', 'AVAILABLE', 'FAILED') THEN
    UPDATE public.payouts
    SET status = 'BLOCKED', failure_reason = 'DISPUTE_OPEN', updated_at = NOW()
    WHERE id = v_payout.id;
  END IF;

  UPDATE public.bookings
  SET status = 'DISPUTED', updated_at = NOW()
  WHERE id = p_booking_id;

  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (
    gen_random_uuid(), v_uid, 'BOOKING_DISPUTE_OPENED', 'BookingDispute', v_dispute.id,
    jsonb_build_object('booking_status', v_booking.status),
    jsonb_build_object('booking_status', 'DISPUTED', 'reason_code', v_dispute.reason_code, 'payout_status', 'BLOCKED'),
    NOW()
  );

  RETURN to_jsonb(v_dispute);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'ACTIVE_DISPUTE_ALREADY_EXISTS' USING ERRCODE='23505';
END;
$$;

REVOKE ALL ON FUNCTION public.open_booking_dispute(UUID, VARCHAR, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_booking_dispute(UUID, VARCHAR, TEXT) TO authenticated;
