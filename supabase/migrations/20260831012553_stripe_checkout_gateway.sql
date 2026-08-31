-- Activate Stripe as the only real checkout gateway for new attempts.
-- Mercado Pago records and functions remain available only for historical
-- reconciliation; no new frontend payment attempt can target them.

CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id uuid,
  p_method public.payment_method,
  p_idempotency_key varchar DEFAULT NULL,
  p_gateway_provider varchar DEFAULT 'fake_payment_gateway'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_booking record;
  v_payment record;
  v_now timestamptz := now();
  v_payment_id uuid;
  v_requested_idem varchar := nullif(btrim(p_idempotency_key), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000';
  END IF;
  PERFORM public.lock_student_profile(v_uid);
  PERFORM public.assert_current_user_student();

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    IF v_booking.status = 'CONFIRMED' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    END IF;
    RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
  END IF;
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now WHERE id = p_booking_id;
    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;
  IF p_gateway_provider NOT IN ('fake_payment_gateway', 'stripe') THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000';
  END IF;

  IF v_requested_idem IS NOT NULL THEN
    SELECT * INTO v_payment
      FROM public.payments
     WHERE booking_id = p_booking_id AND idempotency_key = v_requested_idem
     ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
      RETURN jsonb_build_object(
        'success', true, 'is_idempotent', true, 'payment_id', v_payment.id,
        'booking_id', v_payment.booking_id, 'status', v_payment.status,
        'amount_in_cents', v_payment.amount_in_cents,
        'gateway_provider', v_payment.gateway_provider
      );
    END IF;
  END IF;

  -- A method switch closes only the unused local attempt. Stripe intents are
  -- created afterward by the authenticated Edge Function.
  UPDATE public.payments
     SET status = 'CANCELLED', updated_at = v_now,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cancelled_reason', 'PAYMENT_METHOD_CHANGED')
   WHERE booking_id = p_booking_id
     AND status IN ('PENDING', 'AUTHORIZED')
     AND (v_requested_idem IS NULL OR idempotency_key <> v_requested_idem);

  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (
    id, booking_id, method, status, amount_in_cents, idempotency_key,
    gateway_provider, created_at, updated_at
  ) VALUES (
    v_payment_id, p_booking_id, p_method, 'PENDING', v_booking.total_in_cents,
    coalesce(v_requested_idem, 'idem_pay_' || p_booking_id || '_' || v_payment_id),
    p_gateway_provider, v_now, v_now
  );

  RETURN jsonb_build_object(
    'success', true, 'is_idempotent', false, 'payment_id', v_payment_id,
    'booking_id', p_booking_id, 'status', 'PENDING',
    'amount_in_cents', v_booking.total_in_cents,
    'gateway_provider', p_gateway_provider
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_booking_payment(uuid, public.payment_method, varchar, varchar) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(uuid, public.payment_method, varchar, varchar) TO authenticated, service_role;
