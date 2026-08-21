-- Terminal historical bookings do not create a market-facing reservation and
-- must remain insertable for cancellation/expiry reconciliation paths.
CREATE OR REPLACE FUNCTION public.enforce_booking_instructor_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     AND COALESCE(NEW.status::TEXT, '') NOT IN ('CANCELLED', 'EXPIRED')
     AND NOT public.is_provider_instructor_eligible(NEW.provider_id, NEW.instructor_id, NULL) THEN
    RAISE EXCEPTION 'INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE = '42501';
  END IF;
  IF NEW.selection_mode IS NULL THEN NEW.selection_mode := 'SPECIFIC_INSTRUCTOR'; END IF;
  IF TG_OP = 'UPDATE'
     AND ((NEW.checkin_instructor_at IS DISTINCT FROM OLD.checkin_instructor_at AND NEW.checkin_instructor_at IS NOT NULL)
       OR (NEW.lesson_started_at IS DISTINCT FROM OLD.lesson_started_at AND NEW.lesson_started_at IS NOT NULL))
     AND NOT public.is_provider_instructor_eligible(NEW.provider_id, NEW.instructor_id, NULL) THEN
    RAISE EXCEPTION 'INSTRUCTOR_COMPLIANCE_INVALID_AT_LESSON_START' USING ERRCODE = '42501';
  END IF;
  IF NEW.snapshot_data IS NULL THEN
    NEW.snapshot_data := jsonb_build_object('selectionMode', NEW.selection_mode::TEXT);
  ELSIF NOT (NEW.snapshot_data ? 'selectionMode') THEN
    NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{selectionMode}', to_jsonb(NEW.selection_mode::TEXT), true);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_booking_instructor_eligibility() FROM PUBLIC, anon, authenticated;
