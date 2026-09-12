-- Enable an explicit Mercado Pago production mode while preserving test mode.
-- Production credentials are still server-side Supabase secrets only.

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
  IF p_gateway_provider NOT IN ('fake_payment_gateway', 'mercadopago_test', 'mercadopago_production') THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000';
  END IF;

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
  v_gateway_provider varchar;
  v_environment varchar;
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
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_booking
    FROM public.bookings
   WHERE id = v_payment.booking_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> p_student_id THEN
    RAISE EXCEPTION 'CROSS_STUDENT_PAYMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;
  IF v_payment.amount_in_cents <> v_booking.total_in_cents THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH' USING ERRCODE = '22000';
  END IF;

  v_gateway_provider := CASE
    WHEN v_payment.gateway_provider = 'mercadopago_production' THEN 'mercadopago_production'
    ELSE 'mercadopago_test'
  END;
  v_environment := CASE WHEN v_gateway_provider = 'mercadopago_production' THEN 'production' ELSE 'test' END;

  IF v_payment.status = 'PAID' THEN
    IF v_payment.external_transaction_id = p_external_payment_id THEN
      RETURN jsonb_build_object(
        'success', true, 'is_idempotent', true, 'payment_id', v_payment.id,
        'booking_id', v_booking.id, 'payment_status', 'PAID',
        'booking_status', v_booking.status, 'paid_at', v_payment.paid_at,
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
       SET status = 'EXPIRED', expired_at = COALESCE(expired_at, v_now), updated_at = v_now
     WHERE id = v_booking.id;
    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;

  UPDATE public.payments
     SET status = 'PAID', gateway_provider = v_gateway_provider,
         external_transaction_id = p_external_payment_id, paid_at = v_paid_at,
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
           'environment', v_environment, 'card_brand', NULLIF(trim(p_card_brand), ''),
           'card_last4', v_card_last4
         )), updated_at = v_now
   WHERE id = v_payment.id;
  UPDATE public.bookings
     SET status = 'CONFIRMED', confirmed_at = COALESCE(confirmed_at, v_paid_at), updated_at = v_now
   WHERE id = v_booking.id;

  RETURN jsonb_build_object(
    'success', true, 'is_idempotent', false, 'payment_id', v_payment.id,
    'booking_id', v_booking.id, 'payment_status', 'PAID', 'booking_status', 'CONFIRMED',
    'paid_at', v_paid_at, 'confirmed_at', COALESCE(v_booking.confirmed_at, v_paid_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_mercadopago_test_payment(uuid, uuid, varchar, varchar, varchar) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_mercadopago_test_payment(uuid, uuid, varchar, varchar, varchar) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_mercadopago_pix_payment(
  p_external_payment_id VARCHAR,
  p_amount_in_cents INTEGER,
  p_paid_at TIMESTAMPTZ DEFAULT NULL,
  p_gateway_fee_in_cents INTEGER DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_payment RECORD;
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_paid_at TIMESTAMPTZ := COALESCE(p_paid_at, NOW());
  v_gateway_provider VARCHAR;
  v_environment VARCHAR;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'PAYMENT_FINALIZATION_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF NULLIF(BTRIM(p_external_payment_id), '') IS NULL THEN RAISE EXCEPTION 'EXTERNAL_PAYMENT_ID_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF p_amount_in_cents IS NULL OR p_amount_in_cents <= 0 THEN RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE external_transaction_id = p_external_payment_id
      OR metadata->>'mercado_pago_payment_id' = p_external_payment_id
   ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_payment.amount_in_cents <> p_amount_in_cents OR v_payment.amount_in_cents <> v_booking.total_in_cents THEN RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH' USING ERRCODE = '22000'; END IF;

  v_gateway_provider := CASE WHEN v_payment.gateway_provider = 'mercadopago_production' THEN 'mercadopago_production' ELSE 'mercadopago_test' END;
  v_environment := CASE WHEN v_gateway_provider = 'mercadopago_production' THEN 'production' ELSE 'test' END;

  IF v_payment.status = 'PAID' THEN
    RETURN jsonb_build_object('success', TRUE, 'is_idempotent', TRUE, 'payment_id', v_payment.id, 'booking_id', v_booking.id, 'payment_status', 'PAID', 'booking_status', v_booking.status);
  END IF;
  IF v_payment.status NOT IN ('PENDING', 'AUTHORIZED') THEN RAISE EXCEPTION 'PAYMENT_NOT_CONFIRMABLE' USING ERRCODE = '22000'; END IF;

  UPDATE public.payments
     SET status = 'PAID', gateway_provider = v_gateway_provider, external_transaction_id = p_external_payment_id,
         gateway_fee_in_cents = COALESCE(p_gateway_fee_in_cents, gateway_fee_in_cents), paid_at = v_paid_at,
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('mercado_pago_payment_id', p_external_payment_id, 'gateway_fee_in_cents', p_gateway_fee_in_cents, 'environment', v_environment), updated_at = v_now
   WHERE id = v_payment.id;
  IF v_booking.status = 'PENDING_PAYMENT'
     AND (v_booking.hold_expires_at IS NULL OR v_booking.hold_expires_at > v_now)
     AND (v_payment.pix_expires_at IS NULL OR v_paid_at <= v_payment.pix_expires_at) THEN
    UPDATE public.bookings SET status = 'CONFIRMED', confirmed_at = COALESCE(confirmed_at, v_paid_at), updated_at = v_now WHERE id = v_booking.id;
    RETURN jsonb_build_object('success', TRUE, 'is_idempotent', FALSE, 'payment_id', v_payment.id, 'booking_id', v_booking.id, 'payment_status', 'PAID', 'booking_status', 'CONFIRMED', 'paid_at', v_paid_at);
  END IF;
  UPDATE public.bookings SET status = 'EXPIRED', expired_at = COALESCE(expired_at, v_now), updated_at = v_now WHERE id = v_booking.id AND status = 'PENDING_PAYMENT';
  RETURN jsonb_build_object('success', TRUE, 'late_payment', TRUE, 'payment_id', v_payment.id, 'booking_id', v_booking.id, 'payment_status', 'PAID', 'booking_status', 'EXPIRED', 'paid_at', v_paid_at);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_mercadopago_pix_payment(VARCHAR, INTEGER, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mercadopago_pix_payment(VARCHAR, INTEGER, TIMESTAMPTZ, INTEGER) TO service_role;
