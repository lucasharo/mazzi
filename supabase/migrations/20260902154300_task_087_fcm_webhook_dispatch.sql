-- TASK-087 — DEV-only asynchronous notification dispatch.
-- The secret is provisioned in Supabase Vault; it is never committed here.

BEGIN;

CREATE OR REPLACE FUNCTION public.dispatch_notification_push_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret
    INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'FCM_WEBHOOK_SECRET'
  LIMIT 1;

  IF NULLIF(v_secret, '') IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://bhvpkgonhlujmxvwnxix.supabase.co/functions/v1/dispatch-push-notification',
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'notifications',
        'schema', 'public',
        'record', jsonb_build_object('id', NEW.id),
        'old_record', NULL
      ),
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-mazzi-dispatch-secret', v_secret
      ),
      timeout_milliseconds := 5000
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_notification_push_webhook() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS dispatch_notification_push_webhook ON public.notifications;
CREATE TRIGGER dispatch_notification_push_webhook
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.dispatch_notification_push_webhook();

COMMIT;
