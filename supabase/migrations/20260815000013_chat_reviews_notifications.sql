-- ============================================================================
-- MAZZI — Sprint 13: secure booking chat, reviews, and in-app notifications
-- ============================================================================

BEGIN;

-- Existing Sprint 01 tables already include conversations, messages and reviews.
-- Sprint 13 extends them safely instead of creating duplicates.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES public.providers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.conversations c
SET provider_id = b.provider_id,
    updated_at = GREATEST(c.created_at, c.updated_at)
FROM public.bookings b
WHERE b.id = c.booking_id
  AND c.provider_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE provider_id IS NULL) THEN
    ALTER TABLE public.conversations ALTER COLUMN provider_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN (
      'BOOKING_CONFIRMED',
      'BOOKING_CANCELLED',
      'NEW_MESSAGE',
      'LESSON_COMPLETED',
      'REVIEW_AVAILABLE',
      'REVIEW_RECEIVED'
    )
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversations_booking_id ON public.conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_conversations_provider_id ON public.conversations(provider_id);
CREATE INDEX IF NOT EXISTS idx_conversations_student_id ON public.conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_conversations_instructor_id ON public.conversations(instructor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_reviews_provider_created_at ON public.reviews(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_student_id ON public.reviews(student_id);
CREATE INDEX IF NOT EXISTS idx_reviews_instructor_id ON public.reviews(instructor_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created_at
  ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON public.notifications(entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_lesson_events
  ON public.notifications(user_id, type, entity_type, entity_id)
  WHERE type IN ('LESSON_COMPLETED', 'REVIEW_AVAILABLE');

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_booking_participant(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.providers p ON p.id = b.provider_id
    WHERE b.id = p_booking_id
      AND auth.uid() IS NOT NULL
      AND public.is_current_user_active()
      AND (
        b.student_id = auth.uid()
        OR b.instructor_id = auth.uid()
        OR p.user_id = auth.uid()
        OR public.is_school_member(b.provider_id)
        OR public.is_platform_admin()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND public.is_booking_participant(c.booking_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_provider_reviews(p_provider_id UUID, p_student_id UUID, p_instructor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_current_user_active()
    AND (
      p_student_id = auth.uid()
      OR p_instructor_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.providers p
        WHERE p.id = p_provider_id
          AND p.user_id = auth.uid()
      )
      OR public.is_school_member(p_provider_id)
      OR public.is_platform_admin()
    );
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation_for_booking(p_booking_id UUID)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_conversation public.conversations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_booking_participant(p_booking_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversations (
    booking_id,
    student_id,
    provider_id,
    instructor_id,
    updated_at
  )
  VALUES (
    v_booking.id,
    v_booking.student_id,
    v_booking.provider_id,
    v_booking.instructor_id,
    NOW()
  )
  ON CONFLICT (booking_id) DO UPDATE
  SET provider_id = EXCLUDED.provider_id,
      student_id = EXCLUDED.student_id,
      instructor_id = EXCLUDED.instructor_id,
      updated_at = public.conversations.updated_at
  RETURNING * INTO v_conversation;

  RETURN v_conversation;
END;
$$;

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

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT DISTINCT recipient_id,
    'NEW_MESSAGE',
    'Nova mensagem',
    'Você recebeu uma nova mensagem sobre uma aula agendada.',
    'conversation',
    p_conversation_id
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

CREATE OR REPLACE FUNCTION public.create_review_for_booking(
  p_booking_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL
)
RETURNS public.reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_review public.reviews%ROWTYPE;
  v_rating_average NUMERIC;
  v_rating_count INTEGER;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'REVIEW_RATING_OUT_OF_RANGE' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.student_id <> v_student THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_booking.instructor_id = v_student THEN
    RAISE EXCEPTION 'PROVIDER_CANNOT_REVIEW_SELF' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status::TEXT <> 'COMPLETED' THEN
    RAISE EXCEPTION 'REVIEW_REQUIRES_COMPLETED_BOOKING' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.reviews (
    booking_id,
    student_id,
    provider_id,
    instructor_id,
    rating_overall,
    comment,
    updated_at
  )
  VALUES (
    v_booking.id,
    v_booking.student_id,
    v_booking.provider_id,
    v_booking.instructor_id,
    p_rating,
    NULLIF(BTRIM(COALESCE(p_comment, '')), ''),
    NOW()
  )
  RETURNING * INTO v_review;

  SELECT COALESCE(ROUND(AVG(rating_overall)::NUMERIC, 2), 0.00), COUNT(*)::INTEGER
  INTO v_rating_average, v_rating_count
  FROM public.reviews
  WHERE provider_id = v_booking.provider_id;

  UPDATE public.providers
  SET rating_average = v_rating_average,
      rating_count = v_rating_count,
      updated_at = NOW()
  WHERE id = v_booking.provider_id;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT DISTINCT recipient_id,
    'REVIEW_RECEIVED',
    'Nova avaliação recebida',
    'Um aluno avaliou uma aula concluída.',
    'review',
    v_review.id
  FROM (
    SELECT v_booking.instructor_id AS recipient_id
    UNION ALL
    SELECT p.user_id
    FROM public.providers p
    WHERE p.id = v_booking.provider_id
  ) recipients
  WHERE recipient_id IS NOT NULL
    AND recipient_id <> v_student;

  RETURN v_review;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_booking_completion_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status::TEXT = 'COMPLETED'
    AND (OLD.status IS NULL OR OLD.status::TEXT IS DISTINCT FROM NEW.status::TEXT) THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES
      (
        NEW.student_id,
        'LESSON_COMPLETED',
        'Aula concluída',
        'Sua aula foi marcada como concluída.',
        'booking',
        NEW.id
      ),
      (
        NEW.student_id,
        'REVIEW_AVAILABLE',
        'Avaliação disponível',
        'Avalie sua aula para ajudar outros alunos da MAZZI.',
        'booking',
        NEW.id
      )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_completion_notifications ON public.bookings;
CREATE TRIGGER trg_booking_completion_notifications
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.create_booking_completion_notifications();

DROP POLICY IF EXISTS "Public can view reviews" ON public.reviews;

DROP POLICY IF EXISTS conversations_select_participants ON public.conversations;
CREATE POLICY conversations_select_participants
ON public.conversations
FOR SELECT
TO authenticated
USING (public.is_booking_participant(booking_id));

DROP POLICY IF EXISTS messages_select_participants ON public.messages;
CREATE POLICY messages_select_participants
ON public.messages
FOR SELECT
TO authenticated
USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS reviews_select_authorized ON public.reviews;
CREATE POLICY reviews_select_authorized
ON public.reviews
FOR SELECT
TO authenticated
USING (public.can_access_provider_reviews(provider_id, student_id, instructor_id));

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (public.is_current_user_active() AND user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_read_own ON public.notifications;
CREATE POLICY notifications_update_read_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (public.is_current_user_active() AND user_id = auth.uid())
WITH CHECK (public.is_current_user_active() AND user_id = auth.uid());

REVOKE ALL ON TABLE public.conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.reviews FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.conversations TO authenticated;
GRANT SELECT ON TABLE public.messages TO authenticated;
GRANT SELECT ON TABLE public.reviews TO authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (is_read, read_at) ON TABLE public.notifications TO authenticated;

REVOKE ALL ON FUNCTION public.is_booking_participant(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_conversation_participant(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_access_provider_reviews(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_conversation_for_booking(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_message(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_review_for_booking(UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_booking_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_provider_reviews(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation_for_booking(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_review_for_booking(UUID, INTEGER, TEXT) TO authenticated;

COMMIT;
