CREATE OR REPLACE FUNCTION public.claim_stripe_transfer_reconciliation(p_limit INTEGER DEFAULT 25)
RETURNS TABLE(payout_id UUID, booking_id UUID, stripe_account_id TEXT, stripe_transfer_id TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT po.id,po.booking_id,po.destination_key::TEXT,po.transfer_reference::TEXT
    FROM public.payouts po
   WHERE po.status IN ('PROCESSING','PAID') AND po.transfer_reference ~ '^tr_[A-Za-z0-9]+$'
     AND po.stripe_available_on IS NULL AND po.destination_key ~ '^acct_[A-Za-z0-9]+$'
   ORDER BY po.updated_at FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),100);
END; $$;
REVOKE ALL ON FUNCTION public.claim_stripe_transfer_reconciliation(INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_transfer_reconciliation(INTEGER) TO service_role;
