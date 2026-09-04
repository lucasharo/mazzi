-- TASK-089: the PRO is expected to accept an offer for its own offering.
-- The normal Student checkout keeps SELF_BOOKING protection; this path has
-- already authorized the caller against the offer and must not apply the
-- student-side self-booking check to the instructor actor.
DO $migration$
DECLARE
  v_definition text;
  v_updated_definition text;
  v_self_booking_block text := E'  IF public.is_self_booking_context(v_quote.provider_id, v_quote.instructor_id) THEN\n    RAISE EXCEPTION ''SELF_BOOKING_NOT_ALLOWED'' USING ERRCODE = ''42501'';\n  END IF;\n';
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
  v_updated_definition := replace(v_definition, v_self_booking_block, '');
  IF v_updated_definition = v_definition THEN
    RAISE EXCEPTION 'INSTANT_BOOKING_HOLD_SELF_BOOKING_CHECK_NOT_FOUND';
  END IF;
  EXECUTE v_updated_definition;
END;
$migration$;
