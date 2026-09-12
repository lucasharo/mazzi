CREATE INDEX IF NOT EXISTS booking_dispute_evidence_dispute_idx ON public.booking_dispute_evidence(dispute_id);
CREATE INDEX IF NOT EXISTS booking_dispute_evidence_uploaded_by_idx ON public.booking_dispute_evidence(uploaded_by);
CREATE INDEX IF NOT EXISTS booking_disputes_opened_by_idx ON public.booking_disputes(opened_by);
CREATE INDEX IF NOT EXISTS booking_disputes_response_by_idx ON public.booking_disputes(response_by) WHERE response_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS booking_disputes_resolved_by_idx ON public.booking_disputes(resolved_by) WHERE resolved_by IS NOT NULL;
REVOKE ALL ON FUNCTION public.create_payout_after_lesson_completion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_pending_payouts_after_config_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_booking_disputes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_booking_disputes() TO authenticated;
DO $schedule_processor$
DECLARE v_project_url TEXT; v_cron_token TEXT;
BEGIN
  SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name='project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_cron_token FROM vault.decrypted_secrets WHERE name='payout_cron_token' LIMIT 1;
  IF NULLIF(v_project_url,'') IS NULL OR NULLIF(v_cron_token,'') IS NULL THEN
    RAISE EXCEPTION 'Payout cron secrets are missing';
  END IF;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname='process-automatic-stripe-payouts';
  PERFORM cron.schedule(
    'process-automatic-stripe-payouts', '* * * * *',
    $job$SELECT net.http_post(
      url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='project_url' LIMIT 1),'/') || '/functions/v1/process-automatic-stripe-payouts',
      headers := jsonb_build_object('Content-Type','application/json','x-mazzi-cron-token',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='payout_cron_token' LIMIT 1)),
      body := jsonb_build_object('scheduled_at',NOW()), timeout_milliseconds := 30000
    );$job$
  );
END;
$schedule_processor$;;
