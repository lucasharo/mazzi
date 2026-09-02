CREATE OR REPLACE FUNCTION public.respond_booking_dispute(p_dispute_id UUID, p_response_text TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_uid UUID:=auth.uid(); v_dispute public.booking_disputes%ROWTYPE; v_booking public.bookings%ROWTYPE; v_provider_user UUID; v_allowed BOOLEAN:=false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_dispute FROM public.booking_disputes WHERE id=p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id=v_dispute.booking_id;
  SELECT user_id INTO v_provider_user FROM public.providers WHERE id=v_booking.provider_id;
  IF v_dispute.information_requested_from='STUDENT' THEN v_allowed:=v_uid=v_booking.student_id; ELSIF v_dispute.information_requested_from='PROVIDER' THEN v_allowed:=v_uid=v_provider_user; ELSE v_allowed:=v_uid<>v_dispute.opened_by AND v_uid IN (v_booking.student_id,v_provider_user); END IF;
  IF NOT v_allowed THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF v_dispute.status NOT IN ('OPEN','AWAITING_RESPONSE') THEN RAISE EXCEPTION 'DISPUTE_NOT_AWAITING_RESPONSE' USING ERRCODE='22000'; END IF;
  IF NOW()>v_dispute.response_due_at THEN RAISE EXCEPTION 'DISPUTE_RESPONSE_DEADLINE_EXPIRED' USING ERRCODE='22000'; END IF;
  UPDATE public.booking_disputes SET response_by=v_uid,response_text=btrim(p_response_text),responded_at=NOW(),status='UNDER_REVIEW',information_requested_from=NULL,information_request=NULL,updated_at=NOW() WHERE id=p_dispute_id RETURNING * INTO v_dispute;
  RETURN to_jsonb(v_dispute);
END; $$;
REVOKE ALL ON FUNCTION public.respond_booking_dispute(UUID,TEXT) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_booking_dispute(UUID,TEXT) TO authenticated;
