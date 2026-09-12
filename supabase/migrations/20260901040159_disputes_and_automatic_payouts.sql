-- Disputas operacionais MAZZI e repasses automáticos Stripe Connect.
-- Valores monetários permanecem em centavos inteiros. O banco é a fonte da verdade.

-- pg_cron é provisionado pela plataforma Supabase. Não tentamos reinstalá-lo,
-- pois os privilégios internos são gerenciados pelo serviço hospedado.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.provider_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  gateway VARCHAR(50) NOT NULL,
  external_account_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id,gateway)
);
ALTER TABLE public.provider_payment_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS provider_payment_accounts_owner_select ON public.provider_payment_accounts;
CREATE POLICY provider_payment_accounts_owner_select ON public.provider_payment_accounts
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.providers p WHERE p.id=provider_id AND p.user_id=(SELECT auth.uid()))
  OR public.current_user_has_permission('admin.finance.read_all'::public.app_permission)
);

INSERT INTO public.platform_configurations (key, value, updated_at)
VALUES ('platform_operations', jsonb_build_object('payout_safety_period_hours', 72), NOW())
ON CONFLICT (key) DO UPDATE
SET value = CASE
  WHEN public.platform_configurations.value ? 'payout_safety_period_hours'
    THEN public.platform_configurations.value
  ELSE public.platform_configurations.value || jsonb_build_object('payout_safety_period_hours', 72)
END,
updated_at = NOW();

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0 CHECK (processing_attempts >= 0),
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.booking_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  opened_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  opened_by_role VARCHAR(20) NOT NULL CHECK (opened_by_role IN ('STUDENT', 'PROVIDER')),
  reason_code VARCHAR(60) NOT NULL CHECK (reason_code IN (
    'PROVIDER_NO_SHOW', 'STUDENT_NO_SHOW', 'LESSON_NOT_DELIVERED',
    'TIME_MISMATCH', 'MEETING_POINT_MISMATCH', 'SERVICE_MISMATCH',
    'SAFETY_CONCERN', 'OTHER'
  )),
  description TEXT NOT NULL CHECK (length(btrim(description)) BETWEEN 10 AND 4000),
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN (
    'OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW', 'RESOLVED', 'CANCELLED'
  )),
  response_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  response_text TEXT CHECK (response_text IS NULL OR length(btrim(response_text)) BETWEEN 10 AND 4000),
  responded_at TIMESTAMPTZ,
  resolution_code VARCHAR(40) CHECK (resolution_code IS NULL OR resolution_code IN (
    'NO_ACTION', 'FULL_REFUND', 'PARTIAL_REFUND', 'RELEASE_PAYOUT', 'RESCHEDULE'
  )),
  resolution_notes TEXT,
  refund_amount_in_cents INTEGER CHECK (refund_amount_in_cents IS NULL OR refund_amount_in_cents >= 0),
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  response_due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_disputes_one_active_per_booking
  ON public.booking_disputes (booking_id)
  WHERE status IN ('OPEN', 'AWAITING_RESPONSE', 'UNDER_REVIEW');
CREATE INDEX IF NOT EXISTS booking_disputes_status_created_idx
  ON public.booking_disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_disputes_opened_by_idx
  ON public.booking_disputes (opened_by);
CREATE INDEX IF NOT EXISTS booking_disputes_response_by_idx
  ON public.booking_disputes (response_by) WHERE response_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_disputes_resolved_by_idx
  ON public.booking_disputes (resolved_by) WHERE resolved_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.booking_dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.booking_disputes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL CHECK (length(btrim(storage_path)) > 0),
  evidence_type VARCHAR(30) NOT NULL DEFAULT 'DOCUMENT' CHECK (evidence_type IN ('IMAGE', 'DOCUMENT', 'LOCATION', 'OTHER')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS booking_dispute_evidence_dispute_idx
  ON public.booking_dispute_evidence (dispute_id);
CREATE INDEX IF NOT EXISTS booking_dispute_evidence_uploaded_by_idx
  ON public.booking_dispute_evidence (uploaded_by);

ALTER TABLE public.booking_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_dispute_evidence ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.booking_disputes TO authenticated;
GRANT SELECT ON public.booking_dispute_evidence TO authenticated;

DROP POLICY IF EXISTS booking_disputes_participant_select ON public.booking_disputes;
CREATE POLICY booking_disputes_participant_select ON public.booking_disputes
FOR SELECT TO authenticated USING (
  opened_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.providers pr ON pr.id = b.provider_id
    WHERE b.id = booking_id
      AND (b.student_id = (SELECT auth.uid()) OR pr.user_id = (SELECT auth.uid()))
  )
  OR public.current_user_has_permission('admin.finance.read_all'::public.app_permission)
);

