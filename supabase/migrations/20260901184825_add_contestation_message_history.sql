CREATE TABLE IF NOT EXISTS public.booking_dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.booking_disputes(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author_role VARCHAR(20) NOT NULL CHECK (author_role IN ('STUDENT','PROVIDER','ADMIN')),
  message_type VARCHAR(30) NOT NULL CHECK (message_type IN ('DESCRIPTION','RESPONSE','INFORMATION_REQUEST')),
  content TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS booking_dispute_messages_dispute_created_idx ON public.booking_dispute_messages(dispute_id, created_at);
ALTER TABLE public.booking_dispute_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.booking_dispute_messages TO authenticated;
DROP POLICY IF EXISTS booking_dispute_messages_participant_select ON public.booking_dispute_messages;
CREATE POLICY booking_dispute_messages_participant_select ON public.booking_dispute_messages FOR SELECT TO authenticated USING (
  author_id=(SELECT auth.uid()) OR public.current_user_has_permission('admin.finance.read_all'::public.app_permission)
  OR EXISTS (SELECT 1 FROM public.booking_disputes d JOIN public.bookings b ON b.id=d.booking_id JOIN public.providers p ON p.id=b.provider_id WHERE d.id=dispute_id AND (b.student_id=(SELECT auth.uid()) OR p.user_id=(SELECT auth.uid())))
);

INSERT INTO public.booking_dispute_messages(dispute_id,author_id,author_role,message_type,content,created_at)
SELECT d.id,d.opened_by,d.opened_by_role,'DESCRIPTION',d.description,d.created_at
FROM public.booking_disputes d
WHERE NOT EXISTS (SELECT 1 FROM public.booking_dispute_messages m WHERE m.dispute_id=d.id AND m.message_type='DESCRIPTION');
INSERT INTO public.booking_dispute_messages(dispute_id,author_id,author_role,message_type,content,created_at)
SELECT d.id,d.response_by,CASE WHEN d.opened_by_role='STUDENT' THEN 'PROVIDER' ELSE 'STUDENT' END,'RESPONSE',d.response_text,COALESCE(d.responded_at,d.updated_at)
FROM public.booking_disputes d
WHERE NULLIF(btrim(d.response_text),'') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.booking_dispute_messages m WHERE m.dispute_id=d.id AND m.message_type='RESPONSE');

CREATE OR REPLACE FUNCTION public.capture_booking_dispute_message_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public, pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.booking_dispute_messages(dispute_id,author_id,author_role,message_type,content,created_at) VALUES(NEW.id,NEW.opened_by,NEW.opened_by_role,'DESCRIPTION',NEW.description,NEW.created_at);
  ELSE
    IF NULLIF(btrim(NEW.information_request),'') IS DISTINCT FROM NULLIF(btrim(OLD.information_request),'') AND NULLIF(btrim(NEW.information_request),'') IS NOT NULL THEN
      INSERT INTO public.booking_dispute_messages(dispute_id,author_id,author_role,message_type,content) VALUES(NEW.id,auth.uid(),'ADMIN', 'INFORMATION_REQUEST',btrim(NEW.information_request));
    END IF;
    IF NULLIF(btrim(NEW.response_text),'') IS DISTINCT FROM NULLIF(btrim(OLD.response_text),'') AND NULLIF(btrim(NEW.response_text),'') IS NOT NULL THEN
      INSERT INTO public.booking_dispute_messages(dispute_id,author_id,author_role,message_type,content) VALUES(NEW.id,NEW.response_by,CASE WHEN NEW.opened_by_role='STUDENT' THEN 'PROVIDER' ELSE 'STUDENT' END,'RESPONSE',btrim(NEW.response_text));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_capture_booking_dispute_message_history ON public.booking_disputes;
CREATE TRIGGER trg_capture_booking_dispute_message_history AFTER INSERT OR UPDATE OF information_request,response_text ON public.booking_disputes FOR EACH ROW EXECUTE FUNCTION public.capture_booking_dispute_message_history();

CREATE OR REPLACE FUNCTION public.get_booking_dispute_messages(p_dispute_id UUID)
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path TO public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.created_at),'[]'::JSONB)
  FROM public.booking_dispute_messages m WHERE m.dispute_id=p_dispute_id;
$$;
REVOKE ALL ON FUNCTION public.get_booking_dispute_messages(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_dispute_messages(UUID) TO authenticated;
