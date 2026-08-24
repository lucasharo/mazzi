CREATE OR REPLACE FUNCTION public.admin_refund_mock_booking(
  p_booking_id uuid,
  p_reason text DEFAULT 'ADMIN_MOCK_REFUND'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_existing public.refunds%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_key text := 'admin_mock_refund:' || p_booking_id::text;
  v_reason text := COALESCE(NULLIF(BTRIM(p_reason), ''), 'ADMIN_MOCK_REFUND');
  v_processed bigint;
  v_remaining bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE booking_id = p_booking_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.status NOT IN ('CONFIRMED'::public.booking_status, 'COMPLETED'::public.booking_status)
     AND v_booking.status <> 'REFUNDED'::public.booking_status THEN
    RAISE EXCEPTION 'ADMIN_MOCK_REFUND_BOOKING_STATUS_INVALID' USING ERRCODE = '22000';
  END IF;

  IF UPPER(COALESCE(v_payment.gateway_provider, '')) NOT IN ('FAKE_PAYMENT_GATEWAY', 'MOCK_VALIDATION', 'FAKE') THEN
    RAISE EXCEPTION 'REAL_GATEWAY_REFUND_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.refunds
  WHERE idempotency_key = v_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.booking_id <> p_booking_id OR v_existing.payment_id <> v_payment.id THEN
      RAISE EXCEPTION 'REFUND_IDEMPOTENCY_COLLISION' USING ERRCODE = '23505';
    END IF;
    IF v_existing.status <> 'PROCESSED' THEN
      RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'is_existing', true,
      'booking_id', p_booking_id,
      'payment_id', v_payment.id,
      'refund_id', v_existing.id,
      'amount_in_cents', v_existing.amount_in_cents,
      'total_refunded_in_cents', v_existing.amount_in_cents,
      'booking_status', v_booking.status,
      'payment_status', v_payment.status
    );
  END IF;

  SELECT COALESCE(SUM(amount_in_cents), 0)::bigint INTO v_processed
  FROM public.refunds
  WHERE payment_id = v_payment.id
    AND status = 'PROCESSED';

  IF v_processed > v_payment.amount_in_cents THEN
    RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000';
  END IF;

  IF v_processed = v_payment.amount_in_cents THEN
    IF v_payment.status <> 'REFUNDED'::public.payment_status
       OR v_booking.status <> 'REFUNDED'::public.booking_status THEN
      RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000';
    END IF;
    SELECT * INTO v_existing
    FROM public.refunds
    WHERE payment_id = v_payment.id
      AND status = 'PROCESSED'
    ORDER BY created_at DESC
    LIMIT 1;
    RETURN jsonb_build_object(
      'success', true,
      'is_existing', true,
      'booking_id', p_booking_id,
      'payment_id', v_payment.id,
      'refund_id', v_existing.id,
      'amount_in_cents', v_existing.amount_in_cents,
      'total_refunded_in_cents', v_processed,
      'booking_status', v_booking.status,
      'payment_status', v_payment.status
    );
  END IF;

  IF v_payment.status <> 'PAID'::public.payment_status THEN
    RAISE EXCEPTION 'PAYMENT_NOT_REFUNDABLE' USING ERRCODE = '22000';
  END IF;

  v_remaining := v_payment.amount_in_cents - v_processed;
  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000';
  END IF;

  INSERT INTO public.refunds (
    payment_id,
    booking_id,
    amount_in_cents,
    reason,
    external_refund_id,
    idempotency_key,
    status
  ) VALUES (
    v_payment.id,
    p_booking_id,
    v_remaining,
    v_reason,
    NULL,
    v_key,
    'PROCESSED'
  )
  RETURNING * INTO v_refund;

  UPDATE public.payments
  SET status = 'REFUNDED'::public.payment_status,
      updated_at = now()
  WHERE id = v_payment.id;

  UPDATE public.bookings
  SET status = 'REFUNDED'::public.booking_status,
      refund_amount_in_cents = v_processed + v_remaining,
      updated_at = now()
  WHERE id = p_booking_id;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    previous_value,
    new_value,
    ip_address,
    user_agent,
    severity
  ) VALUES (
    v_uid,
    'ADMIN_MOCK_REFUND',
    'BOOKING',
    p_booking_id::text,
    jsonb_build_object(
      'booking_status', v_booking.status,
      'payment_status', v_payment.status,
      'previous_refunded_in_cents', v_processed
    ),
    jsonb_build_object(
      'booking_status', 'REFUNDED',
      'payment_status', 'REFUNDED',
      'refund_id', v_refund.id,
      'refund_amount_in_cents', v_remaining,
      'gateway_provider', v_payment.gateway_provider
    ),
    NULL,
    NULL,
    'INFO'
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_existing', false,
    'booking_id', p_booking_id,
    'payment_id', v_payment.id,
    'refund_id', v_refund.id,
    'amount_in_cents', v_remaining,
    'total_refunded_in_cents', v_processed + v_remaining,
    'booking_status', 'REFUNDED',
    'payment_status', 'REFUNDED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_refund_mock_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_refund_mock_booking(uuid, text) TO authenticated;
