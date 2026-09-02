-- Fix historical response authors using the actual participant who sent them.
UPDATE public.booking_dispute_messages m
SET author_role = CASE WHEN m.author_id=b.student_id THEN 'STUDENT' ELSE 'PROVIDER' END
FROM public.booking_disputes d
JOIN public.bookings b ON b.id=d.booking_id
WHERE m.dispute_id=d.id AND m.message_type='RESPONSE' AND m.author_id IS NOT NULL;

-- Split legacy concatenated responses into independent messages.
INSERT INTO public.booking_dispute_messages(dispute_id,author_id,author_role,message_type,content,created_at)
SELECT m.dispute_id,m.author_id,m.author_role,'RESPONSE',btrim(split_part(m.content,E'\n\nResposta complementar:\n',2)),m.created_at
FROM public.booking_dispute_messages m
WHERE m.message_type='RESPONSE' AND m.content LIKE '%' || E'\n\nResposta complementar:\n' || '%';
UPDATE public.booking_dispute_messages
SET content=btrim(split_part(content,E'\n\nResposta complementar:\n',1))
WHERE message_type='RESPONSE' AND content LIKE '%' || E'\n\nResposta complementar:\n' || '%';

CREATE OR REPLACE FUNCTION public.capture_booking_dispute_message_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_role VARCHAR(20);
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.booking_dispute_messages(dispute_id,author_id,author_role,message_type,content,created_at) VALUES(NEW.id,NEW.opened_by,NEW.opened_by_role,'DESCRIPTION',NEW.description,NEW.created_at);
  ELSE
    IF NULLIF(btrim(NEW.information_request),'') IS DISTINCT FROM NULLIF(btrim(OLD.information_request),'') AND NULLIF(btrim(NEW.information_request),'') IS NOT NULL THEN
      INSERT INTO public.booking_dispute_messages(dispute_id,author_id,author_role,message_type,content) VALUES(NEW.id,auth.uid(),'ADMIN','INFORMATION_REQUEST',btrim(NEW.information_request));
    END IF;
    IF NULLIF(btrim(NEW.response_text),'') IS DISTINCT FROM NULLIF(btrim(OLD.response_text),'') AND NULLIF(btrim(NEW.response_text),'') IS NOT NULL THEN
      SELECT CASE WHEN NEW.response_by=b.student_id THEN 'STUDENT' ELSE 'PROVIDER' END INTO v_role
      FROM public.booking_disputes d JOIN public.bookings b ON b.id=d.booking_id WHERE d.id=NEW.id;
      INSERT INTO public.booking_dispute_messages(dispute_id,author_id,author_role,message_type,content) VALUES(NEW.id,NEW.response_by,COALESCE(v_role,'PROVIDER'),'RESPONSE',btrim(NEW.response_text));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_booking_dispute(p_dispute_id UUID, p_response_text TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
DECLARE v_uid UUID:=auth.uid(); v_dispute public.booking_disputes%ROWTYPE; v_booking public.bookings%ROWTYPE; v_provider_user UUID; v_allowed BOOLEAN:=false;
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
  UPDATE public.booking_disputes SET response_by=v_uid,response_text=btrim(p_response_text),responded_at=NOW(),status='UNDER_REVIEW',information_request=NULL,updated_at=NOW() WHERE id=p_dispute_id RETURNING * INTO v_dispute;
  RETURN to_jsonb(v_dispute);
END; $$;
REVOKE ALL ON FUNCTION public.respond_booking_dispute(UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_booking_dispute(UUID,TEXT) TO authenticated;
