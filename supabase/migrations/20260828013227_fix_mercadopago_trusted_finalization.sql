CREATE OR REPLACE FUNCTION public.finalize_mercadopago_test_payment(
  p_payment_id uuid,
  p_student_id uuid,
  p_external_payment_id varchar,
  p_card_brand varchar DEFAULT NULL,
  p_card_last4 varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_now timestamptz := now();
  v_paid_at timestamptz := now();
  v_card_last4 text := NULLIF(regexp_replace(COALESCE(p_card_last4, ''), '\D', '', 'g'), '');
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'PAYMENT_FINALIZATION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_external_payment_id IS NULL OR btrim(p_external_payment_id) = '' THEN
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

  IF v_booking.student_id <> p_student_id THEN
    RAISE EXCEPTION 'CROSS_STUDENT_PAYMENT_ACCESS_DENIED' USING ERRCODE = '42501';
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

  IF v_payment.status NOT IN ('PENDING', 'FAILED', 'AUTHORIZED') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_CONFIRMABLE' USING ERRCODE = '22000';
  END IF;

  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
  END IF;

  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings
    SET status = 'EXPIRED',
        expired_at = COALESCE(expired_at, v_now),
        updated_at = v_now
    WHERE id = v_booking.id;

    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;

  UPDATE public.payments
  SET status = 'PAID',
      gateway_provider = 'mercadopago_test',
      external_transaction_id = p_external_payment_id,
      paid_at = v_paid_at,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'environment', 'test',
        'card_brand', NULLIF(trim(p_card_brand), ''),
        'card_last4', v_card_last4
      )),
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

REVOKE ALL ON FUNCTION public.finalize_mercadopago_test_payment(uuid, varchar, varchar, varchar) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finalize_mercadopago_test_payment(uuid, uuid, varchar, varchar, varchar) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mercadopago_test_payment(uuid, uuid, varchar, varchar, varchar) TO service_role;

DROP FUNCTION IF EXISTS public.finalize_mercadopago_test_payment(uuid, varchar, varchar, varchar);
