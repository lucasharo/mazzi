-- Never erase a previous contestation response when the Admin requests more information.
-- Additional responses are appended to the existing text until a dedicated message
-- history table is introduced.

CREATE OR REPLACE FUNCTION public.request_booking_dispute_information(p_dispute_id UUID, p_requested_from TEXT, p_request TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_dispute public.booking_disputes%ROWTYPE; v_hours INTEGER; v_status VARCHAR(40);
BEGIN
  IF NOT public.current_user_has_permission('admin.finance.read_all'::public.app_permission) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF upper(p_requested_from) NOT IN ('STUDENT','PROVIDER') OR length(btrim(p_request))<5 THEN RAISE EXCEPTION 'INVALID_INFORMATION_REQUEST' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id FOR UPDATE;
  IF NOT FOUND OR v_dispute.status IN ('RESOLVED','CANCELLED') THEN RAISE EXCEPTION 'DISPUTE_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  SELECT COALESCE((value->>'contestation_response_hours')::INTEGER,72) INTO v_hours FROM public.platform_configurations WHERE key='platform_operations';
  v_status := CASE WHEN upper(p_requested_from)='STUDENT' THEN 'AWAITING_STUDENT_RESPONSE' ELSE 'AWAITING_PROVIDER_RESPONSE' END;
  UPDATE public.booking_disputes
  SET status=v_status, information_request=btrim(p_request), response_by=NULL, responded_at=NULL,
      response_due_at=NOW()+make_interval(hours=>v_hours), updated_at=NOW()
  WHERE id=p_dispute_id RETURNING * INTO v_dispute;
  RETURN to_jsonb(v_dispute);
END; $$;
REVOKE ALL ON FUNCTION public.request_booking_dispute_information(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_booking_dispute_information(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_booking_dispute(p_dispute_id UUID, p_response_text TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_uid UUID:=auth.uid(); v_dispute public.booking_disputes%ROWTYPE; v_booking public.bookings%ROWTYPE; v_provider_user UUID; v_allowed BOOLEAN:=false; v_response TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=v_dispute.booking_id;
  SELECT user_id INTO v_provider_user FROM public.providers WHERE id=v_booking.provider_id;
  IF v_dispute.status='AWAITING_STUDENT_RESPONSE' THEN v_allowed:=v_uid=v_booking.student_id;
  ELSIF v_dispute.status='AWAITING_PROVIDER_RESPONSE' THEN v_allowed:=v_uid=v_provider_user;
  ELSE v_allowed:=v_dispute.status='OPEN' AND v_uid<>v_dispute.opened_by AND v_uid IN (v_booking.student_id,v_provider_user); END IF;
  IF NOT v_allowed THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF v_dispute.status NOT IN ('OPEN','AWAITING_STUDENT_RESPONSE','AWAITING_PROVIDER_RESPONSE') THEN RAISE EXCEPTION 'DISPUTE_NOT_AWAITING_RESPONSE' USING ERRCODE='22000'; END IF;
  IF NOW()>v_dispute.response_due_at THEN RAISE EXCEPTION 'DISPUTE_RESPONSE_DEADLINE_EXPIRED' USING ERRCODE='22000'; END IF;
  v_response := CASE WHEN NULLIF(btrim(v_dispute.response_text),'') IS NULL THEN btrim(p_response_text) ELSE v_dispute.response_text || E'\n\nResposta complementar:\n' || btrim(p_response_text) END;
  UPDATE public.booking_disputes SET response_by=v_uid,response_text=v_response,responded_at=NOW(),status='UNDER_REVIEW',information_request=NULL,updated_at=NOW() WHERE id=p_dispute_id RETURNING * INTO v_dispute;
  RETURN to_jsonb(v_dispute);
END; $$;
REVOKE ALL ON FUNCTION public.respond_booking_dispute(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_booking_dispute(UUID,TEXT) TO authenticated;
