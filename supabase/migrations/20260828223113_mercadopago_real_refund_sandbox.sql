-- Reconcile a real Mercado Pago sandbox refund with MAZZI atomically.
-- The Edge Function is the only caller: it performs the gateway request and
-- calls this function with the service role after Mercado Pago confirms it.

CREATE OR REPLACE FUNCTION public.finalize_mercadopago_refund(
  p_payment_id uuid,
  p_amount_in_cents integer,
  p_reason text,
  p_idempotency_key text,
  p_external_refund_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_existing public.refunds%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_processed bigint;
  v_remaining bigint;
  v_reason text := COALESCE(NULLIF(BTRIM(p_reason), ''), 'ADMIN_MERCADOPAGO_REFUND');
BEGIN
  IF p_amount_in_cents IS NULL OR p_amount_in_cents <= 0 THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_INVALID' USING ERRCODE = '22000';
  END IF;
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'REFUND_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_existing FROM public.refunds
  WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.payment_id <> v_payment.id OR v_existing.booking_id <> v_booking.id THEN
      RAISE EXCEPTION 'REFUND_IDEMPOTENCY_COLLISION' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'success', true, 'is_existing', true,
      'booking_id', v_booking.id, 'payment_id', v_payment.id,
      'refund_id', v_existing.id, 'amount_in_cents', v_existing.amount_in_cents,
      'total_refunded_in_cents', v_existing.amount_in_cents,
      'booking_status', v_booking.status, 'payment_status', v_payment.status
    );
  END IF;

  SELECT COALESCE(SUM(amount_in_cents), 0)::bigint INTO v_processed
  FROM public.refunds WHERE payment_id = v_payment.id AND status = 'PROCESSED';
  IF v_processed > v_payment.amount_in_cents THEN
    RAISE EXCEPTION 'REFUND_STATE_INVALID' USING ERRCODE = '22000';
  END IF;

  v_remaining := v_payment.amount_in_cents - v_processed;
  IF p_amount_in_cents <> v_remaining THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_MISMATCH' USING ERRCODE = '22000';
  END IF;
  IF v_remaining = 0 THEN RAISE EXCEPTION 'PAYMENT_ALREADY_REFUNDED' USING ERRCODE = '22000'; END IF;
  IF v_payment.status <> 'PAID'::public.payment_status THEN
    RAISE EXCEPTION 'PAYMENT_NOT_REFUNDABLE' USING ERRCODE = '22000';
  END IF;

  INSERT INTO public.refunds (
    payment_id, booking_id, amount_in_cents, reason,
    external_refund_id, idempotency_key, status
  ) VALUES (
    v_payment.id, v_booking.id, v_remaining, v_reason,
    p_external_refund_id, p_idempotency_key, 'PROCESSED'
  ) RETURNING * INTO v_refund;

  UPDATE public.payments SET status = 'REFUNDED'::public.payment_status, updated_at = now()
  WHERE id = v_payment.id;
  UPDATE public.bookings SET status = 'REFUNDED'::public.booking_status,
    refund_amount_in_cents = v_processed + v_remaining, updated_at = now()
  WHERE id = v_booking.id;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, previous_value, new_value, severity
  ) VALUES (
    p_actor_id, 'MERCADOPAGO_REFUND', 'BOOKING', v_booking.id::text,
    jsonb_build_object('booking_status', v_booking.status,
      'payment_status', v_payment.status, 'previous_refunded_in_cents', v_processed),
    jsonb_build_object('booking_status', 'REFUNDED', 'payment_status', 'REFUNDED',
      'refund_id', v_refund.id, 'refund_amount_in_cents', v_remaining,
      'external_refund_id', p_external_refund_id), 'INFO'
  );

  RETURN jsonb_build_object(
    'success', true, 'is_existing', false, 'booking_id', v_booking.id,
    'payment_id', v_payment.id, 'refund_id', v_refund.id,
    'amount_in_cents', v_remaining, 'total_refunded_in_cents', v_processed + v_remaining,
    'booking_status', 'REFUNDED', 'payment_status', 'REFUNDED'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_mercadopago_refund(uuid, integer, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_mercadopago_refund(uuid, integer, text, text, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_mercadopago_refund(uuid, integer, text, text, text, uuid) TO service_role;

DO $revoke$
BEGIN
  IF to_regprocedure('public.process_booking_refund(uuid,integer,character varying,character varying,character varying)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.process_booking_refund(uuid, integer, varchar, varchar, varchar) FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.process_booking_refund(uuid, integer, varchar, varchar, varchar) TO service_role;
  END IF;
END;
$revoke$;
