-- Contestations use their own response flow. Freeze the lesson chat while a
-- contestation is active so messages cannot bypass the evidence/response log.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.bookings b ON b.id=c.booking_id
    WHERE c.id=p_conversation_id
      AND b.status <> 'DISPUTED'
      AND public.is_booking_participant(c.booking_id)
  );
$$;
REVOKE ALL ON FUNCTION public.is_conversation_participant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID) TO authenticated;
