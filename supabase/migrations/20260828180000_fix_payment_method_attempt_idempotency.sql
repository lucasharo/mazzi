-- Separate Mercado Pago attempts when the student changes the payment method.
-- A PIX attempt must never be reused for a card payment (or vice versa), while
-- an exact idempotency key must still return the original pending attempt.

CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id UUID,
  p_method public.payment_method,
  p_idempotency_key VARCHAR DEFAULT NULL,
  p_gateway_provider VARCHAR DEFAULT 'fake_payment_gateway'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_payment RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_payment_id UUID;
  v_requested_idem VARCHAR := NULLIF(BTRIM(p_idempotency_key), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000';
  END IF;

  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    IF v_booking.status = 'CONFIRMED' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    ELSE
      RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
    END IF;
  END IF;
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings
       SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
     WHERE id = p_booking_id;
    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;
  IF p_gateway_provider NOT IN ('fake_payment_gateway', 'mercadopago_test') THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000';
  END IF;

  -- Idempotent retries reuse only the exact requested attempt. This also
  -- allows the first payment call after the booking hold to reuse its record.
  IF v_requested_idem IS NOT NULL THEN
    SELECT * INTO v_payment
      FROM public.payments
     WHERE booking_id = p_booking_id
       AND idempotency_key = v_requested_idem
     ORDER BY created_at DESC
     LIMIT 1;

    IF FOUND AND v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
      UPDATE public.payments
         SET method = p_method,
             gateway_provider = p_gateway_provider,
             updated_at = v_now
       WHERE id = v_payment.id;
      RETURN jsonb_build_object(
        'success', TRUE,
        'is_idempotent', TRUE,
        'payment_id', v_payment.id,
        'booking_id', v_payment.booking_id,
        'status', v_payment.status,
        'amount_in_cents', v_payment.amount_in_cents,
        'gateway_provider', p_gateway_provider
      );
    END IF;
  END IF;

  -- A different method or key always receives a new payment attempt. This
  -- is essential after a PIX QR code was already created for the booking.
  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (
    id, booking_id, method, status, amount_in_cents, idempotency_key,
    gateway_provider, created_at, updated_at
  )
  VALUES (
    v_payment_id, p_booking_id, p_method, 'PENDING', v_booking.total_in_cents,
    COALESCE(v_requested_idem, 'idem_pay_' || p_booking_id || '_' || v_payment_id),
    p_gateway_provider, v_now, v_now
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'is_idempotent', FALSE,
    'payment_id', v_payment_id,
    'booking_id', p_booking_id,
    'status', 'PENDING',
    'amount_in_cents', v_booking.total_in_cents,
    'gateway_provider', p_gateway_provider
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(UUID, public.payment_method, VARCHAR, VARCHAR) TO authenticated, service_role;
