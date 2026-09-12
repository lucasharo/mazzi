-- Notification catalog and dispatch alignment for DEV.
-- PRO receives operational and financial attention events, but not lesson
-- lifecycle confirmations or student reviews. Students keep lesson lifecycle
-- and review-available notifications.

BEGIN;

-- Lesson lifecycle events are student-facing only. Booking confirmation,
-- cancellation, check-in and chat continue to use all relevant participants.
CREATE OR REPLACE FUNCTION public.notify_booking_participants(
  p_booking_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT DISTINCT recipient_id,
    p_type,
    p_title,
    p_body,
    'booking',
    p_booking_id
  FROM (
    SELECT v_booking.student_id AS recipient_id
    UNION ALL
    SELECT v_booking.instructor_id
    WHERE p_type NOT IN ('LESSON_STARTED', 'LESSON_COMPLETED')
    UNION ALL
    SELECT p.user_id
    FROM public.providers p
    WHERE p.id = v_booking.provider_id
      AND p_type NOT IN ('LESSON_STARTED', 'LESSON_COMPLETED')
  ) recipients
  WHERE recipient_id IS NOT NULL
    AND (p_exclude_user_id IS NULL OR recipient_id <> p_exclude_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_booking_participants(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_booking_participants(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;

-- Do not expose student reviews to the PRO notification center or push channel.
CREATE OR REPLACE FUNCTION public.filter_provider_review_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.type = 'REVIEW_RECEIVED'
     AND NEW.entity_type = 'review'
     AND public.resolve_notification_app_context(NEW.user_id, NEW.entity_type, NEW.entity_id) = 'PRO' THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS filter_provider_review_notifications_before_insert ON public.notifications;
CREATE TRIGGER filter_provider_review_notifications_before_insert
BEFORE INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.filter_provider_review_notifications();

REVOKE ALL ON FUNCTION public.filter_provider_review_notifications() FROM PUBLIC, anon, authenticated;

-- Keep historical provider review notifications out of the PRO center too.
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (
  public.is_current_user_active()
  AND user_id = auth.uid()
  AND NOT (app_context = 'PRO' AND type = 'REVIEW_RECEIVED')
);

DROP POLICY IF EXISTS notifications_update_read_own ON public.notifications;
CREATE POLICY notifications_update_read_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  public.is_current_user_active()
  AND user_id = auth.uid()
  AND NOT (app_context = 'PRO' AND type = 'REVIEW_RECEIVED')
)
WITH CHECK (
  public.is_current_user_active()
  AND user_id = auth.uid()
  AND NOT (app_context = 'PRO' AND type = 'REVIEW_RECEIVED')
);

-- Notify the participant expected to act and both participants after an
-- administrative resolution. The trigger covers opening, responses,
-- information requests and resolution updates.
CREATE OR REPLACE FUNCTION public.notify_booking_dispute_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID;
  v_provider_user_id UUID;
  v_actor_id UUID;
  v_title TEXT := 'Contestação atualizada';
  v_body TEXT := 'Há uma atualização na contestação da aula.';
  v_should_notify BOOLEAN := FALSE;
BEGIN
  SELECT b.student_id, p.user_id
  INTO v_student_id, v_provider_user_id
  FROM public.bookings b
  JOIN public.providers p ON p.id = b.provider_id
  WHERE b.id = NEW.booking_id;

  IF TG_OP = 'INSERT' THEN
    v_actor_id := NEW.opened_by;
    v_should_notify := TRUE;
  ELSE
    v_actor_id := COALESCE(NEW.response_by, NEW.resolved_by, auth.uid());
    v_should_notify := NEW.status IS DISTINCT FROM OLD.status
      OR NEW.information_request IS DISTINCT FROM OLD.information_request
      OR NEW.response_text IS DISTINCT FROM OLD.response_text
      OR NEW.resolution_code IS DISTINCT FROM OLD.resolution_code;
  END IF;

  IF NOT v_should_notify OR v_student_id IS NULL OR v_provider_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'RESOLVED' THEN
    v_title := 'Contestação analisada';
    v_body := 'A contestação da aula foi analisada e recebeu uma atualização.';
  ELSIF NEW.status IN ('AWAITING_STUDENT_RESPONSE', 'AWAITING_PROVIDER_RESPONSE') THEN
    v_title := 'Resposta necessária na contestação';
    v_body := 'Há uma atualização na contestação que precisa da sua atenção.';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT recipient_id,
    'CONTESTATION_UPDATED',
    v_title,
    v_body,
    'booking',
    NEW.booking_id
  FROM (
    SELECT v_student_id AS recipient_id
    WHERE NEW.status = 'RESOLVED'
       OR (NEW.status = 'AWAITING_STUDENT_RESPONSE')
       OR (NEW.status = 'UNDER_REVIEW' AND v_student_id <> COALESCE(NEW.response_by, v_actor_id))
       OR (NEW.status = 'OPEN' AND v_student_id <> v_actor_id)
    UNION ALL
    SELECT v_provider_user_id
    WHERE NEW.status = 'RESOLVED'
       OR (NEW.status = 'AWAITING_PROVIDER_RESPONSE')
       OR (NEW.status = 'UNDER_REVIEW' AND v_provider_user_id <> COALESCE(NEW.response_by, v_actor_id))
       OR (NEW.status = 'OPEN' AND v_provider_user_id <> v_actor_id)
  ) recipients
  WHERE recipient_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_booking_dispute_change_after_write ON public.booking_disputes;
CREATE TRIGGER notify_booking_dispute_change_after_write
AFTER INSERT OR UPDATE OF status, information_request, response_text, resolution_code
ON public.booking_disputes
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_dispute_change();

REVOKE ALL ON FUNCTION public.notify_booking_dispute_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_booking_dispute_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id UUID;
  v_provider_user_id UUID;
BEGIN
  SELECT b.student_id, p.user_id
  INTO v_student_id, v_provider_user_id
  FROM public.booking_disputes d
  JOIN public.bookings b ON b.id = d.booking_id
  JOIN public.providers p ON p.id = b.provider_id
  WHERE d.id = NEW.dispute_id;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT recipient_id,
    'CONTESTATION_UPDATED',
    'Contestação atualizada',
    'Uma nova evidência foi adicionada à contestação da aula.',
    'booking',
    d.booking_id
  FROM public.booking_disputes d
  CROSS JOIN LATERAL (
    VALUES (v_student_id), (v_provider_user_id)
  ) recipients(recipient_id)
  WHERE d.id = NEW.dispute_id
    AND recipient_id IS NOT NULL
    AND recipient_id <> NEW.uploaded_by
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_booking_dispute_evidence_after_insert ON public.booking_dispute_evidence;
CREATE TRIGGER notify_booking_dispute_evidence_after_insert
AFTER INSERT ON public.booking_dispute_evidence
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_dispute_evidence();

REVOKE ALL ON FUNCTION public.notify_booking_dispute_evidence() FROM PUBLIC, anon, authenticated;

-- Notify the PRO when a payout becomes available/paid, blocked or failed.
CREATE OR REPLACE FUNCTION public.notify_provider_payout_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_type TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_type := CASE NEW.status::TEXT
    WHEN 'AVAILABLE' THEN 'PAYOUT_PAID'
    WHEN 'PAID' THEN 'PAYOUT_PAID'
    WHEN 'BLOCKED' THEN 'PAYOUT_BLOCKED'
    WHEN 'FAILED' THEN 'PAYOUT_FAILED'
    ELSE NULL
  END;

  IF v_type IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.user_id INTO v_user_id
  FROM public.providers p
  WHERE p.id = NEW.provider_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_type = 'PAYOUT_PAID' THEN
    v_title := 'Recebimento liberado';
    v_body := 'Um recebimento foi liberado ou pago. Confira os detalhes em Ganhos.';
  ELSIF v_type = 'PAYOUT_BLOCKED' THEN
    v_title := 'Recebimento bloqueado';
    v_body := 'Um recebimento requer atenção. Confira os detalhes em Ganhos.';
  ELSE
    v_title := 'Falha no recebimento';
    v_body := 'Houve uma falha em um recebimento. Confira os detalhes em Ganhos.';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
  VALUES (v_user_id, v_type, v_title, v_body, 'payout', NEW.id, 'PRO', 'details')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_provider_payout_change_after_write ON public.payouts;
CREATE TRIGGER notify_provider_payout_change_after_write
AFTER INSERT OR UPDATE OF status
ON public.payouts
FOR EACH ROW
EXECUTE FUNCTION public.notify_provider_payout_change();

REVOKE ALL ON FUNCTION public.notify_provider_payout_change() FROM PUBLIC, anon, authenticated;

-- Compliance notifications are emitted for new, rejected or expired
-- requirements and are addressed to the relevant instructor/provider owner.
CREATE OR REPLACE FUNCTION public.notify_provider_compliance_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.status::TEXT NOT IN ('PENDING', 'IN_REVIEW', 'REJECTED', 'EXPIRED')
     OR (TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NEW.user_id, p.user_id)
  INTO v_user_id
  FROM public.providers p
  WHERE p.id = NEW.provider_id;

  IF v_user_id IS NULL THEN
    v_user_id := NEW.user_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, app_context, navigation_action)
  VALUES (
    v_user_id,
    'COMPLIANCE_PENDING',
    'Pendência de compliance',
    'Há uma pendência no seu credenciamento. Confira os documentos em Gestão.',
    'compliance',
    NEW.id,
    'PRO',
    'compliance'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_provider_compliance_pending_after_write ON public.compliance_documents;
CREATE TRIGGER notify_provider_compliance_pending_after_write
AFTER INSERT OR UPDATE OF status
ON public.compliance_documents
FOR EACH ROW
EXECUTE FUNCTION public.notify_provider_compliance_pending();

REVOKE ALL ON FUNCTION public.notify_provider_compliance_pending() FROM PUBLIC, anon, authenticated;

COMMIT;
