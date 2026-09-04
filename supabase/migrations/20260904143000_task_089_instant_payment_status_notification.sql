-- TASK-089 — Expose the payment handoff between Aula Agora and the PRO.
-- DEV only. Pending payment remains a hold; the provider must wait for the
-- signed payment confirmation before moving to the meeting point.

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
SET search_path = public, pg_temp
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

  INSERT INTO public.notifications (
    user_id, type, title, body, entity_type, entity_id, app_context
  )
  SELECT DISTINCT
    recipient_id,
    p_type,
    CASE
      WHEN p_type = 'BOOKING_CONFIRMED' AND recipient_id = v_booking.student_id THEN 'Pagamento confirmado'
      ELSE p_title
    END,
    CASE
      WHEN p_type = 'BOOKING_CONFIRMED' AND recipient_id = v_booking.student_id
        THEN 'Seu pagamento foi confirmado. A aula está confirmada em Minhas Aulas.'
      WHEN p_type = 'BOOKING_CONFIRMED'
        THEN 'O aluno concluiu o pagamento. A aula está confirmada na sua agenda.'
      ELSE p_body
    END,
    'booking',
    p_booking_id,
    CASE WHEN recipient_id = v_booking.student_id THEN 'STUDENT' ELSE 'PRO' END
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

CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_payment_id UUID,
  p_external_payment_id VARCHAR DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_service_role BOOLEAN := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';
  v_payment RECORD;
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_paid_at TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL AND NOT v_is_service_role THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT v_is_service_role THEN
    PERFORM public.lock_student_profile(v_uid);
    PERFORM public.assert_current_user_student();
  END IF;
  IF p_external_payment_id IS NULL OR BTRIM(p_external_payment_id) = '' THEN
    RAISE EXCEPTION 'EXTERNAL_PAYMENT_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_payment.booking_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT v_is_service_role AND v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_PAYMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_payment.gateway_provider <> 'fake_payment_gateway'
     AND NOT (v_is_service_role AND v_payment.gateway_provider = 'stripe') THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_CONFIRMATION_REQUIRES_TRUSTED_BACKEND' USING ERRCODE = '42501';
  END IF;
  IF v_payment.amount_in_cents <> v_booking.total_in_cents THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH' USING ERRCODE = '22000';
  END IF;

  IF v_payment.status = 'PAID' THEN
    IF v_payment.external_transaction_id = p_external_payment_id THEN
      RETURN jsonb_build_object(
        'success', TRUE, 'is_idempotent', TRUE, 'payment_id', v_payment.id,
        'booking_id', v_booking.id, 'payment_status', 'PAID',
        'booking_status', v_booking.status, 'paid_at', v_payment.paid_at,
        'confirmed_at', v_booking.confirmed_at
      );
    END IF;
    RAISE EXCEPTION 'PAYMENT_ALREADY_CONFIRMED_WITH_DIFFERENT_EXTERNAL_ID' USING ERRCODE = '23505';
  END IF;
  IF v_payment.status NOT IN ('PENDING', 'AUTHORIZED') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_CONFIRMABLE' USING ERRCODE = '22000';
  END IF;
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
  END IF;

  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now
     AND (v_payment.payment_processing_until IS NULL OR v_payment.payment_processing_until <= v_now) THEN
    UPDATE public.bookings
    SET status = 'EXPIRED', expired_at = COALESCE(expired_at, v_now), updated_at = v_now
    WHERE id = v_booking.id;
    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;

  v_paid_at := COALESCE(p_paid_at, v_now);
  IF v_payment.payment_processing_until IS NOT NULL
     AND v_paid_at > v_payment.payment_processing_until THEN
    RAISE EXCEPTION 'PAYMENT_PROCESSING_WINDOW_EXPIRED' USING ERRCODE = '22000';
  END IF;

  UPDATE public.payments
  SET status = 'PAID', external_transaction_id = p_external_payment_id,
      paid_at = v_paid_at, updated_at = v_now
  WHERE id = v_payment.id;

  UPDATE public.bookings
  SET status = 'CONFIRMED', confirmed_at = COALESCE(confirmed_at, v_paid_at), updated_at = v_now
  WHERE id = v_booking.id;

  PERFORM public.notify_booking_participants(
    v_booking.id,
    'BOOKING_CONFIRMED',
    'Aula confirmada',
    'O pagamento foi confirmado e a aula está confirmada na agenda.',
    NULL
  );

  RETURN jsonb_build_object(
    'success', TRUE, 'is_idempotent', FALSE, 'payment_id', v_payment.id,
    'booking_id', v_booking.id, 'payment_status', 'PAID', 'booking_status', 'CONFIRMED',
    'paid_at', v_paid_at, 'confirmed_at', COALESCE(v_booking.confirmed_at, v_paid_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_booking_participants(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_booking_participants(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) TO authenticated, service_role;
