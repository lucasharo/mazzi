-- MAZZI — transactional email delivery infrastructure
-- This migration is intentionally independent from business-event wiring.

-- Stable, non-sequential references for user-facing emails and links.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS public_reference TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS public_reference TEXT;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS public_reference TEXT;

UPDATE public.bookings
   SET public_reference = 'MAZZI-LESSON-' || upper(substr(replace(id::text, '-', ''), 1, 10))
 WHERE public_reference IS NULL;

UPDATE public.payments
   SET public_reference = 'MAZZI-PAY-' || upper(substr(replace(id::text, '-', ''), 1, 10))
 WHERE public_reference IS NULL;

UPDATE public.payouts
   SET public_reference = 'MAZZI-PAYOUT-' || upper(substr(replace(id::text, '-', ''), 1, 10))
 WHERE public_reference IS NULL;

ALTER TABLE public.bookings
  ALTER COLUMN public_reference SET DEFAULT 'MAZZI-LESSON-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  ALTER COLUMN public_reference SET NOT NULL;

ALTER TABLE public.payments
  ALTER COLUMN public_reference SET DEFAULT 'MAZZI-PAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  ALTER COLUMN public_reference SET NOT NULL;

ALTER TABLE public.payouts
  ALTER COLUMN public_reference SET DEFAULT 'MAZZI-PAYOUT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  ALTER COLUMN public_reference SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_public_reference_unique
  ON public.bookings (public_reference);

CREATE UNIQUE INDEX IF NOT EXISTS payments_public_reference_unique
  ON public.payments (public_reference);

CREATE UNIQUE INDEX IF NOT EXISTS payouts_public_reference_unique
  ON public.payouts (public_reference);

CREATE TABLE IF NOT EXISTS public.email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'PAYMENT_CONFIRMED',
    'CANCELLATION_REFUND_REQUESTED',
    'REFUND_COMPLETED',
    'PRO_BOOKING_CONFIRMED',
    'PRO_PAYOUT_COMPLETED'
  )),
  template_name TEXT NOT NULL CHECK (template_name IN (
    'student-payment-confirmed',
    'student-cancellation-refund',
    'student-refund-completed',
    'pro-booking-confirmed',
    'pro-payout-completed'
  )),
  recipient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  recipient_email VARCHAR(255) NOT NULL,
  app_context TEXT NOT NULL CHECK (app_context IN ('STUDENT', 'PRO')),
  business_entity_type TEXT NOT NULL CHECK (business_entity_type IN ('BOOKING', 'PAYMENT', 'REFUND', 'PAYOUT')),
  business_entity_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  provider TEXT,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  UNIQUE (event_type, template_name, business_entity_id, recipient_user_id)
);

ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.email_deliveries TO service_role;

CREATE INDEX IF NOT EXISTS email_deliveries_pending_idx
  ON public.email_deliveries (status, created_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS email_deliveries_entity_idx
  ON public.email_deliveries (business_entity_type, business_entity_id);

CREATE OR REPLACE FUNCTION public.enqueue_email_delivery(
  p_event_type TEXT,
  p_template_name TEXT,
  p_recipient_user_id UUID,
  p_recipient_email TEXT,
  p_app_context TEXT,
  p_business_entity_type TEXT,
  p_business_entity_id UUID,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.email_deliveries (
    event_type, template_name, recipient_user_id, recipient_email, app_context,
    business_entity_type, business_entity_id, idempotency_key
  ) VALUES (
    p_event_type, p_template_name, p_recipient_user_id, lower(btrim(p_recipient_email)), p_app_context,
    p_business_entity_type, p_business_entity_id, p_idempotency_key
  )
  ON CONFLICT (event_type, template_name, business_entity_id, recipient_user_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
      FROM public.email_deliveries
     WHERE event_type = p_event_type
       AND template_name = p_template_name
       AND business_entity_id = p_business_entity_id
       AND recipient_user_id = p_recipient_user_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_email_delivery(p_delivery_id UUID)
RETURNS SETOF public.email_deliveries
LANGUAGE plpgsql
VOLATILE
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
     WHERE id = p_delivery_id
       AND (
         status = 'PENDING'
         OR (status = 'PROCESSING' AND updated_at < NOW() - INTERVAL '15 minutes')
       )
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_deliveries d
     SET status = 'PROCESSING',
         attempt_count = d.attempt_count + 1,
         failed_at = NULL,
         updated_at = NOW()
    FROM candidate c
   WHERE d.id = c.id
  RETURNING d.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_email_delivery(p_delivery_id UUID)
RETURNS SETOF public.email_deliveries
LANGUAGE plpgsql
VOLATILE
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE public.email_deliveries
     SET status = 'PENDING', updated_at = NOW(), last_error = NULL
   WHERE id = p_delivery_id AND status = 'FAILED'
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_email_delivery_sent(
  p_delivery_id UUID,
  p_provider TEXT,
  p_provider_message_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  UPDATE public.email_deliveries
     SET status = 'SENT', provider = p_provider, provider_message_id = p_provider_message_id,
         sent_at = COALESCE(sent_at, NOW()), failed_at = NULL, last_error = NULL, updated_at = NOW()
   WHERE id = p_delivery_id AND status = 'PROCESSING';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_email_delivery_failed(
  p_delivery_id UUID,
  p_error TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  UPDATE public.email_deliveries
     SET status = 'FAILED', last_error = left(COALESCE(p_error, 'EMAIL_DELIVERY_FAILED'), 1000),
         failed_at = NOW(), updated_at = NOW()
   WHERE id = p_delivery_id AND status = 'PROCESSING';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_email_delivery(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_email_delivery(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_email_delivery(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_email_delivery_sent(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_email_delivery_failed(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email_delivery(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_delivery(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_email_delivery(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_delivery_sent(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_delivery_failed(UUID, TEXT) TO service_role;
