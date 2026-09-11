-- Track the bank payout created by Stripe Connect separately from the
-- platform-to-connected-account transfer.
CREATE OR REPLACE FUNCTION public.record_stripe_payout_status(
  p_payout_id UUID,
  p_stripe_payout_id TEXT,
  p_stripe_transfer_id TEXT,
  p_stripe_status TEXT,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
DECLARE
  v_row public.payouts%ROWTYPE;
  v_status public.payout_status;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_stripe_payout_id IS NULL OR p_stripe_payout_id !~ '^po_[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'STRIPE_PAYOUT_ID_INVALID' USING ERRCODE = '22023';
  END IF;
  v_status := CASE lower(COALESCE(p_stripe_status, 'pending'))
    WHEN 'paid' THEN 'PAID'::public.payout_status
    WHEN 'failed' THEN 'FAILED'::public.payout_status
    WHEN 'canceled' THEN 'FAILED'::public.payout_status
    ELSE 'PROCESSING'::public.payout_status
  END;
  SELECT * INTO v_row FROM public.payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.payouts
     SET status = v_status,
         external_payout_id = p_stripe_payout_id,
         transfer_reference = COALESCE(p_stripe_transfer_id, transfer_reference),
         released_at = CASE WHEN v_status = 'PAID' THEN COALESCE(released_at, v_now) ELSE released_at END,
         failure_reason = CASE WHEN v_status = 'FAILED' THEN left(COALESCE(p_failure_reason, 'STRIPE_PAYOUT_FAILED'), 1000) ELSE NULL END,
         next_retry_at = CASE WHEN v_status = 'FAILED' AND processing_attempts < 5 THEN v_now + INTERVAL '15 minutes' ELSE NULL END,
         updated_at = v_now
   WHERE id = p_payout_id;
  IF v_status = 'PAID' AND to_regclass('public.financial_events') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.financial_events(event_type,booking_id,provider_id,amount_in_cents,provider_amount_in_cents,metadata) VALUES($1,$2,$3,$4,$5,$6)'
      USING 'PAYOUT_PAID', v_row.booking_id, v_row.provider_id, v_row.amount_in_cents, v_row.amount_in_cents,
        jsonb_build_object('payout_id', p_payout_id, 'stripe_payout_id', p_stripe_payout_id, 'stripe_transfer_id', p_stripe_transfer_id);
  END IF;
  RETURN jsonb_build_object('success', true, 'status', v_status, 'stripe_payout_id', p_stripe_payout_id);
END;
$$;
REVOKE ALL ON FUNCTION public.record_stripe_payout_status(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_payout_status(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
