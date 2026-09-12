-- TASK-087 — DEV-only FCM delivery ledger and server-side dispatch contract.
-- The notification row remains the canonical history. Delivery rows are
-- private implementation state and are never exposed through the Data API.

BEGIN;

CREATE TABLE IF NOT EXISTS public.push_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.user_push_devices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('WEB_PUSH', 'FCM')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'RETRY', 'FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0 AND attempt_count <= 3),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  external_message_id TEXT,
  error_message TEXT,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notification_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_dispatch
  ON public.push_deliveries(status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_notification
  ON public.push_deliveries(notification_id, device_id);

ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_deliveries FROM PUBLIC, anon, authenticated;

-- Only server-side code can claim a delivery. The row lock and bounded
-- attempts make retries idempotent under concurrent webhook invocations.
CREATE OR REPLACE FUNCTION public.claim_push_delivery(p_delivery_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery public.push_deliveries;
BEGIN
  SELECT * INTO v_delivery
  FROM public.push_deliveries
  WHERE id = p_delivery_id
    AND status IN ('PENDING', 'RETRY')
    AND attempt_count < 3
    AND next_attempt_at <= NOW()
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.push_deliveries
  SET status = 'PROCESSING',
      attempt_count = attempt_count + 1,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_delivery.id
  RETURNING * INTO v_delivery;

  RETURN jsonb_build_object(
    'id', v_delivery.id,
    'notification_id', v_delivery.notification_id,
    'device_id', v_delivery.device_id,
    'attempt_count', v_delivery.attempt_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_push_delivery(
  p_delivery_id UUID,
  p_status TEXT,
  p_external_message_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_retry_after_seconds INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT := UPPER(BTRIM(p_status));
BEGIN
  IF v_status NOT IN ('SENT', 'RETRY', 'FAILED') THEN
    RAISE EXCEPTION 'INVALID_PUSH_DELIVERY_STATUS' USING ERRCODE = '22023';
  END IF;
  UPDATE public.push_deliveries
  SET status = v_status,
      external_message_id = NULLIF(BTRIM(p_external_message_id), ''),
      error_message = CASE WHEN v_status IN ('RETRY', 'FAILED') THEN LEFT(NULLIF(BTRIM(p_error_message), ''), 500) ELSE NULL END,
      next_attempt_at = CASE WHEN v_status = 'RETRY' THEN NOW() + MAKE_INTERVAL(secs => GREATEST(COALESCE(p_retry_after_seconds, 60), 1)) ELSE next_attempt_at END,
      sent_at = CASE WHEN v_status = 'SENT' THEN NOW() ELSE sent_at END,
      updated_at = NOW()
  WHERE id = p_delivery_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_push_device(p_device_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.user_push_devices
  SET disabled_at = NOW(), invalidated_at = NOW(), updated_at = NOW()
  WHERE id = p_device_id;
END;
$$;

-- Build the fan-out ledger at the same transaction boundary as the canonical
-- notification. A device that registers later is eligible for later events;
-- it is intentionally not backfilled into old notifications.
CREATE OR REPLACE FUNCTION public.enqueue_notification_push_deliveries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.push_deliveries (notification_id, device_id, provider)
  SELECT NEW.id, d.id, d.provider
  FROM public.user_push_devices AS d
  WHERE d.user_id = NEW.user_id
    AND d.app_context = NEW.app_context
    AND d.provider = 'FCM'
    AND d.disabled_at IS NULL
    AND d.invalidated_at IS NULL
  ON CONFLICT (notification_id, device_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_notification_push_deliveries ON public.notifications;
CREATE TRIGGER enqueue_notification_push_deliveries
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_notification_push_deliveries();

-- Keep the existing RPC surface, but restrict registration to real Student or
-- PRO identities. auth.uid() remains the only source of ownership.
CREATE OR REPLACE FUNCTION public.register_my_push_device(
  p_provider TEXT,
  p_app_context TEXT,
  p_device_fingerprint TEXT,
  p_endpoint TEXT,
  p_public_key TEXT DEFAULT NULL,
  p_auth_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_can_register BOOLEAN;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_provider NOT IN ('WEB_PUSH', 'FCM') OR p_app_context NOT IN ('STUDENT', 'PRO') THEN
    RAISE EXCEPTION 'INVALID_PUSH_DEVICE' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid AND u.status = 'ACTIVE'::public.user_status
      AND ((p_app_context = 'STUDENT' AND u.role::TEXT = 'STUDENT')
        OR (p_app_context = 'PRO' AND u.role::TEXT IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF')))
    UNION ALL
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ((p_app_context = 'STUDENT' AND ur.role::TEXT = 'STUDENT')
        OR (p_app_context = 'PRO' AND ur.role::TEXT IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'SCHOOL_STAFF')))
  ) INTO v_can_register;
  IF NOT v_can_register THEN
    RAISE EXCEPTION 'INVALID_PUSH_CONTEXT' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(p_device_fingerprint), '') IS NULL OR char_length(p_device_fingerprint) > 128
     OR NULLIF(BTRIM(p_endpoint), '') IS NULL OR char_length(p_endpoint) > 2048 THEN
    RAISE EXCEPTION 'INVALID_PUSH_DEVICE' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_push_devices (user_id, app_context, provider, device_fingerprint, endpoint, public_key, auth_key, last_seen_at, disabled_at, invalidated_at, updated_at)
  VALUES (v_uid, p_app_context, p_provider, BTRIM(p_device_fingerprint), BTRIM(p_endpoint), NULLIF(BTRIM(p_public_key), ''), NULLIF(BTRIM(p_auth_key), ''), NOW(), NULL, NULL, NOW())
  ON CONFLICT (user_id, app_context, provider, device_fingerprint) DO UPDATE
    SET endpoint = EXCLUDED.endpoint,
        public_key = EXCLUDED.public_key,
        auth_key = EXCLUDED.auth_key,
        last_seen_at = NOW(),
        disabled_at = NULL,
        invalidated_at = NULL,
        updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_delivery(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_push_delivery(UUID, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invalidate_push_device(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_notification_push_deliveries() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_my_push_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_delivery(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_push_delivery(UUID, TEXT, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_push_device(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_my_push_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
