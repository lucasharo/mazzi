-- TASK-089 hotfix: the internal match hold must serialize the student's
-- bookings without calling lock_student_profile(), which intentionally
-- requires auth.uid() to be that student.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'create_instant_booking_hold'
     AND pg_get_function_identity_arguments(p.oid) =
       'p_offer_id uuid, p_quote_id uuid, p_student_id uuid, p_idempotency_key character varying, p_hold_duration_minutes integer';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_HOLD_FUNCTION_NOT_FOUND';
  END IF;

  v_updated_definition := replace(
    v_definition,
    'PERFORM public.lock_student_profile(p_student_id);',
    'PERFORM pg_advisory_xact_lock(hashtextextended(''student-profile:'' || p_student_id::text, 0));'
  );
  IF v_updated_definition = v_definition THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_HOLD_LOCK_NOT_FOUND';
  END IF;
  EXECUTE v_updated_definition;
END;
$migration$;
