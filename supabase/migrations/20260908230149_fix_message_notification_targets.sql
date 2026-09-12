-- Chat notifications must target the booking, not the internal conversation.
-- The booking is the canonical navigation target for both Student and PRO.

BEGIN;

UPDATE public.notifications n
SET entity_type = 'booking',
    entity_id = c.booking_id,
    navigation_action = 'chat'
FROM public.conversations c
WHERE n.type = 'NEW_MESSAGE'
  AND n.entity_type = 'conversation'
  AND n.entity_id = c.id;

CREATE OR REPLACE FUNCTION public.send_message(p_conversation_id UUID, p_body TEXT)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_body TEXT := BTRIM(COALESCE(p_body, ''));
  v_conversation public.conversations%ROWTYPE;
  v_message public.messages%ROWTYPE;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF LENGTH(v_body) = 0 THEN
    RAISE EXCEPTION 'MESSAGE_EMPTY' USING ERRCODE = '22023';
  END IF;

  IF LENGTH(v_body) > 2000 THEN
    RAISE EXCEPTION 'MESSAGE_TOO_LONG' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVERSATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (p_conversation_id, v_sender, v_body)
  RETURNING * INTO v_message;

  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = p_conversation_id;

  INSERT INTO public.notifications (
    user_id, type, title, body, entity_type, entity_id
  )
  SELECT DISTINCT
    recipient_id,
    'NEW_MESSAGE',
    'Nova mensagem',
    'Você recebeu uma nova mensagem sobre uma aula agendada.',
    'booking',
    v_conversation.booking_id
  FROM (
    SELECT v_conversation.student_id AS recipient_id
    UNION ALL
    SELECT v_conversation.instructor_id
    UNION ALL
    SELECT p.user_id
    FROM public.providers p
    WHERE p.id = v_conversation.provider_id
  ) recipients
  WHERE recipient_id IS NOT NULL
    AND recipient_id <> v_sender;

  RETURN v_message;
END;
$$;

REVOKE ALL ON FUNCTION public.send_message(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT) TO authenticated;

COMMIT;
