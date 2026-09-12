-- Use Stripe's official bank arrival date in the provider payout forecast.
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS stripe_arrival_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payouts_stripe_arrival_date
  ON public.payouts (stripe_arrival_date)
  WHERE stripe_arrival_date IS NOT NULL;

DROP FUNCTION IF EXISTS public.record_stripe_payout_status(UUID, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_stripe_payout_status(
  p_payout_id UUID,
  p_stripe_payout_id TEXT,
  p_stripe_transfer_id TEXT,
  p_stripe_status TEXT,
  p_failure_reason TEXT DEFAULT NULL,
  p_arrival_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
DECLARE
  v_row public.payouts%ROWTYPE;
  v_status public.payout_status;
  v_was_paid BOOLEAN;
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

  SELECT * INTO v_row
    FROM public.payouts
   WHERE id = p_payout_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_was_paid := v_row.status = 'PAID';
  UPDATE public.payouts
     SET status = v_status,
         external_payout_id = p_stripe_payout_id,
         stripe_arrival_date = COALESCE(p_arrival_date, stripe_arrival_date),
         transfer_reference = COALESCE(p_stripe_transfer_id, transfer_reference),
         released_at = CASE WHEN v_status = 'PAID' THEN COALESCE(released_at, v_now) ELSE released_at END,
         failure_reason = CASE WHEN v_status = 'FAILED' THEN left(COALESCE(p_failure_reason, 'STRIPE_PAYOUT_FAILED'), 1000) ELSE NULL END,
         next_retry_at = CASE WHEN v_status = 'FAILED' AND processing_attempts < 5 THEN v_now + INTERVAL '15 minutes' ELSE NULL END,
         updated_at = v_now
   WHERE id = p_payout_id;

  IF v_status = 'PAID' AND NOT v_was_paid AND to_regclass('public.financial_events') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.financial_events(event_type,booking_id,provider_id,amount_in_cents,provider_amount_in_cents,metadata) VALUES($1,$2,$3,$4,$5,$6)'
      USING 'PAYOUT_PAID', v_row.booking_id, v_row.provider_id, v_row.amount_in_cents, v_row.amount_in_cents,
        jsonb_build_object('payout_id', p_payout_id, 'stripe_payout_id', p_stripe_payout_id, 'stripe_transfer_id', p_stripe_transfer_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_status, 'stripe_payout_id', p_stripe_payout_id, 'arrival_date', p_arrival_date);
END;
$$;

REVOKE ALL ON FUNCTION public.record_stripe_payout_status(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_payout_status(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_provider_payout_detail(p_payout_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'PAYOUT_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'id', po.id,
    'status', po.status,
    'amount_in_cents', po.amount_in_cents,
    'scheduled_release_at', po.scheduled_release_at,
    'arrival_date', po.stripe_arrival_date,
    'released_at', po.released_at,
    'processed_at', po.processed_at,
    'failure_reason', CASE WHEN po.status::TEXT IN ('FAILED', 'BLOCKED') THEN po.failure_reason ELSE NULL END
  ) INTO v_result
  FROM public.payouts po
  JOIN public.providers p ON p.id = po.provider_id
  WHERE po.id = p_payout_id
    AND ((p.type::TEXT = 'INSTRUCTOR' AND p.user_id = v_uid AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission))
      OR (p.type::TEXT = 'DRIVING_SCHOOL' AND public.current_user_has_permission('school.finance.read'::public.app_permission)
        AND (p.user_id = v_uid OR EXISTS (SELECT 1 FROM public.driving_school_staff dss WHERE dss.school_id = p.id AND dss.user_id = v_uid AND dss.is_active IS TRUE))));
  IF v_result IS NULL THEN RAISE EXCEPTION 'PAYOUT_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_provider_upcoming_payouts()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', po.id,
    'date', (COALESCE(po.stripe_arrival_date, po.scheduled_release_at) AT TIME ZONE 'America/Sao_Paulo')::DATE,
    'status', po.status,
    'amount_in_cents', po.amount_in_cents,
    'is_overdue', COALESCE(po.stripe_arrival_date, po.scheduled_release_at) < NOW(),
    'failure_reason', CASE WHEN po.status::TEXT = 'FAILED' THEN po.failure_reason ELSE NULL END
  ) ORDER BY COALESCE(po.stripe_arrival_date, po.scheduled_release_at)), '[]'::JSONB)
  INTO v_result
  FROM public.payouts po
  JOIN public.providers p ON p.id = po.provider_id
  WHERE COALESCE(po.stripe_arrival_date, po.scheduled_release_at) < NOW() + INTERVAL '7 days'
    AND po.status::TEXT IN ('PENDING', 'AVAILABLE', 'PROCESSING')
    AND ((p.type::TEXT = 'INSTRUCTOR' AND p.user_id = v_uid AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission))
      OR (p.type::TEXT = 'DRIVING_SCHOOL' AND public.current_user_has_permission('school.finance.read'::public.app_permission)
        AND (p.user_id = v_uid OR EXISTS (SELECT 1 FROM public.driving_school_staff dss WHERE dss.school_id = p.id AND dss.user_id = v_uid AND dss.is_active IS TRUE))));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_payout_detail(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_payout_detail(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_provider_upcoming_payouts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_upcoming_payouts() TO authenticated;