DROP POLICY IF EXISTS booking_dispute_evidence_participant_select ON public.booking_dispute_evidence;
CREATE POLICY booking_dispute_evidence_participant_select ON public.booking_dispute_evidence
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.booking_disputes d
    JOIN public.bookings b ON b.id = d.booking_id
    JOIN public.providers pr ON pr.id = b.provider_id
    WHERE d.id = dispute_id
      AND (b.student_id = (SELECT auth.uid()) OR pr.user_id = (SELECT auth.uid())
        OR public.current_user_has_permission('admin.finance.read_all'::public.app_permission))
  )
);

-- Escritas ocorrem somente por RPCs validadas. Nenhuma política INSERT/UPDATE/DELETE direta.

CREATE OR REPLACE FUNCTION public.get_payout_safety_period_hours()
RETURNS INTEGER LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT GREATEST(0, COALESCE((
    SELECT (value->>'payout_safety_period_hours')::INTEGER
    FROM public.platform_configurations WHERE key = 'platform_operations'
  ), 72));
$$;
REVOKE ALL ON FUNCTION public.get_payout_safety_period_hours() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payout_safety_period_hours() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_booking_payout(p_booking_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_account public.provider_payment_accounts%ROWTYPE;
  v_gateway_fee INTEGER;
  v_amount INTEGER;
  v_release_at TIMESTAMPTZ;
  v_payout_id UUID;
  v_has_dispute BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.status NOT IN ('COMPLETED', 'DISPUTED') THEN RETURN NULL; END IF;

  SELECT * INTO v_payment FROM public.payments
   WHERE booking_id = p_booking_id AND status = 'PAID'
   ORDER BY paid_at DESC NULLS LAST, created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_account FROM public.provider_payment_accounts
   WHERE provider_id = v_booking.provider_id AND gateway = 'STRIPE'
   ORDER BY updated_at DESC LIMIT 1;

  v_gateway_fee := GREATEST(0, COALESCE(v_payment.gateway_fee_in_cents, 0));
  v_amount := GREATEST(0, v_booking.total_in_cents - v_booking.platform_fee_in_cents - v_gateway_fee);
  v_release_at := COALESCE(v_booking.completed_at, v_booking.lesson_finished_at, v_booking.updated_at)
    + make_interval(hours => public.get_payout_safety_period_hours());
  SELECT EXISTS (SELECT 1 FROM public.booking_disputes WHERE booking_id = p_booking_id AND status IN ('OPEN','AWAITING_RESPONSE','UNDER_REVIEW')) INTO v_has_dispute;

  INSERT INTO public.payouts (
    provider_id, booking_id, amount_in_cents, status, scheduled_release_at,
    idempotency_key, gross_amount_in_cents, platform_fee_in_cents,
    gateway_fee_in_cents, gateway_fee_source, transfer_method,
    destination_key_type, destination_key, destination_key_masked,
    recipient_name, updated_at
  ) VALUES (
    v_booking.provider_id, p_booking_id, v_amount,
    CASE
      WHEN v_has_dispute THEN 'BLOCKED'::public.payout_status
      WHEN v_account.id IS NULL OR v_account.status <> 'ACTIVE' OR NOT v_account.payouts_enabled THEN 'BLOCKED'::public.payout_status
      ELSE 'PENDING'::public.payout_status
    END,
    v_release_at, 'stripe-transfer:' || p_booking_id, v_booking.total_in_cents,
    v_booking.platform_fee_in_cents, v_gateway_fee,
    CASE WHEN v_payment.gateway_fee_in_cents IS NULL THEN 'CONFIGURED_ESTIMATE' ELSE 'GATEWAY_RESPONSE' END,
    'STRIPE_CONNECT', 'STRIPE_ACCOUNT', v_account.external_account_id,
    CASE WHEN v_account.external_account_id IS NULL THEN NULL ELSE 'acct_…' || right(v_account.external_account_id, 6) END,
    NULL, NOW()
  ) ON CONFLICT (booking_id) DO UPDATE SET
    amount_in_cents = EXCLUDED.amount_in_cents,
    scheduled_release_at = EXCLUDED.scheduled_release_at,
    status = CASE WHEN public.payouts.status IN ('PAID','PROCESSING') THEN public.payouts.status ELSE EXCLUDED.status END,
    destination_key = EXCLUDED.destination_key,
    destination_key_masked = EXCLUDED.destination_key_masked,
    transfer_method = EXCLUDED.transfer_method,
    updated_at = NOW()
  RETURNING id INTO v_payout_id;

  RETURN v_payout_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_booking_payout(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_booking_payout(UUID) TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.create_payout_after_lesson_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.ensure_booking_payout(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.create_payout_after_lesson_completion() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS create_payout_after_lesson_completion ON public.bookings;
CREATE TRIGGER create_payout_after_lesson_completion
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.create_payout_after_lesson_completion();

CREATE OR REPLACE FUNCTION public.reschedule_pending_payouts_after_config_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
BEGIN
  IF NEW.key='platform_operations' AND (OLD.value->>'payout_safety_period_hours') IS DISTINCT FROM (NEW.value->>'payout_safety_period_hours') THEN
    UPDATE public.payouts po SET
      scheduled_release_at=COALESCE(b.completed_at,b.lesson_finished_at,b.updated_at)+make_interval(hours=>public.get_payout_safety_period_hours()),
      next_retry_at=NULL, updated_at=NOW()
    FROM public.bookings b WHERE b.id=po.booking_id AND po.status IN ('PENDING','FAILED','BLOCKED');
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.reschedule_pending_payouts_after_config_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reschedule_pending_payouts_after_config_change ON public.platform_configurations;
CREATE TRIGGER reschedule_pending_payouts_after_config_change
AFTER UPDATE OF value ON public.platform_configurations
FOR EACH ROW EXECUTE FUNCTION public.reschedule_pending_payouts_after_config_change();

CREATE OR REPLACE FUNCTION public.open_booking_dispute(
  p_booking_id UUID, p_reason_code VARCHAR, p_description TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_provider_user UUID;
  v_role VARCHAR(20);
  v_deadline TIMESTAMPTZ;
  v_dispute public.booking_disputes%ROWTYPE;
  v_payout public.payouts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT b.* INTO v_booking FROM public.bookings b WHERE b.id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT pr.user_id INTO v_provider_user FROM public.providers pr WHERE pr.id = v_booking.provider_id;
  IF v_booking.student_id = v_uid THEN v_role := 'STUDENT';
  ELSIF v_provider_user = v_uid THEN v_role := 'PROVIDER';
  ELSE RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF v_booking.status <> 'COMPLETED' THEN RAISE EXCEPTION 'BOOKING_NOT_COMPLETED' USING ERRCODE = '22000'; END IF;

  v_deadline := COALESCE(v_booking.completed_at, v_booking.lesson_finished_at, v_booking.updated_at)
    + make_interval(hours => public.get_payout_safety_period_hours());
  IF clock_timestamp() > v_deadline THEN RAISE EXCEPTION 'DISPUTE_WINDOW_EXPIRED' USING ERRCODE = '22000'; END IF;
  IF upper(btrim(COALESCE(p_reason_code,''))) NOT IN ('PROVIDER_NO_SHOW','STUDENT_NO_SHOW','LESSON_NOT_DELIVERED','TIME_MISMATCH','MEETING_POINT_MISMATCH','SERVICE_MISMATCH','SAFETY_CONCERN','OTHER') THEN
    RAISE EXCEPTION 'INVALID_DISPUTE_REASON' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.booking_disputes (booking_id, opened_by, opened_by_role, reason_code, description, status)
  VALUES (p_booking_id, v_uid, v_role, upper(btrim(p_reason_code)), btrim(p_description), 'AWAITING_RESPONSE')
  RETURNING * INTO v_dispute;

  SELECT * INTO v_payout FROM public.payouts WHERE booking_id = p_booking_id FOR UPDATE;
  IF FOUND AND v_payout.status IN ('PENDING','AVAILABLE','FAILED') THEN
    UPDATE public.payouts SET status = 'BLOCKED', failure_reason = 'DISPUTE_OPEN', updated_at = NOW() WHERE id = v_payout.id;
  END IF;
  UPDATE public.bookings SET status = 'DISPUTED', updated_at = NOW() WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (gen_random_uuid(), v_uid, 'BOOKING_DISPUTE_OPENED', 'BookingDispute', v_dispute.id,
    jsonb_build_object('booking_status','COMPLETED'),
    jsonb_build_object('booking_status','DISPUTED','reason_code',v_dispute.reason_code,'payout_status','BLOCKED'), NOW());
  RETURN to_jsonb(v_dispute);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'ACTIVE_DISPUTE_ALREADY_EXISTS' USING ERRCODE = '23505';
END;
$$;
REVOKE ALL ON FUNCTION public.open_booking_dispute(UUID,VARCHAR,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_booking_dispute(UUID,VARCHAR,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_booking_dispute(p_dispute_id UUID, p_response_text TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID := auth.uid(); v_dispute public.booking_disputes%ROWTYPE; v_booking public.bookings%ROWTYPE; v_provider_user UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=v_dispute.booking_id;
  SELECT user_id INTO v_provider_user FROM public.providers WHERE id=v_booking.provider_id;
  IF v_uid = v_dispute.opened_by OR v_uid NOT IN (v_booking.student_id, v_provider_user) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF v_dispute.status NOT IN ('OPEN','AWAITING_RESPONSE') THEN RAISE EXCEPTION 'DISPUTE_NOT_AWAITING_RESPONSE' USING ERRCODE='22000'; END IF;
  UPDATE public.booking_disputes SET response_by=v_uid, response_text=btrim(p_response_text), responded_at=NOW(), status='UNDER_REVIEW', updated_at=NOW() WHERE id=p_dispute_id RETURNING * INTO v_dispute;
  RETURN to_jsonb(v_dispute);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_booking_dispute(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_booking_dispute(UUID,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_booking_dispute(
  p_dispute_id UUID, p_resolution_code VARCHAR, p_resolution_notes TEXT,
  p_refund_amount_in_cents INTEGER DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID:=auth.uid(); v_dispute public.booking_disputes%ROWTYPE; v_booking public.bookings%ROWTYPE; v_payout public.payouts%ROWTYPE; v_resolution VARCHAR:=upper(btrim(p_resolution_code));
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.finance.read_all'::public.app_permission) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_dispute.status IN ('RESOLVED','CANCELLED') THEN RETURN to_jsonb(v_dispute) || jsonb_build_object('is_idempotent',true); END IF;
  IF v_resolution NOT IN ('NO_ACTION','FULL_REFUND','PARTIAL_REFUND','RELEASE_PAYOUT','RESCHEDULE') THEN RAISE EXCEPTION 'INVALID_RESOLUTION' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=v_dispute.booking_id FOR UPDATE;
  SELECT * INTO v_payout FROM public.payouts WHERE booking_id=v_dispute.booking_id FOR UPDATE;
  IF v_resolution='PARTIAL_REFUND' AND (p_refund_amount_in_cents IS NULL OR p_refund_amount_in_cents <= 0 OR p_refund_amount_in_cents >= v_booking.total_in_cents) THEN RAISE EXCEPTION 'INVALID_PARTIAL_REFUND_AMOUNT' USING ERRCODE='22023'; END IF;
  UPDATE public.booking_disputes SET status='RESOLVED', resolution_code=v_resolution, resolution_notes=btrim(p_resolution_notes), refund_amount_in_cents=CASE WHEN v_resolution='FULL_REFUND' THEN v_booking.total_in_cents WHEN v_resolution='PARTIAL_REFUND' THEN p_refund_amount_in_cents ELSE 0 END, resolved_by=v_uid, resolved_at=NOW(), updated_at=NOW() WHERE id=p_dispute_id RETURNING * INTO v_dispute;
  UPDATE public.bookings SET status=CASE WHEN v_resolution IN ('FULL_REFUND','PARTIAL_REFUND') THEN 'REFUNDED'::public.booking_status ELSE 'COMPLETED'::public.booking_status END, updated_at=NOW() WHERE id=v_booking.id;
  IF FOUND AND v_payout.id IS NOT NULL THEN
    UPDATE public.payouts SET status=CASE WHEN v_resolution IN ('NO_ACTION','RELEASE_PAYOUT') THEN 'PENDING'::public.payout_status ELSE 'BLOCKED'::public.payout_status END, failure_reason=CASE WHEN v_resolution IN ('NO_ACTION','RELEASE_PAYOUT') THEN NULL ELSE 'DISPUTE_RESOLUTION_'||v_resolution END, updated_at=NOW() WHERE id=v_payout.id AND status <> 'PAID';
  END IF;
  INSERT INTO public.audit_logs(id,actor_id,action,entity_type,entity_id,previous_value,new_value,created_at) VALUES(gen_random_uuid(),v_uid,'BOOKING_DISPUTE_RESOLVED','BookingDispute',p_dispute_id,jsonb_build_object('status',v_dispute.status),jsonb_build_object('resolution_code',v_resolution,'refund_amount_in_cents',v_dispute.refund_amount_in_cents),NOW());
  RETURN to_jsonb(v_dispute) || jsonb_build_object('is_idempotent',false);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_booking_dispute(UUID,VARCHAR,TEXT,INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_booking_dispute(UUID,VARCHAR,TEXT,INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_due_stripe_payouts(p_limit INTEGER DEFAULT 25)
RETURNS TABLE(payout_id UUID, booking_id UUID, amount_in_cents INTEGER, stripe_account_id TEXT, idempotency_key VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  WITH candidates AS (
    SELECT po.id FROM public.payouts po
    WHERE po.status IN ('PENDING','FAILED') AND po.scheduled_release_at <= NOW()
      AND po.processing_attempts < 5 AND (po.next_retry_at IS NULL OR po.next_retry_at <= NOW())
      AND po.transfer_method='STRIPE_CONNECT' AND NULLIF(po.destination_key,'') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.booking_disputes d WHERE d.booking_id=po.booking_id AND d.status IN ('OPEN','AWAITING_RESPONSE','UNDER_REVIEW'))
    ORDER BY po.scheduled_release_at FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),100)
  ), claimed AS (
    UPDATE public.payouts po SET status='PROCESSING', processed_at=NOW(), processing_attempts=po.processing_attempts+1, failure_reason=NULL, updated_at=NOW()
    FROM candidates c WHERE po.id=c.id RETURNING po.*
  )
  SELECT c.id,c.booking_id,c.amount_in_cents,c.destination_key,c.idempotency_key FROM claimed c;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_due_stripe_payouts(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_stripe_payouts(INTEGER) TO service_role;

DO $create_cron_secret$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='payout_cron_token') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32),'hex'),'payout_cron_token','Token interno do processador automático de repasses MAZZI');
  END IF;
END;
$create_cron_secret$;

CREATE OR REPLACE FUNCTION public.verify_payout_cron_token(p_token TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path TO public, vault, pg_temp AS $$
  SELECT current_user IN ('service_role','postgres') AND
    encode(extensions.digest(convert_to(COALESCE(p_token,''),'UTF8'),'sha256'),'hex') = encode(extensions.digest(convert_to(COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='payout_cron_token' LIMIT 1),''),'UTF8'),'sha256'),'hex');
$$;
REVOKE ALL ON FUNCTION public.verify_payout_cron_token(TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payout_cron_token(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_stripe_payout(p_payout_id UUID,p_external_transfer_id TEXT,p_success BOOLEAN,p_failure_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp
AS $$
DECLARE v_row public.payouts%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_row FROM public.payouts WHERE id=p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYOUT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_row.status='PAID' THEN RETURN jsonb_build_object('success',true,'is_idempotent',true); END IF;
  UPDATE public.payouts SET status=CASE WHEN p_success THEN 'PAID'::public.payout_status ELSE 'FAILED'::public.payout_status END, external_payout_id=CASE WHEN p_success THEN p_external_transfer_id ELSE external_payout_id END, transfer_reference=CASE WHEN p_success THEN p_external_transfer_id ELSE transfer_reference END, released_at=CASE WHEN p_success THEN NOW() ELSE released_at END, next_retry_at=CASE WHEN p_success THEN NULL WHEN processing_attempts < 5 THEN NOW()+INTERVAL '15 minutes' ELSE NULL END, failure_reason=CASE WHEN p_success THEN NULL ELSE left(COALESCE(p_failure_reason,'STRIPE_TRANSFER_FAILED'),1000) END, updated_at=NOW() WHERE id=p_payout_id;
  -- Some legacy environments do not yet have the optional financial ledger.
  -- Keep payout finalization functional there; audit_logs remains mandatory.
  IF to_regclass('public.financial_events') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.financial_events(event_type,booking_id,provider_id,amount_in_cents,provider_amount_in_cents,metadata) VALUES($1,$2,$3,$4,$5,$6)'
      USING CASE WHEN p_success THEN 'PAYOUT_PAID' ELSE 'PAYOUT_HELD' END,
        v_row.booking_id, v_row.provider_id, v_row.amount_in_cents, v_row.amount_in_cents,
        jsonb_build_object('payout_id',p_payout_id,'stripe_transfer_id',p_external_transfer_id,'failure_reason',p_failure_reason);
  END IF;
  RETURN jsonb_build_object('success',p_success,'is_idempotent',false,'payout_id',p_payout_id);
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_stripe_payout(UUID,TEXT,BOOLEAN,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_stripe_payout(UUID,TEXT,BOOLEAN,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_booking_disputes()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path TO public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.created_at DESC),'[]'::jsonb) FROM public.booking_disputes d;
$$;
REVOKE ALL ON FUNCTION public.get_my_booking_disputes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_booking_disputes() TO authenticated;

-- Mantém a preparação de repasses independente da abertura do painel Admin.
CREATE OR REPLACE FUNCTION public.prepare_missing_completed_booking_payouts()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_booking_id UUID; v_count INTEGER:=0;
BEGIN
  FOR v_booking_id IN SELECT b.id FROM public.bookings b WHERE b.status='COMPLETED' AND NOT EXISTS (SELECT 1 FROM public.payouts po WHERE po.booking_id=b.id) LOOP
    IF public.ensure_booking_payout(v_booking_id) IS NOT NULL THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.prepare_missing_completed_booking_payouts() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.prepare_missing_completed_booking_payouts() TO postgres;

DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='prepare-automatic-payouts';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('prepare-automatic-payouts','* * * * *',$$SELECT public.prepare_missing_completed_booking_payouts();$$);

-- Agenda o processador HTTP quando os segredos recomendados pela documentação
-- do Supabase já estiverem no Vault. O deploy configura esses segredos antes de
-- aplicar esta migração no ambiente hospedado.
DO $schedule_processor$
DECLARE v_project_url TEXT; v_cron_token TEXT;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name='project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_cron_token FROM vault.decrypted_secrets WHERE name='payout_cron_token' LIMIT 1;
  IF NULLIF(v_project_url,'') IS NOT NULL AND NULLIF(v_cron_token,'') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='process-automatic-stripe-payouts';
    PERFORM cron.schedule(
      'process-automatic-stripe-payouts', '* * * * *',
      $job$SELECT net.http_post(
        url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='project_url' LIMIT 1),'/') || '/functions/v1/process-automatic-stripe-payouts',
        headers := jsonb_build_object('Content-Type','application/json','x-mazzi-cron-token',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='payout_cron_token' LIMIT 1)),
        body := jsonb_build_object('scheduled_at',NOW()), timeout_milliseconds := 30000
      );$job$
    );
  END IF;
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN
  RAISE NOTICE 'Vault não disponível; configure o job process-automatic-stripe-payouts pelo Dashboard.';
END;
$schedule_processor$;

-- O painel Admin passa a ser somente leitura: abrir a tela financeira não cria
-- nem altera repasses. A criação é feita pelo trigger/job acima.
CREATE OR REPLACE FUNCTION public.get_admin_payouts()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE v_uid UUID:=auth.uid(); v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.current_user_has_permission('admin.finance.read_all'::public.app_permission) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',po.id,'provider_id',po.provider_id,'booking_id',po.booking_id,
    'amount_in_cents',po.amount_in_cents,'status',po.status,
    'scheduled_release_at',po.scheduled_release_at,'released_at',po.released_at,
    'external_payout_id',po.external_payout_id,'idempotency_key',po.idempotency_key,
    'gross_amount_in_cents',po.gross_amount_in_cents,'platform_fee_in_cents',po.platform_fee_in_cents,
    'gateway_fee_in_cents',po.gateway_fee_in_cents,'gateway_fee_source',po.gateway_fee_source,
    'transfer_method',po.transfer_method,'destination_key_type',po.destination_key_type,
    'destination_key_masked',po.destination_key_masked,'recipient_name',po.recipient_name,
    'recipient_document',po.recipient_document,'transfer_reference',po.transfer_reference,
    'processed_at',po.processed_at,'failure_reason',po.failure_reason,
    'processing_attempts',po.processing_attempts,'next_retry_at',po.next_retry_at,
    'provider_name',COALESCE(pr.trade_name,pr.legal_name,'Prestador'),
    'has_active_dispute',EXISTS(SELECT 1 FROM public.booking_disputes d WHERE d.booking_id=po.booking_id AND d.status IN ('OPEN','AWAITING_RESPONSE','UNDER_REVIEW')),
    'created_at',po.created_at,'updated_at',po.updated_at
  ) ORDER BY po.scheduled_release_at DESC),'[]'::jsonb) INTO v_result
  FROM public.payouts po JOIN public.providers pr ON pr.id=po.provider_id;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_payouts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_payouts() TO authenticated;
