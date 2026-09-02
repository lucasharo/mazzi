-- TASK-086 — local-only contract for earnings destinations and push devices.
-- This migration is intentionally not applied to the remote DEV or production projects.

BEGIN;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS navigation_action TEXT;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'NEW_MESSAGE', 'STUDENT_CHECKIN',
    'PROVIDER_CHECKIN', 'LESSON_STARTED', 'LESSON_COMPLETED', 'CONTESTATION_UPDATED',
    'COMPLIANCE_PENDING', 'PAYOUT_PAID', 'PAYOUT_BLOCKED', 'PAYOUT_FAILED',
    'REVIEW_AVAILABLE', 'REVIEW_RECEIVED'
  ));

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_navigation_action_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_navigation_action_check CHECK (
    navigation_action IS NULL OR navigation_action IN ('details', 'chat', 'review', 'reviews', 'compliance')
  );

CREATE OR REPLACE FUNCTION public.assign_notification_navigation_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.navigation_action IS NULL THEN
    NEW.navigation_action := CASE
      WHEN NEW.type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'STUDENT_CHECKIN', 'PROVIDER_CHECKIN', 'LESSON_STARTED', 'CONTESTATION_UPDATED') THEN 'details'
      WHEN NEW.type = 'NEW_MESSAGE' THEN 'chat'
      WHEN NEW.type = 'LESSON_COMPLETED' AND NEW.app_context = 'STUDENT' THEN 'review'
      WHEN NEW.type IN ('PAYOUT_PAID', 'PAYOUT_BLOCKED', 'PAYOUT_FAILED') THEN 'details'
      WHEN NEW.type = 'COMPLIANCE_PENDING' THEN 'compliance'
      WHEN NEW.type = 'REVIEW_RECEIVED' THEN 'reviews'
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_notification_navigation_action ON public.notifications;
CREATE TRIGGER set_notification_navigation_action
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.assign_notification_navigation_action();

CREATE INDEX IF NOT EXISTS idx_notifications_navigation
  ON public.notifications(user_id, app_context, navigation_action, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  app_context TEXT NOT NULL CHECK (app_context IN ('STUDENT', 'PRO', 'ADMIN')),
  provider TEXT NOT NULL CHECK (provider IN ('WEB_PUSH', 'FCM')),
  device_fingerprint TEXT NOT NULL CHECK (char_length(device_fingerprint) BETWEEN 16 AND 128),
  endpoint TEXT NOT NULL CHECK (char_length(endpoint) BETWEEN 1 AND 2048),
  public_key TEXT,
  auth_key TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, app_context, provider, device_fingerprint)
);

ALTER TABLE public.user_push_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_push_devices FROM PUBLIC, anon, authenticated;

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
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_provider NOT IN ('WEB_PUSH', 'FCM') OR p_app_context NOT IN ('STUDENT', 'PRO', 'ADMIN') THEN
    RAISE EXCEPTION 'INVALID_PUSH_DEVICE' USING ERRCODE = '22023';
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

CREATE OR REPLACE FUNCTION public.disable_my_push_device(p_device_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  UPDATE public.user_push_devices
  SET disabled_at = NOW(), updated_at = NOW()
  WHERE id = p_device_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_provider_payout_detail(p_payout_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'PAYOUT_UNAVAILABLE' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'id', po.id,
    'status', po.status,
    'amount_in_cents', po.amount_in_cents,
    'scheduled_release_at', po.scheduled_release_at,
    'released_at', po.released_at,
    'processed_at', po.processed_at,
    'failure_reason', CASE WHEN po.status::TEXT IN ('FAILED', 'BLOCKED') THEN po.failure_reason ELSE NULL END
  ) INTO v_result
  FROM public.payouts po
  JOIN public.providers p ON p.id = po.provider_id
  WHERE po.id = p_payout_id
    AND ((p.type::TEXT = 'INSTRUCTOR' AND p.user_id = v_uid AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission))
      OR (p.type::TEXT = 'DRIVING_SCHOOL' AND public.current_user_has_permission('school.finance.read'::public.app_permission)
        AND (p.user_id = v_uid OR EXISTS (SELECT 1 FROM public.driving_school_staff dss WHERE dss.school_id = p.id AND dss.user_id = v_uid AND dss.is_active IS TRUE))));
  IF v_result IS NULL THEN RAISE EXCEPTION 'PAYOUT_UNAVAILABLE' USING ERRCODE = '42501'; END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_notification_navigation_action() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_my_push_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.disable_my_push_device(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_provider_payout_detail(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_my_push_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disable_my_push_device(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_provider_payout_detail(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_provider_upcoming_payouts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', po.id,
    'date', (po.scheduled_release_at AT TIME ZONE 'America/Sao_Paulo')::DATE,
    'status', po.status,
    'amount_in_cents', po.amount_in_cents,
    'failure_reason', CASE WHEN po.status::TEXT IN ('FAILED', 'BLOCKED') THEN po.failure_reason ELSE NULL END
  ) ORDER BY po.scheduled_release_at), '[]'::JSONB)
  INTO v_result
  FROM public.payouts po
  JOIN public.providers p ON p.id = po.provider_id
  WHERE po.scheduled_release_at >= NOW()
    AND po.scheduled_release_at < NOW() + INTERVAL '7 days'
    AND po.status::TEXT IN ('PENDING', 'AVAILABLE', 'PROCESSING', 'BLOCKED')
    AND ((p.type::TEXT = 'INSTRUCTOR' AND p.user_id = v_uid AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission))
      OR (p.type::TEXT = 'DRIVING_SCHOOL' AND public.current_user_has_permission('school.finance.read'::public.app_permission)
        AND (p.user_id = v_uid OR EXISTS (SELECT 1 FROM public.driving_school_staff dss WHERE dss.school_id = p.id AND dss.user_id = v_uid AND dss.is_active IS TRUE))));
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_provider_upcoming_payouts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_provider_upcoming_payouts() TO authenticated;

COMMIT;
