-- Allow the signed Stripe webhook to confirm Stripe payments server-to-server.
-- Student calls remain authenticated and restricted to their own booking.
CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_payment_id UUID,
  p_external_payment_id VARCHAR,
  p_paid_at TIMESTAMPTZ
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
        'success', true,
        'is_idempotent', true,
        'payment_id', v_payment.id,
        'booking_id', v_booking.id,
        'payment_status', 'PAID',
        'booking_status', v_booking.status,
        'paid_at', v_payment.paid_at,
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

  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings
    SET status = 'EXPIRED', expired_at = COALESCE(expired_at, v_now), updated_at = v_now
    WHERE id = v_booking.id;
    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;

  v_paid_at := COALESCE(p_paid_at, v_now);
  UPDATE public.payments
  SET status = 'PAID',
      external_transaction_id = p_external_payment_id,
      paid_at = v_paid_at,
      updated_at = v_now
  WHERE id = v_payment.id;

  UPDATE public.bookings
  SET status = 'CONFIRMED',
      confirmed_at = COALESCE(confirmed_at, v_paid_at),
      updated_at = v_now
  WHERE id = v_booking.id;

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'payment_id', v_payment.id,
    'booking_id', v_booking.id,
    'payment_status', 'PAID',
    'booking_status', 'CONFIRMED',
    'paid_at', v_paid_at,
    'confirmed_at', COALESCE(v_booking.confirmed_at, v_paid_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(UUID, VARCHAR, TIMESTAMPTZ) TO authenticated, service_role;
