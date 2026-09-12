-- MAZZI — Expiração automática das reservas aguardando pagamento
-- A rotina é executada pelo pg_cron e registra a mudança no histórico de auditoria.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

CREATE OR REPLACE FUNCTION public.expire_pending_payment_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_expired_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE public.bookings
    SET status = 'EXPIRED',
        expired_at = COALESCE(expired_at, v_now),
        updated_at = v_now
    WHERE status = 'PENDING_PAYMENT'
      AND hold_expires_at IS NOT NULL
      AND hold_expires_at <= v_now
    RETURNING id, hold_expires_at, expired_at
  )
  INSERT INTO public.audit_logs (
    id,
    actor_id,
    action,
    entity_type,
    entity_id,
    previous_value,
    new_value,
    user_agent,
    created_at
  )
  SELECT
    gen_random_uuid(),
    NULL,
    'BOOKING_PAYMENT_HOLD_EXPIRED',
    'BOOKINGS',
    id::VARCHAR,
    jsonb_build_object(
      'status', 'PENDING_PAYMENT',
      'hold_expires_at', hold_expires_at
    ),
    jsonb_build_object(
      'status', 'EXPIRED',
      'expired_at', expired_at
    ),
    'Supabase Cron',
    v_now
  FROM expired;

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_pending_payment_bookings() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_pending_payment_bookings() TO postgres;

SELECT cron.schedule(
  'expire-pending-payment-bookings',
  '* * * * *',
  $$SELECT public.expire_pending_payment_bookings();$$
);
