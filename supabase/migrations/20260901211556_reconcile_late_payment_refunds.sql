-- Reconcile payments that were approved by the gateway after the booking
-- processing window. The booking is never revived; the payment is recorded
-- and refunded by the trusted gateway webhook.

CREATE OR REPLACE FUNCTION public.record_late_payment(
  p_payment_id uuid,
  p_external_payment_id varchar,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_payment record;
  v_booking record;
  v_paid_at timestamptz := COALESCE(p_paid_at, now());
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
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

  IF v_payment.status = 'PAID' THEN
    RETURN jsonb_build_object(
      'success', true, 'late_payment', true, 'is_idempotent', true,
      'payment_id', v_payment.id, 'booking_id', v_booking.id,
      'payment_status', v_payment.status, 'booking_status', v_booking.status
    );
  END IF;
  IF v_payment.status NOT IN ('PENDING', 'AUTHORIZED') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_CONFIRMABLE' USING ERRCODE = '22000';
  END IF;

  UPDATE public.payments
     SET status = 'PAID',
         external_transaction_id = p_external_payment_id,
         paid_at = v_paid_at,
         metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
           'late_payment', true,
           'auto_refund_required', true,
           'late_payment_recorded_at', now()
         ),
         updated_at = now()
   WHERE id = v_payment.id;

  UPDATE public.bookings
     SET status = CASE WHEN status = 'PENDING_PAYMENT' THEN 'EXPIRED'::public.booking_status ELSE status END,
         expired_at = CASE WHEN status = 'PENDING_PAYMENT' THEN COALESCE(expired_at, now()) ELSE expired_at END,
         updated_at = now()
   WHERE id = v_booking.id;

  RETURN jsonb_build_object(
    'success', true, 'late_payment', true, 'is_idempotent', false,
    'payment_id', v_payment.id, 'booking_id', v_booking.id,
    'payment_status', 'PAID',
    'booking_status', CASE WHEN v_booking.status = 'PENDING_PAYMENT' THEN 'EXPIRED' ELSE v_booking.status END,
    'paid_at', v_paid_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_late_payment(uuid, varchar, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_late_payment(uuid, varchar, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_late_payment_refund(
  p_payment_id uuid,
  p_amount_in_cents integer,
  p_idempotency_key text,
  p_external_refund_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_payment record;
  v_booking record;
  v_existing record;
  v_processed bigint;
  v_remaining bigint;
  v_refund record;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_amount_in_cents IS NULL OR p_amount_in_cents <= 0 THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_INVALID' USING ERRCODE = '22000';
  END IF;
  IF NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'REFUND_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_existing
    FROM public.refunds
   WHERE idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 'is_existing', true, 'late_payment', true,
      'payment_id', v_payment.id, 'booking_id', v_booking.id,
      'refund_id', v_existing.id, 'amount_in_cents', v_existing.amount_in_cents,
      'refund_status', v_existing.status
    );
  END IF;

  SELECT COALESCE(SUM(amount_in_cents), 0)::bigint INTO v_processed
    FROM public.refunds
   WHERE payment_id = v_payment.id AND status = 'PROCESSED';
  v_remaining := v_payment.amount_in_cents - v_processed;
  IF v_remaining <= 0 OR p_amount_in_cents <> v_remaining THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_MISMATCH' USING ERRCODE = '22000';
  END IF;
  IF v_payment.status <> 'PAID' THEN
    RAISE EXCEPTION 'PAYMENT_NOT_REFUNDABLE' USING ERRCODE = '22000';
  END IF;

  INSERT INTO public.refunds (
    id, payment_id, booking_id, amount_in_cents, reason,
    external_refund_id, idempotency_key, status, created_at
  ) VALUES (
    gen_random_uuid(), v_payment.id, v_booking.id, p_amount_in_cents,
    'LATE_PAYMENT_AFTER_PROCESSING_WINDOW', p_external_refund_id,
    p_idempotency_key, 'PROCESSED', now()
  ) RETURNING * INTO v_refund;

  UPDATE public.payments
     SET status = 'REFUNDED', updated_at = now()
   WHERE id = v_payment.id;
  UPDATE public.bookings
     SET status = 'REFUNDED',
         refund_amount_in_cents = v_processed + p_amount_in_cents,
         updated_at = now()
   WHERE id = v_booking.id;

  RETURN jsonb_build_object(
    'success', true, 'is_existing', false, 'late_payment', true,
    'payment_id', v_payment.id, 'booking_id', v_booking.id,
    'refund_id', v_refund.id, 'amount_in_cents', p_amount_in_cents,
    'refund_status', 'PROCESSED'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_late_payment_refund(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_late_payment_refund(uuid, integer, text, text) TO service_role;
