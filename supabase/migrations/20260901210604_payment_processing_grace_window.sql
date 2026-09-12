-- Keep the quote deadline strict for starting a payment, while allowing a
-- payment already started before that deadline to finish processing.
-- The grace window is server-side only and never extends quote reuse.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_processing_until timestamptz;

CREATE INDEX IF NOT EXISTS payments_processing_window_idx
  ON public.payments (payment_processing_until)
  WHERE status IN ('PENDING', 'AUTHORIZED');

CREATE OR REPLACE FUNCTION public.create_booking_payment(
  p_booking_id uuid,
  p_method public.payment_method,
  p_idempotency_key varchar DEFAULT NULL,
  p_gateway_provider varchar DEFAULT 'fake_payment_gateway'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_booking record;
  v_payment record;
  v_quote_expires_at timestamptz;
  v_processing_until timestamptz;
  v_now timestamptz := now();
  v_payment_id uuid;
  v_requested_idem varchar := nullif(btrim(p_idempotency_key), '');
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
    END IF;
    RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
  END IF;

  SELECT q.expires_at INTO v_quote_expires_at
    FROM public.quotes q
   WHERE q.id = v_booking.quote_id;
  v_quote_expires_at := COALESCE(v_quote_expires_at, v_booking.hold_expires_at);

  -- Repeated calls with the same idempotency key return the existing attempt.
  -- This is evaluated before the quote check so a retry cannot create a new
  -- attempt after the quote deadline.
  IF v_requested_idem IS NOT NULL THEN
    SELECT * INTO v_payment
      FROM public.payments
     WHERE booking_id = p_booking_id
       AND idempotency_key = v_requested_idem
     ORDER BY created_at DESC
     LIMIT 1;
    IF FOUND AND v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_idempotent', true,
        'payment_id', v_payment.id,
        'booking_id', v_payment.booking_id,
        'status', v_payment.status,
        'amount_in_cents', v_payment.amount_in_cents,
        'gateway_provider', v_payment.gateway_provider,
        'payment_started_at', v_payment.payment_started_at,
        'payment_processing_until', v_payment.payment_processing_until
      );
    END IF;
  END IF;

  -- Once the quote expires, an already-created attempt may be retried, but a
  -- new payment method/attempt must not be created.
  IF v_quote_expires_at IS NOT NULL AND v_quote_expires_at <= v_now THEN
    SELECT * INTO v_payment
      FROM public.payments
     WHERE booking_id = p_booking_id
       AND status IN ('PENDING', 'AUTHORIZED')
     ORDER BY created_at DESC
     LIMIT 1;
    IF FOUND AND v_payment.payment_processing_until IS NOT NULL
       AND v_payment.payment_processing_until > v_now THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_idempotent', true,
        'payment_id', v_payment.id,
        'booking_id', v_payment.booking_id,
        'status', v_payment.status,
        'amount_in_cents', v_payment.amount_in_cents,
        'gateway_provider', v_payment.gateway_provider,
        'payment_started_at', v_payment.payment_started_at,
        'payment_processing_until', v_payment.payment_processing_until
      );
    END IF;

    UPDATE public.bookings
       SET status = 'EXPIRED', expired_at = COALESCE(expired_at, v_now), updated_at = v_now
     WHERE id = p_booking_id;
    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;

  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings
       SET status = 'EXPIRED', expired_at = COALESCE(expired_at, v_now), updated_at = v_now
     WHERE id = p_booking_id;
    RAISE EXCEPTION 'BOOKING_HOLD_EXPIRED' USING ERRCODE = '22000';
  END IF;
  IF p_gateway_provider NOT IN ('fake_payment_gateway', 'stripe') THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000';
  END IF;

  -- A method switch closes only the unused local attempt. The new attempt is
  -- still created before the quote deadline and receives the same grace end.
  UPDATE public.payments
     SET status = 'CANCELLED',
         updated_at = v_now,
         metadata = coalesce(metadata, '{}'::jsonb)
           || jsonb_build_object('cancelled_reason', 'PAYMENT_METHOD_CHANGED')
   WHERE booking_id = p_booking_id
     AND status IN ('PENDING', 'AUTHORIZED')
     AND (v_requested_idem IS NULL OR idempotency_key <> v_requested_idem);

  v_payment_id := gen_random_uuid();
  v_processing_until := COALESCE(v_quote_expires_at, v_booking.hold_expires_at) + interval '5 minutes';

  INSERT INTO public.payments (
    id, booking_id, method, status, amount_in_cents, idempotency_key,
    gateway_provider, payment_started_at, payment_processing_until,
    created_at, updated_at
  ) VALUES (
    v_payment_id, p_booking_id, p_method, 'PENDING', v_booking.total_in_cents,
    coalesce(v_requested_idem, 'idem_pay_' || p_booking_id || '_' || v_payment_id),
    p_gateway_provider, v_now, v_processing_until, v_now, v_now
  );

  -- The quote deadline remains unchanged; only the temporary schedule lock is
  -- extended for this payment attempt.
  UPDATE public.bookings
     SET hold_expires_at = v_processing_until,
         updated_at = v_now
   WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'payment_id', v_payment_id,
    'booking_id', p_booking_id,
    'status', 'PENDING',
    'amount_in_cents', v_booking.total_in_cents,
    'gateway_provider', p_gateway_provider,
    'payment_started_at', v_now,
    'payment_processing_until', v_processing_until
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_booking_payment(uuid, public.payment_method, varchar, varchar) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment(uuid, public.payment_method, varchar, varchar) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_payment_id uuid,
  p_external_payment_id varchar,
  p_paid_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_service_role boolean := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';
  v_payment record;
  v_booking record;
  v_now timestamptz := now();
  v_paid_at timestamptz;
BEGIN
  IF v_uid IS NULL AND NOT v_is_service_role THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT v_is_service_role THEN
    PERFORM public.lock_student_profile(v_uid);
    PERFORM public.assert_current_user_student();
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
        'success', true, 'is_idempotent', true, 'payment_id', v_payment.id,
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

  -- The booking hold is extended when the payment attempt starts. This check
  -- is intentionally based on the processing window as well, so a webhook
  -- arriving shortly after the quote deadline is still accepted.
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

  RETURN jsonb_build_object(
    'success', true, 'is_idempotent', false, 'payment_id', v_payment.id,
    'booking_id', v_booking.id, 'payment_status', 'PAID', 'booking_status', 'CONFIRMED',
    'paid_at', v_paid_at, 'confirmed_at', COALESCE(v_booking.confirmed_at, v_paid_at)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_booking_payment(uuid, varchar, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(uuid, varchar, timestamptz) TO authenticated, service_role;
