-- Chat history remains visible during a contestation, but new chat messages
-- are rejected. Contestation responses must use the audited dispute flow.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id=p_conversation_id
      AND public.is_booking_participant(c.booking_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_message_during_contestation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.bookings b ON b.id=c.booking_id
    WHERE c.id=NEW.conversation_id AND b.status='DISPUTED'
  ) THEN
    RAISE EXCEPTION 'CHAT_BLOCKED_DURING_CONTESTATION' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_message_during_contestation ON public.messages;
CREATE TRIGGER trg_prevent_message_during_contestation
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.prevent_message_during_contestation();

REVOKE ALL ON FUNCTION public.is_conversation_participant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID) TO authenticated;
