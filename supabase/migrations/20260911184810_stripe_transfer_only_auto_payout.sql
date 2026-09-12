-- Stripe creates the bank payout according to the connected account's
-- automatic payout schedule. MAZZI only creates the Connect transfer.
CREATE OR REPLACE FUNCTION public.record_stripe_transfer(
  p_payout_id UUID,
  p_stripe_transfer_id TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
DECLARE v_row public.payouts%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_stripe_transfer_id IS NULL OR p_stripe_transfer_id !~ '^tr_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'STRIPE_TRANSFER_ID_INVALID' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_row FROM public.payouts WHERE id=p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_row.status='PAID' THEN RETURN jsonb_build_object('success',true,'is_idempotent',true,'status','PAID'); END IF;
  UPDATE public.payouts SET status='PROCESSING', transfer_reference=p_stripe_transfer_id, external_payout_id=NULL, released_at=NULL, failure_reason=NULL, next_retry_at=NULL, updated_at=NOW() WHERE id=p_payout_id;
  RETURN jsonb_build_object('success',true,'is_idempotent',false,'status','PROCESSING','transfer_id',p_stripe_transfer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.record_stripe_transfer(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_transfer(UUID, TEXT) TO service_role;
