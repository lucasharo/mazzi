BEGIN;

-- Restore the canonical refund finalizer. The original migration was recorded
-- in the historical ledger without this function in the DEV schema, causing
-- signed Stripe refund webhooks to return HTTP 500.
CREATE OR REPLACE FUNCTION public.process_booking_refund(
  p_payment_id uuid,
  p_amount_in_cents integer,
  p_reason varchar,
  p_idempotency_key varchar,
  p_external_refund_id varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_existing public.refunds%ROWTYPE;
  v_refund public.refunds%ROWTYPE;
  v_prior_refunded bigint;
  v_total_refunded bigint;
  v_is_full_refund boolean;
BEGIN
  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_amount_in_cents IS NULL OR p_amount_in_cents <= 0 THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'REFUND_IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'REFUND_REASON_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- A local cancellation may record the same Stripe refund before the webhook
  -- arrives, using a different idempotency key. The external refund id is also
  -- authoritative and prevents a second accounting entry in that case.
  SELECT * INTO v_existing
  FROM public.refunds r
  WHERE r.idempotency_key = p_idempotency_key
     OR (
       NULLIF(btrim(p_external_refund_id), '') IS NOT NULL
       AND r.external_refund_id = p_external_refund_id
     )
  ORDER BY (r.idempotency_key = p_idempotency_key) DESC, r.created_at
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.payment_id <> p_payment_id
      OR v_existing.amount_in_cents <> p_amount_in_cents THEN
      RAISE EXCEPTION 'REFUND_IDEMPOTENCY_COLLISION' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'success', true,
      'is_existing', true,
      'refund_id', v_existing.id,
      'amount_in_cents', v_existing.amount_in_cents,
      'status', v_existing.status
    );
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_payment.status NOT IN (
    'PAID'::public.payment_status,
    'PARTIALLY_REFUNDED'::public.payment_status
  ) THEN
    RAISE EXCEPTION 'PAYMENT_NOT_REFUNDABLE' USING ERRCODE = '22000';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_payment.booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(sum(r.amount_in_cents), 0)::bigint
  INTO v_prior_refunded
  FROM public.refunds r
  WHERE r.payment_id = p_payment_id
    AND r.status = 'PROCESSED';

  v_total_refunded := v_prior_refunded + p_amount_in_cents;
  IF v_total_refunded > v_payment.amount_in_cents THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_EXCEEDS_REMAINING_BALANCE' USING ERRCODE = '22000';
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
    v_booking.id,
    p_amount_in_cents,
    btrim(p_reason),
    NULLIF(btrim(p_external_refund_id), ''),
    btrim(p_idempotency_key),
    'PROCESSED'
  )
  RETURNING * INTO v_refund;

  v_is_full_refund := v_total_refunded = v_payment.amount_in_cents;

  UPDATE public.payments
  SET status = CASE
        WHEN v_is_full_refund THEN 'REFUNDED'::public.payment_status
        ELSE 'PARTIALLY_REFUNDED'::public.payment_status
      END,
      updated_at = now()
  WHERE id = v_payment.id;

  UPDATE public.bookings
  SET status = CASE
        -- Preserve the operational reason for already-cancelled/no-show rows.
        WHEN status IN (
          'CONFIRMED'::public.booking_status,
          'COMPLETED'::public.booking_status,
          'PARTIALLY_REFUNDED'::public.booking_status,
          'REFUNDED'::public.booking_status
        ) THEN CASE
          WHEN v_is_full_refund THEN 'REFUNDED'::public.booking_status
          ELSE 'PARTIALLY_REFUNDED'::public.booking_status
        END
        ELSE status
      END,
      refund_amount_in_cents = v_total_refunded,
      updated_at = now()
  WHERE id = v_booking.id;

  RETURN jsonb_build_object(
    'success', true,
    'is_existing', false,
    'refund_id', v_refund.id,
    'amount_in_cents', v_refund.amount_in_cents,
    'total_refunded_in_cents', v_total_refunded,
    'is_full_refund', v_is_full_refund,
    'status', v_refund.status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_booking_refund(uuid, integer, varchar, varchar, varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_booking_refund(uuid, integer, varchar, varchar, varchar)
  TO service_role;

COMMENT ON FUNCTION public.process_booking_refund(uuid, integer, varchar, varchar, varchar)
IS 'Idempotently finalizes a gateway-confirmed refund. Restricted to service_role.';

NOTIFY pgrst, 'reload schema';

COMMIT;
