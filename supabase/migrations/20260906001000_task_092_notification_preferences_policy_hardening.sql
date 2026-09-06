-- TASK-092 — Explicitly deny direct Data API access to preferences.
-- The authenticated RPCs remain the only application access path.

BEGIN;

DROP POLICY IF EXISTS user_notification_preferences_no_direct_client_access ON public.user_notification_preferences;
CREATE POLICY user_notification_preferences_no_direct_client_access
  ON public.user_notification_preferences
  FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

COMMIT;
