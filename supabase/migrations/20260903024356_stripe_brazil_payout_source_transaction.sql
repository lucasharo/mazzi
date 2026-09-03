-- Automatic Brazilian Connect transfers must be tied to the original Stripe charge.
-- Legacy DEV seed payments without a real PaymentIntent are intentionally excluded.

DROP FUNCTION IF EXISTS public.claim_due_stripe_payouts(INTEGER);

CREATE FUNCTION public.claim_due_stripe_payouts(p_limit INTEGER DEFAULT 25)
RETURNS TABLE(
  payout_id UUID,
  booking_id UUID,
  amount_in_cents INTEGER,
  stripe_account_id TEXT,
  idempotency_key VARCHAR,
  stripe_payment_intent_id TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT po.id
    FROM public.payouts po
    WHERE po.status IN ('PENDING','FAILED')
      AND po.scheduled_release_at <= NOW()
      AND po.processing_attempts < 5
      AND (po.next_retry_at IS NULL OR po.next_retry_at <= NOW())
      AND po.transfer_method='STRIPE_CONNECT'
      AND NULLIF(po.destination_key,'') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.booking_disputes d
        WHERE d.booking_id=po.booking_id
          AND d.status IN ('OPEN','AWAITING_RESPONSE','UNDER_REVIEW')
      )
      AND EXISTS (
        SELECT 1
        FROM public.payments payment
        WHERE payment.booking_id=po.booking_id
          AND payment.status='PAID'
          AND lower(COALESCE(payment.gateway_provider,'')) LIKE '%stripe%'
          AND payment.external_transaction_id ~ '^pi_[A-Za-z0-9]+$'
      )
    ORDER BY po.scheduled_release_at
    FOR UPDATE
    SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit,1),100)
  ), claimed AS (
    UPDATE public.payouts po
    SET status='PROCESSING',
        processed_at=NOW(),
        processing_attempts=po.processing_attempts+1,
        failure_reason=NULL,
        updated_at=NOW()
    FROM candidates c
    WHERE po.id=c.id
    RETURNING po.*
  )
  SELECT c.id,
         c.booking_id,
         c.amount_in_cents,
         c.destination_key,
         c.idempotency_key,
         payment.external_transaction_id
  FROM claimed c
  JOIN LATERAL (
    SELECT p.external_transaction_id
    FROM public.payments p
    WHERE p.booking_id=c.booking_id
      AND p.status='PAID'
      AND lower(COALESCE(p.gateway_provider,'')) LIKE '%stripe%'
      AND p.external_transaction_id ~ '^pi_[A-Za-z0-9]+$'
    ORDER BY p.paid_at DESC NULLS LAST, p.created_at DESC
    LIMIT 1
  ) payment ON TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_stripe_payouts(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_stripe_payouts(INTEGER) TO service_role;
