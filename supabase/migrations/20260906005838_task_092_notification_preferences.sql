-- TASK-092 — Per-user notification preferences
-- DEV only. Preferences default to enabled when no row exists.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'NEW_MESSAGE', 'STUDENT_CHECKIN',
    'PROVIDER_CHECKIN', 'PROVIDER_ON_THE_WAY', 'LESSON_STARTED', 'LESSON_COMPLETED',
    'CONTESTATION_UPDATED', 'COMPLIANCE_PENDING', 'PAYOUT_PAID', 'PAYOUT_BLOCKED',
    'PAYOUT_FAILED', 'INSTANT_LESSON_OFFER', 'REVIEW_AVAILABLE', 'REVIEW_RECEIVED'
  )),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, notification_type)
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_notification_preferences FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS user_notification_preferences_no_direct_client_access ON public.user_notification_preferences;
CREATE POLICY user_notification_preferences_no_direct_client_access
  ON public.user_notification_preferences
  FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user
  ON public.user_notification_preferences(user_id, notification_type);

CREATE OR REPLACE FUNCTION public.get_my_notification_preferences()
RETURNS TABLE(notification_type TEXT, enabled BOOLEAN)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.notification_type, p.enabled
  FROM public.user_notification_preferences p
  WHERE p.user_id = (SELECT auth.uid())
  ORDER BY p.notification_type;
$$;

CREATE OR REPLACE FUNCTION public.set_my_notification_preference(
  p_notification_type TEXT,
  p_enabled BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'NOTIFICATION_ENABLED_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF p_notification_type IS NULL OR p_notification_type NOT IN (
    'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'NEW_MESSAGE', 'STUDENT_CHECKIN',
    'PROVIDER_CHECKIN', 'PROVIDER_ON_THE_WAY', 'LESSON_STARTED', 'LESSON_COMPLETED',
    'CONTESTATION_UPDATED', 'COMPLIANCE_PENDING', 'PAYOUT_PAID', 'PAYOUT_BLOCKED',
    'PAYOUT_FAILED', 'INSTANT_LESSON_OFFER', 'REVIEW_AVAILABLE', 'REVIEW_RECEIVED'
  ) THEN
    RAISE EXCEPTION 'NOTIFICATION_TYPE_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_notification_preferences (user_id, notification_type, enabled)
  VALUES (v_uid, p_notification_type, p_enabled)
  ON CONFLICT (user_id, notification_type) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        updated_at = NOW();

  RETURN p_enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_notification_preferences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_notification_preferences() TO authenticated;
REVOKE ALL ON FUNCTION public.set_my_notification_preference(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_notification_preference(TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.filter_disabled_notifications()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_notification_preferences p
    WHERE p.user_id = NEW.user_id
      AND p.notification_type = NEW.type
      AND p.enabled = FALSE
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS filter_disabled_notifications_before_insert ON public.notifications;
CREATE TRIGGER filter_disabled_notifications_before_insert
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.filter_disabled_notifications();

REVOKE ALL ON FUNCTION public.filter_disabled_notifications() FROM PUBLIC, anon, authenticated;

COMMIT;
