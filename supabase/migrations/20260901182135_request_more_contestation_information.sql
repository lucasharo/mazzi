ALTER TABLE public.booking_disputes ADD COLUMN IF NOT EXISTS information_requested_from TEXT CHECK (information_requested_from IN ('STUDENT','PROVIDER'));
ALTER TABLE public.booking_disputes ADD COLUMN IF NOT EXISTS information_request TEXT;

CREATE OR REPLACE FUNCTION public.request_booking_dispute_information(p_dispute_id UUID, p_requested_from TEXT, p_request TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_dispute public.booking_disputes%ROWTYPE; v_hours INTEGER;
BEGIN
  IF NOT public.current_user_has_permission('admin.finance.read_all'::public.app_permission) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF upper(p_requested_from) NOT IN ('STUDENT','PROVIDER') OR length(btrim(p_request)) < 5 THEN RAISE EXCEPTION 'INVALID_INFORMATION_REQUEST' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id FOR UPDATE;
  IF NOT FOUND OR v_dispute.status IN ('RESOLVED','CANCELLED') THEN RAISE EXCEPTION 'DISPUTE_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  SELECT COALESCE((value->>'contestation_response_hours')::INTEGER,72) INTO v_hours FROM public.platform_configurations WHERE key='platform_operations';
  UPDATE public.booking_disputes SET status='AWAITING_RESPONSE',information_requested_from=upper(p_requested_from),information_request=btrim(p_request),response_by=NULL,response_text=NULL,responded_at=NULL,response_due_at=NOW()+make_interval(hours=>v_hours),updated_at=NOW() WHERE id=p_dispute_id RETURNING * INTO v_dispute;
  RETURN to_jsonb(v_dispute);
END; $$;
REVOKE ALL ON FUNCTION public.request_booking_dispute_information(UUID,TEXT,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_booking_dispute_information(UUID,TEXT,TEXT) TO authenticated;
