-- MAZZI — transactional email domain events
-- The triggers below only enqueue an internal outbox record. They never call
-- Resend and therefore cannot block or roll back a financial gateway call.

CREATE OR REPLACE FUNCTION public.queue_confirmed_email_deliveries(
  p_booking_id UUID,
  p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_student_email TEXT;
  v_instructor_email TEXT;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND OR v_booking.status::TEXT <> 'CONFIRMED' THEN RETURN; END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE id = p_payment_id AND booking_id = p_booking_id AND status = 'PAID';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT lower(btrim(email)) INTO v_student_email
    FROM public.users
   WHERE id = v_booking.student_id AND NULLIF(btrim(email), '') IS NOT NULL;
  IF v_student_email IS NOT NULL THEN
    PERFORM public.enqueue_email_delivery(
      'PAYMENT_CONFIRMED', 'student-payment-confirmed', v_booking.student_id, v_student_email,
      'STUDENT', 'PAYMENT', v_payment.id,
      'PAYMENT_CONFIRMED:' || v_payment.id::TEXT || ':' || v_booking.student_id::TEXT
    );
  END IF;

  -- The assigned instructor is the PRO recipient, including school/CFC bookings.
  SELECT lower(btrim(email)) INTO v_instructor_email
    FROM public.users
   WHERE id = v_booking.instructor_id AND NULLIF(btrim(email), '') IS NOT NULL;
  IF v_instructor_email IS NOT NULL THEN
    PERFORM public.enqueue_email_delivery(
      'PRO_BOOKING_CONFIRMED', 'pro-booking-confirmed', v_booking.instructor_id, v_instructor_email,
      'PRO', 'BOOKING', v_booking.id,
      'PRO_BOOKING_CONFIRMED:' || v_booking.id::TEXT || ':' || v_booking.instructor_id::TEXT
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_cancellation_refund_requested_email(p_booking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_student_email TEXT;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND OR v_booking.status::TEXT NOT IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER') THEN RETURN; END IF;
  IF COALESCE(v_booking.refund_amount_in_cents, 0) <= 0 THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.refunds WHERE booking_id = p_booking_id) THEN RETURN; END IF;

  SELECT * INTO v_payment
    FROM public.payments
   WHERE booking_id = p_booking_id AND status IN ('PAID', 'PARTIALLY_REFUNDED')
   ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT lower(btrim(email)) INTO v_student_email
    FROM public.users
   WHERE id = v_booking.student_id AND NULLIF(btrim(email), '') IS NOT NULL;
  IF v_student_email IS NULL THEN RETURN; END IF;

  PERFORM public.enqueue_email_delivery(
    'CANCELLATION_REFUND_REQUESTED', 'student-cancellation-refund', v_booking.student_id, v_student_email,
    'STUDENT', 'BOOKING', v_booking.id,
    'CANCELLATION_REFUND_REQUESTED:' || v_booking.id::TEXT || ':' || v_booking.student_id::TEXT
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_refund_completed_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_student_email TEXT;
BEGIN
  IF NEW.status <> 'PROCESSED' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = NEW.booking_id;
  SELECT * INTO v_payment FROM public.payments WHERE id = NEW.payment_id AND booking_id = NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT lower(btrim(email)) INTO v_student_email FROM public.users
   WHERE id = v_booking.student_id AND NULLIF(btrim(email), '') IS NOT NULL;
  IF v_student_email IS NULL THEN RETURN NEW; END IF;

  PERFORM public.enqueue_email_delivery(
    'REFUND_COMPLETED', 'student-refund-completed', v_booking.student_id, v_student_email,
    'STUDENT', 'REFUND', NEW.id,
    'REFUND_COMPLETED:' || NEW.id::TEXT || ':' || v_booking.student_id::TEXT
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_payout_completed_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_recipient_id UUID;
  v_recipient_email TEXT;
BEGIN
  IF NEW.status::TEXT <> 'PAID' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT * INTO v_provider FROM public.providers WHERE id = NEW.provider_id;
  SELECT * INTO v_booking FROM public.bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  v_recipient_id := COALESCE(v_provider.user_id, v_booking.instructor_id);
  SELECT lower(btrim(email)) INTO v_recipient_email FROM public.users
   WHERE id = v_recipient_id AND NULLIF(btrim(email), '') IS NOT NULL;
  IF v_recipient_email IS NULL THEN RETURN NEW; END IF;

  PERFORM public.enqueue_email_delivery(
    'PRO_PAYOUT_COMPLETED', 'pro-payout-completed', v_recipient_id, v_recipient_email,
    'PRO', 'PAYOUT', NEW.id,
    'PRO_PAYOUT_COMPLETED:' || NEW.id::TEXT || ':' || v_recipient_id::TEXT
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_email_delivery_from_domain_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    IF NEW.status::TEXT = 'CONFIRMED' AND OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.queue_confirmed_email_deliveries(
        NEW.id,
        (SELECT p.id FROM public.payments p WHERE p.booking_id = NEW.id AND p.status = 'PAID' ORDER BY p.created_at DESC LIMIT 1)
      );
    ELSIF NEW.status::TEXT IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER')
      AND OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.queue_cancellation_refund_requested_email(NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' AND NEW.status = 'PAID' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.queue_confirmed_email_deliveries(NEW.booking_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_delivery_on_booking_domain_change ON public.bookings;
CREATE TRIGGER email_delivery_on_booking_domain_change
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.queue_email_delivery_from_domain_change();

DROP TRIGGER IF EXISTS email_delivery_on_payment_domain_change ON public.payments;
CREATE TRIGGER email_delivery_on_payment_domain_change
AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.queue_email_delivery_from_domain_change();

DROP TRIGGER IF EXISTS email_delivery_on_refund_domain_change ON public.refunds;
CREATE TRIGGER email_delivery_on_refund_domain_change
AFTER INSERT OR UPDATE OF status ON public.refunds
FOR EACH ROW EXECUTE FUNCTION public.queue_refund_completed_email();

DROP TRIGGER IF EXISTS email_delivery_on_payout_domain_change ON public.payouts;
CREATE TRIGGER email_delivery_on_payout_domain_change
AFTER INSERT OR UPDATE OF status ON public.payouts
FOR EACH ROW EXECUTE FUNCTION public.queue_payout_completed_email();

REVOKE ALL ON FUNCTION public.queue_confirmed_email_deliveries(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_cancellation_refund_requested_email(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_refund_completed_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_payout_completed_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_email_delivery_from_domain_change() FROM PUBLIC, anon, authenticated;

-- The worker claims one item atomically. The Edge Function can call this without
-- knowing an id, which lets pg_cron drain the outbox automatically.
CREATE OR REPLACE FUNCTION public.claim_next_email_delivery()
RETURNS SETOF public.email_deliveries
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT id
      FROM public.email_deliveries
     WHERE status = 'PENDING'
        OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '15 minutes')
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE public.email_deliveries AS delivery
     SET status = 'PROCESSING',
         attempt_count = delivery.attempt_count + 1,
         updated_at = NOW()
    FROM candidate
   WHERE delivery.id = candidate.id
  RETURNING delivery.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_email_delivery() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_email_delivery() TO service_role;

-- Schedule the HTTP worker when the standard Supabase Vault values already
-- exist. If they do not, the migration remains safe and can be re-run after
-- configuring project_url and email_delivery_token in Vault.
DO $schedule_email_worker$
DECLARE
  v_project_url TEXT;
  v_worker_token TEXT;
BEGIN
  SELECT decrypted_secret INTO v_project_url
    FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_worker_token
    FROM vault.decrypted_secrets WHERE name = 'email_delivery_token' LIMIT 1;

  IF NULLIF(v_project_url, '') IS NOT NULL AND NULLIF(v_worker_token, '') IS NOT NULL THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job WHERE jobname = 'mazzi-email-delivery-worker';
    PERFORM cron.schedule(
      'mazzi-email-delivery-worker', '* * * * *',
      $job$SELECT net.http_post(
        url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1), '/') || '/functions/v1/send-email-delivery',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-mazzi-email-delivery-token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_delivery_token' LIMIT 1)),
        body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', NOW()), timeout_milliseconds := 30000
      );$job$
    );
  END IF;
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN
  RAISE NOTICE 'Vault não disponível; configure o worker de e-mail pelo Dashboard.';
END;
$schedule_email_worker$;
