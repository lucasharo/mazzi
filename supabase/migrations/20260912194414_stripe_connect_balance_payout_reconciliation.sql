-- Reconcile the two distinct Stripe Connect legs without creating bank payouts
-- from MAZZI. scheduled_release_at/released_at remain MAZZI-controlled; the
-- columns below belong exclusively to the connected-account payout lifecycle.
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS stripe_balance_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_available_on TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_payout_status TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payout_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_failure_code TEXT,
  ADD COLUMN IF NOT EXISTS stripe_failure_message TEXT;

CREATE INDEX IF NOT EXISTS idx_payouts_stripe_available_on
  ON public.payouts (stripe_available_on)
  WHERE stripe_available_on IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payouts_transfer_reconciliation
  ON public.payouts (destination_key, transfer_reference)
  WHERE transfer_reference IS NOT NULL AND external_payout_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payouts_external_payout_id
  ON public.payouts (external_payout_id)
  WHERE external_payout_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_stripe_transfer(
  p_payout_id UUID, p_stripe_transfer_id TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_row public.payouts%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_stripe_transfer_id IS NULL OR p_stripe_transfer_id !~ '^tr_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'STRIPE_TRANSFER_ID_INVALID' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.payouts WHERE id=p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_row.transfer_reference IS NOT NULL AND v_row.transfer_reference <> p_stripe_transfer_id THEN
    RAISE EXCEPTION 'STRIPE_TRANSFER_CONFLICT' USING ERRCODE='23505';
  END IF;
  IF v_row.status='PAID' AND v_row.transfer_reference = p_stripe_transfer_id THEN
    RETURN jsonb_build_object('success',true,'is_idempotent',true,'status','PAID','transfer_id',p_stripe_transfer_id);
  END IF;
  UPDATE public.payouts SET
    status=CASE WHEN status='PAID' THEN status ELSE 'PROCESSING'::public.payout_status END,
    transfer_reference=p_stripe_transfer_id,
    released_at=COALESCE(released_at,NOW()),
    failure_reason=NULL, next_retry_at=NULL, updated_at=NOW()
  WHERE id=p_payout_id;
  RETURN jsonb_build_object('success',true,'is_idempotent',false,'status','PROCESSING','transfer_id',p_stripe_transfer_id);
END; $$;
REVOKE ALL ON FUNCTION public.record_stripe_transfer(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_transfer(UUID,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.record_stripe_transfer_available_on(
  p_payout_id UUID, p_stripe_account_id TEXT, p_stripe_transfer_id TEXT,
  p_balance_transaction_id TEXT, p_available_on TIMESTAMPTZ
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_row public.payouts%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_stripe_account_id IS NULL OR p_stripe_account_id !~ '^acct_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'STRIPE_ACCOUNT_ID_INVALID' USING ERRCODE='22023'; END IF;
  IF p_stripe_transfer_id IS NULL OR p_stripe_transfer_id !~ '^tr_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'STRIPE_TRANSFER_ID_INVALID' USING ERRCODE='22023'; END IF;
  IF p_balance_transaction_id IS NULL OR p_balance_transaction_id !~ '^txn_[A-Za-z0-9]+$' OR p_available_on IS NULL THEN RAISE EXCEPTION 'STRIPE_BALANCE_TRANSACTION_INVALID' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.payouts WHERE id=p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_row.destination_key <> p_stripe_account_id OR v_row.transfer_reference <> p_stripe_transfer_id THEN RAISE EXCEPTION 'STRIPE_PAYOUT_ACCOUNT_MISMATCH' USING ERRCODE='42501'; END IF;
  IF v_row.stripe_balance_transaction_id IS NOT NULL AND v_row.stripe_balance_transaction_id <> p_balance_transaction_id THEN RAISE EXCEPTION 'STRIPE_BALANCE_TRANSACTION_CONFLICT' USING ERRCODE='23505'; END IF;
  UPDATE public.payouts SET stripe_balance_transaction_id=p_balance_transaction_id, stripe_available_on=COALESCE(stripe_available_on,p_available_on), updated_at=NOW() WHERE id=p_payout_id;
  RETURN jsonb_build_object('success',true,'is_idempotent',v_row.stripe_balance_transaction_id IS NOT NULL,'available_on',p_available_on,'balance_transaction_id',p_balance_transaction_id);
END; $$;
REVOKE ALL ON FUNCTION public.record_stripe_transfer_available_on(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_transfer_available_on(UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_stripe_transfer_reconciliation(p_limit INTEGER DEFAULT 25)
RETURNS TABLE(payout_id UUID, booking_id UUID, stripe_account_id TEXT, stripe_transfer_id TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT po.id,po.booking_id,po.destination_key,po.transfer_reference
    FROM public.payouts po
   WHERE po.status IN ('PROCESSING','PAID') AND po.transfer_reference ~ '^tr_[A-Za-z0-9]+$'
     AND po.external_payout_id IS NULL AND po.stripe_available_on IS NULL
     AND po.destination_key ~ '^acct_[A-Za-z0-9]+$'
   ORDER BY po.updated_at FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),100);
END; $$;
REVOKE ALL ON FUNCTION public.claim_stripe_transfer_reconciliation(INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_transfer_reconciliation(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.record_stripe_payout_status(
  p_payout_id UUID, p_stripe_payout_id TEXT, p_stripe_transfer_id TEXT,
  p_stripe_status TEXT, p_failure_code TEXT DEFAULT NULL,
  p_failure_message TEXT DEFAULT NULL, p_arrival_date TIMESTAMPTZ DEFAULT NULL,
  p_stripe_account_id TEXT DEFAULT NULL, p_balance_transaction_id TEXT DEFAULT NULL,
  p_stripe_available_on TIMESTAMPTZ DEFAULT NULL,
  p_payout_created_at TIMESTAMPTZ DEFAULT NULL, p_stripe_paid_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_row public.payouts%ROWTYPE; v_status public.payout_status; v_incoming TEXT; v_was_paid BOOLEAN; v_now TIMESTAMPTZ:=NOW();
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_stripe_payout_id IS NULL OR p_stripe_payout_id !~ '^po_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'STRIPE_PAYOUT_ID_INVALID' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_row FROM public.payouts WHERE id=p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF p_stripe_account_id IS NOT NULL AND v_row.destination_key <> p_stripe_account_id THEN RAISE EXCEPTION 'STRIPE_PAYOUT_ACCOUNT_MISMATCH' USING ERRCODE='42501'; END IF;
  IF p_stripe_transfer_id IS NOT NULL AND v_row.transfer_reference IS NOT NULL AND v_row.transfer_reference <> p_stripe_transfer_id THEN RAISE EXCEPTION 'STRIPE_TRANSFER_CONFLICT' USING ERRCODE='23505'; END IF;
  IF EXISTS (SELECT 1 FROM public.payouts other WHERE other.external_payout_id=p_stripe_payout_id AND other.id<>p_payout_id) THEN RAISE EXCEPTION 'STRIPE_PAYOUT_ALREADY_LINKED' USING ERRCODE='23505'; END IF;
  v_incoming:=lower(COALESCE(p_stripe_status,'pending'));
  v_status:=CASE WHEN v_incoming='paid' THEN 'PAID'::public.payout_status WHEN v_incoming IN ('failed','canceled') THEN 'FAILED'::public.payout_status ELSE 'PROCESSING'::public.payout_status END;
  v_was_paid:=v_row.status='PAID';
  IF v_was_paid AND v_status<>'PAID' THEN v_status:='PAID'::public.payout_status; END IF;
  UPDATE public.payouts SET
    status=v_status, external_payout_id=p_stripe_payout_id,
    transfer_reference=COALESCE(p_stripe_transfer_id,transfer_reference),
    stripe_payout_status=left(v_incoming,40),
    stripe_payout_created_at=COALESCE(p_payout_created_at,stripe_payout_created_at),
    stripe_arrival_date=COALESCE(p_arrival_date,stripe_arrival_date),
    stripe_balance_transaction_id=COALESCE(p_balance_transaction_id,stripe_balance_transaction_id),
    stripe_available_on=COALESCE(p_stripe_available_on,stripe_available_on),
    stripe_paid_at=CASE WHEN v_status='PAID' THEN COALESCE(p_stripe_paid_at,v_now,stripe_paid_at) ELSE stripe_paid_at END,
    stripe_failure_code=CASE WHEN v_incoming IN ('failed','canceled') THEN left(p_failure_code,120) ELSE stripe_failure_code END,
    stripe_failure_message=CASE WHEN v_incoming IN ('failed','canceled') THEN left(p_failure_message,1000) ELSE stripe_failure_message END,
    failure_reason=CASE WHEN v_incoming IN ('failed','canceled') THEN left(COALESCE(p_failure_message,p_failure_code,'STRIPE_PAYOUT_FAILED'),1000) WHEN v_status='PAID' THEN NULL ELSE failure_reason END,
    updated_at=v_now
  WHERE id=p_payout_id;
  IF v_status='PAID' AND NOT v_was_paid AND to_regclass('public.financial_events') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.financial_events(event_type,booking_id,provider_id,amount_in_cents,provider_amount_in_cents,metadata) VALUES($1,$2,$3,$4,$5,$6)'
      USING 'PAYOUT_PAID',v_row.booking_id,v_row.provider_id,v_row.amount_in_cents,v_row.amount_in_cents,
        jsonb_build_object('payout_id',p_payout_id,'stripe_payout_id',p_stripe_payout_id,'stripe_transfer_id',COALESCE(p_stripe_transfer_id,v_row.transfer_reference));
  END IF;
  RETURN jsonb_build_object('success',true,'status',v_status,'stripe_payout_id',p_stripe_payout_id,'arrival_date',p_arrival_date,'available_on',p_stripe_available_on);
END; $$;
REVOKE ALL ON FUNCTION public.record_stripe_payout_status(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_payout_status(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ) TO service_role;

-- Compatibility wrapper for older internal callers; it still derives and checks
-- the connected account from the payout row rather than trusting the caller.
CREATE OR REPLACE FUNCTION public.record_stripe_payout_status(
  p_payout_id UUID, p_stripe_payout_id TEXT, p_stripe_transfer_id TEXT,
  p_stripe_status TEXT, p_failure_reason TEXT DEFAULT NULL,
  p_arrival_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_account TEXT;
BEGIN
  SELECT destination_key INTO v_account FROM public.payouts WHERE id=p_payout_id;
  RETURN public.record_stripe_payout_status(p_payout_id,p_stripe_payout_id,p_stripe_transfer_id,p_stripe_status,NULL,p_failure_reason,p_arrival_date,v_account,NULL,NULL,NULL,NULL);
END; $$;
REVOKE ALL ON FUNCTION public.record_stripe_payout_status(UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_payout_status(UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_stripe_payout(p_payout_id UUID,p_external_transfer_id TEXT,p_success BOOLEAN,p_failure_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_success THEN RAISE EXCEPTION 'TRANSFER_MUST_BE_RECORDED_SEPARATELY' USING ERRCODE='22000'; END IF;
  UPDATE public.payouts SET status='FAILED', failure_reason=left(COALESCE(p_failure_reason,'STRIPE_TRANSFER_FAILED'),1000), next_retry_at=CASE WHEN processing_attempts<5 THEN NOW()+INTERVAL '15 minutes' ELSE NULL END, updated_at=NOW()
   WHERE id=p_payout_id AND status<>'PAID' AND external_payout_id IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'is_idempotent',true,'payout_id',p_payout_id); END IF;
  RETURN jsonb_build_object('success',false,'is_idempotent',false,'payout_id',p_payout_id,'status','FAILED');
END; $$;
REVOKE ALL ON FUNCTION public.finalize_stripe_payout(UUID,TEXT,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_stripe_payout(UUID,TEXT,BOOLEAN,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_provider_payout_detail(p_payout_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_uid UUID:=auth.uid(); v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN RAISE EXCEPTION 'PAYOUT_UNAVAILABLE' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('id',po.id,'status',po.status,'amount_in_cents',po.amount_in_cents,'scheduled_release_at',po.scheduled_release_at,'released_at',po.released_at,'stripe_available_on',po.stripe_available_on,'stripe_arrival_date',po.stripe_arrival_date,'stripe_payout_status',po.stripe_payout_status,'stripe_paid_at',po.stripe_paid_at,'failure_reason',CASE WHEN po.status::TEXT IN ('FAILED','BLOCKED') THEN po.failure_reason ELSE NULL END) INTO v_result
  FROM public.payouts po JOIN public.providers p ON p.id=po.provider_id
  WHERE po.id=p_payout_id AND ((p.type::TEXT='INSTRUCTOR' AND p.user_id=v_uid AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission)) OR (p.type::TEXT='DRIVING_SCHOOL' AND public.current_user_has_permission('school.finance.read'::public.app_permission) AND (p.user_id=v_uid OR EXISTS(SELECT 1 FROM public.driving_school_staff dss WHERE dss.school_id=p.id AND dss.user_id=v_uid AND dss.is_active IS TRUE))));
  IF v_result IS NULL THEN RAISE EXCEPTION 'PAYOUT_UNAVAILABLE' USING ERRCODE='42501'; END IF;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.get_my_provider_payout_detail(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_payout_detail(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_provider_upcoming_payouts()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_uid UUID:=auth.uid(); v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',po.id,
    'date',(COALESCE(po.stripe_arrival_date,po.stripe_available_on,po.scheduled_release_at) AT TIME ZONE 'America/Sao_Paulo')::DATE,
    'date_source',CASE WHEN po.stripe_arrival_date IS NOT NULL THEN 'STRIPE_ARRIVAL' WHEN po.stripe_available_on IS NOT NULL THEN 'STRIPE_AVAILABLE' ELSE 'MAZZI_RELEASE' END,
    'stripe_available_on',po.stripe_available_on,'stripe_arrival_date',po.stripe_arrival_date,
    'external_payout_id',po.external_payout_id,'stripe_payout_status',po.stripe_payout_status,
    'status',po.status,'amount_in_cents',po.amount_in_cents,
    'is_overdue',COALESCE(po.stripe_arrival_date,po.stripe_available_on,po.scheduled_release_at)<NOW(),
    'failure_reason',CASE WHEN po.status::TEXT='FAILED' THEN po.failure_reason ELSE NULL END
  ) ORDER BY COALESCE(po.stripe_arrival_date,po.stripe_available_on,po.scheduled_release_at)),'[]'::JSONB) INTO v_result
  FROM public.payouts po JOIN public.providers p ON p.id=po.provider_id
  WHERE COALESCE(po.stripe_arrival_date,po.stripe_available_on,po.scheduled_release_at)<NOW()+INTERVAL '7 days'
    AND po.status::TEXT IN ('PENDING','AVAILABLE','PROCESSING')
    AND ((p.type::TEXT='INSTRUCTOR' AND p.user_id=v_uid AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission)) OR (p.type::TEXT='DRIVING_SCHOOL' AND public.current_user_has_permission('school.finance.read'::public.app_permission) AND (p.user_id=v_uid OR EXISTS(SELECT 1 FROM public.driving_school_staff dss WHERE dss.school_id=p.id AND dss.user_id=v_uid AND dss.is_active IS TRUE))));
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.get_my_provider_upcoming_payouts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_upcoming_payouts() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_provider_completed_payouts()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public,pg_temp AS $$
DECLARE v_uid UUID:=auth.uid(); v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(items) ORDER BY items.stripe_paid_at DESC),'[]'::JSONB) INTO v_result FROM (
    SELECT po.id,po.booking_id,b.public_reference AS booking_reference,po.amount_in_cents,po.status::TEXT AS status,
      po.released_at,po.stripe_paid_at,po.stripe_arrival_date,po.stripe_available_on,po.scheduled_release_at,
      b.scheduled_start_at AS lesson_scheduled_at,b.status::TEXT AS booking_status
    FROM public.payouts po JOIN public.bookings b ON b.id=po.booking_id JOIN public.providers p ON p.id=po.provider_id
    WHERE po.status='PAID' AND po.stripe_paid_at IS NOT NULL AND b.status='COMPLETED'
      AND ((p.type::TEXT='INSTRUCTOR' AND p.user_id=v_uid AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission)) OR (p.type::TEXT='DRIVING_SCHOOL' AND public.current_user_has_permission('school.finance.read'::public.app_permission) AND (p.user_id=v_uid OR EXISTS(SELECT 1 FROM public.driving_school_staff dss WHERE dss.school_id=p.id AND dss.user_id=v_uid AND dss.is_active IS TRUE))))
    ORDER BY po.stripe_paid_at DESC LIMIT 20
  ) items;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.get_my_provider_completed_payouts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_completed_payouts() TO authenticated;
